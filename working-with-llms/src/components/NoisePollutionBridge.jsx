import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
  mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ── Data ──────────────────────────────────────────────────────────────────────

const VAGUE_PROMPT = {
  label: "Vague Prompt",
  tokens: [
    { t: "Build", type: "structural", weight: 0.06 },
    { t: "me", type: "noise", weight: 0.03 },
    { t: "a", type: "noise", weight: 0.02 },
    { t: "task", type: "grounded", weight: 0.14 },
    { t: "management", type: "grounded", weight: 0.12 },
    { t: "API", type: "grounded", weight: 0.11 },
    { t: "with", type: "noise", weight: 0.03 },
    { t: "real-time", type: "inferred", weight: 0.09 },
    { t: "updates", type: "inferred", weight: 0.08 },
  ],
  // 3 layers of activation — flattening as noise compounds
  layers: [
    [0.3, 0.1, 0.05, 0.7, 0.6, 0.5, 0.08, 0.4, 0.35],
    [0.2, 0.08, 0.04, 0.5, 0.4, 0.35, 0.06, 0.25, 0.2],
    [0.15, 0.06, 0.03, 0.35, 0.28, 0.22, 0.04, 0.16, 0.12],
  ],
  channels: [
    { label: "Purpose", resolution: 0.6, fill: "inferred" },
    { label: "Data Model", resolution: 0.1, fill: "confabulated" },
    { label: "API", resolution: 0.3, fill: "confabulated" },
    { label: "Tech Stack", resolution: 0.0, fill: "confabulated" },
    { label: "Auth", resolution: 0.0, fill: "confabulated" },
    { label: "Deployment", resolution: 0.0, fill: "confabulated" },
    { label: "Error Handling", resolution: 0.0, fill: "confabulated" },
    { label: "Performance", resolution: 0.1, fill: "confabulated" },
    { label: "Security", resolution: 0.0, fill: "confabulated" },
    { label: "Testing", resolution: 0.0, fill: "confabulated" },
  ],
};

const DENSE_PROMPT = {
  label: "Dense Prompt",
  tokens: [
    { t: "Node.js 20", type: "grounded", weight: 0.12 },
    { t: "Fastify 4", type: "grounded", weight: 0.11 },
    { t: "PostgreSQL 15", type: "grounded", weight: 0.13 },
    { t: "JWT+RBAC", type: "grounded", weight: 0.10 },
    { t: "tasks(id,title,status,assignee)", type: "grounded", weight: 0.14 },
    { t: "SSE /events", type: "grounded", weight: 0.11 },
    { t: "Docker→ECS", type: "grounded", weight: 0.09 },
    { t: "p95<200ms", type: "grounded", weight: 0.10 },
    { t: "Jest 80%", type: "grounded", weight: 0.10 },
  ],
  layers: [
    [0.6, 0.55, 0.7, 0.5, 0.75, 0.6, 0.45, 0.55, 0.5],
    [0.65, 0.6, 0.75, 0.55, 0.8, 0.65, 0.5, 0.6, 0.55],
    [0.7, 0.65, 0.8, 0.6, 0.85, 0.7, 0.55, 0.65, 0.6],
  ],
  channels: [
    { label: "Purpose", resolution: 0.9, fill: "grounded" },
    { label: "Data Model", resolution: 0.85, fill: "grounded" },
    { label: "API", resolution: 0.9, fill: "grounded" },
    { label: "Tech Stack", resolution: 1.0, fill: "grounded" },
    { label: "Auth", resolution: 0.8, fill: "grounded" },
    { label: "Deployment", resolution: 0.7, fill: "grounded" },
    { label: "Error Handling", resolution: 0.5, fill: "inferred" },
    { label: "Performance", resolution: 0.85, fill: "grounded" },
    { label: "Security", resolution: 0.6, fill: "inferred" },
    { label: "Testing", resolution: 0.8, fill: "grounded" },
  ],
};

const TOKEN_COLORS = {
  grounded: C.green,
  inferred: C.yellow,
  noise: "#64748B",
  structural: "#64748B",
  confabulated: C.red,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, children, flex = 1 }) {
  return (
    <div style={{
      flex, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "14px 16px", display: "flex", flexDirection: "column", minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontFamily: C.mono, color: C.textDim, textTransform: "uppercase",
        letterSpacing: 1.5, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function TokenRow({ tokens, animate }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => { if (animate) { setShow(false); const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); } }, [animate]);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
      {tokens.map((tok, i) => (
        <div key={i} style={{
          padding: "3px 7px", borderRadius: 4, fontSize: 11, fontFamily: C.mono,
          background: `${TOKEN_COLORS[tok.type]}15`,
          border: `1px solid ${TOKEN_COLORS[tok.type]}40`,
          color: TOKEN_COLORS[tok.type],
          opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(8px)",
          transition: `all 0.3s ease ${i * 0.05}s`,
        }}>
          {tok.t}
        </div>
      ))}
    </div>
  );
}

function AttentionBars({ tokens, animate }) {
  const [widths, setWidths] = useState(tokens.map(() => 0));
  useEffect(() => {
    const t = setTimeout(() => setWidths(tokens.map(tok => tok.weight * 100 / 0.15)), animate ? 400 : 0);
    return () => clearTimeout(t);
  }, [tokens, animate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Attention distribution</div>
      {tokens.map((tok, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 50, fontSize: 8, fontFamily: C.mono, color: C.textDim, textAlign: "right",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tok.t}</div>
          <div style={{ flex: 1, height: 8, background: `${C.border}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${widths[i]}%`, height: "100%", borderRadius: 4,
              background: TOKEN_COLORS[tok.type],
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ width: 28, fontSize: 8, fontFamily: C.mono, color: C.textDim }}>
            {(tok.weight * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivationLayers({ layers, tokens, animate }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => { if (animate) { setShow(false); const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t); } }, [animate]);

  const maxVal = Math.max(...layers.flat());
  const layerLabels = ["Early", "Middle", "Late"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {layers.map((layer, li) => (
        <div key={li}>
          <div style={{ fontSize: 8, fontFamily: C.mono, color: C.textDim, marginBottom: 3 }}>
            Layer {li + 1} ({layerLabels[li]})
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 36 }}>
            {layer.map((val, ti) => {
              const h = show ? (val / maxVal) * 32 : 2;
              const tok = tokens[ti];
              return (
                <div key={ti} style={{
                  flex: 1, height: h, minHeight: 2, borderRadius: "3px 3px 0 0",
                  background: TOKEN_COLORS[tok.type],
                  opacity: show ? 0.8 : 0.2,
                  transition: `all 0.6s ease ${li * 0.15 + ti * 0.03}s`,
                }} title={`${tok.t}: ${(val * 100).toFixed(0)}%`} />
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, color: C.textDim, fontStyle: "italic", marginTop: 2 }}>
        {layers[2].every(v => v < 0.25)
          ? "Activations flatten through layers — noise compounds, signal degrades"
          : "Activations sharpen through layers — constraints reinforce, signal strengthens"}
      </div>
    </div>
  );
}

function ChannelBars({ channels, animate }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => { if (animate) { setShow(false); const t = setTimeout(() => setShow(true), 600); return () => clearTimeout(t); } }, [animate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {channels.map((ch, i) => {
        const fillColor = ch.fill === "grounded" ? C.green : ch.fill === "inferred" ? C.yellow : C.red;
        const barW = show ? ch.resolution * 100 : 0;
        const gapW = show && ch.resolution < 0.8 ? (1 - ch.resolution) * 100 : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 62, fontSize: 8, fontFamily: C.mono, color: C.textDim, textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.label}</div>
            <div style={{ flex: 1, height: 10, background: C.border, borderRadius: 4, overflow: "hidden",
              display: "flex" }}>
              {/* Resolved portion */}
              <div style={{
                width: `${barW}%`, height: "100%",
                background: fillColor, transition: "width 0.6s ease",
              }} />
              {/* Confabulated fill for unresolved */}
              {ch.fill === "confabulated" && ch.resolution < 0.8 && (
                <div style={{
                  width: `${gapW}%`, height: "100%",
                  background: `repeating-linear-gradient(45deg, ${C.red}30, ${C.red}30 2px, transparent 2px, transparent 4px)`,
                  transition: "width 0.6s ease 0.3s",
                }} />
              )}
            </div>
            <div style={{ width: 30, fontSize: 8, fontFamily: C.mono, color: fillColor }}>
              {(ch.resolution * 100).toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Flow Arrows ───────────────────────────────────────────────────────────────

function FlowArrow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, flexShrink: 0 }}>
      <svg viewBox="0 0 20 40" width={16} height={32}>
        <path d="M4 20 L14 20 M10 14 L16 20 L10 26" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NoisePollutionBridge() {
  const [mode, setMode] = useState("vague");
  const [animKey, setAnimKey] = useState(0);
  const data = mode === "vague" ? VAGUE_PROMPT : DENSE_PROMPT;

  const toggle = (m) => {
    setMode(m);
    setAnimKey(k => k + 1);
  };

  const vagueCount = VAGUE_PROMPT.channels.filter(c => c.fill === "confabulated").length;
  const denseCount = DENSE_PROMPT.channels.filter(c => c.fill === "confabulated").length;

  return (
    <div style={{ background: C.bg, padding: "20px 16px", minHeight: "100%", fontFamily: C.sans }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            From Noise to Confabulation: The Causal Chain
          </div>
          <div style={{ fontSize: 12, color: C.textDim, maxWidth: 650, margin: "0 auto" }}>
            Watch how prompt tokens flow through attention, compound across layers, and ultimately determine
            whether the model executes from constraints or invents from training defaults.
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
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

        {/* Three-panel flow */}
        <div key={animKey} style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
          {/* Panel 1: Prompt + Attention */}
          <Panel title="1. Prompt Tokens & Attention" flex={1.1}>
            <TokenRow tokens={data.tokens} animate />
            <AttentionBars tokens={data.tokens} animate />
            <div style={{ marginTop: 8, fontSize: 9, color: mode === "vague" ? C.red : C.green, fontStyle: "italic" }}>
              {mode === "vague"
                ? "Attention spread thin — noise tokens steal probability mass"
                : "Attention focused — every token carries constraint signal"}
            </div>
          </Panel>

          <FlowArrow />

          {/* Panel 2: Activation Layers */}
          <Panel title="2. Multi-Layer Activation" flex={1}>
            <ActivationLayers layers={data.layers} tokens={data.tokens} animate />
          </Panel>

          <FlowArrow />

          {/* Panel 3: Channel Resolution */}
          <Panel title="3. Channel Resolution" flex={1.1}>
            <ChannelBars channels={data.channels} animate />
            <div style={{
              marginTop: 10, padding: "8px 10px", borderRadius: 6,
              background: mode === "vague" ? `${C.red}10` : `${C.green}10`,
              border: `1px solid ${mode === "vague" ? `${C.red}30` : `${C.green}30`}`,
            }}>
              <div style={{ fontSize: 10, fontFamily: C.mono, color: mode === "vague" ? C.red : C.green, fontWeight: 600 }}>
                {mode === "vague"
                  ? `${vagueCount}/10 channels unresolved → model will confabulate`
                  : `${denseCount}/10 channels unresolved → model executes from spec`}
              </div>
            </div>
          </Panel>
        </div>

        {/* Causal chain summary */}
        <div style={{
          marginTop: 14, padding: "10px 16px", borderRadius: 8,
          background: C.surface, border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap",
        }}>
          {[
            { label: mode === "vague" ? "Noise tokens" : "Constraint tokens", color: mode === "vague" ? "#64748B" : C.green },
            { label: "→" },
            { label: mode === "vague" ? "Diluted attention" : "Focused attention", color: mode === "vague" ? C.orange : C.green },
            { label: "→" },
            { label: mode === "vague" ? "Flat activations" : "Sharp activations", color: mode === "vague" ? C.red : C.green },
            { label: "→" },
            { label: mode === "vague" ? "Unresolved channels" : "Resolved channels", color: mode === "vague" ? C.red : C.green },
            { label: "→" },
            { label: mode === "vague" ? "Confabulated output" : "Grounded output", color: mode === "vague" ? C.red : C.green },
          ].map((item, i) => (
            <span key={i} style={{
              fontSize: item.label === "→" ? 14 : 11,
              fontFamily: item.label === "→" ? C.sans : C.mono,
              color: item.color || C.textDim,
              fontWeight: item.label === "→" ? 400 : 600,
            }}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
