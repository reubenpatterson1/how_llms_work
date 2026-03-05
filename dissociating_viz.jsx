import { useState, useEffect, useRef } from "react";

// ─── Data ───────────────────────────────────────────────────────────────────

const FORMAL_EXAMPLES = [
  {
    id: "agreement",
    label: "Subject-Verb Agreement",
    sentence: "The keys to the old wooden cabinet _____ on the table.",
    correct: "are",
    incorrect: "is",
    trap: "cabinet",
    explanation: "The verb must agree with \"keys\" (plural), not the nearest noun \"cabinet\" (singular). This requires understanding hierarchical structure, not just word proximity.",
    llmScore: 0.95,
    humanScore: 0.97,
  },
  {
    id: "filler-gap",
    label: "Filler-Gap Dependencies",
    sentence: "Bert knew what many writers _____.",
    correct: "find",
    incorrect: "find what",
    trap: null,
    explanation: "\"What\" at the start fills the object slot of \"find,\" so no second \"what\" is needed. This requires tracking a long-distance relationship between words.",
    llmScore: 0.91,
    humanScore: 0.94,
  },
  {
    id: "npi",
    label: "Negative Polarity Items",
    sentence: "The truck has _____ tipped over.",
    correct: "clearly",
    incorrect: "ever",
    trap: null,
    explanation: "\"Ever\" is a negative polarity item—it needs a negative context (like \"hasn't ever\"). In a positive sentence, \"clearly\" works but \"ever\" doesn't.",
    llmScore: 0.88,
    humanScore: 0.93,
  },
  {
    id: "construction",
    label: "Rare Constructions",
    sentence: "It was a beautiful five _____ in New York.",
    correct: "days",
    incorrect: "day",
    trap: null,
    explanation: "Normally \"a\" can't precede a plural noun (\"a days\" is wrong). But English has a special construction where an adjective + numeral allow it: \"a beautiful five days.\"",
    llmScore: 0.82,
    humanScore: 0.89,
  },
];

const FUNCTIONAL_DOMAINS = [
  {
    id: "reasoning",
    label: "Formal Reasoning",
    icon: "🧮",
    color: "#E07A5F",
    brainRegion: "Multiple Demand Network",
    example: {
      prompt: "What is 47 × 83?",
      llmAnswer: "3,811",
      correctAnswer: "3,901",
      llmCorrect: false,
    },
    description: "Logic, math, and multi-step problem solving. LLMs handle simple arithmetic but fail on complex operations. Humans use a separate brain network (the Multiple Demand Network) for these tasks.",
    llmScore: 0.45,
    humanScore: 0.92,
    challenge: "LLMs are trained to predict plausible next tokens, not to compute. Each digit in a multiplication requires carry operations that don't map to pattern matching.",
  },
  {
    id: "knowledge",
    label: "World Knowledge",
    icon: "🌍",
    color: "#81B29A",
    brainRegion: "Distributed cortical regions",
    example: {
      prompt: "Is a penguin a bird that can fly?",
      llmAnswer: "Varies—sometimes says yes",
      correctAnswer: "No, penguins cannot fly",
      llmCorrect: false,
    },
    description: "Factual and commonsense knowledge. LLMs absorb vast knowledge from text but hallucinate, give inconsistent answers, and miss 'obvious' facts that humans never write down.",
    llmScore: 0.60,
    humanScore: 0.95,
    challenge: "Commonsense facts (\"fire is hot\") are rarely stated in text. LLMs optimize for plausibility, not truth, leading to confident-sounding hallucinations.",
  },
  {
    id: "situation",
    label: "Situation Modeling",
    icon: "📖",
    color: "#3D85C6",
    brainRegion: "Default Network",
    example: {
      prompt: "Arthur doesn't own a dog. What color is Arthur's dog?",
      llmAnswer: "\"Arthur's dog is brown.\"",
      correctAnswer: "Arthur doesn't have a dog.",
      llmCorrect: false,
    },
    description: "Tracking entities and their states over time. Humans build rich mental models of narratives. LLMs can refer to non-existent entities and lose track of who knows what.",
    llmScore: 0.50,
    humanScore: 0.94,
    challenge: "LLMs process text left-to-right in a context window. They lack a persistent \"world state\" that gets updated—every inference must be reconstructed from raw text each time.",
  },
  {
    id: "social",
    label: "Social Reasoning",
    icon: "🧠",
    color: "#B07AA1",
    brainRegion: "Theory of Mind Network",
    example: {
      prompt: "Sally puts a ball in a basket, then leaves. Anne moves the ball to a box. Where will Sally look for the ball?",
      llmAnswer: "Varies—often says \"the box\"",
      correctAnswer: "The basket (Sally doesn't know it was moved)",
      llmCorrect: false,
    },
    description: "Understanding intentions, beliefs, sarcasm, and social context. Requires reasoning about what others know and don't know—a separate brain network handles this in humans.",
    llmScore: 0.40,
    humanScore: 0.96,
    challenge: "Theory of mind requires modeling another agent's beliefs separately from reality. LLMs tend to leak true-state information into their predictions about what characters believe.",
  },
];

const MODEL_EVOLUTION = [
  { name: "N-gram", year: "~2005", formal: 0.15, functional: 0.05, text: "The meaning of life is gulped and gone, bleeds with keenest anguish..." },
  { name: "RNN", year: "~2014", formal: 0.30, functional: 0.10, text: "The meaning of life is the tradition of the ancient human reproduction: it is less favorable..." },
  { name: "GPT-2", year: "2019", formal: 0.80, functional: 0.30, text: "The meaning of life is something simple that has nothing to do with who we are." },
  { name: "GPT-3", year: "2020", formal: 0.90, functional: 0.50, text: "The meaning of life is a mystery to us all, and a question that will never be answered." },
  { name: "GPT-4", year: "2023", formal: 0.95, functional: 0.65, text: "The meaning of life is subjective and varies greatly depending on personal beliefs, values, and experiences." },
];

// ─── Components ─────────────────────────────────────────────────────────────

function BarChart({ label, score, color, maxWidth = 200, animate, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setWidth(score * 100), delay);
      return () => clearTimeout(timer);
    } else {
      setWidth(score * 100);
    }
  }, [score, animate, delay]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 60, fontSize: 11, color: "#8896A7", textAlign: "right", flexShrink: 0 }}>{label}</div>
      <div style={{ width: maxWidth, height: 18, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          width: `${width}%`, height: "100%", background: color, borderRadius: 4,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color, width: 36, flexShrink: 0 }}>{(score * 100).toFixed(0)}%</div>
    </div>
  );
}

function BrainDiagram({ activeRegion }) {
  const regions = [
    { id: "language", label: "Language Network", x: 30, y: 38, w: 22, h: 18, color: "#4ECDC4", desc: "Formal competence only" },
    { id: "multiple-demand", label: "Multiple Demand", x: 55, y: 20, w: 20, h: 16, color: "#E07A5F", desc: "Reasoning & logic" },
    { id: "default", label: "Default Network", x: 52, y: 55, w: 22, h: 16, color: "#3D85C6", desc: "Situation modeling" },
    { id: "tom", label: "Theory of Mind", x: 25, y: 62, w: 20, h: 14, color: "#B07AA1", desc: "Social reasoning" },
  ];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 320, height: 200, margin: "0 auto" }}>
      {/* Brain outline */}
      <svg viewBox="0 0 100 90" style={{ width: "100%", height: "100%" }}>
        <ellipse cx="50" cy="45" rx="42" ry="38" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <path d="M50 7 Q35 10 28 20 Q20 32 22 50 Q24 65 35 75 Q45 83 50 83 Q55 83 65 75 Q76 65 78 50 Q80 32 72 20 Q65 10 50 7"
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
        {regions.map(r => {
          const isActive = activeRegion === r.id || activeRegion === "all";
          const isLanguage = r.id === "language";
          return (
            <g key={r.id}>
              <rect
                x={r.x} y={r.y} width={r.w} height={r.h} rx="4"
                fill={isActive ? r.color + "40" : "rgba(255,255,255,0.02)"}
                stroke={isActive ? r.color : "rgba(255,255,255,0.08)"}
                strokeWidth={isActive ? 1.5 : 0.5}
                style={{ transition: "all 0.5s ease" }}
              />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 2} textAnchor="middle" fontSize="3.5"
                fill={isActive ? "#E2E8F0" : "#4A5568"} fontWeight={isActive ? 600 : 400}
                style={{ transition: "fill 0.5s ease" }}>
                {r.label}
              </text>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 4} textAnchor="middle" fontSize="2.5"
                fill={isActive ? r.color : "#2D3748"}
                style={{ transition: "fill 0.5s ease" }}>
                {r.desc}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "The Big Idea" },
  { id: "formal", label: "Formal Competence" },
  { id: "functional", label: "Functional Competence" },
  { id: "evolution", label: "Model Evolution" },
  { id: "brain", label: "The Brain Map" },
];

export default function DissociatingViz() {
  const [tab, setTab] = useState("overview");
  const [selectedFormal, setSelectedFormal] = useState(0);
  const [selectedFunctional, setSelectedFunctional] = useState(null);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [userChoice, setUserChoice] = useState(null);
  const [animTrigger, setAnimTrigger] = useState(0);
  const [hoveredModel, setHoveredModel] = useState(null);
  const [activeBrainRegion, setActiveBrainRegion] = useState("language");

  useEffect(() => {
    setRevealAnswer(false);
    setUserChoice(null);
  }, [selectedFormal]);

  useEffect(() => { setAnimTrigger(t => t + 1); }, [tab]);

  const ex = FORMAL_EXAMPLES[selectedFormal];

  return (
    <div style={{
      minHeight: "100vh", background: "#0C131D", color: "#C8D6E5",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", textAlign: "center", maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#4ECDC4", margin: "0 0 4px", letterSpacing: 0.3 }}>
          Language ≠ Thought
        </h1>
        <p style={{ fontSize: 12, color: "#5A6B7E", margin: 0 }}>
          Exploring how LLMs master language form while struggling with real-world reasoning
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 4, padding: "16px 16px 0",
        maxWidth: 880, margin: "0 auto", flexWrap: "wrap",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? "#4ECDC420" : "transparent",
            color: tab === t.id ? "#4ECDC4" : "#5A6B7E",
            transition: "all 0.3s ease",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px" }}>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === "overview" && (
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20,
            }}>
              {/* Fallacy 1 */}
              <div style={{
                background: "rgba(224,122,95,0.08)", border: "1px solid rgba(224,122,95,0.2)",
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#E07A5F", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  ⚠ Fallacy 1
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 8 }}>
                  "Good at language → Good at thought"
                </div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  Because an LLM writes fluently, we assume it understands deeply. But fluency is a language skill, not a reasoning skill.
                </div>
              </div>

              {/* Fallacy 2 */}
              <div style={{
                background: "rgba(224,122,95,0.08)", border: "1px solid rgba(224,122,95,0.2)",
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#E07A5F", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  ⚠ Fallacy 2
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 8 }}>
                  "Bad at thought → Bad at language"
                </div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  Because an LLM can't do math, we dismiss it as a language model. But math failure doesn't mean language failure.
                </div>
              </div>
            </div>

            {/* The distinction */}
            <div style={{
              background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)",
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#4ECDC4", marginBottom: 12 }}>
                The Solution: Separate Two Types of Competence
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#4ECDC4", marginBottom: 6 }}>
                    Formal Competence
                  </div>
                  <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6, marginBottom: 10 }}>
                    Getting the <em>form</em> of language right: grammar, syntax, word patterns, constructions. Like knowing the rules of chess.
                  </div>
                  <div style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 11,
                    background: "rgba(78,205,196,0.15)", color: "#4ECDC4", display: "inline-block",
                  }}>
                    LLMs: ✅ Near-human level
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#E07A5F", marginBottom: 6 }}>
                    Functional Competence
                  </div>
                  <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6, marginBottom: 10 }}>
                    <em>Using</em> language in the world: reasoning, world knowledge, tracking situations, social understanding. Like playing chess strategically.
                  </div>
                  <div style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 11,
                    background: "rgba(224,122,95,0.15)", color: "#E07A5F", display: "inline-block",
                  }}>
                    LLMs: ⚠️ Patchy & inconsistent
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: "#5A6B7E" }}>
              Use the tabs above to explore each type of competence interactively →
            </div>
          </div>
        )}

        {/* ─── FORMAL COMPETENCE TAB ─── */}
        {tab === "formal" && (
          <div>
            <div style={{ fontSize: 13, color: "#8896A7", marginBottom: 16, lineHeight: 1.6 }}>
              LLMs have learned the deep structural rules of English — not just surface patterns. Try these interactive tests to see what formal competence looks like.
            </div>

            {/* Example selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {FORMAL_EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => { setSelectedFormal(i); setRevealAnswer(false); setUserChoice(null); }} style={{
                  padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: selectedFormal === i ? 600 : 400,
                  background: selectedFormal === i ? "#4ECDC420" : "rgba(255,255,255,0.04)",
                  color: selectedFormal === i ? "#4ECDC4" : "#5A6B7E",
                }}>
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Challenge card */}
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 20,
              border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#4ECDC4", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                Which word completes this sentence correctly?
              </div>
              <div style={{ fontSize: 18, color: "#E2E8F0", marginBottom: 16, lineHeight: 1.5 }}>
                {ex.sentence.split("_____")[0]}
                <span style={{
                  padding: "2px 12px", borderRadius: 4, margin: "0 2px",
                  background: revealAnswer
                    ? "rgba(78,205,196,0.2)"
                    : "rgba(255,255,255,0.08)",
                  color: revealAnswer ? "#4ECDC4" : "#5A6B7E",
                  fontWeight: 600,
                  transition: "all 0.3s ease",
                }}>
                  {revealAnswer ? ex.correct : "?"}
                </span>
                {ex.sentence.split("_____")[1]}
              </div>

              {!revealAnswer && (
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  {[ex.correct, ex.incorrect].sort(() => ex.id.charCodeAt(0) % 2 ? 1 : -1).map(option => (
                    <button key={option} onClick={() => { setUserChoice(option); setRevealAnswer(true); }} style={{
                      padding: "10px 24px", borderRadius: 8, border: "1px solid rgba(78,205,196,0.3)",
                      background: "rgba(78,205,196,0.08)", color: "#E2E8F0", cursor: "pointer",
                      fontSize: 16, fontWeight: 500, transition: "all 0.2s ease",
                    }}>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {revealAnswer && (
                <div style={{
                  background: userChoice === ex.correct ? "rgba(78,205,196,0.08)" : "rgba(224,122,95,0.08)",
                  border: `1px solid ${userChoice === ex.correct ? "rgba(78,205,196,0.2)" : "rgba(224,122,95,0.2)"}`,
                  borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: userChoice === ex.correct ? "#4ECDC4" : "#E07A5F", marginBottom: 6 }}>
                    {userChoice === ex.correct ? "✓ Correct!" : `✗ The answer is "${ex.correct}"`}
                  </div>
                  <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>{ex.explanation}</div>
                </div>
              )}

              {/* LLM vs Human scores */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#5A6B7E", marginBottom: 6 }}>Performance on this type of test:</div>
                <BarChart label="LLM" score={ex.llmScore} color="#4ECDC4" animate={true} delay={100} />
                <BarChart label="Human" score={ex.humanScore} color="#8896A7" animate={true} delay={300} />
              </div>
            </div>

            <div style={{
              background: "rgba(78,205,196,0.06)", borderRadius: 8, padding: 12,
              border: "1px solid rgba(78,205,196,0.1)", fontSize: 12, color: "#8896A7", lineHeight: 1.6,
            }}>
              <strong style={{ color: "#4ECDC4" }}>Key finding:</strong> Modern LLMs score near human-level on these formal competence benchmarks. They learned hierarchical structure, abstract categories, and rare constructions — all from next-word prediction alone, with no explicit grammar rules.
            </div>
          </div>
        )}

        {/* ─── FUNCTIONAL COMPETENCE TAB ─── */}
        {tab === "functional" && (
          <div>
            <div style={{ fontSize: 13, color: "#8896A7", marginBottom: 16, lineHeight: 1.6 }}>
              Functional competence requires non-linguistic cognitive skills. Click a domain to see where LLMs struggle — and which brain region humans use instead.
            </div>

            {/* Domain cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {FUNCTIONAL_DOMAINS.map((d, i) => (
                <button key={d.id} onClick={() => setSelectedFunctional(selectedFunctional === i ? null : i)} style={{
                  background: selectedFunctional === i ? `${d.color}15` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedFunctional === i ? d.color + "40" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left",
                  transition: "all 0.3s ease",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selectedFunctional === i ? d.color : "#C8D6E5" }}>
                    {d.label}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2, overflow: "hidden",
                      background: "rgba(255,255,255,0.06)",
                    }}>
                      <div style={{ width: `${d.llmScore * 100}%`, height: "100%", background: d.color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: d.color }}>{(d.llmScore * 100).toFixed(0)}%</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selectedFunctional !== null && (() => {
              const d = FUNCTIONAL_DOMAINS[selectedFunctional];
              return (
                <div style={{
                  background: `${d.color}08`, borderRadius: 12, padding: 16,
                  border: `1px solid ${d.color}25`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: d.color, marginBottom: 8 }}>
                    {d.icon} {d.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6, marginBottom: 14 }}>
                    {d.description}
                  </div>

                  {/* Example */}
                  <div style={{
                    background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 12, marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 11, color: "#5A6B7E", marginBottom: 6 }}>Example Challenge:</div>
                    <div style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500, marginBottom: 8 }}>
                      "{d.example.prompt}"
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#E07A5F", fontWeight: 600, marginBottom: 3 }}>LLM ANSWER</div>
                        <div style={{ fontSize: 12, color: "#C8D6E5" }}>{d.example.llmAnswer}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#4ECDC4", fontWeight: 600, marginBottom: 3 }}>CORRECT ANSWER</div>
                        <div style={{ fontSize: 12, color: "#C8D6E5" }}>{d.example.correctAnswer}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: d.color, marginBottom: 10 }}>
                    <strong>Why LLMs struggle:</strong> {d.challenge}
                  </div>

                  <div style={{ fontSize: 11, color: "#5A6B7E", marginBottom: 6 }}>
                    In the human brain: <strong style={{ color: d.color }}>{d.brainRegion}</strong> (separate from language)
                  </div>
                  <BarChart label="LLM" score={d.llmScore} color={d.color} animate={true} delay={100} />
                  <BarChart label="Human" score={d.humanScore} color="#8896A7" animate={true} delay={300} />
                </div>
              );
            })()}

            <div style={{
              background: "rgba(224,122,95,0.06)", borderRadius: 8, padding: 12,
              border: "1px solid rgba(224,122,95,0.1)", fontSize: 12, color: "#8896A7", lineHeight: 1.6,
            }}>
              <strong style={{ color: "#E07A5F" }}>Key finding:</strong> Unlike formal competence, functional competence doesn't reliably improve just by making models bigger. It requires specialized fine-tuning (RLHF), external tools (calculators, search), or architectural modularity — mirroring how the human brain uses separate systems.
            </div>
          </div>
        )}

        {/* ─── MODEL EVOLUTION TAB ─── */}
        {tab === "evolution" && (
          <div>
            <div style={{ fontSize: 13, color: "#8896A7", marginBottom: 16, lineHeight: 1.6 }}>
              Watch formal competence surge ahead of functional competence as models evolve. Hover over a model to see its generated text.
            </div>

            {/* Chart */}
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 20,
              border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#4ECDC4" }}>● Formal Competence</span>
                <span style={{ fontSize: 11, color: "#E07A5F" }}>● Functional Competence</span>
              </div>

              <svg viewBox="0 0 400 160" style={{ width: "100%", height: 160 }}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(v => (
                  <g key={v}>
                    <line x1="50" y1={140 - v * 1.3} x2="390" y2={140 - v * 1.3}
                      stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                    <text x="46" y={144 - v * 1.3} textAnchor="end" fontSize="8" fill="#3A4A5C">{v}%</text>
                  </g>
                ))}

                {/* Formal line */}
                <polyline
                  points={MODEL_EVOLUTION.map((m, i) => `${70 + i * 78},${140 - m.formal * 130}`).join(" ")}
                  fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                {/* Functional line */}
                <polyline
                  points={MODEL_EVOLUTION.map((m, i) => `${70 + i * 78},${140 - m.functional * 130}`).join(" ")}
                  fill="none" stroke="#E07A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />

                {/* Gap fill */}
                <polygon
                  points={[
                    ...MODEL_EVOLUTION.map((m, i) => `${70 + i * 78},${140 - m.formal * 130}`),
                    ...MODEL_EVOLUTION.slice().reverse().map((m, i) => `${70 + (MODEL_EVOLUTION.length - 1 - i) * 78},${140 - m.functional * 130}`),
                  ].join(" ")}
                  fill="rgba(255,255,255,0.03)"
                />

                {/* Data points */}
                {MODEL_EVOLUTION.map((m, i) => (
                  <g key={i}
                    onMouseEnter={() => setHoveredModel(i)}
                    onMouseLeave={() => setHoveredModel(null)}
                    style={{ cursor: "pointer" }}>
                    <circle cx={70 + i * 78} cy={140 - m.formal * 130} r={hoveredModel === i ? 5 : 3.5}
                      fill="#4ECDC4" style={{ transition: "r 0.2s ease" }} />
                    <circle cx={70 + i * 78} cy={140 - m.functional * 130} r={hoveredModel === i ? 5 : 3.5}
                      fill="#E07A5F" style={{ transition: "r 0.2s ease" }} />
                    {/* Invisible hover target */}
                    <rect x={70 + i * 78 - 20} y="5" width="40" height="145" fill="transparent" />
                    <text x={70 + i * 78} y="155" textAnchor="middle" fontSize="7.5"
                      fill={hoveredModel === i ? "#E2E8F0" : "#5A6B7E"} fontWeight={hoveredModel === i ? 600 : 400}>
                      {m.name}
                    </text>
                    <text x={70 + i * 78} y="10" textAnchor="middle" fontSize="6" fill="#3A4A5C">{m.year}</text>
                  </g>
                ))}

                {/* Gap label */}
                <text x="310" y={140 - MODEL_EVOLUTION[4].formal * 130 + (MODEL_EVOLUTION[4].formal - MODEL_EVOLUTION[4].functional) * 65}
                  fontSize="7" fill="#5A6B7E" textAnchor="middle" fontStyle="italic">
                  the gap
                </text>
              </svg>
            </div>

            {/* Selected model text */}
            {hoveredModel !== null && (
              <div style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14,
                border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", marginBottom: 6 }}>
                  {MODEL_EVOLUTION[hoveredModel].name} ({MODEL_EVOLUTION[hoveredModel].year}) — "The meaning of life is..."
                </div>
                <div style={{
                  fontSize: 13, color: "#8896A7", lineHeight: 1.6, fontStyle: "italic",
                  borderLeft: "2px solid rgba(78,205,196,0.3)", paddingLeft: 12,
                }}>
                  "{MODEL_EVOLUTION[hoveredModel].text}"
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: "#4ECDC4" }}>Formal: </span>
                    <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{(MODEL_EVOLUTION[hoveredModel].formal * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: "#E07A5F" }}>Functional: </span>
                    <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{(MODEL_EVOLUTION[hoveredModel].functional * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{
              fontSize: 12, color: "#8896A7", lineHeight: 1.6, textAlign: "center",
            }}>
              Notice: formal competence (teal) shot up dramatically after ~2018, while functional competence (coral) grew much more slowly. The gap between the lines is the paper's central observation.
            </div>
          </div>
        )}

        {/* ─── BRAIN MAP TAB ─── */}
        {tab === "brain" && (
          <div>
            <div style={{ fontSize: 13, color: "#8896A7", marginBottom: 16, lineHeight: 1.6 }}>
              The human brain uses physically separate networks for language vs. thinking. Click a region to learn about its role and what it means for AI.
            </div>

            <BrainDiagram activeRegion={activeBrainRegion} />

            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { id: "language", label: "Language Network", color: "#4ECDC4" },
                { id: "multiple-demand", label: "Reasoning", color: "#E07A5F" },
                { id: "default", label: "Situation Modeling", color: "#3D85C6" },
                { id: "tom", label: "Social/ToM", color: "#B07AA1" },
                { id: "all", label: "Show All", color: "#E2E8F0" },
              ].map(r => (
                <button key={r.id} onClick={() => setActiveBrainRegion(r.id)} style={{
                  padding: "6px 12px", borderRadius: 6, border: `1px solid ${r.color}40`,
                  background: activeBrainRegion === r.id ? `${r.color}20` : "transparent",
                  color: activeBrainRegion === r.id ? r.color : "#5A6B7E",
                  cursor: "pointer", fontSize: 11, fontWeight: activeBrainRegion === r.id ? 600 : 400,
                }}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Description */}
            {activeBrainRegion === "language" && (
              <div style={{ background: "rgba(78,205,196,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(78,205,196,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#4ECDC4", marginBottom: 6 }}>Language Network</div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  Located in the left frontal and temporal lobes. Handles <strong>only</strong> language: grammar, word meaning, sentence structure. Does NOT activate during math, logic, music, coding, or social reasoning. People with damage here (aphasia) lose language but keep their thinking abilities intact. This is what LLMs model well.
                </div>
              </div>
            )}
            {activeBrainRegion === "multiple-demand" && (
              <div style={{ background: "rgba(224,122,95,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(224,122,95,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E07A5F", marginBottom: 6 }}>Multiple Demand Network</div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  The brain's general-purpose problem-solver. Activates for logic, math, coding, planning, and any cognitively demanding task — even when presented in language. Completely separate from the Language Network. This is why the paper argues LLMs need external reasoning modules (calculators, code interpreters) to match human reasoning.
                </div>
              </div>
            )}
            {activeBrainRegion === "default" && (
              <div style={{ background: "rgba(61,133,198,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(61,133,198,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3D85C6", marginBottom: 6 }}>Default Network</div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  Tracks narratives and builds situation models — maintaining a mental picture of who, what, where, and when as a story unfolds. Works for both linguistic and non-linguistic narratives (e.g., silent films). Separate from the Language Network, explaining why LLMs can produce grammatical text about a story while losing track of basic plot details.
                </div>
              </div>
            )}
            {activeBrainRegion === "tom" && (
              <div style={{ background: "rgba(176,122,161,0.06)", borderRadius: 10, padding: 14, border: "1px solid rgba(176,122,161,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#B07AA1", marginBottom: 6 }}>Theory of Mind Network</div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  Reasons about other people's beliefs, desires, knowledge, and intentions. Essential for understanding sarcasm, indirect requests, jokes, and lies. Separate from the Language Network — you can understand the <em>words</em> "Nice job!" without this network, but you need it to detect that the speaker is being sarcastic.
                </div>
              </div>
            )}
            {activeBrainRegion === "all" && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 6 }}>All Networks Together</div>
                <div style={{ fontSize: 12, color: "#8896A7", lineHeight: 1.6 }}>
                  In everyday language use, all four networks collaborate seamlessly. But they are physically separate and can be damaged independently. This biological architecture is the paper's strongest evidence that <strong>language ability and thinking ability are genuinely distinct</strong> — and that AI systems may need a similar modular design to achieve human-like language use.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px", fontSize: 11, color: "#3A4A5C" }}>
        Based on Mahowald, Ivanova et al. (2024) · "Dissociating language and thought in large language models"
      </div>
    </div>
  );
}
