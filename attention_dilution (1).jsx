import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ============================================================
//  DATA
// ============================================================
const CORE_SENTENCE = [
  { word: "The", id: 0, type: "core" },
  { word: "cat", id: 1, type: "core" },
  { word: "sat", id: 2, type: "core" },
  { word: "on", id: 3, type: "core" },
  { word: "the", id: 4, type: "core" },
  { word: "warm", id: 5, type: "core" },
  { word: "mat", id: 6, type: "core" },
  { word: "and", id: 7, type: "core" },
  { word: "then", id: 8, type: "core" },
  { word: "slept", id: 9, type: "core" },
];

const NOISE_BATCHES = [
  [
    { word: "blue", type: "noise" },
    { word: "seven", type: "noise" },
    { word: "report", type: "noise" },
    { word: "fiscal", type: "noise" },
    { word: "hence", type: "noise" },
  ],
  [
    { word: "rugby", type: "noise" },
    { word: "copper", type: "noise" },
    { word: "delta", type: "noise" },
    { word: "prism", type: "noise" },
    { word: "cactus", type: "noise" },
  ],
  [
    { word: "orbit", type: "noise" },
    { word: "glaze", type: "noise" },
    { word: "vinyl", type: "noise" },
    { word: "quorum", type: "noise" },
    { word: "marsh", type: "noise" },
  ],
];

const BASE_AFFINITIES = [
  [1.0, 2.5, 0.5, 0.3, 0.8, 0.3, 0.4, 0.2, 0.2, 0.3],
  [1.8, 3.0, 2.8, 0.8, 0.5, 1.5, 2.0, 1.0, 0.8, 2.5],
  [0.4, 2.5, 2.0, 2.2, 0.6, 0.8, 2.8, 0.5, 1.2, 1.8],
  [0.3, 0.8, 2.0, 1.5, 1.8, 1.2, 2.5, 0.4, 0.3, 0.5],
  [0.8, 0.5, 0.4, 1.5, 1.0, 2.2, 2.8, 0.3, 0.2, 0.3],
  [0.2, 1.8, 0.6, 0.8, 1.5, 2.0, 3.2, 0.3, 0.4, 1.0],
  [0.3, 2.2, 2.5, 2.0, 2.0, 3.0, 2.5, 0.5, 0.6, 1.5],
  [0.2, 1.0, 0.8, 0.4, 0.3, 0.3, 0.5, 1.5, 2.5, 2.0],
  [0.2, 0.8, 0.5, 0.3, 0.2, 0.3, 0.4, 2.2, 1.8, 3.0],
  [0.3, 3.5, 1.5, 0.5, 0.3, 1.2, 1.8, 0.8, 2.0, 2.5],
];

const SEMANTIC_ROLES = [
  { id: 0, word: "The",   role: "Determiner",   category: "structure",  weight: 0.3,  description: "Specifies the subject — a particular cat, not any cat" },
  { id: 1, word: "cat",   role: "Subject",       category: "who",       weight: 1.0,  description: "The agent — who the sentence is about" },
  { id: 2, word: "sat",   role: "Verb (action)", category: "what",      weight: 0.95, description: "Primary action — what the subject did" },
  { id: 3, word: "on",    role: "Preposition",   category: "structure",  weight: 0.5,  description: "Spatial relationship — connects action to location" },
  { id: 4, word: "the",   role: "Determiner",   category: "structure",  weight: 0.2,  description: "Specifies the object — a particular mat" },
  { id: 5, word: "warm",  role: "Adjective",     category: "detail",    weight: 0.6,  description: "Sensory detail — temperature, comfort, atmosphere" },
  { id: 6, word: "mat",   role: "Object",        category: "where",     weight: 0.85, description: "Location / object — where the action occurred" },
  { id: 7, word: "and",   role: "Conjunction",   category: "structure",  weight: 0.35, description: "Clause connector — signals continuation" },
  { id: 8, word: "then",  role: "Temporal",      category: "when",      weight: 0.55, description: "Sequence marker — establishes ordering of events" },
  { id: 9, word: "slept", role: "Verb (action)", category: "what",      weight: 0.9,  description: "Secondary action — consequence or next event" },
];

const CATEGORY_META = {
  who:       { label: "Who",       color: "#e8927c", icon: "\u{1F464}" },
  what:      { label: "What",      color: "#7ccea0", icon: "\u26A1" },
  where:     { label: "Where",     color: "#7ca8e8", icon: "\u{1F4CD}" },
  when:      { label: "When",      color: "#c87ce8", icon: "\u23F1" },
  detail:    { label: "Detail",    color: "#e8c47c", icon: "\u2726" },
  structure: { label: "Structure", color: "#8899aa", icon: "\u2310" },
};

// ============================================================
//  MATH HELPERS
// ============================================================
function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function computeAttentionMatrix(tokens) {
  const n = tokens.length;
  const matrix = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const ti = tokens[i];
      const tj = tokens[j];
      if (ti.type === "core" && tj.type === "core") {
        const ci = CORE_SENTENCE.findIndex((c) => c.word === ti.word && c.id === ti.id);
        const cj = CORE_SENTENCE.findIndex((c) => c.word === tj.word && c.id === tj.id);
        if (ci >= 0 && cj >= 0) row.push(BASE_AFFINITIES[ci][cj]);
        else row.push(0.3 + Math.random() * 0.4);
      } else if (ti.type === "noise" && tj.type === "noise") {
        row.push(0.5 + Math.random() * 0.6);
      } else {
        row.push(0.15 + Math.random() * 0.35);
      }
    }
    matrix.push(row);
  }
  return matrix.map((row) => softmax(row));
}

function computeSubMatrix(enabledIds) {
  const indices = enabledIds.map((id) => CORE_SENTENCE.findIndex((c) => c.id === id)).filter((i) => i >= 0);
  const n = indices.length;
  if (n === 0) return [];
  const raw = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(BASE_AFFINITIES[indices[i]][indices[j]]);
    }
    raw.push(row);
  }
  return raw.map((r) => softmax(r));
}

function getEntropy(probs) {
  return -probs.reduce((s, p) => s + (p > 1e-10 ? p * Math.log2(p) : 0), 0);
}
function getMaxProb(probs) {
  return Math.max(...probs);
}

// ============================================================
//  COLOR HELPERS
// ============================================================
function attentionColor(value, isCorePair) {
  if (isCorePair) {
    const r = Math.round(20 + value * 200);
    const g = Math.round(30 + value * 60);
    const b = Math.round(60 + value * 40);
    return `rgb(${r},${g},${b})`;
  }
  const gray = Math.round(25 + value * 50);
  return `rgb(${gray},${gray + 5},${gray + 15})`;
}

const FONT_MONO = "'IBM Plex Mono', monospace";
const FONT_SANS = "'IBM Plex Sans', sans-serif";

// ============================================================
//  SHARED COMPONENTS
// ============================================================
function TokenBar({ tokens, selectedIdx, onSelect }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
      {tokens.map((t, i) => {
        const isSelected = i === selectedIdx;
        const isCore = t.type === "core";
        return (
          <button key={`${t.word}-${i}`} onClick={() => onSelect(i)} style={{
            padding: "6px 12px", fontSize: "14px", fontFamily: FONT_MONO, fontWeight: isSelected ? 700 : 500,
            border: isSelected ? `2px solid ${isCore ? "#e8927c" : "#7c8ea8"}` : "2px solid transparent",
            borderRadius: "4px",
            background: isSelected ? (isCore ? "rgba(232,146,124,0.2)" : "rgba(124,142,168,0.2)") : (isCore ? "rgba(232,146,124,0.08)" : "rgba(124,142,168,0.08)"),
            color: isCore ? "#e8c4b8" : "#8899aa", cursor: "pointer", transition: "all 0.2s ease", position: "relative",
          }}>
            {t.word}
            <span style={{ position: "absolute", top: "-8px", right: "-4px", fontSize: "9px", color: isCore ? "#e8927c55" : "#7c8ea855", fontWeight: 400 }}>{i}</span>
          </button>
        );
      })}
    </div>
  );
}

function HeatmapMatrix({ matrix, tokens, selectedIdx, onSelect, compact }) {
  const n = tokens.length;
  const cellSize = compact ? Math.max(20, Math.min(32, 340 / n)) : Math.max(18, Math.min(38, 420 / n));
  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "480px" }}>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "flex", marginLeft: `${cellSize + 4}px` }}>
          {tokens.map((t, j) => (
            <div key={j} style={{
              width: `${cellSize}px`, height: "28px", display: "flex", alignItems: "flex-end", justifyContent: "center",
              fontSize: Math.min(10, cellSize * 0.35) + "px", fontFamily: FONT_MONO,
              color: t.type === "core" ? "#e8c4b8" : "#667788",
              transform: n > 12 ? "rotate(-45deg)" : "none", transformOrigin: "bottom center", paddingBottom: "2px", whiteSpace: "nowrap", overflow: "hidden",
            }}>{t.word}</div>
          ))}
        </div>
        {matrix.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: `${cellSize + 4}px`, textAlign: "right", paddingRight: "6px",
              fontSize: Math.min(10, cellSize * 0.35) + "px", fontFamily: FONT_MONO,
              color: tokens[i]?.type === "core" ? "#e8c4b8" : "#667788", whiteSpace: "nowrap", overflow: "hidden",
            }}>{tokens[i]?.word}</div>
            {row.map((val, j) => {
              const isCorePair = tokens[i]?.type === "core" && tokens[j]?.type === "core";
              const isHL = i === selectedIdx || j === selectedIdx;
              const isBoth = i === selectedIdx && j === selectedIdx;
              return (
                <div key={j} onClick={() => onSelect(i)} style={{
                  width: `${cellSize}px`, height: `${cellSize}px`,
                  background: attentionColor(val, isCorePair),
                  border: isBoth ? "1.5px solid #e8927c" : isHL ? "1px solid rgba(232,146,124,0.3)" : "0.5px solid rgba(255,255,255,0.03)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: Math.min(8, cellSize * 0.25) + "px",
                  color: val > 0.15 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                  fontFamily: FONT_MONO, transition: "background 0.4s ease",
                }}>{cellSize >= 28 ? (val * 100).toFixed(0) : ""}</div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({ probs, tokens, selectedIdx, label }) {
  const maxP = Math.max(...probs, 0.01);
  const barMaxHeight = 120;
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8899aa", marginBottom: "8px", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: `${barMaxHeight + 40}px`, padding: "0 4px", overflowX: "auto" }}>
        {probs.map((p, i) => {
          const h = (p / maxP) * barMaxHeight;
          const isCore = tokens[i]?.type === "core";
          const isSelf = i === selectedIdx;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: tokens.length > 20 ? "12px" : "24px", flex: tokens.length > 20 ? "0 0 12px" : "1" }}>
              <div style={{ fontSize: "8px", color: p > 0.08 ? "#e8c4b8" : "#556677", marginBottom: "2px", fontFamily: FONT_MONO }}>{(p * 100).toFixed(1)}</div>
              <div style={{
                width: tokens.length > 20 ? "8px" : "16px", height: `${Math.max(2, h)}px`,
                background: isSelf ? "#e8927c" : isCore ? `rgba(232,146,124,${0.3 + p * 3})` : `rgba(124,142,168,${0.2 + p * 2})`,
                borderRadius: "2px 2px 0 0", transition: "height 0.5s ease, background 0.5s ease",
              }} />
              <div style={{
                fontSize: "7px", color: isCore ? "#e8c4b8" : "#556677", marginTop: "3px",
                transform: tokens.length > 15 ? "rotate(-60deg)" : "none", transformOrigin: "top center",
                whiteSpace: "nowrap", fontFamily: FONT_MONO, height: "20px",
              }}>{tokens[i]?.word}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "12px 16px", flex: 1, minWidth: "130px" }}>
      <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: accent || "#e8c4b8", fontFamily: FONT_MONO, lineHeight: 1 }}>{value}</div>
      {subtext && <div style={{ fontSize: "10px", color: "#556677", marginTop: "4px", fontFamily: FONT_MONO }}>{subtext}</div>}
    </div>
  );
}

function StepExplainer({ step }) {
  const steps = [
    { num: 0, title: "The Clean Sentence", text: "Start with 10 meaningful words. Each word produces a Query, Key, and Value vector. The attention matrix is 10\u00D710 \u2014 each word computes a relevance score against every other word. After softmax, each row sums to 1.0, concentrating probability on the words that matter most." },
    { num: 1, title: "+5 Noise Tokens", text: "Now the matrix is 15\u00D715. Each meaningful word must distribute its attention across 15 targets instead of 10. The noise words have weak but nonzero affinity scores, so softmax assigns them small probabilities \u2014 stealing attention mass from the words that actually matter." },
    { num: 2, title: "+10 Noise Tokens", text: "At 20\u00D720, the dilution compounds. Each noise token individually takes only a few percent of attention, but collectively they siphon off a substantial fraction. The peak attention weight on the most relevant word drops noticeably. The model\u2019s \u201Cconfidence\u201D about what matters is eroding." },
    { num: 3, title: "+15 Noise Tokens", text: "At 25\u00D725, the distribution approaches uniformity. The signal \u2014 the grammatical and semantic relationships between meaningful words \u2014 is buried under noise. This is the \u201Clost in the middle\u201D effect: the attention mechanism physically cannot concentrate enough probability mass on the tokens that carry meaning." },
  ];
  const s = steps[step] || steps[0];
  return (
    <div style={{ background: "rgba(232,146,124,0.06)", border: "1px solid rgba(232,146,124,0.15)", borderRadius: "8px", padding: "16px 20px", marginBottom: "20px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e8927c", fontFamily: FONT_MONO, marginBottom: "6px" }}>Step {s.num}: {s.title}</div>
      <div style={{ fontSize: "13px", color: "#bfc8d0", lineHeight: 1.6, fontFamily: FONT_SANS }}>{s.text}</div>
    </div>
  );
}

// ============================================================
//  EXPERIMENT MODE
// ============================================================
function buildMeaningSentence(enabledIds) {
  const present = new Set(enabledIds);
  const parts = [];
  if (present.has(0) && present.has(1)) parts.push("The cat");
  else if (present.has(1)) parts.push("A cat");
  else if (present.has(0)) parts.push("[The ???]");
  if (present.has(2)) parts.push("sat");
  if (present.has(3)) {
    if (present.has(4) && present.has(5) && present.has(6)) parts.push("on the warm mat");
    else if (present.has(4) && present.has(6)) parts.push("on the mat");
    else if (present.has(6)) parts.push("on [a] mat");
    else if (present.has(5)) parts.push("on [something] warm");
    else parts.push("on [???]");
  } else if (present.has(6)) {
    parts.push("[somewhere near a] mat");
  }
  if (present.has(7) && (present.has(8) || present.has(9))) parts.push("and");
  if (present.has(8)) parts.push("then");
  if (present.has(9)) parts.push("slept");
  if (parts.length === 0) return "[No meaning recoverable]";
  return parts.join(" ");
}

function computeMeaningScore(enabledIds) {
  const enabled = new Set(enabledIds);
  let score = 0;
  let maxScore = 0;
  for (const role of SEMANTIC_ROLES) {
    maxScore += role.weight;
    if (enabled.has(role.id)) score += role.weight;
  }
  const hasSubject = enabled.has(1);
  const hasVerb = enabled.has(2) || enabled.has(9);
  const hasObject = enabled.has(6);
  const coherenceBonus = (hasSubject && hasVerb ? 0.5 : 0) + (hasSubject && hasVerb && hasObject ? 0.3 : 0);
  return Math.min(1, (score + coherenceBonus) / (maxScore + 0.8));
}

function getLostRelationships(enabledIds) {
  const enabled = new Set(enabledIds);
  const lost = [];
  if (!enabled.has(1) && enabled.has(2)) lost.push({ pair: "??? \u2192 sat", desc: "Who is doing the sitting? The subject is missing." });
  if (!enabled.has(2) && !enabled.has(9) && enabled.has(1)) lost.push({ pair: "cat \u2192 ???", desc: "The cat exists but does nothing \u2014 no action verb." });
  if (!enabled.has(6) && enabled.has(3)) lost.push({ pair: "on \u2192 ???", desc: "\u2018On\u2019 points nowhere \u2014 the preposition has no object." });
  if (!enabled.has(3) && enabled.has(6)) lost.push({ pair: "??? \u2194 mat", desc: "The mat exists but has no spatial connection to the action." });
  if (!enabled.has(5) && enabled.has(6)) lost.push({ pair: "_ mat", desc: "The mat loses its warmth \u2014 sensory context is gone." });
  if (!enabled.has(1) && !enabled.has(2)) lost.push({ pair: "??? \u2192 ???", desc: "No subject and no primary verb \u2014 the core proposition is destroyed." });
  if (!enabled.has(7) && enabled.has(9) && enabled.has(2)) lost.push({ pair: "sat _ slept", desc: "Two actions without a conjunction \u2014 the temporal link is severed." });
  if (!enabled.has(8) && enabled.has(9) && enabled.has(2)) lost.push({ pair: "sat \u2192 slept", desc: "No \u2018then\u2019 \u2014 the sequence is ambiguous. Did these happen in order?" });
  if (enabled.has(1) && enabled.has(9) && !enabled.has(2)) lost.push({ pair: "cat \u2192 slept", desc: "Only the second action survives \u2014 the first event is lost." });
  return lost;
}

function ExperimentMode() {
  const [enabledWords, setEnabledWords] = useState(() => new Set(CORE_SENTENCE.map((c) => c.id)));
  const [selectedIdx, setSelectedIdx] = useState(0);

  const toggleWord = (id) => {
    setEnabledWords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size <= 1) return next; next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const resetAll = () => setEnabledWords(new Set(CORE_SENTENCE.map((c) => c.id)));

  const enabledIds = useMemo(() => CORE_SENTENCE.filter((c) => enabledWords.has(c.id)).map((c) => c.id), [enabledWords]);
  const enabledTokens = useMemo(() => CORE_SENTENCE.filter((c) => enabledWords.has(c.id)).map((c) => ({ ...c })), [enabledWords]);
  const matrix = useMemo(() => computeSubMatrix(enabledIds), [enabledIds]);
  const fullMatrix = useMemo(() => computeSubMatrix(CORE_SENTENCE.map((c) => c.id)), []);
  const meaningScore = useMemo(() => computeMeaningScore(enabledIds), [enabledIds]);
  const meaningText = useMemo(() => buildMeaningSentence(enabledIds), [enabledIds]);
  const lostLinks = useMemo(() => getLostRelationships(enabledIds), [enabledIds]);

  const clampedIdx = Math.min(selectedIdx, enabledTokens.length - 1);
  const selectedRow = matrix[clampedIdx] || [];

  const categoryPresence = useMemo(() => {
    const cats = {};
    for (const cat of Object.keys(CATEGORY_META)) {
      const roles = SEMANTIC_ROLES.filter((r) => r.category === cat);
      const present = roles.filter((r) => enabledWords.has(r.id));
      cats[cat] = { total: roles.length, present: present.length };
    }
    return cats;
  }, [enabledWords]);

  return (
    <div>
      <div style={{ background: "rgba(124,206,160,0.06)", border: "1px solid rgba(124,206,160,0.15)", borderRadius: "8px", padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#7ccea0", fontFamily: FONT_MONO, marginBottom: "6px" }}>Experiment: Remove Words, Watch Meaning Collapse</div>
        <div style={{ fontSize: "13px", color: "#bfc8d0", lineHeight: 1.6, fontFamily: FONT_SANS }}>
          Click words below to toggle them off. As you remove tokens, the attention matrix shrinks,
          semantic roles disappear, and the recoverable meaning of the sentence degrades. Some words
          are structurally critical — removing them severs relationships that no other word can restore.
        </div>
      </div>

      {/* Word toggle grid */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px" }}>Click to toggle words on/off</div>
          <button onClick={resetAll} style={{ fontSize: "10px", fontFamily: FONT_MONO, color: "#7ccea0", background: "rgba(124,206,160,0.1)", border: "1px solid rgba(124,206,160,0.3)", borderRadius: "4px", padding: "4px 12px", cursor: "pointer" }}>Reset All</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {CORE_SENTENCE.map((tok) => {
            const role = SEMANTIC_ROLES.find((r) => r.id === tok.id);
            const catMeta = CATEGORY_META[role.category];
            const isEnabled = enabledWords.has(tok.id);
            return (
              <button key={tok.id} onClick={() => toggleWord(tok.id)} style={{
                padding: "10px 14px", minWidth: "80px", fontSize: "15px", fontFamily: FONT_MONO,
                fontWeight: 600, borderRadius: "6px", cursor: "pointer", transition: "all 0.25s ease",
                position: "relative", textAlign: "center",
                background: isEnabled ? `${catMeta.color}18` : "rgba(255,255,255,0.02)",
                border: isEnabled ? `2px solid ${catMeta.color}66` : "2px solid rgba(255,255,255,0.06)",
                color: isEnabled ? catMeta.color : "#444",
                opacity: isEnabled ? 1 : 0.4,
                textDecoration: isEnabled ? "none" : "line-through",
              }}>
                {tok.word}
                <div style={{ fontSize: "8px", fontWeight: 400, marginTop: "3px", color: isEnabled ? "#8899aa" : "#444", textDecoration: "none" }}>{role.role}</div>
                {!isEnabled && (
                  <div style={{
                    position: "absolute", top: "-1px", left: "-1px", right: "-1px", bottom: "-1px",
                    borderRadius: "6px", background: "rgba(0,0,0,0.3)", pointerEvents: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#e87c7c88",
                  }}>{"\u2715"}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Meaning score + reconstructed sentence */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 140px" }}>
          <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Meaning Retained</div>
          <div style={{ position: "relative", width: "120px", height: "120px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none"
                stroke={meaningScore > 0.7 ? "#7ccea0" : meaningScore > 0.4 ? "#e8c47c" : "#e87c7c"}
                strokeWidth="8" strokeDasharray={`${meaningScore * 327} 327`}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease" }}
              />
            </svg>
            <div style={{ position: "absolute", top: 0, left: 0, width: "120px", height: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                fontSize: "28px", fontWeight: 700, fontFamily: FONT_MONO, lineHeight: 1,
                color: meaningScore > 0.7 ? "#7ccea0" : meaningScore > 0.4 ? "#e8c47c" : "#e87c7c", transition: "color 0.3s",
              }}>{Math.round(meaningScore * 100)}%</div>
              <div style={{ fontSize: "9px", color: "#667788", fontFamily: FONT_MONO }}>{enabledIds.length}/10 words</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: "250px" }}>
          <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Recoverable Meaning</div>
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "6px", padding: "16px", fontSize: "18px", fontFamily: FONT_SANS,
            color: "#e8c4b8", lineHeight: 1.5, fontStyle: "italic", minHeight: "60px", transition: "all 0.3s",
          }}>"{meaningText}"</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              const info = categoryPresence[cat];
              if (!info || info.total === 0) return null;
              const filled = info.present > 0;
              return (
                <div key={cat} style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px",
                  borderRadius: "4px", fontSize: "11px", fontFamily: FONT_MONO,
                  background: filled ? `${meta.color}15` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${filled ? meta.color + "44" : "rgba(255,255,255,0.06)"}`,
                  color: filled ? meta.color : "#444", transition: "all 0.3s", opacity: filled ? 1 : 0.5,
                }}>
                  <span>{meta.icon}</span><span>{meta.label}</span>
                  <span style={{ fontSize: "9px", opacity: 0.7 }}>{info.present}/{info.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lost relationships */}
      {lostLinks.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: "#e87c7c", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
            Severed Relationships ({lostLinks.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
            {lostLinks.map((link, i) => (
              <div key={i} style={{
                background: "rgba(232,124,124,0.06)", border: "1px solid rgba(232,124,124,0.15)",
                borderRadius: "6px", padding: "10px 14px", display: "flex", gap: "10px", alignItems: "flex-start",
              }}>
                <div style={{ fontSize: "13px", fontFamily: FONT_MONO, color: "#e87c7c", fontWeight: 700, whiteSpace: "nowrap", minWidth: "90px" }}>{link.pair}</div>
                <div style={{ fontSize: "12px", color: "#99aabb", lineHeight: 1.5 }}>{link.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matrices side by side */}
      <div style={{ display: "grid", gridTemplateColumns: enabledIds.length < 10 ? "1fr 1fr" : "1fr", gap: "24px", marginBottom: "24px" }}>
        {enabledIds.length < 10 && (
          <div>
            <div style={{ fontSize: "11px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
              Full Sentence (10{"\u00D7"}10 reference)
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)", opacity: 0.5 }}>
              <HeatmapMatrix matrix={fullMatrix} tokens={CORE_SENTENCE} selectedIdx={-1} onSelect={() => {}} compact />
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: "11px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
            Current Sentence ({enabledIds.length}{"\u00D7"}{enabledIds.length})
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
            {matrix.length > 0 && <HeatmapMatrix matrix={matrix} tokens={enabledTokens} selectedIdx={clampedIdx} onSelect={setSelectedIdx} compact />}
          </div>
        </div>
      </div>

      {/* Distribution */}
      {selectedRow.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "16px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "24px" }}>
          <DistributionChart probs={selectedRow} tokens={enabledTokens} selectedIdx={clampedIdx}
            label={`Attention distribution for \u201C${enabledTokens[clampedIdx]?.word}\u201D`} />
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        <MetricCard label="Matrix Size" value={`${enabledIds.length}\u00D7${enabledIds.length}`} subtext={`${enabledIds.length * enabledIds.length} attention scores`} />
        <MetricCard label="Words Removed" value={`${10 - enabledIds.length}`}
          accent={enabledIds.length >= 8 ? "#7ccea0" : enabledIds.length >= 5 ? "#e8c47c" : "#e87c7c"}
          subtext={`${10 - enabledIds.length} semantic roles lost`} />
        <MetricCard label="Peak Attention" value={selectedRow.length > 0 ? `${(getMaxProb(selectedRow) * 100).toFixed(1)}%` : "\u2014"}
          accent={selectedRow.length > 0 && getMaxProb(selectedRow) > 0.25 ? "#7ccea0" : "#e8c47c"} />
        <MetricCard label="Entropy" value={selectedRow.length > 0 ? getEntropy(selectedRow).toFixed(2) : "\u2014"}
          subtext={enabledIds.length > 1 ? `Max: ${Math.log2(enabledIds.length).toFixed(2)} bits` : ""} />
      </div>

      {/* Insight */}
      <div style={{ padding: "20px", background: "rgba(124,206,160,0.05)", border: "1px solid rgba(124,206,160,0.12)", borderRadius: "8px" }}>
        <div style={{ fontSize: "10px", color: "#7ccea0", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>What This Reveals</div>
        <div style={{ fontSize: "13px", color: "#99aabb", lineHeight: 1.7 }}>
          <strong style={{ color: "#e8c4b8" }}>Dilution adds noise tokens that spread attention.</strong>{" "}
          This mode shows the inverse: removing meaningful tokens doesn't just shrink the matrix — it
          destroys the <em>relationships</em> between the remaining words. A verb without a subject, a
          preposition without an object, a conjunction with only one clause — these aren't just smaller
          sentences, they're <em>broken</em> sentences. The attention matrix might actually become more
          concentrated (higher peak weights) with fewer tokens, but the semantic content those weights
          point to is impoverished. <strong style={{ color: "#e8c4b8" }}>Attention can be sharp and still meaningless.</strong>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  DILUTION MODE (original)
// ============================================================
function DilutionMode() {
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(1);
  const [matrix, setMatrix] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [animating, setAnimating] = useState(false);
  const matrixCacheRef = useRef({});

  const buildTokens = useCallback((level) => {
    let toks = CORE_SENTENCE.map((t) => ({ ...t }));
    for (let b = 0; b < level; b++) {
      const batch = NOISE_BATCHES[b];
      const insertPoints = [2, 5, 7, 9, toks.length];
      const offset = b;
      batch.forEach((nt, i) => {
        const pos = Math.min(insertPoints[i % insertPoints.length] + offset + i * 2, toks.length);
        toks.splice(pos, 0, { ...nt, id: 100 + b * 10 + i });
      });
    }
    return toks;
  }, []);

  useEffect(() => {
    const toks = buildTokens(noiseLevel);
    setTokens(toks);
    const cacheKey = noiseLevel;
    if (!matrixCacheRef.current[cacheKey]) matrixCacheRef.current[cacheKey] = computeAttentionMatrix(toks);
    setMatrix(matrixCacheRef.current[cacheKey]);
    if (selectedIdx >= toks.length) setSelectedIdx(0);
    const catIdx = toks.findIndex((t) => t.word === "cat" && t.type === "core");
    if (catIdx >= 0) setSelectedIdx(catIdx);
  }, [noiseLevel, buildTokens]);

  const selectedRow = matrix[selectedIdx] || [];
  const coreIndices = tokens.map((t, i) => (t.type === "core" ? i : -1)).filter((i) => i >= 0);
  const noiseIndices = tokens.map((t, i) => (t.type === "noise" ? i : -1)).filter((i) => i >= 0);
  const coreAttentionSum = coreIndices.reduce((s, i) => s + (selectedRow[i] || 0), 0);
  const noiseAttentionSum = noiseIndices.reduce((s, i) => s + (selectedRow[i] || 0), 0);
  const entropy = selectedRow.length > 0 ? getEntropy(selectedRow) : 0;
  const maxAttention = selectedRow.length > 0 ? getMaxProb(selectedRow) : 0;
  const matrixSize = tokens.length;

  const handleNoiseChange = (level) => {
    if (animating) return;
    setAnimating(true);
    setNoiseLevel(level);
    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px" }}>Context Noise:</span>
        {[0, 1, 2, 3].map((level) => (
          <button key={level} onClick={() => handleNoiseChange(level)} style={{
            padding: "8px 16px", fontSize: "12px", fontFamily: FONT_MONO, fontWeight: noiseLevel === level ? 700 : 400,
            background: noiseLevel === level ? "rgba(232,146,124,0.15)" : "rgba(255,255,255,0.03)",
            border: noiseLevel === level ? "1px solid rgba(232,146,124,0.4)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px", color: noiseLevel === level ? "#e8927c" : "#8899aa", cursor: "pointer", transition: "all 0.2s",
          }}>
            {level === 0 ? `None (10\u00D710)` : `+${level * 5} noise (${10 + level * 5}\u00D7${10 + level * 5})`}
          </button>
        ))}
      </div>

      <StepExplainer step={noiseLevel} />

      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
          Click a word to inspect its attention row {"\u2192"}
        </div>
        <TokenBar tokens={tokens} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <MetricCard label="Matrix Size" value={`${matrixSize}\u00D7${matrixSize}`} subtext={`${matrixSize * matrixSize} attention scores`} />
        <MetricCard label="Peak Attention" value={`${(maxAttention * 100).toFixed(1)}%`} subtext="Highest single weight"
          accent={maxAttention > 0.2 ? "#7ccea0" : maxAttention > 0.1 ? "#e8c47c" : "#e87c7c"} />
        <MetricCard label="Signal (core)" value={`${(coreAttentionSum * 100).toFixed(1)}%`} subtext="On meaningful tokens"
          accent={coreAttentionSum > 0.8 ? "#7ccea0" : coreAttentionSum > 0.6 ? "#e8c47c" : "#e87c7c"} />
        <MetricCard label="Noise Drain" value={`${(noiseAttentionSum * 100).toFixed(1)}%`} subtext="Wasted on irrelevant"
          accent={noiseAttentionSum < 0.1 ? "#7ccea0" : noiseAttentionSum < 0.3 ? "#e8c47c" : "#e87c7c"} />
        <MetricCard label="Entropy" value={entropy.toFixed(2)} subtext={`Max: ${Math.log2(matrixSize).toFixed(2)} bits`}
          accent={entropy / Math.log2(matrixSize) < 0.7 ? "#7ccea0" : entropy / Math.log2(matrixSize) < 0.85 ? "#e8c47c" : "#e87c7c"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: matrix.length <= 15 ? "auto 1fr" : "1fr", gap: "32px", alignItems: "start" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
            Self-Attention Matrix (softmax probabilities)
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            {matrix.length > 0 && <HeatmapMatrix matrix={matrix} tokens={tokens} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />}
            <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "10px", fontFamily: FONT_MONO }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, background: attentionColor(0.4, true), borderRadius: 2 }} />
                <span style={{ color: "#8899aa" }}>Core{"\u2194"}Core</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, background: attentionColor(0.3, false), borderRadius: 2 }} />
                <span style={{ color: "#8899aa" }}>Involves noise</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
            Attention for "{tokens[selectedIdx]?.word}"
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            {selectedRow.length > 0 && (
              <DistributionChart probs={selectedRow} tokens={tokens} selectedIdx={selectedIdx}
                label={`Row ${selectedIdx}: Where \u201C${tokens[selectedIdx]?.word}\u201D attends`} />
            )}
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "10px", color: "#667788", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Probability Mass</div>
              <div style={{ display: "flex", height: "28px", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{
                  width: `${coreAttentionSum * 100}%`,
                  background: "linear-gradient(90deg, rgba(232,146,124,0.6), rgba(232,146,124,0.3))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontFamily: FONT_MONO, color: "#fff", transition: "width 0.5s ease", whiteSpace: "nowrap", overflow: "hidden",
                }}>{coreAttentionSum > 0.15 ? `Signal ${(coreAttentionSum * 100).toFixed(0)}%` : ""}</div>
                <div style={{
                  width: `${noiseAttentionSum * 100}%`,
                  background: "linear-gradient(90deg, rgba(124,142,168,0.4), rgba(124,142,168,0.2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontFamily: FONT_MONO, color: "#aab", transition: "width 0.5s ease", whiteSpace: "nowrap", overflow: "hidden",
                }}>{noiseAttentionSum > 0.1 ? `Noise ${(noiseAttentionSum * 100).toFixed(0)}%` : ""}</div>
              </div>
            </div>
            <div style={{ marginTop: "20px", padding: "14px", background: "rgba(232,146,124,0.05)", border: "1px solid rgba(232,146,124,0.12)", borderRadius: "6px" }}>
              <div style={{ fontSize: "10px", color: "#e8927c", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Why This Matters</div>
              <div style={{ fontSize: "12px", color: "#99aabb", lineHeight: 1.7 }}>
                {noiseLevel === 0 && <>With only meaningful tokens, softmax concentrates probability on the most relevant words. Peak attention: <strong style={{ color: "#e8c4b8" }}>{(maxAttention * 100).toFixed(1)}%</strong>. The distribution is peaked and decisive.</>}
                {noiseLevel === 1 && <>Five irrelevant words absorb <strong style={{ color: "#e87c7c" }}>{(noiseAttentionSum * 100).toFixed(1)}%</strong> of the attention budget. Collectively they flatten the distribution. Peak attention drops because softmax must sum to 1.0 across all {tokens.length} tokens.</>}
                {noiseLevel === 2 && <>At {tokens.length} tokens, noise absorbs <strong style={{ color: "#e87c7c" }}>{(noiseAttentionSum * 100).toFixed(1)}%</strong>. Entropy: <strong style={{ color: "#e8c47c" }}>{entropy.toFixed(2)}</strong> / {Math.log2(matrixSize).toFixed(2)} bits. Attention is becoming more noise than signal.</>}
                {noiseLevel === 3 && <>With {tokens.length} tokens, noise claims <strong style={{ color: "#e87c7c" }}>{(noiseAttentionSum * 100).toFixed(1)}%</strong>. This is the "lost in the middle" mechanism: the softmax denominator inflates, every weight shrinks, and the model cannot concentrate enough probability on meaningful relationships.</>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "32px", padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "11px", color: "#e8927c", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "2px", marginBottom: "12px" }}>The Math Behind Dilution</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", fontSize: "13px", color: "#99aabb", lineHeight: 1.7 }}>
          <div><strong style={{ color: "#e8c4b8" }}>Softmax forces a fixed budget.</strong> Each row passes through softmax: <span style={{ fontFamily: FONT_MONO, fontSize: "12px", color: "#e8927c" }}>p(j) = exp(s_j) / {"\u03A3"} exp(s_k)</span>. The denominator sums over <em>all</em> tokens. Adding tokens inflates the denominator, mechanically shrinking every probability.</div>
          <div><strong style={{ color: "#e8c4b8" }}>Noise tokens aren't zero.</strong> Even unrelated words produce nonzero dot products — the embedding space is dense. A noise token scoring 0.3 where a meaningful one scores 2.5 still claims probability mass after exponentiation.</div>
          <div><strong style={{ color: "#e8c4b8" }}>Dilution compounds across layers.</strong> Each layer uses the previous layer's output. Slightly blurred output from layer 1 becomes degraded input for layer 2. Over 32+ layers, small per-layer losses compound into substantial information loss.</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN SHELL
// ============================================================
export default function AttentionDilution() {
  const [mode, setMode] = useState("dilution");

  return (
    <div style={{ background: "#0e1117", minHeight: "100vh", color: "#d0d8e0", fontFamily: FONT_SANS, padding: 0 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ padding: "32px 32px 0", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontSize: "11px", color: "#e8927c", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "3px", marginBottom: "8px" }}>Interactive Visualization</div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8c4b8", margin: "0 0 6px", lineHeight: 1.2 }}>Attention Dilution</h1>
        <p style={{ fontSize: "14px", color: "#8899aa", margin: "0 0 24px", maxWidth: "700px", lineHeight: 1.6 }}>
          How the softmax probability budget spreads thin as context grows —
          and what's lost when meaningful words disappear.
        </p>
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { id: "dilution", label: "Noise Dilution", desc: "Add irrelevant tokens" },
            { id: "experiment", label: "Experiment", desc: "Remove meaningful words" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setMode(tab.id)} style={{
              padding: "12px 20px", fontSize: "13px", fontFamily: FONT_MONO, fontWeight: mode === tab.id ? 700 : 400,
              background: mode === tab.id ? "rgba(255,255,255,0.05)" : "transparent",
              border: "none", borderBottom: mode === tab.id ? "2px solid #e8927c" : "2px solid transparent",
              color: mode === tab.id ? "#e8c4b8" : "#667788", cursor: "pointer", transition: "all 0.2s", borderRadius: "6px 6px 0 0",
            }}>
              {tab.label}
              <span style={{ fontSize: "10px", display: "block", fontWeight: 400, color: mode === tab.id ? "#8899aa" : "#445566", marginTop: "2px" }}>{tab.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px 40px" }}>
        {mode === "dilution" ? <DilutionMode /> : <ExperimentMode />}
      </div>
    </div>
  );
}
