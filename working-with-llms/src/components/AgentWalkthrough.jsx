import { useState, useMemo } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

// Sub-dimensions per channel (must match architect/channels.py)
const CHANNEL_SUBS = {
  "Purpose": ["objective", "users", "success_criteria", "scope"],
  "Data Model": ["entities", "relationships", "cardinality", "constraints", "indexes"],
  "API": ["endpoints", "request_shapes", "response_shapes", "versioning", "realtime"],
  "Tech Stack": ["language", "framework", "database", "cache", "message_queue"],
  "Auth": ["method", "authorization", "session", "mfa"],
  "Deployment": ["infrastructure", "cicd", "environments", "scaling"],
  "Error Handling": ["taxonomy", "retry", "circuit_breaker", "logging"],
  "Performance": ["latency", "throughput", "optimization", "pagination"],
  "Security": ["input_validation", "encryption", "cors", "rate_limiting"],
  "Testing": ["strategy", "coverage", "test_data", "ci_integration"],
};

const CHANNEL_NAMES = Object.keys(CHANNEL_SUBS);

const EXCHANGES = [
  // ── Round 1: Initial intake (10 exchanges covering all channels) ──
  {
    round: 1,
    question: `What is the primary objective of this application? Who are the target users and what problem does it solve for them?`,
    response: `Build a collaborative task management API for engineering teams. Target users are software engineers and engineering managers. Success criteria: teams can create, assign, track, and complete tasks with real-time status updates. Scope includes task CRUD, team management, assignment workflows, and a real-time notification feed.`,
    updates: [
      { channel: "Purpose", sub: "objective", value: 0.7, constraint: "Objective: collaborative task management" },
      { channel: "Purpose", sub: "users", value: 0.7, constraint: "Users: engineers + eng managers" },
      { channel: "Purpose", sub: "success_criteria", value: 0.6, constraint: "Success: real-time task tracking" },
      { channel: "Purpose", sub: "scope", value: 0.7, constraint: "Scope: CRUD + teams + assignments + realtime" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What are the core entities in your domain? Describe their key attributes and how they relate to each other.`,
    response: `Core entities: User (id, email UNIQUE NOT NULL, name, role ENUM), Team (id, name UNIQUE, created_at), Task (id, title NOT NULL, description, status ENUM, priority ENUM, assignee_id FK users, team_id FK teams NOT NULL). User belongs to one Team (one-to-many). Task belongs to one Team (many-to-one, required). Task has one optional assignee User (many-to-one, nullable). Compound index on (team_id, status) for dashboard queries. Index on assignee_id for user task lists.`,
    updates: [
      { channel: "Data Model", sub: "entities", value: 0.8, constraint: "Entities: User, Team, Task with typed attrs" },
      { channel: "Data Model", sub: "relationships", value: 0.8, constraint: "FKs: Task→User, Task→Team, User→Team" },
      { channel: "Data Model", sub: "cardinality", value: 0.8, constraint: "1:N Team→Users, 1:N Team→Tasks, N:1 Task→User" },
      { channel: "Data Model", sub: "constraints", value: 0.8, constraint: "UNIQUE, NOT NULL, ENUM constraints" },
      { channel: "Data Model", sub: "indexes", value: 0.8, constraint: "Compound idx (team_id, status), idx assignee_id" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What programming language and web framework will you use? Specify versions if known.`,
    response: `Python 3.12 with FastAPI 0.104. PostgreSQL 15 for primary storage. Redis 7 for caching and pub/sub for real-time events. No separate message queue needed — Redis pub/sub is sufficient at our scale.`,
    updates: [
      { channel: "Tech Stack", sub: "language", value: 0.9, constraint: "Language: Python 3.12" },
      { channel: "Tech Stack", sub: "framework", value: 0.9, constraint: "Framework: FastAPI 0.104" },
      { channel: "Tech Stack", sub: "database", value: 0.9, constraint: "Database: PostgreSQL 15" },
      { channel: "Tech Stack", sub: "cache", value: 0.9, constraint: "Cache: Redis 7" },
      { channel: "Tech Stack", sub: "message_queue", value: 0.85, constraint: "MQ: Redis pub/sub (no separate broker)" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What API style will you use (REST, GraphQL, gRPC)? Describe the endpoints and real-time capabilities.`,
    response: `RESTful API with URL-path versioning (v1). Endpoints: GET/POST /v1/tasks, GET/PUT/DELETE /v1/tasks/{id}, GET/POST /v1/teams, GET/PUT /v1/teams/{id}, GET /v1/users/me. Request bodies: JSON validated by Pydantic. Response envelope: {data, meta, errors}. WebSocket at /v1/ws/tasks/{team_id} for real-time task updates. Cursor-based pagination with max page size 50.`,
    updates: [
      { channel: "API", sub: "endpoints", value: 0.85, constraint: "REST: full CRUD on tasks, teams, users" },
      { channel: "API", sub: "request_shapes", value: 0.8, constraint: "Requests: JSON + Pydantic validation" },
      { channel: "API", sub: "response_shapes", value: 0.8, constraint: "Response: {data, meta, errors} envelope" },
      { channel: "API", sub: "versioning", value: 0.85, constraint: "Versioning: URL path /v1/" },
      { channel: "API", sub: "realtime", value: 0.85, constraint: "Realtime: WebSocket per team" },
      { channel: "Performance", sub: "pagination", value: 0.85, constraint: "Pagination: cursor-based, max 50" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `How will users authenticate? What's the authorization model?`,
    response: `JWT authentication with RS256 signing. 15-minute access tokens, 7-day refresh tokens with rotation. RBAC authorization: admin (full access), manager (team CRUD + assign), member (own tasks only). No MFA required for v1. Session/token cache in Redis with revocation list.`,
    updates: [
      { channel: "Auth", sub: "method", value: 0.9, constraint: "Auth: JWT RS256" },
      { channel: "Auth", sub: "authorization", value: 0.85, constraint: "RBAC: admin/manager/member" },
      { channel: "Auth", sub: "session", value: 0.85, constraint: "Session: Redis cache + revocation list" },
      { channel: "Auth", sub: "mfa", value: 0.9, constraint: "MFA: not required for v1" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `Where will this be deployed? What's the CI/CD pipeline?`,
    response: `AWS with Kubernetes (EKS). Docker containers built via GitHub Actions. Blue-green deployment with health checks. Three environments: dev (auto-deploy on merge), staging (manual promote), prod (manual promote with approval gate). Horizontal auto-scaling: min 2, max 10 pods, target 70% CPU.`,
    updates: [
      { channel: "Deployment", sub: "infrastructure", value: 0.85, constraint: "Infrastructure: AWS EKS + Docker" },
      { channel: "Deployment", sub: "cicd", value: 0.85, constraint: "CI/CD: GitHub Actions, blue-green" },
      { channel: "Deployment", sub: "environments", value: 0.85, constraint: "Envs: dev/staging/prod with gates" },
      { channel: "Deployment", sub: "scaling", value: 0.85, constraint: "Scaling: HPA 2-10 pods, 70% CPU" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `How should errors be categorized? What retry and logging policies do you need?`,
    response: `Error taxonomy: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (optimistic lock), 422 unprocessable, 429 rate limit, 500 internal, 503 service unavailable. Retry: exponential backoff for upstream calls (max 3, base 1s, jitter). Circuit breaker on Redis (5 failures in 60s, 30s half-open). Structured JSON logging to stdout with correlation IDs, request_id, user_id. Levels: DEBUG/INFO/WARN/ERROR/CRITICAL.`,
    updates: [
      { channel: "Error Handling", sub: "taxonomy", value: 0.85, constraint: "9 HTTP status codes mapped" },
      { channel: "Error Handling", sub: "retry", value: 0.85, constraint: "Retry: exp backoff, 3 max, jitter" },
      { channel: "Error Handling", sub: "circuit_breaker", value: 0.85, constraint: "CB: 5/60s threshold, 30s half-open" },
      { channel: "Error Handling", sub: "logging", value: 0.85, constraint: "JSON logs: correlation_id, 5 levels" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What are your latency targets and throughput requirements?`,
    response: `P50 < 50ms, P95 < 100ms, P99 < 500ms for all REST endpoints. WebSocket message delivery P95 < 200ms. Sustain 1000 rps with burst to 2000. Connection pooling: 20 PostgreSQL connections via SQLAlchemy pool, 10 Redis connections. Query optimization: eager load relationships, no N+1.`,
    updates: [
      { channel: "Performance", sub: "latency", value: 0.85, constraint: "Latency: P50<50ms P95<100ms P99<500ms" },
      { channel: "Performance", sub: "throughput", value: 0.85, constraint: "Throughput: 1000 rps sustained, 2000 burst" },
      { channel: "Performance", sub: "optimization", value: 0.85, constraint: "Opt: pool 20 PG + 10 Redis, eager load" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What are your security requirements? Input validation, encryption, CORS, rate limiting?`,
    response: `Pydantic models on all endpoints. Title: 1-200 chars, description: max 2000 chars. Status enum: todo|in_progress|review|done. Priority enum: low|medium|high|critical. TLS at ALB, encryption at rest via AWS KMS for PostgreSQL and Redis. CORS: allow app.example.com (prod), localhost:3000 (dev). Rate limiting: 100 req/min per user, 10/min for auth endpoints.`,
    updates: [
      { channel: "Security", sub: "input_validation", value: 0.85, constraint: "Validation: Pydantic + field limits + enums" },
      { channel: "Security", sub: "encryption", value: 0.85, constraint: "TLS at ALB + KMS at rest" },
      { channel: "Security", sub: "cors", value: 0.85, constraint: "CORS: app.example.com + localhost:3000" },
      { channel: "Security", sub: "rate_limiting", value: 0.85, constraint: "Rate: 100/min user, 10/min auth" },
    ],
    ambiguities: [],
  },
  {
    round: 1,
    question: `What's your test strategy? Coverage targets? How do tests run in CI?`,
    response: `Unit tests for business logic with pytest. Integration tests hitting real PostgreSQL via testcontainers. E2e tests for critical paths: create task → assign → status change → WebSocket notification. 80% code coverage target enforced in CI. Factory_boy fixtures with transactional rollback. Tests run in GitHub Actions CI on every PR, must pass before merge.`,
    updates: [
      { channel: "Testing", sub: "strategy", value: 0.8, constraint: "Testing: unit + integration + e2e" },
      { channel: "Testing", sub: "coverage", value: 0.85, constraint: "Coverage: 80% enforced in CI" },
      { channel: "Testing", sub: "test_data", value: 0.8, constraint: "Fixtures: factory_boy + transactional rollback" },
      { channel: "Testing", sub: "ci_integration", value: 0.85, constraint: "CI: GitHub Actions, must pass for merge" },
    ],
    ambiguities: [],
  },

  // ── Round 2: Follow-up questions targeting sub-80% channels ──
  {
    round: 2,
    question: `[Follow-up — Purpose at 68%] You mentioned success criteria as "real-time task tracking." Can you quantify that? What specific KPIs define success? What's explicitly out of scope for v1?`,
    response: `Success KPIs: task state changes reflected in < 2 seconds (P95), 90% weekly active rate among onboarded teams, < 5% task duplication rate. Out of scope for v1: file attachments, Gantt charts, time tracking, external integrations (Slack/Jira), mobile app. V1 is API-only, frontend is a separate project.`,
    updates: [
      { channel: "Purpose", sub: "success_criteria", value: 0.9, constraint: "KPIs: <2s updates, 90% WAU, <5% duplication" },
      { channel: "Purpose", sub: "scope", value: 0.9, constraint: "Out of scope: attachments, Gantt, time tracking, integrations" },
    ],
    ambiguities: [],
  },
  {
    round: 2,
    question: `[Follow-up — Purpose at 78%] What specific user personas and permission boundaries exist? Are there external API consumers beyond the frontend?`,
    response: `Three personas: IC engineer (creates/updates own tasks, views team board), engineering manager (assigns tasks, manages team membership, views reports), platform admin (manages all teams, user provisioning, system config). No external API consumers in v1 — API is internal to the frontend only. Admin uses the same API with elevated RBAC.`,
    updates: [
      { channel: "Purpose", sub: "users", value: 0.9, constraint: "Personas: IC, eng manager, platform admin" },
      { channel: "Purpose", sub: "objective", value: 0.85, constraint: "Objective: internal API for frontend only" },
    ],
    ambiguities: [],
  },
  {
    round: 2,
    question: `[Follow-up — Testing at 78%] What specific e2e test scenarios beyond the happy path? How do you handle test database state between integration test runs?`,
    response: `E2e scenarios: happy path CRUD, concurrent task assignment (optimistic lock conflict), WebSocket reconnection after disconnect, expired JWT refresh flow, rate limit exhaustion and recovery, team deletion cascading to tasks. Integration tests use a dedicated PostgreSQL instance via testcontainers, each test wrapped in a transaction that rolls back. Parallel test execution with pytest-xdist, 4 workers.`,
    updates: [
      { channel: "Testing", sub: "strategy", value: 0.9, constraint: "E2e: 6 scenarios including edge cases" },
      { channel: "Testing", sub: "test_data", value: 0.9, constraint: "Testcontainers + transaction rollback + xdist" },
    ],
    ambiguities: [],
  },
];

function HighlightedText({ text, keywords }) {
  if (!keywords.length) return <span>{text}</span>;
  const pattern = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <span>
      {parts.map((part, i) =>
        keywords.some(k => part.toLowerCase() === k.toLowerCase()) ?
          <span key={i} style={{ background: `${C.green}33`, color: C.green, padding: "1px 3px",
            borderRadius: 3 }}>{part}</span> :
          <span key={i}>{part}</span>
      )}
    </span>
  );
}

function computeChannelState(visibleExchanges) {
  // Track best resolution per (channel, sub-dimension)
  const subState = {};
  for (const ch of CHANNEL_NAMES) {
    subState[ch] = {};
    for (const sub of CHANNEL_SUBS[ch]) {
      subState[ch][sub] = 0;
    }
  }

  for (const ex of visibleExchanges) {
    for (const u of ex.updates) {
      if (subState[u.channel] && u.sub in subState[u.channel]) {
        subState[u.channel][u.sub] = Math.max(subState[u.channel][u.sub], u.value);
      }
    }
  }

  // Compute per-channel averages
  const channelRes = {};
  for (const ch of CHANNEL_NAMES) {
    const subs = CHANNEL_SUBS[ch];
    const sum = subs.reduce((s, sub) => s + subState[ch][sub], 0);
    channelRes[ch] = sum / subs.length;
  }

  // Overall density
  const density = CHANNEL_NAMES.reduce((s, ch) => s + channelRes[ch], 0) / CHANNEL_NAMES.length;

  return { subState, channelRes, density };
}

export default function AgentWalkthrough() {
  const [step, setStep] = useState(0);

  const visibleExchanges = EXCHANGES.slice(0, step + 1);
  const current = EXCHANGES[step];
  const keywords = current.updates.map(u => u.constraint.split(": ").pop() || "").filter(Boolean);

  const { channelRes, density, subState } = useMemo(
    () => computeChannelState(visibleExchanges),
    [step]
  );

  const allAbove80 = CHANNEL_NAMES.every(ch => channelRes[ch] >= 0.8);
  const isLastStep = step === EXCHANGES.length - 1;

  // Find channels below 80% for the status line
  const belowThreshold = CHANNEL_NAMES.filter(ch => channelRes[ch] < 0.8);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", overflow: "hidden" }}>
      {/* Left: Conversation */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", borderRight: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h3 style={{ color: C.text, fontSize: 16, margin: 0 }}>Agent Session: Task Management API</h3>
          {current.round === 2 && (
            <span style={{ color: C.orange, fontSize: 11, fontWeight: 600 }}>
              FOLLOW-UP ROUND — targeting gaps
            </span>
          )}
        </div>

        {visibleExchanges.map((ex, i) => (
          <div key={i} style={{ marginBottom: 20, opacity: i === step ? 1 : 0.6 }}>
            {/* Round divider */}
            {i > 0 && ex.round === 2 && EXCHANGES[i - 1].round === 1 && (
              <div style={{ borderTop: `1px dashed ${C.orange}44`, margin: "16px 0",
                padding: "8px 0 0", color: C.orange, fontSize: 12, fontWeight: 600 }}>
                Round 2: Follow-up questions — {belowThreshold.length > 0 ?
                  `${belowThreshold.length} channel(s) below 80%` : "closing gaps"}
              </div>
            )}
            <div style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}33`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
              <p style={{ color: C.accent, fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>Agent</p>
              <p style={{ color: C.text, fontSize: 14, margin: 0, lineHeight: 1.5 }}>{ex.question}</p>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>You</p>
              <p style={{ color: C.text, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                <HighlightedText text={ex.response} keywords={i === step ? keywords : []} />
              </p>
            </div>
            {i === step && ex.updates.length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: `${C.green}10`,
                border: `1px solid ${C.green}33`, borderRadius: 6 }}>
                {ex.updates.map((u, j) => (
                  <div key={j} style={{ color: C.green, fontSize: 12, marginBottom: 2 }}>
                    ✓ {u.channel}.{u.sub} → {(u.value * 100).toFixed(0)}% ({u.constraint})
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: Dashboard */}
      <div style={{ width: 340, overflow: "auto", padding: "20px 16px", background: C.surface }}>
        <h3 style={{ color: C.text, fontSize: 16, marginBottom: 4 }}>Channel Dashboard</h3>
        <p style={{ color: allAbove80 ? C.green : C.accent, fontSize: 13, margin: "0 0 4px", fontWeight: 600 }}>
          Overall Density: {(density * 100).toFixed(1)}%
        </p>
        <p style={{ color: C.textDim, fontSize: 11, margin: "0 0 16px" }}>
          {allAbove80
            ? "All channels ≥ 80% — ready to generate spec"
            : `${belowThreshold.length} channel(s) below 80% threshold`}
        </p>

        {CHANNEL_NAMES.map(name => {
          const res = channelRes[name];
          const above = res >= 0.8;
          return (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: C.text, fontSize: 12 }}>
                  {above ? "✓" : "○"} {name}
                </span>
                <span style={{ color: above ? C.green : C.textDim, fontSize: 11, fontWeight: 600 }}>
                  {(res * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${res * 100}%`, height: "100%", borderRadius: 3,
                  background: above ? C.green : res >= 0.5 ? C.yellow : C.border,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
          );
        })}

        {/* 80% threshold line label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, borderTop: `1px dashed ${C.green}44` }} />
          <span style={{ color: C.green, fontSize: 10 }}>80% threshold</span>
          <div style={{ flex: 1, borderTop: `1px dashed ${C.green}44` }} />
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            style={{ flex: 1, background: "none", border: `1px solid ${C.border}`,
              color: step === 0 ? C.textDim : C.text, padding: "8px 0", borderRadius: 6,
              cursor: step === 0 ? "default" : "pointer", fontSize: 13 }}>
            Back
          </button>
          <button onClick={() => setStep(s => Math.min(EXCHANGES.length - 1, s + 1))}
            disabled={isLastStep}
            style={{ flex: 1, background: isLastStep ? C.green : C.accent, border: "none", color: "#fff",
              padding: "8px 0", borderRadius: 6,
              cursor: isLastStep ? "default" : "pointer", fontSize: 13 }}>
            {isLastStep
              ? (allAbove80 ? "All Channels ≥ 80%" : "Intake Complete")
              : "Next Step"}
          </button>
        </div>

        {/* Step counter */}
        <div style={{ textAlign: "center", marginTop: 8, color: C.textDim, fontSize: 11 }}>
          Step {step + 1} / {EXCHANGES.length}
          {current.round === 2 ? " (follow-up)" : ""}
        </div>
      </div>
    </div>
  );
}
