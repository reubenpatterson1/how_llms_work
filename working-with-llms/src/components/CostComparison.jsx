import { useState, useEffect } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
  mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ── Pricing: Claude Opus 4 ($15/$75 per M tokens) ────────────────────────────
const PRICE_INPUT = 15.00;  // $/M tokens
const PRICE_OUTPUT = 75.00; // $/M tokens
const DEV_RATE = 85;        // $/hr (mid-senior engineer)

// ── Scenario data ─────────────────────────────────────────────────────────────

const VAGUE = {
  label: "Vague Prompt",
  prompt: '"Build me a task management API with real-time updates"',
  iterations: [
    { step: "Initial generation", input: 100, output: 4200, note: "Express + MongoDB + no auth (model defaults)" },
    { step: "Add authentication", input: 250, output: 3100, note: "Bolted-on JWT — no RBAC, no refresh tokens" },
    { step: "Switch to PostgreSQL", input: 600, output: 4500, note: "Full regeneration — Mongoose code discarded" },
    { step: "Fix error handling", input: 350, output: 2200, note: "Generic try/catch — no taxonomy, no logging" },
    { step: "Security patch (SQLi)", input: 450, output: 2000, note: "Found injection in raw query — parameterize" },
    { step: "Add logging", input: 200, output: 1600, note: "Console.log only — no structured logging" },
    { step: "Fix failing tests", input: 700, output: 2400, note: "Tests assumed MongoDB schema — rewrite" },
    { step: "Add rate limiting + CORS", input: 300, output: 1800, note: "Afterthought — not in original design" },
    { step: "Refactor for code review", input: 550, output: 2500, note: "Inconsistent patterns from 8 iterations" },
    { step: "Add deployment config", input: 250, output: 1200, note: "Dockerfile + basic docker-compose" },
  ],
  devHours: 5.5,
  softCosts: {
    security: { severity: "high", issues: 3, detail: "SQL injection found in iteration 5, no input validation until iteration 8, auth bolted on without proper session management" },
    logging: { severity: "high", issues: 2, detail: "Console.log only — no structured logging, no request IDs, no audit trail. Debugging production issues requires reproducing locally" },
    stability: { severity: "medium", issues: 4, detail: "No circuit breakers, no graceful degradation, generic error responses leak stack traces, no health checks" },
    homogeneity: { severity: "high", issues: 5, detail: "8 iterations = 8 different coding patterns. Mixed async/await and callbacks. Inconsistent error shapes. Three different response formats" },
    testing: { severity: "medium", issues: 2, detail: "Tests written after code, rewritten after DB switch. 45% coverage. No integration tests. No load tests" },
    debt: { severity: "high", issues: 6, detail: "Estimated 2-3 additional dev days to bring to production quality. Hardcoded values, no env config, no graceful shutdown" },
  },
};

const DENSE = {
  label: "Dense Spec",
  prompt: "Architecture Agent → 10-channel Dense Specification (482 tokens)",
  iterations: [
    { step: "Agent intake (10 exchanges)", input: 5200, output: 4100, note: "All 10 channels resolved to 85%+ density" },
    { step: "Dense spec → code generation", input: 1600, output: 4800, note: "Single-shot: all constraints grounded" },
    { step: "Minor fix: env var naming", input: 350, output: 800, note: "Convention alignment — not a design flaw" },
  ],
  devHours: 1.5,
  softCosts: {
    security: { severity: "low", issues: 0, detail: "Input validation, rate limiting, CORS, parameterized queries all specified in the dense spec — generated correctly on first pass" },
    logging: { severity: "low", issues: 0, detail: "Structured JSON logging with request IDs, audit trail, and log levels specified in Error Handling channel — implemented from the start" },
    stability: { severity: "low", issues: 0, detail: "Circuit breakers, health checks, graceful shutdown, and retry policies all specified in Performance + Deployment channels" },
    homogeneity: { severity: "low", issues: 0, detail: "Single generation pass = one consistent coding style. Uniform error shapes, response formats, and async patterns throughout" },
    testing: { severity: "low", issues: 0, detail: "Testing strategy specified upfront: Jest, 80% coverage target, integration tests, fixture factories. Generated alongside code" },
    debt: { severity: "low", issues: 0, detail: "Production-ready on first generation. Environment config via dotenv, Docker + ECS deployment, CI pipeline — all from spec" },
  },
};

const SEVERITY_COLORS = { high: C.red, medium: C.orange, low: C.green };

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalTokens(iters) {
  return iters.reduce((acc, it) => ({ input: acc.input + it.input, output: acc.output + it.output }), { input: 0, output: 0 });
}

function apiCost(totals) {
  return (totals.input / 1e6) * PRICE_INPUT + (totals.output / 1e6) * PRICE_OUTPUT;
}

function devCost(hours) {
  return hours * DEV_RATE;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, vagueVal, denseVal, unit, format, better }) {
  const vStr = format ? format(vagueVal) : vagueVal;
  const dStr = format ? format(denseVal) : denseVal;
  const savings = typeof vagueVal === "number" && typeof denseVal === "number"
    ? Math.round((1 - denseVal / vagueVal) * 100) : null;

  return (
    <div style={{
      flex: 1, minWidth: 130, padding: "14px 16px", background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 10,
    }}>
      <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, textTransform: "uppercase",
        letterSpacing: 1.5, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 8, color: C.red, fontFamily: C.mono, marginBottom: 2 }}>VAGUE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.red, fontFamily: C.mono }}>{vStr}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: C.green, fontFamily: C.mono, marginBottom: 2 }}>DENSE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: C.mono }}>{dStr}</div>
        </div>
      </div>
      {savings !== null && savings > 0 && (
        <div style={{
          marginTop: 8, padding: "3px 8px", borderRadius: 4,
          background: `${C.green}15`, border: `1px solid ${C.green}30`,
          fontSize: 10, fontFamily: C.mono, color: C.green, fontWeight: 600, textAlign: "center",
        }}>
          {savings}% {better || "reduction"}
        </div>
      )}
      {unit && <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>{unit}</div>}
    </div>
  );
}

function IterationTimeline({ data, animate }) {
  const [shown, setShown] = useState(animate ? 0 : data.iterations.length);
  useEffect(() => {
    if (!animate) return;
    setShown(0);
    const t = setInterval(() => setShown(s => { if (s >= data.iterations.length) { clearInterval(t); return s; } return s + 1; }), 200);
    return () => clearInterval(t);
  }, [animate, data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {data.iterations.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
          background: i < shown ? `${C.surface}` : "transparent",
          border: `1px solid ${i < shown ? C.border : "transparent"}`,
          opacity: i < shown ? 1 : 0.2,
          transition: "all 0.3s ease",
        }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 9, fontFamily: C.mono, fontWeight: 700, flexShrink: 0,
            background: i < shown ? `${C.accent}20` : C.border, color: i < shown ? C.accent : C.textDim,
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{it.step}</div>
            <div style={{ fontSize: 9, color: C.textDim }}>{it.note}</div>
          </div>
          <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, flexShrink: 0, textAlign: "right" }}>
            <span style={{ color: C.orange }}>{(it.input / 1000).toFixed(1)}k</span>
            {" / "}
            <span style={{ color: C.accent }}>{(it.output / 1000).toFixed(1)}k</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SoftCostCard({ label, icon, vague, dense }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: "10px 14px", cursor: "pointer",
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: SEVERITY_COLORS[vague.severity],
            }} />
            <span style={{ fontSize: 9, fontFamily: C.mono, color: SEVERITY_COLORS[vague.severity] }}>
              {vague.issues} {vague.issues === 1 ? "issue" : "issues"}
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.textDim }}>→</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: SEVERITY_COLORS[dense.severity],
            }} />
            <span style={{ fontSize: 9, fontFamily: C.mono, color: SEVERITY_COLORS[dense.severity] }}>
              {dense.issues} {dense.issues === 1 ? "issue" : "issues"}
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.textDim }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
          <div style={{ flex: 1, padding: "8px 10px", borderRadius: 6,
            background: `${C.red}08`, border: `1px solid ${C.red}20` }}>
            <div style={{ fontSize: 8, fontFamily: C.mono, color: C.red, marginBottom: 4 }}>VAGUE</div>
            <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>{vague.detail}</div>
          </div>
          <div style={{ flex: 1, padding: "8px 10px", borderRadius: 6,
            background: `${C.green}08`, border: `1px solid ${C.green}20` }}>
            <div style={{ fontSize: 8, fontFamily: C.mono, color: C.green, marginBottom: 4 }}>DENSE</div>
            <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>{dense.detail}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CostComparison() {
  const [tab, setTab] = useState("overview"); // overview | timeline | softcosts
  const [animKey, setAnimKey] = useState(0);

  const vTotals = totalTokens(VAGUE.iterations);
  const dTotals = totalTokens(DENSE.iterations);
  const vApiCost = apiCost(vTotals);
  const dApiCost = apiCost(dTotals);
  const vDevCost = devCost(VAGUE.devHours);
  const dDevCost = devCost(DENSE.devHours);
  const vTotalCost = vApiCost + vDevCost;
  const dTotalCost = dApiCost + dDevCost;

  const TABS = [
    { id: "overview", label: "Cost Overview" },
    { id: "timeline", label: "Iteration Breakdown" },
    { id: "softcosts", label: "Hidden Costs" },
  ];

  return (
    <div style={{ background: C.bg, padding: "20px 16px", minHeight: "100%", fontFamily: C.sans }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            The True Cost of Vagueness
          </div>
          <div style={{ fontSize: 12, color: C.textDim, maxWidth: 600, margin: "0 auto" }}>
            Same task, same model (Claude Opus 4 at $15/$75 per M tokens).
            API costs are the tip of the iceberg — developer time and soft costs dominate.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setAnimKey(k => k + 1); }} style={{
              padding: "7px 18px", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: C.sans,
              cursor: "pointer", transition: "all 0.2s",
              background: tab === t.id ? `${C.accent}20` : "transparent",
              border: `1px solid ${tab === t.id ? C.accent : C.border}`,
              color: tab === t.id ? C.accent : C.textDim,
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div>
            {/* Metric cards */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <MetricCard label="Iterations" vagueVal={VAGUE.iterations.length} denseVal={DENSE.iterations.length}
                format={v => v} better="fewer iterations" />
              <MetricCard label="Input Tokens" vagueVal={vTotals.input} denseVal={dTotals.input}
                format={v => `${(v / 1000).toFixed(1)}k`} />
              <MetricCard label="Output Tokens" vagueVal={vTotals.output} denseVal={dTotals.output}
                format={v => `${(v / 1000).toFixed(1)}k`} />
              <MetricCard label="API Cost" vagueVal={vApiCost} denseVal={dApiCost}
                format={v => `$${v.toFixed(2)}`} better="savings" />
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <MetricCard label="Dev Time" vagueVal={VAGUE.devHours} denseVal={DENSE.devHours}
                format={v => `${v}h`} unit={`@ $${DEV_RATE}/hr`} better="time saved" />
              <MetricCard label="Dev Cost" vagueVal={vDevCost} denseVal={dDevCost}
                format={v => `$${v.toFixed(0)}`} better="savings" />
              <MetricCard label="Total Cost" vagueVal={vTotalCost} denseVal={dTotalCost}
                format={v => `$${v.toFixed(0)}`} better="total savings" />
              <MetricCard label="Code Homogeneity" vagueVal={23} denseVal={95}
                format={v => `${v}%`} better="more consistent" />
            </div>

            {/* The punchline */}
            <div style={{
              padding: "14px 20px", borderRadius: 10,
              background: `${C.green}08`, border: `1px solid ${C.green}25`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 4 }}>
                Dense spec saves ${Math.round(vTotalCost - dTotalCost)} per task ({Math.round((1 - dTotalCost / vTotalCost) * 100)}% reduction)
              </div>
              <div style={{ fontSize: 11, color: C.textDim }}>
                API cost difference is ~${Math.abs(vApiCost - dApiCost).toFixed(2)}. Developer time is {Math.round(vDevCost / dDevCost)}x more expensive with vague prompts.
                The real cost isn't tokens — it's the engineer debugging confabulated code.
              </div>
            </div>
          </div>
        )}

        {/* ── Timeline Tab ── */}
        {tab === "timeline" && (
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontFamily: C.mono, color: C.red, textTransform: "uppercase",
                letterSpacing: 1.5, marginBottom: 8, padding: "4px 10px", borderRadius: 4,
                background: `${C.red}10`, border: `1px solid ${C.red}25`, display: "inline-block",
              }}>Vague — {VAGUE.iterations.length} iterations</div>
              <IterationTimeline key={`v-${animKey}`} data={VAGUE} animate />
              <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.mono, color: C.textDim }}>
                Total: <span style={{ color: C.orange }}>{(vTotals.input / 1000).toFixed(1)}k input</span>
                {" + "}<span style={{ color: C.accent }}>{(vTotals.output / 1000).toFixed(1)}k output</span>
                {" = "}<span style={{ color: C.red }}>${vApiCost.toFixed(2)} API</span>
                {" + "}<span style={{ color: C.red }}>${vDevCost.toFixed(0)} dev time</span>
              </div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontFamily: C.mono, color: C.green, textTransform: "uppercase",
                letterSpacing: 1.5, marginBottom: 8, padding: "4px 10px", borderRadius: 4,
                background: `${C.green}10`, border: `1px solid ${C.green}25`, display: "inline-block",
              }}>Dense — {DENSE.iterations.length} iterations</div>
              <IterationTimeline key={`d-${animKey}`} data={DENSE} animate />
              <div style={{ marginTop: 8, fontSize: 10, fontFamily: C.mono, color: C.textDim }}>
                Total: <span style={{ color: C.orange }}>{(dTotals.input / 1000).toFixed(1)}k input</span>
                {" + "}<span style={{ color: C.accent }}>{(dTotals.output / 1000).toFixed(1)}k output</span>
                {" = "}<span style={{ color: C.green }}>${dApiCost.toFixed(2)} API</span>
                {" + "}<span style={{ color: C.green }}>${dDevCost.toFixed(0)} dev time</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Soft Costs Tab ── */}
        {tab === "softcosts" && (
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, lineHeight: 1.6 }}>
              API tokens are the visible cost. These are the costs that appear weeks later — in incident reports,
              security audits, and the developer who inherits the codebase. Click each category to expand.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SoftCostCard label="Security Vulnerabilities" icon="🔓"
                vague={VAGUE.softCosts.security} dense={DENSE.softCosts.security} />
              <SoftCostCard label="Observability & Logging" icon="📊"
                vague={VAGUE.softCosts.logging} dense={DENSE.softCosts.logging} />
              <SoftCostCard label="System Stability" icon="⚡"
                vague={VAGUE.softCosts.stability} dense={DENSE.softCosts.stability} />
              <SoftCostCard label="Code Homogeneity" icon="🧬"
                vague={VAGUE.softCosts.homogeneity} dense={DENSE.softCosts.homogeneity} />
              <SoftCostCard label="Test Coverage" icon="✓"
                vague={VAGUE.softCosts.testing} dense={DENSE.softCosts.testing} />
              <SoftCostCard label="Technical Debt" icon="🏗"
                vague={VAGUE.softCosts.debt} dense={DENSE.softCosts.debt} />
            </div>

            {/* Totals */}
            <div style={{
              marginTop: 12, padding: "12px 16px", borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`,
              display: "flex", justifyContent: "space-around",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginBottom: 4 }}>VAGUE — TOTAL ISSUES</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.red, fontFamily: C.mono }}>
                  {Object.values(VAGUE.softCosts).reduce((s, c) => s + c.issues, 0)}
                </div>
                <div style={{ fontSize: 9, color: C.textDim }}>across 6 categories</div>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginBottom: 4 }}>DENSE — TOTAL ISSUES</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.green, fontFamily: C.mono }}>
                  {Object.values(DENSE.softCosts).reduce((s, c) => s + c.issues, 0)}
                </div>
                <div style={{ fontSize: 9, color: C.textDim }}>across 6 categories</div>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginBottom: 4 }}>EST. REMEDIATION COST</div>
                <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.red, fontFamily: C.mono }}>$2,040</div>
                    <div style={{ fontSize: 8, color: C.red }}>vague (24h)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: C.mono }}>$0</div>
                    <div style={{ fontSize: 8, color: C.green }}>dense</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
