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
PATTERN_REGISTRY: list[tuple[str, str, str, float, str]] = [
    # Tech Stack
    (r"\b(?:python|Python)\s*(?:3\.?\d*)?", "tech_stack", "language", 0.9, "Language: Python"),
    (r"\b(?:typescript|TypeScript|TS)\b", "tech_stack", "language", 0.9, "Language: TypeScript"),
    (r"\b(?:golang|Go)\b", "tech_stack", "language", 0.9, "Language: Go"),
    (r"\b(?:java|Java)\s*(?:\d+)?", "tech_stack", "language", 0.9, "Language: Java"),
    (r"\b(?:rust|Rust)\b", "tech_stack", "language", 0.9, "Language: Rust"),
    (r"\b(?:fastapi|FastAPI)\b", "tech_stack", "framework", 0.9, "Framework: FastAPI"),
    (r"\b(?:django|Django)\b", "tech_stack", "framework", 0.9, "Framework: Django"),
    (r"\b(?:flask|Flask)\b", "tech_stack", "framework", 0.9, "Framework: Flask"),
    (r"\b(?:express|Express(?:\.js)?)\b", "tech_stack", "framework", 0.9, "Framework: Express"),
    (r"\b(?:next\.?js|Next\.?js|NextJS)\b", "tech_stack", "framework", 0.9, "Framework: Next.js"),
    (r"\b(?:spring\s*boot|Spring\s*Boot)\b", "tech_stack", "framework", 0.9, "Framework: Spring Boot"),
    (r"\b(?:postgresql|postgres|PostgreSQL|Postgres)\b", "tech_stack", "database", 0.9, "Database: PostgreSQL"),
    (r"\b(?:mysql|MySQL)\b", "tech_stack", "database", 0.9, "Database: MySQL"),
    (r"\b(?:mongodb|MongoDB|Mongo)\b", "tech_stack", "database", 0.9, "Database: MongoDB"),
    (r"\b(?:sqlite|SQLite)\b", "tech_stack", "database", 0.8, "Database: SQLite"),
    (r"\b(?:redis|Redis)\b", "tech_stack", "cache", 0.9, "Cache: Redis"),
    (r"\b(?:memcached|Memcached)\b", "tech_stack", "cache", 0.9, "Cache: Memcached"),
    (r"\b(?:rabbitmq|RabbitMQ)\b", "tech_stack", "message_queue", 0.9, "Message queue: RabbitMQ"),
    (r"\b(?:kafka|Kafka)\b", "tech_stack", "message_queue", 0.9, "Message queue: Kafka"),
    (r"\b(?:sqs|SQS)\b", "tech_stack", "message_queue", 0.9, "Message queue: AWS SQS"),

    # Auth
    (r"\bJWT\b", "auth", "method", 0.8, "Auth: JWT tokens"),
    (r"\bOAuth\s*2?\.?0?\b", "auth", "method", 0.8, "Auth: OAuth 2.0"),
    (r"\bAPI\s*key", "auth", "method", 0.7, "Auth: API key"),
    (r"\bsession[- ]?based\b", "auth", "session", 0.7, "Session: server-side sessions"),
    (r"\bRBAC\b", "auth", "authorization", 0.8, "Authorization: RBAC"),
    (r"\bABAC\b", "auth", "authorization", 0.8, "Authorization: ABAC"),
    (r"\b(?:role[- ]?based|roles?)\b", "auth", "authorization", 0.6, "Authorization: role-based"),
    (r"\bMFA\b|multi[- ]?factor", "auth", "mfa", 0.8, "MFA required"),
    (r"\bno\s+(?:MFA|multi[- ]?factor)", "auth", "mfa", 0.9, "MFA: not required"),
    (r"\brefresh\s+token", "auth", "session", 0.8, "Session: refresh token rotation"),

    # Data Model
    (r"\busers?\b.*(?:table|entity|model|schema)", "data_model", "entities", 0.5, "Entity: User"),
    (r"\btasks?\b.*(?:table|entity|model|schema)", "data_model", "entities", 0.5, "Entity: Task"),
    (r"\bteams?\b.*(?:table|entity|model|schema)", "data_model", "entities", 0.5, "Entity: Team"),
    (r"\bone[- ]?to[- ]?many\b", "data_model", "relationships", 0.6, "Relationship: one-to-many"),
    (r"\bmany[- ]?to[- ]?many\b", "data_model", "relationships", 0.6, "Relationship: many-to-many"),
    (r"\bforeign\s+key\b", "data_model", "relationships", 0.7, "Relationship: foreign key constraints"),
    (r"\bunique\s+constraint\b", "data_model", "constraints", 0.7, "Constraint: unique"),
    (r"\bnot\s+null\b", "data_model", "constraints", 0.6, "Constraint: not null"),
    (r"\bindex(?:es)?\s+on\b", "data_model", "indexes", 0.7, "Index strategy specified"),
    (r"\bcompound\s+index\b", "data_model", "indexes", 0.8, "Index: compound index"),

    # API
    (r"\bREST(?:ful)?\b", "api", "endpoints", 0.5, "API style: REST"),
    (r"\bGraphQL\b", "api", "endpoints", 0.5, "API style: GraphQL"),
    (r"\bgRPC\b", "api", "endpoints", 0.5, "API style: gRPC"),
    (r"\bwebsocket|WebSocket|WS\b", "api", "realtime", 0.8, "Realtime: WebSocket"),
    (r"\bSSE\b|server[- ]?sent\s+events?", "api", "realtime", 0.8, "Realtime: SSE"),
    (r"\bpolling\b", "api", "realtime", 0.6, "Realtime: polling"),
    (r"\bv\d+\b.*(?:api|endpoint|version)", "api", "versioning", 0.7, "API versioning: URL path"),
    (r"\bheader[- ]?based\s+version", "api", "versioning", 0.7, "API versioning: header-based"),
    (r"\bpagina(?:tion|ted)\b", "performance", "pagination", 0.6, "Pagination required"),
    (r"\bcursor[- ]?based\b", "performance", "pagination", 0.8, "Pagination: cursor-based"),
    (r"\boffset[- ]?based\b", "performance", "pagination", 0.7, "Pagination: offset-based"),

    # Deployment
    (r"\b(?:kubernetes|k8s|K8s)\b", "deployment", "infrastructure", 0.8, "Infrastructure: Kubernetes"),
    (r"\b(?:docker|Docker)\b", "deployment", "infrastructure", 0.6, "Infrastructure: Docker containers"),
    (r"\b(?:serverless|lambda|Lambda)\b", "deployment", "infrastructure", 0.8, "Infrastructure: serverless"),
    (r"\b(?:AWS|aws)\b", "deployment", "infrastructure", 0.5, "Cloud: AWS"),
    (r"\b(?:GCP|gcp|Google\s+Cloud)\b", "deployment", "infrastructure", 0.5, "Cloud: GCP"),
    (r"\b(?:Azure|azure)\b", "deployment", "infrastructure", 0.5, "Cloud: Azure"),
    (r"\b(?:github\s+actions|GitHub\s+Actions)\b", "deployment", "cicd", 0.8, "CI/CD: GitHub Actions"),
    (r"\b(?:jenkins|Jenkins)\b", "deployment", "cicd", 0.8, "CI/CD: Jenkins"),
    (r"\b(?:blue[- ]?green)\b", "deployment", "cicd", 0.7, "Deployment: blue-green"),
    (r"\b(?:canary)\b", "deployment", "cicd", 0.7, "Deployment: canary releases"),
    (r"\b(?:auto[- ]?scal(?:e|ing))\b", "deployment", "scaling", 0.7, "Scaling: auto-scaling"),
    (r"\bhorizontal\b.*scal", "deployment", "scaling", 0.8, "Scaling: horizontal"),

    # Error Handling
    (r"\bretry\b.*(?:exponential|backoff)", "error_handling", "retry", 0.8, "Retry: exponential backoff"),
    (r"\bcircuit\s*breaker\b", "error_handling", "circuit_breaker", 0.8, "Circuit breaker pattern"),
    (r"\bstructured\s+log(?:ging|s)?\b", "error_handling", "logging", 0.7, "Logging: structured format"),
    (r"\b(?:JSON|json)\s+log(?:ging|s)?\b", "error_handling", "logging", 0.8, "Logging: JSON format"),
    (r"\b(?:4\d{2}|5\d{2})\b.*(?:error|status)", "error_handling", "taxonomy", 0.5, "Error: HTTP status codes specified"),

    # Performance
    (r"\b(?:p50|p95|p99|P50|P95|P99)\b", "performance", "latency", 0.7, "Latency targets specified"),
    (r"\b\d+\s*(?:ms|millisecond)", "performance", "latency", 0.6, "Latency target specified"),
    (r"\b\d+\s*(?:rps|req(?:uests?)?/s)", "performance", "throughput", 0.7, "Throughput target specified"),
    (r"\bconnection\s+pool(?:ing)?\b", "performance", "optimization", 0.7, "Optimization: connection pooling"),

    # Security
    (r"\bCORS\b", "security", "cors", 0.7, "CORS policy required"),
    (r"\brate\s*limit(?:ing)?\b", "security", "rate_limiting", 0.7, "Rate limiting required"),
    (r"\b\d+\s*req(?:uests?)?\s*/\s*(?:min|hour|sec)", "security", "rate_limiting", 0.8, "Rate limit threshold specified"),
    (r"\b(?:TLS|HTTPS|SSL)\b", "security", "encryption", 0.7, "Encryption: TLS in transit"),
    (r"\bencrypt(?:ion)?\s+at\s+rest\b", "security", "encryption", 0.8, "Encryption at rest"),
    (r"\binput\s+(?:validation|sanitiz)", "security", "input_validation", 0.7, "Input validation required"),

    # Testing
    (r"\bunit\s+test", "testing", "strategy", 0.5, "Testing: unit tests"),
    (r"\bintegration\s+test", "testing", "strategy", 0.6, "Testing: integration tests"),
    (r"\be2e\s+test|end[- ]?to[- ]?end", "testing", "strategy", 0.6, "Testing: e2e tests"),
    (r"\b\d+%\s*(?:coverage|cov)\b", "testing", "coverage", 0.8, "Coverage target specified"),
    (r"\bfixture", "testing", "test_data", 0.6, "Test data: fixtures"),

    # Purpose
    (r"\btask\s+manag", "purpose", "objective", 0.6, "Objective: task management"),
    (r"\breal[- ]?time\b", "purpose", "scope", 0.5, "Scope: real-time features"),
    (r"\bcollabora", "purpose", "scope", 0.5, "Scope: collaboration features"),
    (r"\bteam\b", "purpose", "users", 0.5, "Users: team-based"),
    (r"\badmin\b", "purpose", "users", 0.5, "Users: admin role"),
    (r"\bKPI|metric|dashboard\b", "purpose", "success_criteria", 0.5, "Success: measurable metrics"),
]

# Ambiguity patterns: (regex, channel_id, reason)
AMBIGUITY_PATTERNS: list[tuple[str, str, str]] = [
    (r"\bsome\s+(?:kind|sort|type)\s+of\b", "", "Vague qualifier: 'some kind of' — specify exactly"),
    (r"\bmaybe\b", "", "Uncertain: 'maybe' — commit to a decision"),
    (r"\bsimple\b", "", "Ambiguous: 'simple' is subjective — specify constraints"),
    (r"\bbasic\b", "", "Ambiguous: 'basic' is subjective — specify what's included/excluded"),
    (r"\bprobably\b", "", "Uncertain: 'probably' — confirm the requirement"),
    (r"\bstandard\b", "", "Ambiguous: 'standard' — specify which standard"),
    (r"\bnormal\b", "", "Ambiguous: 'normal' — define the expected behavior"),
    (r"\betc\.?\b", "", "Incomplete: 'etc.' — enumerate all items explicitly"),
    (r"\band\s+(?:so\s+on|stuff|things)\b", "", "Incomplete: vague list terminator — enumerate explicitly"),
    (r"\bwhatever\b", "", "Dismissive: 'whatever' — this dimension needs a decision"),
    (r"\bdefault\b", "", "Unspecified: 'default' — state the explicit value"),
    (r"\bI\s+(?:guess|think|suppose)\b", "", "Uncertain: hedging — commit to a requirement"),
    (r"\bsomething\s+like\b", "", "Vague: 'something like' — specify exactly"),
    (r"\bfigure\s+(?:it\s+)?out\s+later\b", "", "Deferred: deferring decisions creates hallucination surface"),
    (r"\bdon'?t\s+(?:care|matter|mind)\b", "", "Unspecified: every unresolved dimension is a hallucination vector"),
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
