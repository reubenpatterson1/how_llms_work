import { useState, useEffect } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
  mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ── Channel data with sub-dimensions ─────────────────────────────────────────

const CHANNELS = [
  { id: "purpose", icon: "◎", label: "Purpose", subs: ["objective", "users", "success", "scope"] },
  { id: "data", icon: "⊞", label: "Data Model", subs: ["entities", "relations", "cardinality", "indexes"] },
  { id: "api", icon: "⇌", label: "API", subs: ["endpoints", "request", "response", "versioning"] },
  { id: "stack", icon: "⚙", label: "Tech Stack", subs: ["language", "framework", "database", "cache"] },
  { id: "auth", icon: "🔐", label: "Auth", subs: ["method", "authz", "session", "mfa"] },
  { id: "deploy", icon: "☁", label: "Deploy", subs: ["infra", "ci/cd", "envs", "scaling"] },
  { id: "errors", icon: "⚠", label: "Errors", subs: ["taxonomy", "retry", "circuit", "logging"] },
  { id: "perf", icon: "⚡", label: "Perf", subs: ["latency", "throughput", "optimize", "pagination"] },
  { id: "security", icon: "🛡", label: "Security", subs: ["validation", "encryption", "cors", "rate-limit"] },
  { id: "testing", icon: "✓", label: "Testing", subs: ["strategy", "coverage", "test-data", "ci"] },
];

// Vague: only a few subs are filled (inferred), most are confabulated
const VAGUE_FILLS = {
  purpose:  ["inferred", "inferred", "empty", "empty"],
  data:     ["confab", "empty", "empty", "empty"],
  api:      ["confab", "confab", "empty", "empty"],
  stack:    ["confab", "confab", "confab", "empty"],
  auth:     ["confab", "empty", "empty", "empty"],
  deploy:   ["confab", "empty", "empty", "empty"],
  errors:   ["confab", "empty", "empty", "empty"],
  perf:     ["empty", "empty", "empty", "empty"],
  security: ["confab", "empty", "empty", "empty"],
  testing:  ["empty", "empty", "empty", "empty"],
};

// Dense: nearly all subs are grounded
const DENSE_FILLS = {
  purpose:  ["grounded", "grounded", "grounded", "grounded"],
  data:     ["grounded", "grounded", "grounded", "grounded"],
  api:      ["grounded", "grounded", "grounded", "inferred"],
  stack:    ["grounded", "grounded", "grounded", "grounded"],
  auth:     ["grounded", "grounded", "inferred", "empty"],
  deploy:   ["grounded", "grounded", "inferred", "inferred"],
  errors:   ["inferred", "inferred", "empty", "grounded"],
  perf:     ["grounded", "grounded", "grounded", "inferred"],
  security: ["grounded", "inferred", "grounded", "grounded"],
  testing:  ["grounded", "grounded", "inferred", "grounded"],
};

// 5 "output runs" — vague produces different results each time
const VAGUE_RUNS = [
  { stack: "Express + MongoDB", auth: "No auth", port: "3000", db: "Mongoose ODM" },
  { stack: "Fastify + PostgreSQL", auth: "Basic auth", port: "8080", db: "Prisma ORM" },
  { stack: "Express + MySQL", auth: "JWT", port: "3000", db: "Sequelize" },
  { stack: "Koa + MongoDB", auth: "Session cookies", port: "4000", db: "Mongoose ODM" },
  { stack: "Express + SQLite", auth: "API key", port: "3001", db: "Knex.js" },
];

const DENSE_RUNS = [
  { stack: "Fastify 4 + PostgreSQL 15", auth: "JWT + RBAC", port: "3000", db: "pg + compound idx" },
  { stack: "Fastify 4 + PostgreSQL 15", auth: "JWT + RBAC", port: "3000", db: "pg + compound idx" },
  { stack: "Fastify 4 + PostgreSQL 15", auth: "JWT + RBAC", port: "3000", db: "pg + compound idx" },
  { stack: "Fastify 4 + PostgreSQL 15", auth: "JWT + RBAC", port: "3000", db: "pg + compound idx" },
  { stack: "Fastify 4 + PostgreSQL 15", auth: "JWT + RBAC", port: "3000", db: "pg + compound idx" },
];

const FILL_COLORS = {
  grounded: C.green,
  inferred: C.yellow,
  confab: C.red,
  empty: "#1E293B",
};

const FILL_LABELS = {
  grounded: "Grounded",
  inferred: "Inferred",
  confab: "Confabulated",
  empty: "Unresolved",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SubSlot({ status, label, animate, delay }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => {
    if (animate) { setShow(false); const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }
  }, [animate, delay]);

  const color = FILL_COLORS[status];
  const isConfab = status === "confab";

  return (
    <div title={`${label}: ${FILL_LABELS[status]}`} style={{
      width: "100%", height: 14, borderRadius: 3, marginBottom: 2,
      background: show
        ? (isConfab
          ? `repeating-linear-gradient(45deg, ${C.red}40, ${C.red}40 2px, ${C.red}15 2px, ${C.red}15 4px)`
          : status === "empty" ? `${color}40` : `${color}50`)
        : `${C.border}`,
      border: `1px solid ${show ? `${color}60` : C.border}`,
      transition: `all 0.4s ease ${delay}ms`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 7, fontFamily: C.mono, color: show ? color : "transparent",
        transition: `color 0.3s ease ${delay + 200}ms` }}>
        {label}
      </span>
    </div>
  );
}

function ChannelColumn({ channel, fills, animate, delay }) {
  const grounded = fills.filter(f => f === "grounded").length;
  const total = fills.length;
  const pct = Math.round((grounded / total) * 100);
  const hasConfab = fills.some(f => f === "confab");

  return (
    <div style={{
      flex: 1, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <div style={{ fontSize: 14 }}>{channel.icon}</div>
      <div style={{ fontSize: 8, fontFamily: C.mono, color: C.textDim, textAlign: "center", lineHeight: 1.2 }}>
        {channel.label}
      </div>
      <div style={{
        width: "100%", padding: "4px 3px",
        background: hasConfab ? `${C.red}08` : `${C.green}08`,
        border: `1px solid ${hasConfab ? `${C.red}25` : `${C.green}25`}`,
        borderRadius: 6,
      }}>
        {channel.subs.map((sub, i) => (
          <SubSlot key={sub} status={fills[i]} label={sub} animate={animate} delay={delay + i * 80} />
        ))}
      </div>
      <div style={{
        fontSize: 9, fontFamily: C.mono, fontWeight: 600,
        color: hasConfab ? C.red : pct >= 75 ? C.green : C.yellow,
      }}>
        {pct}%
      </div>
    </div>
  );
}

function RunCard({ run, runIdx, isVague, animate }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => {
    if (animate) { setShow(false); const t = setTimeout(() => setShow(true), 800 + runIdx * 120); return () => clearTimeout(t); }
  }, [animate, runIdx]);

  const fields = [
    { label: "Stack", value: run.stack },
    { label: "Auth", value: run.auth },
    { label: "DB", value: run.db },
  ];

  // For vague: highlight differences by comparing to first run
  return (
    <div style={{
      flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 6,
      background: C.surface, border: `1px solid ${isVague ? `${C.red}30` : `${C.green}30`}`,
      opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)",
      transition: `all 0.4s ease`,
    }}>
      <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginBottom: 4 }}>
        Run {runIdx + 1}
      </div>
      {fields.map(f => (
        <div key={f.label} style={{ fontSize: 8, fontFamily: C.mono, marginBottom: 2 }}>
          <span style={{ color: C.textDim }}>{f.label}: </span>
          <span style={{ color: isVague ? C.orange : C.green }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChannelGroundingViz() {
  const [mode, setMode] = useState("vague");
  const [animKey, setAnimKey] = useState(0);

  const fills = mode === "vague" ? VAGUE_FILLS : DENSE_FILLS;
  const runs = mode === "vague" ? VAGUE_RUNS : DENSE_RUNS;
  const isVague = mode === "vague";

  const toggle = (m) => {
    setMode(m);
    setAnimKey(k => k + 1);
  };

  // Stats
  const allFills = CHANNELS.flatMap(ch => fills[ch.id]);
  const groundedCount = allFills.filter(f => f === "grounded").length;
  const confabCount = allFills.filter(f => f === "confab").length;
  const emptyCount = allFills.filter(f => f === "empty").length;

  // Check if all 5 runs are identical
  const runsIdentical = runs.every(r => JSON.stringify(r) === JSON.stringify(runs[0]));

  return (
    <div style={{ background: C.bg, padding: "20px 16px", minHeight: "100%", fontFamily: C.sans }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Channels → Tokens → Consistency
          </div>
          <div style={{ fontSize: 12, color: C.textDim, maxWidth: 650, margin: "0 auto" }}>
            Each architectural channel has sub-dimensions the model must resolve. Unresolved slots get filled from
            training defaults — differently each run. Resolved slots produce identical output every time.
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          {["vague", "dense"].map(m => (
            <button key={m} onClick={() => toggle(m)} style={{
              padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: C.sans,
              cursor: "pointer", transition: "all 0.2s",
              background: mode === m ? (m === "vague" ? `${C.red}20` : `${C.green}20`) : "transparent",
              border: `1px solid ${mode === m ? (m === "vague" ? C.red : C.green) : C.border}`,
              color: mode === m ? (m === "vague" ? C.red : C.green) : C.textDim,
            }}>
              {m === "vague" ? "Vague Prompt" : "Dense Prompt"}
            </button>
          ))}
        </div>

        {/* Channel columns */}
        <div key={`channels-${animKey}`} style={{
          display: "flex", gap: 6, marginBottom: 14,
          padding: "14px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
        }}>
          {CHANNELS.map((ch, i) => (
            <ChannelColumn key={ch.id} channel={ch} fills={fills[ch.id]} animate delay={i * 60} />
          ))}
        </div>

        {/* Stats bar */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 24, marginBottom: 14,
          padding: "8px 16px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
        }}>
          {[
            { label: "Grounded", count: groundedCount, color: C.green },
            { label: "Inferred", count: allFills.filter(f => f === "inferred").length, color: C.yellow },
            { label: "Confabulated", count: confabCount, color: C.red },
            { label: "Unresolved", count: emptyCount, color: C.textDim },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: C.mono }}>{s.count}</div>
              <div style={{ fontSize: 9, color: C.textDim, fontFamily: C.mono }}>{s.label}</div>
            </div>
          ))}
          <div style={{ width: 1, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: isVague ? C.red : C.green, fontFamily: C.mono }}>
              {Math.round((groundedCount / allFills.length) * 100)}%
            </div>
            <div style={{ fontSize: 9, color: C.textDim, fontFamily: C.mono }}>Density</div>
          </div>
        </div>

        {/* 5-Run Consistency Panel */}
        <div style={{
          padding: "14px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: C.mono, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5 }}>
              5 Independent Runs — Same Prompt, Same Model
            </div>
            <div style={{
              fontSize: 10, fontFamily: C.mono, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
              background: runsIdentical ? `${C.green}15` : `${C.red}15`,
              color: runsIdentical ? C.green : C.red,
              border: `1px solid ${runsIdentical ? `${C.green}40` : `${C.red}40`}`,
            }}>
              {runsIdentical ? "100% Consistent" : "All Different"}
            </div>
          </div>

          <div key={`runs-${animKey}`} style={{ display: "flex", gap: 6 }}>
            {runs.map((run, i) => (
              <RunCard key={i} run={run} runIdx={i} isVague={isVague} animate />
            ))}
          </div>

          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 6,
            background: isVague ? `${C.red}08` : `${C.green}08`,
            border: `1px solid ${isVague ? `${C.red}20` : `${C.green}20`}`,
            fontSize: 11, color: isVague ? C.red : C.green, fontStyle: "italic",
          }}>
            {isVague
              ? "Every unresolved channel is a coin flip. 5 runs → 5 different architectures. The model isn't wrong — it's choosing from equally valid training defaults because you didn't constrain the choice."
              : "Every channel is resolved. 5 runs → 5 identical outputs. The model executes rather than invents because every decision is pre-made in the spec."}
          </div>
        </div>
      </div>
    </div>
  );
}
