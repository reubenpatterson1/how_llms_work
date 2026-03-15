import { useState } from "react";
import testResults from "../data/test_results.json";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

const GROUNDING_COLORS = {
  grounded: C.green,
  inferred: C.yellow,
  defaulted: C.orange,
  confabulated: C.red,
};

const GROUNDING_LABELS = {
  grounded: "Grounded — directly from spec",
  inferred: "Inferred — reasonable deduction",
  defaulted: "Defaulted — common pattern, not specified",
  confabulated: "Confabulated — invented from training data",
};

function TokenView({ tokens, title, color }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ color, fontSize: 16, marginBottom: 8 }}>{title}</h3>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
        lineHeight: 1.8, position: "relative" }}>
        {tokens.map((t, i) => (
          <span key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              color: GROUNDING_COLORS[t.grounding] || C.text,
              background: hovered === i ? `${GROUNDING_COLORS[t.grounding]}22` : "transparent",
              borderRadius: 2, cursor: "default", whiteSpace: "pre-wrap",
              transition: "background 0.15s",
            }}>
            {t.text}
          </span>
        ))}

        {hovered !== null && tokens[hovered] && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "8px 12px", zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}>
            <span style={{ color: GROUNDING_COLORS[tokens[hovered].grounding], fontSize: 12 }}>
              {GROUNDING_LABELS[tokens[hovered].grounding]}
            </span>
            <span style={{ color: C.textDim, fontSize: 11, marginLeft: 8 }}>
              &quot;{tokens[hovered].text.trim()}&quot;
            </span>
          </div>
        )}
      </div>

      {/* Breakdown bar */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12 }}>
        {Object.entries(
          tokens.reduce((acc, t) => { acc[t.grounding] = (acc[t.grounding] || 0) + 1; return acc; }, {})
        ).map(([g, count]) => (
          <span key={g} style={{ color: GROUNDING_COLORS[g] }}>
            {g}: {count} ({((count / tokens.length) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HallucinationComparison() {
  const [vagueRun, setVagueRun] = useState(0);
  const vagueOutputs = testResults.vague?.outputs || [];
  const denseOutputs = testResults.dense?.outputs || [];

  const vagueTokens = vagueOutputs[vagueRun]?.tokens || [];
  const denseTokens = denseOutputs[0]?.tokens || [];

  return (
    <div style={{ padding: "20px 30px", maxWidth: 1100, margin: "0 auto", overflow: "auto",
      maxHeight: "calc(100vh - 120px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 24, margin: 0 }}>Token-Level Hallucination Comparison</h2>
          <p style={{ color: C.textDim, fontSize: 14, margin: "4px 0 0" }}>
            Hover any token to see its grounding classification
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12 }}>
          {Object.entries(GROUNDING_COLORS).map(([g, color]) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ color: C.textDim, fontSize: 11 }}>{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Vague run selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <span style={{ color: C.textDim, fontSize: 12, alignSelf: "center" }}>Vague run:</span>
        {vagueOutputs.map((_, i) => (
          <button key={i} onClick={() => setVagueRun(i)}
            style={{
              background: i === vagueRun ? C.accent : "none",
              color: i === vagueRun ? "#fff" : C.textDim,
              border: `1px solid ${i === vagueRun ? C.accent : C.border}`,
              padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12,
            }}>
            #{i + 1}
          </button>
        ))}
      </div>

      <TokenView tokens={vagueTokens} title={`Vague Output (Run #${vagueRun + 1}) — ${((vagueOutputs[vagueRun]?.hallucination_surface || 0) * 100).toFixed(1)}% confabulated`} color={C.red} />
      <TokenView tokens={denseTokens} title={`Dense Output — ${((denseOutputs[0]?.hallucination_surface || 0) * 100).toFixed(1)}% confabulated`} color={C.green} />
    </div>
  );
}
