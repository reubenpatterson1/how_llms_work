import { useState, useEffect, useRef } from "react";
import testResults from "../data/test_results.json";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

const CHANNEL_META = [
  { id: "purpose", icon: "◎", label: "Purpose", subs: ["objective", "users", "success_criteria", "scope"] },
  { id: "data_model", icon: "⊞", label: "Data Model", subs: ["entities", "relationships", "cardinality", "constraints", "indexes"] },
  { id: "api", icon: "⇌", label: "API", subs: ["endpoints", "request_shapes", "response_shapes", "versioning", "realtime"] },
  { id: "tech_stack", icon: "⚙", label: "Tech Stack", subs: ["language", "framework", "database", "cache", "message_queue"] },
  { id: "auth", icon: "🔐", label: "Auth", subs: ["method", "authorization", "session", "mfa"] },
  { id: "deployment", icon: "☁", label: "Deployment", subs: ["infrastructure", "cicd", "environments", "scaling"] },
  { id: "error_handling", icon: "⚠", label: "Error Handling", subs: ["taxonomy", "retry", "circuit_breaker", "logging"] },
  { id: "performance", icon: "⚡", label: "Performance", subs: ["latency", "throughput", "optimization", "pagination"] },
  { id: "security", icon: "🛡", label: "Security", subs: ["input_validation", "encryption", "cors", "rate_limiting"] },
  { id: "testing", icon: "✓", label: "Testing", subs: ["strategy", "coverage", "test_data", "ci_integration"] },
];

function ProgressBar({ value, width = 120 }) {
  const color = value >= 0.8 ? C.green : value >= 0.4 ? C.yellow : C.red;
  return (
    <div style={{ width, height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${value * 100}%`, height: "100%", background: color,
        borderRadius: 4, transition: "width 0.5s ease" }} />
    </div>
  );
}

export default function DensityMethodology() {
  const snapshots = testResults.channel_resolution_over_time || [];
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const timerRef = useRef(null);

  const currentSnap = step >= 0 && step < snapshots.length ? snapshots[step] : null;

  useEffect(() => {
    if (playing && step < snapshots.length - 1) {
      timerRef.current = setTimeout(() => setStep(s => s + 1), 800);
      return () => clearTimeout(timerRef.current);
    } else if (playing) {
      setPlaying(false);
    }
  }, [playing, step, snapshots.length]);

  const getResolution = (channelId) => {
    if (!currentSnap) return 0;
    const ch = currentSnap.channels?.[channelId];
    return ch ? ch.resolution : 0;
  };

  const getSubResolution = (channelId, subId) => {
    if (!currentSnap) return 0;
    const ch = currentSnap.channels?.[channelId];
    if (!ch) return 0;
    const sub = ch.sub_dimensions?.[subId];
    return sub ? sub.resolution : 0;
  };

  const density = currentSnap ? currentSnap.density_score : 0;

  return (
    <div style={{ padding: "20px 30px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 24, margin: 0 }}>10-Channel Density Methodology</h2>
          <p style={{ color: C.textDim, fontSize: 14, margin: "4px 0 0" }}>
            {step < 0 ? "Click Simulate Intake to watch channels fill" :
              `Step ${step + 1} / ${snapshots.length} — Density: ${(density * 100).toFixed(1)}%`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setStep(0); setPlaying(true); }}
            style={{ background: C.accent, color: "#fff", border: "none", padding: "8px 16px",
              borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            Simulate Intake
          </button>
          <button onClick={() => { setStep(-1); setPlaying(false); }}
            style={{ background: "none", color: C.textDim, border: `1px solid ${C.border}`,
              padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            Reset
          </button>
        </div>
      </div>

      {/* Overall density bar */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: C.textDim, fontSize: 13, minWidth: 110 }}>Overall Density</span>
        <div style={{ flex: 1, height: 12, background: C.border, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: `${density * 100}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.red}, ${C.yellow}, ${C.green})`,
            borderRadius: 6, transition: "width 0.5s ease" }} />
        </div>
        <span style={{ color: C.text, fontSize: 14, fontWeight: 600, minWidth: 50, textAlign: "right" }}>
          {(density * 100).toFixed(1)}%
        </span>
      </div>

      {/* Channel grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200, 1fr))", gap: 12 }}>
        {CHANNEL_META.map(ch => {
          const res = getResolution(ch.id);
          const isSelected = selected === ch.id;
          return (
            <div key={ch.id} onClick={() => setSelected(isSelected ? null : ch.id)}
              style={{
                background: isSelected ? `${C.accent}15` : C.surface,
                border: `1px solid ${isSelected ? C.accent : C.border}`,
                borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                transition: "all 0.2s",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{ch.icon}</span>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{(res * 100).toFixed(0)}%</span>
              </div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{ch.label}</div>
              <ProgressBar value={res} width="100%" />

              {isSelected && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  {ch.subs.map(sub => (
                    <div key={sub} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 4 }}>
                      <span style={{ color: C.textDim, fontSize: 12 }}>{sub.replace(/_/g, " ")}</span>
                      <span style={{ color: C.text, fontSize: 11 }}>
                        {(getSubResolution(ch.id, sub) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step slider */}
      {step >= 0 && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: C.textDim, fontSize: 12 }}>Step</span>
          <input type="range" min={0} max={snapshots.length - 1} value={step}
            onChange={e => { setStep(Number(e.target.value)); setPlaying(false); }}
            style={{ flex: 1 }} />
          <span style={{ color: C.text, fontSize: 12 }}>{step + 1}</span>
        </div>
      )}
    </div>
  );
}
