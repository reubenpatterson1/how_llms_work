import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const C = {
  bg: "#0B1120",
  surface: "#131B2E",
  border: "#1E293B",
  text: "#E2E8F0",
  textDim: "#94A3B8",
  accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22C55E",
  greenGlow: "rgba(34,197,94,0.15)",
  red: "#EF4444",
  yellow: "#EAB308",
  orange: "#F97316",
};

const FONT = "'IBM Plex Sans', system-ui, sans-serif";

/* ── Model definitions ── */
const MODELS = [
  { id: "haiku", label: "Claude Haiku 4.5", inRate: 0.8, outRate: 4, latencyMul: 0.5 },
  { id: "sonnet", label: "Claude Sonnet 4", inRate: 3, outRate: 15, latencyMul: 1.0 },
  { id: "opus", label: "Claude Opus 4", inRate: 15, outRate: 75, latencyMul: 1.8 },
];

/* ── Per-component token data (Dense prompts, base values) ── */
const COMPONENTS_DENSE = [
  { name: "AnimationEngine", short: "Animation", inTok: 280, outTok: 120, latencyBase: 1.8 },
  { name: "ResetController", short: "Reset", inTok: 150, outTok: 60, latencyBase: 1.2 },
  { name: "WeatherService", short: "Weather", inTok: 420, outTok: 180, latencyBase: 3.1 },
  { name: "CitySelector", short: "City", inTok: 200, outTok: 90, latencyBase: 1.6 },
  { name: "LayoutShell", short: "Layout", inTok: 350, outTok: 150, latencyBase: 2.8 },
];

/* Vague prompts: fewer input tokens, many more output tokens, retries */
const VAGUE_MULTIPLIER = { inScale: 0.667, outScale: 2.333, retries: 1.5 };

function costForTokens(inTok, outTok, model) {
  return (inTok * model.inRate + outTok * model.outRate) / 1_000_000;
}

/* ── Bar color by relative cost ── */
function barColor(cost, maxCost) {
  const ratio = cost / maxCost;
  if (ratio < 0.4) return C.green;
  if (ratio < 0.7) return C.yellow;
  return C.orange;
}

/* ── Shared styles ── */
const S = {
  root: {
    fontFamily: FONT,
    background: C.bg,
    color: C.text,
    padding: 24,
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    marginBottom: 20,
    letterSpacing: "-0.02em",
  },
  grid: {
    display: "grid",
    gap: 20,
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: C.textDim,
    marginBottom: 4,
  },
  bigNum: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
  },
};

/* ── Custom Recharts tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: FONT,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: C.text }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color || C.text }}>
          {p.name}: {typeof p.value === "number" && p.value < 1 ? `$${p.value.toFixed(4)}` : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CostingDashboard() {
  const [modelId, setModelId] = useState("sonnet");
  const [optimized, setOptimized] = useState(true);

  const model = MODELS.find((m) => m.id === modelId);

  /* Compute per-component data for current state */
  const componentData = useMemo(() => {
    return COMPONENTS_DENSE.map((comp) => {
      const inTok = optimized
        ? comp.inTok
        : Math.round(comp.inTok * VAGUE_MULTIPLIER.inScale);
      const outTok = optimized
        ? comp.outTok
        : Math.round(comp.outTok * VAGUE_MULTIPLIER.outScale);
      const retries = optimized ? 0 : VAGUE_MULTIPLIER.retries;
      const effectiveIn = Math.round(inTok * (1 + retries));
      const effectiveOut = Math.round(outTok * (1 + retries));
      const cost = costForTokens(effectiveIn, effectiveOut, model);
      const latency = comp.latencyBase * model.latencyMul * (optimized ? 1 : 1.6);
      return {
        name: comp.short,
        fullName: comp.name,
        inTok: effectiveIn,
        outTok: effectiveOut,
        cost,
        latency: Math.round(latency * 10) / 10,
      };
    });
  }, [modelId, optimized]);

  /* Summary stats */
  const summary = useMemo(() => {
    const totalCost = componentData.reduce((s, c) => s + c.cost, 0);
    const totalTokens = componentData.reduce((s, c) => s + c.inTok + c.outTok, 0);
    const avgLatency =
      componentData.reduce((s, c) => s + c.latency, 0) / componentData.length;
    const costPerComp = totalCost / componentData.length;
    return { totalCost, totalTokens, avgLatency, costPerComp };
  }, [componentData]);

  /* Chart data for cost per component */
  const costChartData = useMemo(() => {
    const maxCost = Math.max(...componentData.map((c) => c.cost));
    return componentData.map((c) => ({
      ...c,
      fill: barColor(c.cost, maxCost),
    }));
  }, [componentData]);

  /* Chart data for token breakdown */
  const tokenChartData = useMemo(() => {
    return componentData.map((c) => ({
      name: c.name,
      "Input Tokens": c.inTok,
      "Output Tokens": c.outTok,
    }));
  }, [componentData]);

  /* Savings percentage */
  const savings = useMemo(() => {
    const vagueData = COMPONENTS_DENSE.map((comp) => {
      const inTok = Math.round(comp.inTok * VAGUE_MULTIPLIER.inScale);
      const outTok = Math.round(comp.outTok * VAGUE_MULTIPLIER.outScale);
      const retries = VAGUE_MULTIPLIER.retries;
      return costForTokens(
        Math.round(inTok * (1 + retries)),
        Math.round(outTok * (1 + retries)),
        model
      );
    });
    const denseData = COMPONENTS_DENSE.map((comp) =>
      costForTokens(comp.inTok, comp.outTok, model)
    );
    const vagueTotal = vagueData.reduce((a, b) => a + b, 0);
    const denseTotal = denseData.reduce((a, b) => a + b, 0);
    if (vagueTotal === 0) return 0;
    return Math.round(((vagueTotal - denseTotal) / vagueTotal) * 100);
  }, [modelId]);

  return (
    <div style={S.root}>
      <h2 style={S.heading}>LLM API Costing: Hello World Weather App</h2>

      <div style={{ ...S.grid, gridTemplateRows: "auto auto auto" }}>
        {/* ═══ TOP ROW: Model Selector + Stats ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: 20,
          }}
        >
          {/* Model selector */}
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 12 }}>Model</div>
            {MODELS.map((m) => (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  marginBottom: 4,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: modelId === m.id ? C.accentGlow : "transparent",
                  border:
                    modelId === m.id
                      ? `1px solid ${C.accent}`
                      : `1px solid transparent`,
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="model"
                  checked={modelId === m.id}
                  onChange={() => setModelId(m.id)}
                  style={{ accentColor: C.accent }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>
                    {m.inRate === 0
                      ? "Free (self-hosted)"
                      : `$${m.inRate} / $${m.outRate} per MTok`}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Summary stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
            }}
          >
            <StatCard
              label="Total Cost"
              value={
                model.inRate === 0
                  ? "$0.000"
                  : `$${summary.totalCost.toFixed(3)}`
              }
              color={C.green}
            />
            <StatCard
              label="Total Tokens"
              value={summary.totalTokens.toLocaleString()}
              color={C.accent}
            />
            <StatCard
              label="Avg Latency"
              value={`${summary.avgLatency.toFixed(1)}s`}
              color={C.yellow}
            />
            <StatCard
              label="Cost / Component"
              value={
                model.inRate === 0
                  ? "$0.000"
                  : `$${summary.costPerComp.toFixed(4)}`
              }
              color={C.orange}
            />
          </div>
        </div>

        {/* ═══ MIDDLE ROW: Charts ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          {/* Cost per component bar chart */}
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 12 }}>
              Cost per Component
            </div>
            <ResponsiveContainer key={`cost-${modelId}-${optimized}`} width="100%" height={260}>
              <BarChart
                data={costChartData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: C.textDim, fontSize: 11, fontFamily: FONT }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.textDim, fontSize: 11, fontFamily: FONT }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (v === 0) return "$0"
                    const decimals = v < 0.001 ? 5 : v < 0.01 ? 4 : 3
                    return `$${v.toFixed(decimals)}`
                  }}
                  width={58}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar
                  dataKey="cost"
                  name="Cost"
                  radius={[4, 4, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {costChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Token breakdown stacked bar chart */}
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 12 }}>
              Token Breakdown by Component
            </div>
            <ResponsiveContainer key={`tokens-${modelId}-${optimized}`} width="100%" height={260}>
              <BarChart
                data={tokenChartData}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: C.textDim, fontSize: 11, fontFamily: FONT }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.textDim, fontSize: 11, fontFamily: FONT }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: FONT, color: C.textDim }}
                />
                <Bar
                  dataKey="Input Tokens"
                  stackId="tokens"
                  fill={C.accent}
                  radius={[0, 0, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
                <Bar
                  dataKey="Output Tokens"
                  stackId="tokens"
                  fill={C.orange}
                  radius={[4, 4, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ BOTTOM ROW: Optimization Demo ═══ */}
        <div style={S.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ ...S.label, marginBottom: 2 }}>
                Prompt Optimization
              </div>
              <div style={{ fontSize: 13, color: C.textDim }}>
                Compare vague vs. dense prompt engineering strategies
              </div>
            </div>

            {/* Toggle button */}
            <button
              onClick={() => setOptimized((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                borderRadius: 8,
                border: optimized
                  ? `1px solid ${C.green}`
                  : `1px solid ${C.border}`,
                background: optimized ? C.greenGlow : C.surface,
                color: optimized ? C.green : C.textDim,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: optimized ? C.green : C.border,
                  position: "relative",
                  transition: "background 0.3s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: optimized ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: C.text,
                    transition: "left 0.3s",
                  }}
                />
              </span>
              {optimized ? "Dense Prompts" : "Vague Prompts"}
            </button>
          </div>

          {/* Comparison cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            {/* Vague side */}
            <ComparisonCard
              title="Vague Prompts"
              active={!optimized}
              items={[
                {
                  label: "Total Cost",
                  value:
                    model.inRate === 0
                      ? "$0.000"
                      : `$${vagueTotal(model).toFixed(3)}`,
                },
                {
                  label: "Input Tokens",
                  value: vagueTokens().input.toLocaleString(),
                },
                {
                  label: "Output Tokens",
                  value: vagueTokens().output.toLocaleString(),
                },
                { label: "Avg Retries", value: "1.5" },
              ]}
              borderColor={C.red}
              glowColor="rgba(239,68,68,0.12)"
            />

            {/* Arrow + savings */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  color: C.green,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {model.inRate === 0 ? "--" : `${savings}%`}
              </div>
              <div
                style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}
              >
                savings
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: C.green,
                  marginTop: 4,
                }}
              >
                &#x2192;
              </div>
            </div>

            {/* Dense side */}
            <ComparisonCard
              title="Dense Prompts"
              active={optimized}
              items={[
                {
                  label: "Total Cost",
                  value:
                    model.inRate === 0
                      ? "$0.000"
                      : `$${denseTotal(model).toFixed(3)}`,
                },
                {
                  label: "Input Tokens",
                  value: denseTokens().input.toLocaleString(),
                },
                {
                  label: "Output Tokens",
                  value: denseTokens().output.toLocaleString(),
                },
                { label: "Avg Retries", value: "0" },
              ]}
              borderColor={C.green}
              glowColor={C.greenGlow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper: compute totals for comparison cards ── */
function vagueTokens() {
  let input = 0;
  let output = 0;
  for (const comp of COMPONENTS_DENSE) {
    const inTok = Math.round(comp.inTok * VAGUE_MULTIPLIER.inScale);
    const outTok = Math.round(comp.outTok * VAGUE_MULTIPLIER.outScale);
    const retries = VAGUE_MULTIPLIER.retries;
    input += Math.round(inTok * (1 + retries));
    output += Math.round(outTok * (1 + retries));
  }
  return { input, output };
}

function denseTokens() {
  let input = 0;
  let output = 0;
  for (const comp of COMPONENTS_DENSE) {
    input += comp.inTok;
    output += comp.outTok;
  }
  return { input, output };
}

function vagueTotal(model) {
  const t = vagueTokens();
  return costForTokens(t.input, t.output, model);
}

function denseTotal(model) {
  const t = denseTokens();
  return costForTokens(t.input, t.output, model);
}

/* ── Stat card sub-component ── */
function StatCard({ label, value, color }) {
  return (
    <div style={S.card}>
      <div style={S.label}>{label}</div>
      <div
        style={{
          ...S.bigNum,
          color,
          transition: "color 0.3s",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Comparison card sub-component ── */
function ComparisonCard({ title, active, items, borderColor, glowColor }) {
  return (
    <div
      style={{
        ...S.card,
        border: active
          ? `1px solid ${borderColor}`
          : `1px solid ${C.border}`,
        background: active ? glowColor : C.surface,
        opacity: active ? 1 : 0.55,
        transition: "all 0.4s",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
          color: active ? borderColor : C.textDim,
          transition: "color 0.3s",
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: `1px solid ${C.border}`,
            fontSize: 13,
          }}
        >
          <span style={{ color: C.textDim }}>{item.label}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
