"""Response analyzer that extracts dimension-resolving information from user text.

Maps technical terms and phrases to channel/sub-dimension resolution updates.
Detects ambiguities that need clarification.
"""

import re
from dataclasses import dataclass


@dataclass
class DimensionUpdate:
    channel_id: str
    sub_dimension: str
    resolution: float
    constraint: str


@dataclass
class Ambiguity:
    text: str
    channel_id: str
    reason: str


# Pattern registry: (regex, channel_id, sub_dimension, resolution, constraint_template)
# Higher resolution = more specific constraint. Multiple matches on the same (channel, sub)
# are deduped — only the first match fires per analyze() call, but subsequent calls can
# raise resolution if the pattern yields a higher value (see update_resolution logic).
PATTERN_REGISTRY: list[tuple[str, str, str, float, str]] = [
    # ── Tech Stack ──
    (r"\b(?:python|Python)\s*(?:3\.?\d*)?", "tech_stack", "language", 0.9, "Language: Python"),
    (r"\b(?:typescript|TypeScript|TS)\b", "tech_stack", "language", 0.9, "Language: TypeScript"),
    (r"\b(?:golang|Go)\b", "tech_stack", "language", 0.9, "Language: Go"),
    (r"\b(?:java|Java)\s*(?:\d+)?", "tech_stack", "language", 0.9, "Language: Java"),
    (r"\b(?:rust|Rust)\b", "tech_stack", "language", 0.9, "Language: Rust"),
    (r"\b(?:ruby|Ruby)\b", "tech_stack", "language", 0.9, "Language: Ruby"),
    (r"\b(?:C#|csharp|\.NET)\b", "tech_stack", "language", 0.9, "Language: C#/.NET"),
    (r"\b(?:fastapi|FastAPI)\b", "tech_stack", "framework", 0.9, "Framework: FastAPI"),
    (r"\b(?:django|Django)\b", "tech_stack", "framework", 0.9, "Framework: Django"),
    (r"\b(?:flask|Flask)\b", "tech_stack", "framework", 0.9, "Framework: Flask"),
    (r"\b(?:express|Express(?:\.js)?)\b", "tech_stack", "framework", 0.9, "Framework: Express"),
    (r"\b(?:next\.?js|Next\.?js|NextJS)\b", "tech_stack", "framework", 0.9, "Framework: Next.js"),
    (r"\b(?:spring\s*boot|Spring\s*Boot)\b", "tech_stack", "framework", 0.9, "Framework: Spring Boot"),
    (r"\b(?:hono|Hono)\b", "tech_stack", "framework", 0.9, "Framework: Hono"),
    (r"\b(?:rails|Rails)\b", "tech_stack", "framework", 0.9, "Framework: Rails"),
    (r"\b(?:postgresql|postgres|PostgreSQL|Postgres)\b", "tech_stack", "database", 0.9, "Database: PostgreSQL"),
    (r"\b(?:mysql|MySQL)\b", "tech_stack", "database", 0.9, "Database: MySQL"),
    (r"\b(?:mongodb|MongoDB|Mongo)\b", "tech_stack", "database", 0.9, "Database: MongoDB"),
    (r"\b(?:sqlite|SQLite)\b", "tech_stack", "database", 0.8, "Database: SQLite"),
    (r"\b(?:dynamodb|DynamoDB)\b", "tech_stack", "database", 0.9, "Database: DynamoDB"),
    (r"\b(?:redis|Redis)\b", "tech_stack", "cache", 0.9, "Cache: Redis"),
    (r"\b(?:memcached|Memcached)\b", "tech_stack", "cache", 0.9, "Cache: Memcached"),
    (r"\b(?:rabbitmq|RabbitMQ)\b", "tech_stack", "message_queue", 0.9, "Message queue: RabbitMQ"),
    (r"\b(?:kafka|Kafka)\b", "tech_stack", "message_queue", 0.9, "Message queue: Kafka"),
    (r"\b(?:sqs|SQS)\b", "tech_stack", "message_queue", 0.9, "Message queue: AWS SQS"),
    (r"\bno\s+(?:message\s+queue|event\s+bus|broker)\b", "tech_stack", "message_queue", 0.9, "Message queue: none required"),
    (r"\b(?:prisma|Prisma)\s+(?:ORM)?", "tech_stack", "database", 0.9, "ORM: Prisma"),
    (r"\b(?:socket\.?io|Socket\.?IO)\b", "tech_stack", "framework", 0.8, "Realtime: Socket.io"),

    # ── Auth ──
    (r"\bJWT\b", "auth", "method", 0.8, "Auth: JWT tokens"),
    (r"\b(?:RS256|HS256|RS384|ES256)\b", "auth", "method", 0.9, "Auth: JWT signing algorithm specified"),
    (r"\bOAuth\s*2?\.?0?\b", "auth", "method", 0.8, "Auth: OAuth 2.0"),
    (r"\bAPI\s*key", "auth", "method", 0.7, "Auth: API key"),
    (r"\bsession[- ]?based\b", "auth", "session", 0.7, "Session: server-side sessions"),
    (r"\bRBAC\b", "auth", "authorization", 0.8, "Authorization: RBAC"),
    (r"\bABAC\b", "auth", "authorization", 0.8, "Authorization: ABAC"),
    (r"\b(?:role[- ]?based|roles?\s+and\s+permissions?)\b", "auth", "authorization", 0.6, "Authorization: role-based"),
    (r"\b(?:admin|member|viewer|editor|owner)\b.*(?:role|permission|can\s)", "auth", "authorization", 0.8, "Authorization: roles defined"),
    (r"\bMFA\b|multi[- ]?factor", "auth", "mfa", 0.8, "MFA required"),
    (r"\bno\s+(?:MFA|multi[- ]?factor)", "auth", "mfa", 0.9, "MFA: not required"),
    (r"\brefresh\s+token", "auth", "session", 0.8, "Session: refresh token rotation"),
    (r"\b\d+[- ]?(?:minute|min|hour|day)\s+(?:access|token|expir)", "auth", "session", 0.9, "Session: token TTL specified"),
    (r"\bdevice\s+fingerprint", "auth", "session", 0.9, "Session: device fingerprinting"),

    # ── Data Model ──
    # Entity detection — flexible: "User (email, name)" OR "User entity" OR "entities: User"
    (r"(?:entities?|models?|tables?|schemas?)\s*[:\-]?\s*\w+", "data_model", "entities", 0.6, "Entities defined"),
    (r"\b(?:User|Account|Profile)\s*\(", "data_model", "entities", 0.7, "Entity: User with attributes"),
    (r"\b(?:Task|Ticket|Issue|Item)\s*\(", "data_model", "entities", 0.7, "Entity: Task with attributes"),
    (r"\b(?:Team|Organization|Workspace|Group)\s*\(", "data_model", "entities", 0.7, "Entity: Team with attributes"),
    (r"\b(?:Comment|Note|Message)\s*\(", "data_model", "entities", 0.7, "Entity: Comment with attributes"),
    (r"\b(?:Project|Board|Sprint)\s*\(", "data_model", "entities", 0.7, "Entity: Project with attributes"),
    (r"\b(?:Order|Payment|Invoice)\s*\(", "data_model", "entities", 0.7, "Entity: Order with attributes"),
    (r"\b(?:Product|Catalog|Category)\s*\(", "data_model", "entities", 0.7, "Entity: Product with attributes"),
    # Catch "Core entities: X, Y, Z" pattern
    (r"(?:core\s+)?entit(?:y|ies)\s*[:=]\s*\w+", "data_model", "entities", 0.7, "Core entities listed"),
    # Catch entity attribute listings like "email, name, role" after entity name
    (r"\b\w+\s*\([^)]*(?:id|name|email|title|status|body|type|role|description)[^)]*\)", "data_model", "entities", 0.8, "Entity attributes specified"),
    # Relationships — flexible patterns
    (r"\bone[- ]?to[- ]?many\b", "data_model", "relationships", 0.7, "Relationship: one-to-many"),
    (r"\bmany[- ]?to[- ]?many\b", "data_model", "relationships", 0.7, "Relationship: many-to-many"),
    (r"\bone[- ]?to[- ]?one\b", "data_model", "relationships", 0.7, "Relationship: one-to-one"),
    (r"\bforeign\s+key\b", "data_model", "relationships", 0.7, "Relationship: foreign key constraints"),
    (r"\bbelongs?\s+to\b", "data_model", "relationships", 0.7, "Relationship: belongs-to"),
    (r"\bhas\s+(?:many|one|multiple)\b", "data_model", "relationships", 0.7, "Relationship: has-many/has-one"),
    (r"\w+\s+has\s+(?:many|one|multiple)\s+\w+", "data_model", "relationships", 0.8, "Relationship with entities specified"),
    # Cardinality — specific patterns
    (r"\b(?:can\s+a|does\s+a|each)\s+\w+\s+(?:belong|have|own)", "data_model", "cardinality", 0.6, "Cardinality rules discussed"),
    (r"\bassignee\b|\bassigned?\s+to\b", "data_model", "cardinality", 0.6, "Cardinality: assignment relationship"),
    (r"\bwatcher|subscriber|follower\b", "data_model", "cardinality", 0.6, "Cardinality: watcher/subscriber relationship"),
    (r"\bmember(?:s|ship)?\b.*\b(?:team|group|org)\b", "data_model", "cardinality", 0.7, "Cardinality: team membership"),
    (r"\b(?:one|single)\s+assignee\b", "data_model", "cardinality", 0.8, "Cardinality: single assignee constraint"),
    (r"\bmany\s+watchers?\b", "data_model", "cardinality", 0.8, "Cardinality: multiple watchers"),
    # Constraints
    (r"\bunique\s+(?:constraint|index|key)\b", "data_model", "constraints", 0.7, "Constraint: unique"),
    (r"\bnot\s+null\b", "data_model", "constraints", 0.6, "Constraint: not null"),
    (r"\benum\b|\bstatus\s+enum\b", "data_model", "constraints", 0.7, "Constraint: enum type"),
    (r"\b(?:backlog|todo|in.?progress|review|done)\b.*\b(?:backlog|todo|in.?progress|review|done)\b", "data_model", "constraints", 0.8, "Constraint: status enum values defined"),
    (r"\bvalidation\s+rules?\b", "data_model", "constraints", 0.6, "Constraint: validation rules"),
    (r"\b(?:required|optional)\s+(?:field|attribute|column)\b", "data_model", "constraints", 0.6, "Constraint: field requirements specified"),
    (r"\buuid\b", "data_model", "constraints", 0.6, "Constraint: UUID identifiers"),
    # Indexes
    (r"\bindex(?:es|ed)?\s+(?:on|for)\b", "data_model", "indexes", 0.7, "Index strategy specified"),
    (r"\bcompound\s+index\b", "data_model", "indexes", 0.8, "Index: compound index"),
    (r"\bquery\s+pattern", "data_model", "indexes", 0.6, "Index: query patterns described"),
    (r"\bsearch\s+(?:by|on|for)\b", "data_model", "indexes", 0.6, "Index: search patterns"),

    # ── API ──
    (r"\bREST(?:ful)?\b", "api", "endpoints", 0.5, "API style: REST"),
    (r"\bGraphQL\b", "api", "endpoints", 0.5, "API style: GraphQL"),
    (r"\bgRPC\b", "api", "endpoints", 0.5, "API style: gRPC"),
    # Endpoint listing patterns
    (r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+/\w+", "api", "endpoints", 0.8, "Endpoints: HTTP methods and routes defined"),
    (r"/api/v\d+/", "api", "endpoints", 0.8, "Endpoints: versioned routes"),
    (r"\bendpoints?\s*:.*(?:GET|POST|PUT|DELETE|/\w+)", "api", "endpoints", 0.8, "Endpoints listed"),
    # Request/response shapes
    (r"\b(?:request|req)\s+(?:body|shape|schema|format)", "api", "request_shapes", 0.7, "Request shapes described"),
    (r"\{[^}]*(?:string|number|boolean|uuid|int)[^}]*\}", "api", "request_shapes", 0.8, "Request shapes: typed fields defined"),
    (r"\bCreateTask\b|\bCreate\w+\s*\{", "api", "request_shapes", 0.8, "Request shape: creation DTO defined"),
    (r"\bUpdate\w+\s*\{", "api", "request_shapes", 0.7, "Request shape: update DTO defined"),
    (r"\b(?:response|res)\s+(?:body|shape|schema|format)", "api", "response_shapes", 0.7, "Response shapes described"),
    (r"\b(?:nested|includes?)\s+(?:assignee|author|user|comments?)\b", "api", "response_shapes", 0.8, "Response: nested object inclusions"),
    (r"\bResponse\s*:", "api", "response_shapes", 0.7, "Response shape defined"),
    (r"\bobject\s+with\s+(?:nested|included)", "api", "response_shapes", 0.7, "Response: nested objects"),
    # Realtime
    (r"\b(?:websocket|WebSocket|WS)\b", "api", "realtime", 0.8, "Realtime: WebSocket"),
    (r"\bSSE\b|server[- ]?sent\s+events?", "api", "realtime", 0.8, "Realtime: SSE"),
    (r"\bpolling\b", "api", "realtime", 0.6, "Realtime: polling"),
    (r"\b/ws/\w+", "api", "realtime", 0.9, "Realtime: WebSocket route defined"),
    (r"\blive\s+(?:updates?|sync|notifications?)\b", "api", "realtime", 0.7, "Realtime: live updates required"),
    # Versioning
    (r"\b/api/v\d+\b", "api", "versioning", 0.8, "API versioning: URL prefix /api/vN"),
    (r"\bv\d+\b.*(?:api|endpoint|version)", "api", "versioning", 0.7, "API versioning: URL path"),
    (r"\bheader[- ]?based\s+version", "api", "versioning", 0.7, "API versioning: header-based"),
    (r"\bAPI\s+version(?:ed|ing)\s+via", "api", "versioning", 0.8, "API versioning strategy specified"),
    # Pagination (cross-channel, lives under performance)
    (r"\bpagina(?:tion|ted)\b", "performance", "pagination", 0.6, "Pagination required"),
    (r"\bcursor[- ]?based\b", "performance", "pagination", 0.8, "Pagination: cursor-based"),
    (r"\boffset[- ]?based\b", "performance", "pagination", 0.7, "Pagination: offset-based"),
    (r"\b\d+\s+items?\s+(?:default|max|per\s+page)\b", "performance", "pagination", 0.8, "Pagination: page size specified"),

    # ── Deployment ──
    (r"\b(?:kubernetes|k8s|K8s|EKS|GKE|AKS)\b", "deployment", "infrastructure", 0.8, "Infrastructure: Kubernetes"),
    (r"\b(?:docker|Docker)\b", "deployment", "infrastructure", 0.6, "Infrastructure: Docker containers"),
    (r"\b(?:serverless|lambda|Lambda)\b", "deployment", "infrastructure", 0.8, "Infrastructure: serverless"),
    (r"\b(?:AWS|aws)\b", "deployment", "infrastructure", 0.5, "Cloud: AWS"),
    (r"\b(?:GCP|gcp|Google\s+Cloud)\b", "deployment", "infrastructure", 0.5, "Cloud: GCP"),
    (r"\b(?:Azure|azure)\b", "deployment", "infrastructure", 0.5, "Cloud: Azure"),
    (r"\b(?:github\s+actions|GitHub\s+Actions)\b", "deployment", "cicd", 0.8, "CI/CD: GitHub Actions"),
    (r"\b(?:jenkins|Jenkins)\b", "deployment", "cicd", 0.8, "CI/CD: Jenkins"),
    (r"\b(?:gitlab\s+ci|GitLab\s+CI)\b", "deployment", "cicd", 0.8, "CI/CD: GitLab CI"),
    (r"\b(?:blue[- ]?green)\b", "deployment", "cicd", 0.7, "Deployment: blue-green"),
    (r"\b(?:canary)\b", "deployment", "cicd", 0.7, "Deployment: canary releases"),
    (r"\b(?:rolling\s+(?:deploy|update))\b", "deployment", "cicd", 0.7, "Deployment: rolling updates"),
    (r"\blint\s*→?\s*test\s*→?\s*build\s*→?\s*deploy\b", "deployment", "cicd", 0.9, "CI/CD: full pipeline defined"),
    # Environments
    (r"\b(?:dev|staging|prod(?:uction)?)\b.*\b(?:dev|staging|prod(?:uction)?)\b", "deployment", "environments", 0.8, "Environments: multiple tiers defined"),
    (r"\b3\s+environment", "deployment", "environments", 0.8, "Environments: 3 tiers"),
    (r"\benvironment(?:s)?\s*:", "deployment", "environments", 0.7, "Environments specified"),
    # Scaling
    (r"\b(?:auto[- ]?scal(?:e|ing))\b", "deployment", "scaling", 0.7, "Scaling: auto-scaling"),
    (r"\bhorizontal\b.*scal", "deployment", "scaling", 0.8, "Scaling: horizontal"),
    (r"\b\d+[- ]?\d+\s+pods?\b", "deployment", "scaling", 0.8, "Scaling: pod count range specified"),
    (r"\bCPU\s*(?:\(?\s*\d+%?\s*\)?\s*)?(?:threshold|target|limit)\b", "deployment", "scaling", 0.8, "Scaling: CPU-based trigger"),

    # ── Error Handling ──
    (r"\bretry\b.*(?:exponential|backoff)", "error_handling", "retry", 0.8, "Retry: exponential backoff"),
    (r"\bretry\b.*\b\d+\s*(?:times|retries|attempts)\b", "error_handling", "retry", 0.8, "Retry: count specified"),
    (r"\b(?:base|initial)\s+\d+\s*ms\b", "error_handling", "retry", 0.9, "Retry: base delay specified"),
    (r"\bcircuit\s*breaker\b", "error_handling", "circuit_breaker", 0.8, "Circuit breaker pattern"),
    (r"\b\d+\s+failures?\s+in\s+\d+\s*s\b", "error_handling", "circuit_breaker", 0.9, "Circuit breaker: threshold specified"),
    (r"\bstructured\s+log(?:ging|s)?\b", "error_handling", "logging", 0.7, "Logging: structured format"),
    (r"\b(?:JSON|json)\s+log(?:ging|s)?\b", "error_handling", "logging", 0.8, "Logging: JSON format"),
    (r"\bcorrelation\s+ID\b", "error_handling", "logging", 0.9, "Logging: correlation IDs"),
    (r"\b(?:Winston|Pino|Bunyan|log4j|slog)\b", "error_handling", "logging", 0.9, "Logging: library specified"),
    (r"\blog\s+level", "error_handling", "logging", 0.7, "Logging: levels defined"),
    # Error taxonomy — more flexible matching
    (r"\b(?:4\d{2}|5\d{2})\b.*(?:Error|error|status)", "error_handling", "taxonomy", 0.5, "Error: HTTP status codes specified"),
    (r"\bValidationError\b", "error_handling", "taxonomy", 0.7, "Error taxonomy: ValidationError"),
    (r"\bAuthenticationError\b", "error_handling", "taxonomy", 0.7, "Error taxonomy: AuthenticationError"),
    (r"\b(?:error\s+)?taxonomy\s*:", "error_handling", "taxonomy", 0.8, "Error taxonomy defined"),
    (r"\b(?:400|401|403|404|409|422|429|500|502|503)\b.*\b(?:400|401|403|404|409|422|429|500|502|503)\b", "error_handling", "taxonomy", 0.8, "Error taxonomy: multiple status codes mapped"),

    # ── Performance ──
    (r"\b(?:p50|p95|p99|P50|P95|P99)\b", "performance", "latency", 0.7, "Latency targets specified"),
    (r"\bP50\s*<?\s*\d+\s*ms\b", "performance", "latency", 0.9, "Latency: P50 target defined"),
    (r"\bP95\s*<?\s*\d+\s*ms\b", "performance", "latency", 0.9, "Latency: P95 target defined"),
    (r"\bP99\s*<?\s*\d+\s*ms\b", "performance", "latency", 0.9, "Latency: P99 target defined"),
    (r"\b\d+\s*(?:ms|millisecond)", "performance", "latency", 0.6, "Latency target specified"),
    (r"\b\d+\s*(?:rps|req(?:uests?)?/s(?:ec)?)\b", "performance", "throughput", 0.7, "Throughput target specified"),
    (r"\bconcurrent\s+(?:users?|connections?)\b", "performance", "throughput", 0.7, "Throughput: concurrency target"),
    (r"\b\d+\s*concurrent\b", "performance", "throughput", 0.8, "Throughput: concurrent count specified"),
    (r"\bconnection\s+pool(?:ing)?\b", "performance", "optimization", 0.7, "Optimization: connection pooling"),
    (r"\b(?:pool\s+size|pool_size)\s*:?\s*\d+\b", "performance", "optimization", 0.8, "Optimization: pool size specified"),
    (r"\bTTL\s*:?\s*\d+", "performance", "optimization", 0.8, "Optimization: cache TTL specified"),
    (r"\b(?:cach(?:e|ing))\s+(?:with|strategy|layer|for)\b", "performance", "optimization", 0.7, "Optimization: caching strategy"),

    # ── Security ──
    (r"\bCORS\b", "security", "cors", 0.7, "CORS policy required"),
    (r"\ballow(?:ed)?\s+(?:origin|domain)", "security", "cors", 0.8, "CORS: allowed origins specified"),
    (r"\brate\s*limit(?:ing)?\b", "security", "rate_limiting", 0.7, "Rate limiting required"),
    (r"\b\d+\s*req(?:uests?)?\s*/\s*(?:min|hour|sec)", "security", "rate_limiting", 0.8, "Rate limit threshold specified"),
    (r"\b\d+\s*msg/min\b", "security", "rate_limiting", 0.8, "Rate limit: message rate specified"),
    (r"\b(?:TLS|HTTPS|SSL)\b", "security", "encryption", 0.7, "Encryption: TLS in transit"),
    (r"\bTLS\s+1\.\d\b", "security", "encryption", 0.9, "Encryption: TLS version specified"),
    (r"\bAES[- ]?256\b", "security", "encryption", 0.9, "Encryption: AES-256"),
    (r"\bencrypt(?:ion)?\s+at\s+rest\b", "security", "encryption", 0.8, "Encryption at rest"),
    (r"\bPII\b", "security", "encryption", 0.8, "Encryption: PII field protection"),
    (r"\binput\s+(?:validation|sanitiz)", "security", "input_validation", 0.7, "Input validation required"),
    (r"\b(?:Zod|Joi|yup|class-validator|ajv)\b", "security", "input_validation", 0.9, "Input validation: schema library specified"),
    (r"\bHelmet(?:\.js)?\b", "security", "input_validation", 0.8, "Security: Helmet.js headers"),
    (r"\bSQL\s+injection\b", "security", "input_validation", 0.7, "Security: SQL injection prevention"),
    (r"\bparameterized\s+quer(?:y|ies)\b", "security", "input_validation", 0.8, "Security: parameterized queries"),

    # ── Testing ──
    (r"\bunit\s+test", "testing", "strategy", 0.5, "Testing: unit tests"),
    (r"\bintegration\s+test", "testing", "strategy", 0.6, "Testing: integration tests"),
    (r"\be2e\s+test|end[- ]?to[- ]?end", "testing", "strategy", 0.6, "Testing: e2e tests"),
    (r"\b\d+%\s+unit\b", "testing", "strategy", 0.8, "Testing: unit test ratio specified"),
    (r"\b\d+%\s+integration\b", "testing", "strategy", 0.8, "Testing: integration test ratio specified"),
    (r"\b(?:Vitest|Jest|Mocha|pytest|JUnit)\b", "testing", "strategy", 0.8, "Testing: framework specified"),
    (r"\b(?:Supertest|supertest)\b", "testing", "strategy", 0.8, "Testing: integration test library"),
    (r"\b(?:Playwright|Cypress|Selenium)\b", "testing", "strategy", 0.8, "Testing: e2e framework specified"),
    (r"\b\d+%\s*(?:coverage|cov|lines?|branch)", "testing", "coverage", 0.8, "Coverage target specified"),
    (r"\b(?:85|90|95|100)%\s+lines?\b", "testing", "coverage", 0.9, "Coverage: line target specified"),
    (r"\b\d+%\s+branch", "testing", "coverage", 0.9, "Coverage: branch target specified"),
    (r"\bfixture", "testing", "test_data", 0.6, "Test data: fixtures"),
    (r"\bfactory\s+(?:function|pattern|library)\b", "testing", "test_data", 0.8, "Test data: factory pattern"),
    (r"\b(?:Fishery|FactoryBot|faker)\b", "testing", "test_data", 0.8, "Test data: factory library specified"),
    (r"\bisolated\s+(?:test\s+)?(?:db|database)\b", "testing", "test_data", 0.8, "Test data: isolated test database"),
    (r"\b(?:seed|seeding)\s+data\b", "testing", "test_data", 0.6, "Test data: seed data"),
    (r"\bCI\s+(?:run|pipeline|integration)\b", "testing", "ci_integration", 0.7, "CI: test execution in pipeline"),
    (r"\btests?\s+on\s+(?:PR|pull\s+request|merge)\b", "testing", "ci_integration", 0.8, "CI: tests on PR/merge"),
    (r"\b(?:CI|pipeline)\s+runs?\s+(?:all\s+)?tests?\b", "testing", "ci_integration", 0.8, "CI: automated test execution"),
    (r"\bon\s+(?:PR|merge\s+to\s+main)\b", "testing", "ci_integration", 0.8, "CI: trigger conditions specified"),

    # ── Purpose ──
    # Objective: match "building/creating/developing a <type> for <users>"
    (r"\b(?:build(?:ing)?|creat(?:e|ing)|develop(?:ing)?)\s+(?:a\s+)?(\w+[\w\s]*?)(?:\s+(?:for|to|that))\b", "purpose", "objective", 0.6, "Objective: application described"),
    (r"\btask\s+manag", "purpose", "objective", 0.6, "Objective: task management"),
    (r"\b(?:e[- ]?commerce|shop|store|marketplace)\b", "purpose", "objective", 0.6, "Objective: e-commerce"),
    (r"\b(?:chat|messaging|communication)\s+(?:app|platform|system)\b", "purpose", "objective", 0.6, "Objective: messaging"),
    (r"\b(?:CRM|customer\s+relationship)\b", "purpose", "objective", 0.6, "Objective: CRM"),
    (r"\b(?:analytics|dashboard|reporting)\s+(?:platform|tool|system)\b", "purpose", "objective", 0.6, "Objective: analytics"),
    (r"\b(?:portal|platform|application|app|system|tool|service)\b", "purpose", "objective", 0.5, "Objective: application type identified"),
    (r"\b(?:document|file|upload|review|summary|summariz)\w*\s+(?:portal|platform|system|app|tool)\b", "purpose", "objective", 0.6, "Objective: document processing"),
    (r"\b(?:RAG|retrieval[- ]?augmented|vector\s+(?:db|database|store))\b", "tech_stack", "database", 0.7, "Database: vector store / RAG"),
    (r"\b(?:pinecone|Pinecone|weaviate|Weaviate|chromadb|Chroma|qdrant|Qdrant|pgvector|Milvus)\b", "tech_stack", "database", 0.9, "Database: vector database specified"),
    (r"\b(?:embed(?:ding)?s?|vectoriz)\b", "data_model", "entities", 0.6, "Entity: vector embeddings"),
    # User/domain identification
    (r"\bfor\s+(?:lawyers?|developers?|doctors?|nurses?|teachers?|students?|engineers?|managers?|users?|customers?|clients?|admins?)\b", "purpose", "users", 0.6, "Users: target audience identified"),
    (r"\breal[- ]?time\b", "purpose", "scope", 0.5, "Scope: real-time features"),
    (r"\bcollabora", "purpose", "scope", 0.5, "Scope: collaboration features"),
    (r"\b(?:initial|v1|MVP|first)\s+release\b", "purpose", "scope", 0.7, "Scope: initial release boundary"),
    (r"\bout\s+of\s+scope\b", "purpose", "scope", 0.8, "Scope: exclusions defined"),
    (r"\bteam(?:s)?\s+of\s+\d+", "purpose", "users", 0.7, "Users: team size specified"),
    (r"\bteam\b", "purpose", "users", 0.5, "Users: team-based"),
    (r"\badmin\b", "purpose", "users", 0.5, "Users: admin role"),
    (r"\bengineers?\b.*\bneed\s+to\b", "purpose", "users", 0.7, "Users: engineer user stories"),
    (r"\bKPI|metric|dashboard\b", "purpose", "success_criteria", 0.5, "Success: measurable metrics"),
    (r"\bsub[- ]?\d+\s*ms\b", "purpose", "success_criteria", 0.7, "Success: latency criteria specified"),
    (r"\bsuccess\s+(?:means|criteria|metric)\b", "purpose", "success_criteria", 0.7, "Success criteria defined"),
    (r"\b(?:solve|problem|pain\s+point)\b.*\b(?:for|with)\b", "purpose", "objective", 0.6, "Objective: problem statement"),
    # Scope: feature lists (e.g., "upload documents", "provide summaries")
    (r"\b(?:upload|download|import|export|generate|provide|create|manage|review|analyze)\s+\w+", "purpose", "scope", 0.5, "Scope: feature identified"),
    # Domain-specific entity patterns
    (r"\b(?:document|file|attachment|pdf|upload)s?\b", "data_model", "entities", 0.5, "Entity: documents/files"),
    (r"\b(?:source|reference|citation|archive)s?\b", "data_model", "entities", 0.5, "Entity: sources/references"),
    (r"\b(?:user|account|profile|member)s?\b", "data_model", "entities", 0.5, "Entity: users/accounts"),
]

# Ambiguity patterns: (regex, channel_id, reason)
# Only flag genuinely problematic vagueness, not natural language patterns.
AMBIGUITY_PATTERNS: list[tuple[str, str, str]] = [
    (r"\bsome\s+(?:kind|sort|type)\s+of\b", "", "Vague qualifier — specify the exact technology or approach"),
    (r"\bmaybe\b", "", "Uncertain — commit to a decision to reduce hallucination surface"),
    (r"\bprobably\b", "", "Uncertain — confirm the requirement"),
    (r"\bwhatever\b", "", "Dismissive — this dimension needs a decision"),
    (r"\bI\s+(?:guess|think|suppose)\b", "", "Uncertain — commit to a specific requirement"),
    (r"\bsomething\s+like\b", "", "Vague — specify exactly what you need"),
    (r"\bfigure\s+(?:it\s+)?out\s+later\b", "", "Deferred — deferring decisions creates hallucination surface"),
    (r"\bdon'?t\s+(?:care|matter|mind)\b", "", "Unspecified — every unresolved dimension is a hallucination vector"),
    (r"\band\s+(?:so\s+on|stuff|things)\b", "", "Vague list terminator — enumerate the remaining items"),
]


class ResponseAnalyzer:
    """Analyzes user responses to extract dimension updates and ambiguities."""

    def __init__(self):
        self._patterns = [(re.compile(p, re.IGNORECASE), ch, sub, res, tmpl)
                          for p, ch, sub, res, tmpl in PATTERN_REGISTRY]
        self._ambiguity_patterns = [(re.compile(p, re.IGNORECASE), ch, reason)
                                    for p, ch, reason in AMBIGUITY_PATTERNS]

    def analyze(self, response: str) -> list[DimensionUpdate]:
        updates = []
        seen = set()
        for regex, ch_id, sub_id, resolution, constraint in self._patterns:
            if regex.search(response):
                key = (ch_id, sub_id)
                if key not in seen:
                    seen.add(key)
                    match = regex.search(response)
                    constraint_text = constraint
                    if match:
                        matched = match.group(0).strip()
                        if matched and matched not in constraint_text:
                            constraint_text = f"{constraint} ({matched})"
                    updates.append(DimensionUpdate(ch_id, sub_id, resolution, constraint_text))
        return updates

    def identify_ambiguities(self, response: str) -> list[Ambiguity]:
        ambiguities = []
        for regex, ch_id, reason in self._ambiguity_patterns:
            match = regex.search(response)
            if match:
                ambiguities.append(Ambiguity(
                    text=match.group(0),
                    channel_id=ch_id,
                    reason=reason,
                ))
        return ambiguities
