import { useState } from "react";
import testResults from "../data/test_results.json";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308",
};

const METRICS = [
  {
    key: "hallucination_surface",
    label: "Hallucination Surface",
    desc: "Percentage of confabulated tokens in output",
    unit: "%",
    multiply: 100,
    lowerBetter: true,
    icon: "◉",
  },
  {
    key: "consistency",
    label: "Output Consistency",
    desc: "Jaccard similarity of architectural decisions across runs",
    unit: "%",
    multiply: 100,
    lowerBetter: false,
    icon: "⊞",
  },
  {
    key: "dimension_resolution",
    label: "Dimension Resolution",
    desc: "Percentage of tokens grounded in specification",
    unit: "%",
    multiply: 100,
    lowerBetter: false,
    icon: "△",
  },
  {
    key: "code_quality",
    label: "Code Quality",
    desc: "Structural completeness (endpoints, auth, validation, etc.)",
    unit: "%",
    multiply: 100,
    lowerBetter: false,
    icon: "✓",
  },
];

function Bar({ value, max, color, label }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ color: C.textDim, fontSize: 12, minWidth: 50 }}>{label}</span>
      <div style={{ flex: 1, height: 24, background: C.border, borderRadius: 4, overflow: "hidden",
        position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4,
          transition: "width 0.5s ease" }} />
        <span style={{ position: "absolute", right: 8, top: 3, color: C.text, fontSize: 12, fontWeight: 600 }}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function ComparativeResults() {
  const [selected, setSelected] = useState(null);

  const vague = testResults.vague?.metrics || {};
  const dense = testResults.dense?.metrics || {};
  const deltas = testResults.deltas || {};

  return (
    <div style={{ padding: "20px 30px", maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>Comparative Results</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
        {testResults.iterations} iterations each — vague prompt vs dense specification
      </p>

      {/* Summary delta cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        {METRICS.map(m => {
          const vagueVal = (vague[m.key] || 0) * m.multiply;
          const denseVal = (dense[m.key] || 0) * m.multiply;
          const delta = m.lowerBetter ? vagueVal - denseVal : denseVal - vagueVal;
          const improvement = vagueVal > 0 && m.lowerBetter ? delta / vagueVal : delta;
          const isSelected = selected === m.key;

          return (
            <div key={m.key} onClick={() => setSelected(isSelected ? null : m.key)}
              style={{
                background: isSelected ? `${C.accent}15` : C.surface,
                border: `1px solid ${isSelected ? C.accent : C.border}`,
                borderRadius: 8, padding: "16px", cursor: "pointer", transition: "all 0.2s",
              }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
              <div style={{ color: C.green, fontSize: 20, fontWeight: 700 }}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}{m.unit}
              </div>
              <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>
                {m.lowerBetter ? "reduction" : "improvement"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed comparison bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h3 style={{ color: C.red, fontSize: 16, marginBottom: 12 }}>
            Vague: &quot;Build me a task management API with real-time updates&quot;
          </h3>
          {METRICS.map(m => (
            <div key={m.key} style={{ marginBottom: 16 }}>
              <div style={{ color: C.text, fontSize: 13, marginBottom: 4 }}>{m.label}</div>
              <Bar value={(vague[m.key] || 0) * m.multiply} max={100}
                color={m.lowerBetter ? C.red : C.yellow} label="Vague" />
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ color: C.green, fontSize: 16, marginBottom: 12 }}>
            Dense: Architecture Agent Specification
          </h3>
          {METRICS.map(m => (
            <div key={m.key} style={{ marginBottom: 16 }}>
              <div style={{ color: C.text, fontSize: 13, marginBottom: 4 }}>{m.label}</div>
              <Bar value={(dense[m.key] || 0) * m.multiply} max={100}
                color={m.lowerBetter ? C.green : C.green} label="Dense" />
            </div>
          ))}
        </div>
      </div>

      {/* Selected metric detail */}
      {selected && (
        <div style={{ marginTop: 24, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "16px 20px" }}>
          <h4 style={{ color: C.text, margin: "0 0 8px" }}>
            {METRICS.find(m => m.key === selected)?.label}
          </h4>
          <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>
            {METRICS.find(m => m.key === selected)?.desc}
          </p>
          <div style={{ display: "flex", gap: 40, marginTop: 12 }}>
            <div>
              <span style={{ color: C.red, fontSize: 13 }}>Vague: </span>
              <span style={{ color: C.text, fontWeight: 600 }}>
                {((vague[selected] || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: C.green, fontSize: 13 }}>Dense: </span>
              <span style={{ color: C.text, fontWeight: 600 }}>
                {((dense[selected] || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
