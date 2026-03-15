import { useMemo } from "react";
import testResults from "../data/test_results.json";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

const DECISION_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#EAB308", "#A855F7",
  "#EC4899", "#F97316", "#06B6D4", "#84CC16", "#6366F1",
];

function extractDecisions(text) {
  const lower = text.toLowerCase();
  const decisions = {};

  // Framework
  for (const fw of ["express", "fastapi", "hono", "django", "flask"]) {
    if (lower.includes(fw)) { decisions.Framework = fw; break; }
  }

  // Database
  for (const db of ["mongodb", "mongoose", "postgresql", "pg", "sqlite", "drizzle", "sqlalchemy", "sqlmodel"]) {
    if (lower.includes(db)) { decisions.Database = db; break; }
  }

  // Auth
  for (const auth of ["jwt", "jsonwebtoken", "oauth", "bearer", "httpbearer"]) {
    if (lower.includes(auth)) { decisions.Auth = auth; break; }
  }
  if (!decisions.Auth && !lower.includes("auth")) { decisions.Auth = "none"; }

  // Language
  if (lower.includes("const ") || lower.includes("require(")) decisions.Language = "JavaScript";
  else if (lower.includes("import ") && lower.includes("from ")) {
    if (lower.includes("def ") || lower.includes("async def")) decisions.Language = "Python";
    else decisions.Language = "JavaScript";
  }

  // Port
  const portMatch = lower.match(/(?:listen|port)\D*(\d{4})/);
  if (portMatch) decisions.Port = portMatch[1];

  return decisions;
}

export default function ConsistencyVisualization() {
  const vagueOutputs = testResults.vague?.outputs || [];
  const denseOutputs = testResults.dense?.outputs || [];

  const { vagueDecisions, denseDecisions, allDimensions, valueColorMap } = useMemo(() => {
    const vd = vagueOutputs.map(o => extractDecisions(o.raw_text));
    const dd = denseOutputs.map(o => extractDecisions(o.raw_text));

    const dims = new Set();
    [...vd, ...dd].forEach(d => Object.keys(d).forEach(k => dims.add(k)));
    const allDims = [...dims].sort();

    // Build color map: unique values → colors
    const allValues = new Set();
    [...vd, ...dd].forEach(d => Object.values(d).forEach(v => allValues.add(v)));
    const vcm = {};
    let ci = 0;
    for (const v of allValues) {
      vcm[v] = DECISION_COLORS[ci % DECISION_COLORS.length];
      ci++;
    }

    return { vagueDecisions: vd, denseDecisions: dd, allDimensions: allDims, valueColorMap: vcm };
  }, [vagueOutputs, denseOutputs]);

  const runs = Math.max(vagueDecisions.length, denseDecisions.length);

  return (
    <div style={{ padding: "20px 30px", maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>Run-to-Run Consistency</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
        Each cell shows the architectural decision made in that run. Same color = same decision.
      </p>

      {/* Vague grid */}
      <h3 style={{ color: C.red, fontSize: 16, marginBottom: 12 }}>
        Vague Prompt — {runs} Runs
      </h3>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Dimension</th>
              {Array.from({ length: runs }, (_, i) => (
                <th key={i} style={{ textAlign: "center", padding: "8px 12px", color: C.textDim,
                  fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                  Run {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDimensions.map(dim => (
              <tr key={dim}>
                <td style={{ padding: "8px 12px", color: C.text, fontSize: 13, fontWeight: 500,
                  borderBottom: `1px solid ${C.border}` }}>{dim}</td>
                {Array.from({ length: runs }, (_, i) => {
                  const val = vagueDecisions[i]?.[dim] || "—";
                  const color = valueColorMap[val] || C.border;
                  return (
                    <td key={i} style={{ textAlign: "center", padding: "8px 12px",
                      borderBottom: `1px solid ${C.border}` }}>
                      <span style={{
                        display: "inline-block", padding: "3px 8px", borderRadius: 4,
                        background: `${color}22`, color, fontSize: 12, fontWeight: 500,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {val}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dense grid */}
      <h3 style={{ color: C.green, fontSize: 16, marginBottom: 12 }}>
        Dense Specification — {runs} Runs
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Dimension</th>
              {Array.from({ length: runs }, (_, i) => (
                <th key={i} style={{ textAlign: "center", padding: "8px 12px", color: C.textDim,
                  fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                  Run {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDimensions.map(dim => (
              <tr key={dim}>
                <td style={{ padding: "8px 12px", color: C.text, fontSize: 13, fontWeight: 500,
                  borderBottom: `1px solid ${C.border}` }}>{dim}</td>
                {Array.from({ length: runs }, (_, i) => {
                  const val = denseDecisions[Math.min(i, denseDecisions.length - 1)]?.[dim] || "—";
                  const color = valueColorMap[val] || C.border;
                  return (
                    <td key={i} style={{ textAlign: "center", padding: "8px 12px",
                      borderBottom: `1px solid ${C.border}` }}>
                      <span style={{
                        display: "inline-block", padding: "3px 8px", borderRadius: 4,
                        background: `${color}22`, color, fontSize: 12, fontWeight: 500,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {val}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Consistency scores */}
      <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "12px 16px", flex: 1 }}>
          <div style={{ color: C.red, fontSize: 13, marginBottom: 4 }}>Vague Consistency</div>
          <div style={{ color: C.text, fontSize: 24, fontWeight: 700 }}>
            {((testResults.vague?.metrics?.consistency || 0) * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "12px 16px", flex: 1 }}>
          <div style={{ color: C.green, fontSize: 13, marginBottom: 4 }}>Dense Consistency</div>
          <div style={{ color: C.text, fontSize: 24, fontWeight: 700 }}>
            {((testResults.dense?.metrics?.consistency || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
