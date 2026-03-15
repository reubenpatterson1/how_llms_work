import { useState } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

const EXCHANGES = [
  {
    question: `What is the primary objective of this application? Who are the target users and what problem does it solve for them?`,
    response: `Build a collaborative task management API for engineering teams. Target users are software engineers and engineering managers. Success criteria: teams can create, assign, track, and complete tasks with real-time status updates.`,
    updates: [
      { channel: "Purpose", sub: "objective", value: 0.6, constraint: "Objective: task management" },
      { channel: "Purpose", sub: "users", value: 0.5, constraint: "Users: team-based" },
      { channel: "Purpose", sub: "scope", value: 0.5, constraint: "Scope: real-time features" },
    ],
    ambiguities: [],
    density: 0.03,
  },
  {
    question: `What are the core entities in your domain? Describe their key attributes and how they relate to each other.`,
    response: `Core entities: User (id, email UNIQUE NOT NULL, name, role), Team (id, name UNIQUE, created_at), Task (id, title NOT NULL, description, status, priority, assignee_id FK users, team_id FK teams). User belongs to one Team. Task belongs to one Team and one User assignee.`,
    updates: [
      { channel: "Data Model", sub: "entities", value: 0.5, constraint: "Entity: User, Team, Task" },
      { channel: "Data Model", sub: "relationships", value: 0.7, constraint: "FK relationships defined" },
      { channel: "Data Model", sub: "constraints", value: 0.7, constraint: "UNIQUE, NOT NULL specified" },
    ],
    ambiguities: [],
    density: 0.09,
  },
  {
    question: `What programming language and web framework will you use? Specify versions if known.`,
    response: `Python 3.12 with FastAPI 0.104. PostgreSQL 15 for primary storage. Redis for caching and pub/sub for real-time events.`,
    updates: [
      { channel: "Tech Stack", sub: "language", value: 0.9, constraint: "Language: Python 3.12" },
      { channel: "Tech Stack", sub: "framework", value: 0.9, constraint: "Framework: FastAPI 0.104" },
      { channel: "Tech Stack", sub: "database", value: 0.9, constraint: "Database: PostgreSQL 15" },
      { channel: "Tech Stack", sub: "cache", value: 0.9, constraint: "Cache: Redis" },
    ],
    ambiguities: [],
    density: 0.17,
  },
  {
    question: `What API style will you use (REST, GraphQL, gRPC)? Do you need real-time capabilities?`,
    response: `RESTful API with URL-path versioning (v1). WebSocket at /v1/ws/tasks/{team_id} for real-time task updates. Cursor-based pagination with max page size 50.`,
    updates: [
      { channel: "API", sub: "endpoints", value: 0.5, constraint: "API style: REST" },
      { channel: "API", sub: "realtime", value: 0.8, constraint: "Realtime: WebSocket" },
      { channel: "API", sub: "versioning", value: 0.7, constraint: "Versioning: URL path v1" },
      { channel: "Performance", sub: "pagination", value: 0.8, constraint: "Pagination: cursor-based" },
    ],
    ambiguities: [],
    density: 0.24,
  },
  {
    question: `How will users authenticate? What's the authorization model?`,
    response: `JWT authentication with RS256 signing. 15-minute access tokens, 7-day refresh tokens with rotation. RBAC: admin, manager, member. No MFA for v1. Session stored in Redis.`,
    updates: [
      { channel: "Auth", sub: "method", value: 0.8, constraint: "Auth: JWT RS256" },
      { channel: "Auth", sub: "authorization", value: 0.8, constraint: "Authorization: RBAC" },
      { channel: "Auth", sub: "session", value: 0.8, constraint: "Session: refresh token rotation" },
      { channel: "Auth", sub: "mfa", value: 0.9, constraint: "MFA: not required for v1" },
    ],
    ambiguities: [],
    density: 0.33,
  },
  {
    question: `Where will this be deployed? What's the CI/CD pipeline?`,
    response: `AWS with Kubernetes (EKS). Docker containers, GitHub Actions CI/CD. Blue-green deployment. Three environments: dev, staging, prod. Horizontal auto-scaling target 70% CPU.`,
    updates: [
      { channel: "Deployment", sub: "infrastructure", value: 0.8, constraint: "Infrastructure: AWS EKS" },
      { channel: "Deployment", sub: "cicd", value: 0.8, constraint: "CI/CD: GitHub Actions" },
      { channel: "Deployment", sub: "environments", value: 0.7, constraint: "Envs: dev/staging/prod" },
      { channel: "Deployment", sub: "scaling", value: 0.8, constraint: "Scaling: horizontal auto" },
    ],
    ambiguities: [],
    density: 0.42,
  },
  {
    question: `How should errors be categorized? What retry and logging policies do you need?`,
    response: `400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 429 rate limit, 500 internal. Exponential backoff (max 3 retries, 1s base). Circuit breaker on Redis (5 failures, 30s recovery). Structured JSON logging with correlation IDs.`,
    updates: [
      { channel: "Error Handling", sub: "taxonomy", value: 0.5, constraint: "HTTP status codes defined" },
      { channel: "Error Handling", sub: "retry", value: 0.8, constraint: "Retry: exponential backoff" },
      { channel: "Error Handling", sub: "circuit_breaker", value: 0.8, constraint: "Circuit breaker pattern" },
      { channel: "Error Handling", sub: "logging", value: 0.8, constraint: "Logging: JSON structured" },
    ],
    ambiguities: [],
    density: 0.50,
  },
  {
    question: `What are your latency targets and security requirements?`,
    response: `P50 < 50ms, P95 < 100ms, P99 < 500ms. 1000 rps sustained. Connection pooling: 20 PG, 10 Redis. TLS at load balancer, encryption at rest via KMS. CORS: app.example.com only. Rate limiting: 100 req/min per user.`,
    updates: [
      { channel: "Performance", sub: "latency", value: 0.7, constraint: "Latency: P50<50ms P95<100ms" },
      { channel: "Performance", sub: "throughput", value: 0.7, constraint: "Throughput: 1000 rps" },
      { channel: "Security", sub: "encryption", value: 0.8, constraint: "TLS + encryption at rest" },
      { channel: "Security", sub: "cors", value: 0.7, constraint: "CORS: app.example.com" },
      { channel: "Security", sub: "rate_limiting", value: 0.8, constraint: "Rate limit: 100 req/min" },
    ],
    ambiguities: [],
    density: 0.57,
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

export default function AgentWalkthrough() {
  const [step, setStep] = useState(0);

  const visibleExchanges = EXCHANGES.slice(0, step + 1);
  const current = EXCHANGES[step];
  const keywords = current.updates.map(u => u.constraint.split(": ").pop() || "").filter(Boolean);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", overflow: "hidden" }}>
      {/* Left: Conversation */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", borderRight: `1px solid ${C.border}` }}>
        <h3 style={{ color: C.text, fontSize: 16, marginBottom: 16 }}>Agent Session: Task Management API</h3>

        {visibleExchanges.map((ex, i) => (
          <div key={i} style={{ marginBottom: 20, opacity: i === step ? 1 : 0.6 }}>
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
      <div style={{ width: 320, overflow: "auto", padding: "20px 16px", background: C.surface }}>
        <h3 style={{ color: C.text, fontSize: 16, marginBottom: 4 }}>Channel Dashboard</h3>
        <p style={{ color: C.accent, fontSize: 13, margin: "0 0 16px" }}>
          Density: {(current.density * 100).toFixed(1)}%
        </p>

        {["Purpose", "Data Model", "API", "Tech Stack", "Auth", "Deployment", "Error Handling", "Performance", "Security", "Testing"].map(name => {
          const updates = visibleExchanges.flatMap(ex => ex.updates.filter(u => u.channel === name));
          const maxRes = updates.length > 0 ? Math.max(...updates.map(u => u.value)) : 0;
          const avgRes = updates.length > 0 ? updates.reduce((s, u) => s + u.value, 0) / updates.length : 0;
          return (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: C.text, fontSize: 12 }}>{name}</span>
                <span style={{ color: C.textDim, fontSize: 11 }}>{(avgRes * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${avgRes * 100}%`, height: "100%", borderRadius: 3,
                  background: avgRes >= 0.7 ? C.green : avgRes >= 0.3 ? C.yellow : C.border,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
          );
        })}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            style={{ flex: 1, background: "none", border: `1px solid ${C.border}`,
              color: step === 0 ? C.textDim : C.text, padding: "8px 0", borderRadius: 6,
              cursor: step === 0 ? "default" : "pointer", fontSize: 13 }}>
            Back
          </button>
          <button onClick={() => setStep(s => Math.min(EXCHANGES.length - 1, s + 1))}
            disabled={step === EXCHANGES.length - 1}
            style={{ flex: 1, background: C.accent, border: "none", color: "#fff",
              padding: "8px 0", borderRadius: 6,
              cursor: step === EXCHANGES.length - 1 ? "default" : "pointer", fontSize: 13,
              opacity: step === EXCHANGES.length - 1 ? 0.5 : 1 }}>
            Next Step
          </button>
        </div>
      </div>
    </div>
  );
}
