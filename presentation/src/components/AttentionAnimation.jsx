import { useState, useEffect, useRef, useCallback } from "react";

const SENTENCE = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "tired"];

// Simulated embedding vectors (simplified to 4D for visualization)
const EMBEDDINGS = {
  "The":     [0.2, 0.1, 0.8, 0.3],
  "animal":  [0.9, 0.7, 0.1, 0.8],
  "didn't":  [0.3, 0.5, 0.6, 0.2],
  "cross":   [0.6, 0.8, 0.3, 0.5],
  "the":     [0.2, 0.1, 0.8, 0.3],
  "street":  [0.4, 0.3, 0.9, 0.6],
  "because": [0.1, 0.6, 0.4, 0.1],
  "it":      [0.8, 0.6, 0.2, 0.7],
  "was":     [0.3, 0.4, 0.5, 0.3],
  "tired":   [0.7, 0.8, 0.1, 0.9],
};

// Pre-computed attention scores that tell a linguistically meaningful story
// "it" should attend strongly to "animal" (coreference)
const ATTENTION_SCORES = {
  "The":     [0.25, 0.10, 0.08, 0.07, 0.25, 0.07, 0.05, 0.04, 0.05, 0.04],
  "animal":  [0.12, 0.30, 0.05, 0.08, 0.04, 0.06, 0.04, 0.15, 0.06, 0.10],
  "didn't":  [0.06, 0.15, 0.20, 0.22, 0.04, 0.08, 0.05, 0.08, 0.06, 0.06],
  "cross":   [0.05, 0.12, 0.18, 0.22, 0.05, 0.20, 0.03, 0.05, 0.04, 0.06],
  "the":     [0.08, 0.05, 0.04, 0.06, 0.10, 0.42, 0.06, 0.05, 0.07, 0.07],
  "street":  [0.06, 0.06, 0.04, 0.14, 0.18, 0.30, 0.05, 0.05, 0.06, 0.06],
  "because": [0.05, 0.10, 0.12, 0.10, 0.04, 0.06, 0.20, 0.12, 0.10, 0.11],
  "it":      [0.04, 0.42, 0.05, 0.04, 0.03, 0.04, 0.08, 0.12, 0.06, 0.12],
  "was":     [0.05, 0.12, 0.06, 0.05, 0.04, 0.05, 0.08, 0.22, 0.18, 0.15],
  "tired":   [0.04, 0.25, 0.04, 0.04, 0.03, 0.04, 0.06, 0.18, 0.12, 0.20],
};

// Raw dot products (before softmax) - made to produce the above after softmax
const RAW_SCORES = {
  "The":     [1.8, 0.9, 0.7, 0.6, 1.8, 0.6, 0.3, 0.1, 0.3, 0.1],
  "animal":  [0.7, 1.6, 0.0, 0.4, -0.2, 0.1, -0.2, 1.0, 0.1, 0.6],
  "didn't":  [0.0, 0.9, 1.2, 1.3, -0.3, 0.4, -0.1, 0.4, 0.0, 0.0],
  "cross":   [-0.2, 0.6, 1.0, 1.2, -0.2, 1.1, -0.5, -0.2, -0.4, -0.1],
  "the":     [0.3, -0.2, -0.5, -0.1, 0.5, 1.9, -0.1, -0.2, 0.1, 0.1],
  "street":  [-0.1, -0.1, -0.4, 0.8, 1.0, 1.5, -0.3, -0.3, -0.1, -0.1],
  "because": [-0.4, 0.3, 0.5, 0.3, -0.5, -0.1, 0.9, 0.5, 0.3, 0.4],
  "it":      [-0.6, 1.7, -0.5, -0.7, -1.0, -0.6, 0.1, 0.5, -0.2, 0.5],
  "was":     [-0.3, 0.6, -0.1, -0.3, -0.5, -0.3, 0.2, 1.1, 0.9, 0.7],
  "tired":   [-0.5, 1.4, -0.4, -0.5, -0.8, -0.5, 0.0, 0.9, 0.5, 1.0],
};

const STEPS = [
  { id: 0, title: "Choose a Word", sub: "Click any word to see how it attends to all other words" },
  { id: 1, title: "Compute Similarity", sub: "The Query of your word is compared to every Key via dot product" },
  { id: 2, title: "Scale", sub: "Divide by √d to prevent extreme values" },
  { id: 3, title: "Apply Softmax", sub: "Convert raw scores into attention weights (probabilities)" },
  { id: 4, title: "Weighted Blend", sub: "Each word's Value contributes proportionally to the final representation" },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function AttentionAnimation() {
  const [selectedWord, setSelectedWord] = useState(null);
  const [step, setStep] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredWord, setHoveredWord] = useState(null);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);

  const selectedIdx = selectedWord !== null ? SENTENCE.indexOf(selectedWord) : -1;

  const animateStep = useCallback(() => {
    if (!startTimeRef.current) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const duration = 1200;
    const progress = clamp(elapsed / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setAnimProgress(eased);
    if (progress < 1) {
      animRef.current = requestAnimationFrame(animateStep);
    }
  }, []);

  const triggerAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    startTimeRef.current = null;
    setAnimProgress(0);
    animRef.current = requestAnimationFrame(animateStep);
  }, [animateStep]);

  useEffect(() => {
    if (selectedWord !== null && step > 0) triggerAnim();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [step, selectedWord, triggerAnim]);

  const handleWordClick = (word) => {
    setSelectedWord(word);
    setStep(1);
    setIsPlaying(false);
  };

  const nextStep = () => {
    if (step < 4) setStep(s => s + 1);
  };
  const prevStep = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const playAll = () => {
    setIsPlaying(true);
    setStep(1);
  };

  useEffect(() => {
    if (!isPlaying) return;
    if (animProgress >= 1 && step < 4) {
      const timeout = setTimeout(() => setStep(s => s + 1), 800);
      return () => clearTimeout(timeout);
    }
    if (step >= 4 && animProgress >= 1) setIsPlaying(false);
  }, [isPlaying, animProgress, step]);

  const getBarColor = (weight) => {
    if (weight > 0.3) return "#E8A838";
    if (weight > 0.15) return "#5BA4CF";
    return "#7C8DB0";
  };

  const getWordGlow = (idx) => {
    if (step < 3 || selectedWord === null) return {};
    const w = ATTENTION_SCORES[selectedWord][idx];
    const intensity = step >= 3 ? w * animProgress : 0;
    if (intensity < 0.08) return {};
    const alpha = Math.min(intensity * 2, 0.7);
    return {
      boxShadow: `0 0 ${intensity * 40}px ${intensity * 15}px rgba(232, 168, 56, ${alpha})`,
      background: `rgba(232, 168, 56, ${intensity * 0.35})`,
    };
  };

  const rawScores = selectedWord ? RAW_SCORES[selectedWord] : null;
  const scaledScores = rawScores ? rawScores.map(s => s / 2) : null; // √4 = 2
  const attentionWeights = selectedWord ? ATTENTION_SCORES[selectedWord] : null;

  const currentScores = step === 1 ? rawScores :
                        step === 2 ? scaledScores :
                        step >= 3 ? attentionWeights : null;

  const maxScore = currentScores ? Math.max(...currentScores.map(Math.abs)) : 1;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1120",
      color: "#C8D6E5",
      fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
      padding: "24px 16px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px", textAlign: "center" }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#E8A838",
          margin: "0 0 4px",
          letterSpacing: "0.5px",
        }}>
          Self-Attention Visualized
        </h1>
        <p style={{ fontSize: 13, color: "#7C8DB0", margin: 0 }}>
          How the Transformer decides which words matter to each other
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 10 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600,
                background: i === step ? "#E8A838" : i < step ? "rgba(232,168,56,0.3)" : "rgba(124,141,176,0.15)",
                color: i === step ? "#0B1120" : i < step ? "#E8A838" : "#4A5568",
                transition: "all 0.4s ease",
                cursor: i > 0 && i <= (selectedWord ? 4 : 0) ? "pointer" : "default",
              }} onClick={() => { if (i > 0 && selectedWord) setStep(i); }}>
                {i}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32, height: 2,
                  background: i < step ? "rgba(232,168,56,0.4)" : "rgba(124,141,176,0.15)",
                  transition: "background 0.4s ease",
                }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0" }}>
            {STEPS[step].title}
          </div>
          <div style={{ fontSize: 12, color: "#7C8DB0", marginTop: 2 }}>
            {STEPS[step].sub}
          </div>
        </div>
      </div>

      {/* Sentence display */}
      <div style={{
        maxWidth: 900, margin: "0 auto 24px",
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8,
      }}>
        {SENTENCE.map((word, idx) => {
          const isSelected = word === selectedWord && idx === selectedIdx;
          const weight = attentionWeights ? attentionWeights[idx] : 0;
          const glowStyle = isSelected ? {} : getWordGlow(idx);
          return (
            <div
              key={idx}
              onClick={() => handleWordClick(word)}
              onMouseEnter={() => setHoveredWord(idx)}
              onMouseLeave={() => setHoveredWord(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
                border: isSelected ? "2px solid #E8A838" : "2px solid rgba(124,141,176,0.2)",
                background: isSelected ? "rgba(232,168,56,0.2)" : "rgba(124,141,176,0.06)",
                color: isSelected ? "#E8A838" : "#C8D6E5",
                transition: "all 0.3s ease",
                position: "relative",
                ...glowStyle,
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
              <span style={{
                position: "absolute", top: -7, right: -5,
                fontSize: 9, color: "#4A5568", fontWeight: 400,
              }}>
                {idx}
              </span>
              {step >= 3 && attentionWeights && !isSelected && animProgress > 0.1 && (
                <span style={{
                  position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, color: "#E8A838", fontWeight: 600,
                  opacity: animProgress,
                }}>
                  {(weight * animProgress * 100).toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main visualization area */}
      {selectedWord !== null && step >= 1 && (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Score bars */}
          <div style={{
            background: "rgba(124,141,176,0.06)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 16,
            border: "1px solid rgba(124,141,176,0.1)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7C8DB0" }}>
                {step === 1 && `Raw Dot Product Scores (Query "${selectedWord}" × each Key)`}
                {step === 2 && `Scaled Scores (÷ √d = ÷ 2)`}
                {step === 3 && `Attention Weights (after Softmax) — sum to 100%`}
                {step === 4 && `Final Weighted Blend of Value Vectors`}
              </div>
              {step >= 3 && (
                <div style={{ fontSize: 11, color: "#4A5568" }}>
                  Σ = {(attentionWeights.reduce((a,b) => a + b, 0) * 100).toFixed(0)}%
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SENTENCE.map((word, idx) => {
                const score = currentScores ? currentScores[idx] : 0;
                const displayScore = score * animProgress;
                const isQuery = idx === selectedIdx;
                const barWidth = step >= 3
                  ? `${Math.abs(displayScore) * 100}%`
                  : `${(Math.abs(displayScore) / (maxScore || 1)) * 45}%`;

                return (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    opacity: animProgress * 0.7 + 0.3,
                  }}>
                    <div style={{
                      width: 64, textAlign: "right", fontSize: 13,
                      fontWeight: isQuery ? 700 : 400,
                      color: isQuery ? "#E8A838" : "#7C8DB0",
                      flexShrink: 0,
                    }}>
                      {word}
                    </div>
                    <div style={{
                      flex: 1, height: 22, background: "rgba(0,0,0,0.3)",
                      borderRadius: 4, overflow: "hidden", position: "relative",
                    }}>
                      <div style={{
                        position: "absolute",
                        left: step < 3 && score < 0 ? undefined : 0,
                        right: step < 3 && score < 0 ? "50%" : undefined,
                        ...(step < 3 ? { left: score >= 0 ? "50%" : undefined } : {}),
                        width: step < 3 ? `${(Math.abs(displayScore) / (maxScore || 1)) * 50}%` : barWidth,
                        height: "100%",
                        background: step >= 3
                          ? getBarColor(score)
                          : (score >= 0 ? "#5BA4CF" : "#CF5B5B"),
                        borderRadius: 4,
                        transition: "width 0.1s ease",
                      }} />
                      {step < 3 && (
                        <div style={{
                          position: "absolute", left: "50%", top: 0, bottom: 0,
                          width: 1, background: "rgba(124,141,176,0.3)",
                        }} />
                      )}
                    </div>
                    <div style={{
                      width: 52, textAlign: "right", fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: step >= 3
                        ? (score > 0.3 ? "#E8A838" : score > 0.15 ? "#5BA4CF" : "#4A5568")
                        : (score >= 0 ? "#5BA4CF" : "#CF5B5B"),
                      fontWeight: step >= 3 && score > 0.25 ? 700 : 400,
                      flexShrink: 0,
                    }}>
                      {step >= 3
                        ? `${(displayScore * 100).toFixed(1)}%`
                        : (displayScore >= 0 ? "+" : "") + displayScore.toFixed(2)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Value blending visualization */}
          {step === 4 && (
            <div style={{
              background: "rgba(124,141,176,0.06)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
              border: "1px solid rgba(124,141,176,0.1)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7C8DB0", marginBottom: 14 }}>
                Value Vector Blending (simplified to 4 dimensions)
              </div>

              {/* Show top contributing words */}
              {SENTENCE.map((word, idx) => {
                const w = attentionWeights[idx];
                if (w < 0.08) return null;
                const emb = EMBEDDINGS[word];
                return (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 8, opacity: animProgress,
                  }}>
                    <div style={{
                      width: 80, textAlign: "right", fontSize: 12, color: "#7C8DB0",
                    }}>
                      {(w * 100).toFixed(0)}% × {word}
                    </div>
                    <div style={{ display: "flex", gap: 3, flex: 1 }}>
                      {emb.map((v, d) => (
                        <div key={d} style={{
                          flex: 1, height: 20, borderRadius: 3,
                          background: `rgba(91, 164, 207, ${v * w * animProgress})`,
                          border: "1px solid rgba(91,164,207,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: v * w > 0.15 ? "#0B1120" : "#4A5568",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}>
                          {(v * w * animProgress).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Result vector */}
              <div style={{
                borderTop: "1px solid rgba(232,168,56,0.3)",
                paddingTop: 10, marginTop: 10,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 80, textAlign: "right", fontSize: 12,
                  fontWeight: 700, color: "#E8A838",
                }}>
                  Result →
                </div>
                <div style={{ display: "flex", gap: 3, flex: 1 }}>
                  {[0,1,2,3].map(d => {
                    const val = SENTENCE.reduce((sum, word, idx) => {
                      return sum + EMBEDDINGS[word][d] * attentionWeights[idx];
                    }, 0);
                    return (
                      <div key={d} style={{
                        flex: 1, height: 24, borderRadius: 3,
                        background: `rgba(232, 168, 56, ${val * animProgress})`,
                        border: "1px solid rgba(232,168,56,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600, color: "#0B1120",
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {(val * animProgress).toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#4A5568", marginTop: 8, textAlign: "center" }}>
                This new vector for "{selectedWord}" now encodes context from the most relevant words
              </div>
            </div>
          )}

          {/* Explanation box */}
          <div style={{
            background: "rgba(232,168,56,0.06)",
            border: "1px solid rgba(232,168,56,0.15)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#C8D6E5" }}>
              {step === 1 && selectedWord && (
                <>
                  <strong style={{ color: "#E8A838" }}>What's happening:</strong> The Query vector for "<strong>{selectedWord}</strong>" is being compared to every word's Key vector using the dot product. A
                  {rawScores[SENTENCE.indexOf(selectedWord === "The" ? "the" : selectedWord)] > 0 ? " positive" : " negative"} score means the vectors point in
                  {rawScores[SENTENCE.indexOf(selectedWord === "The" ? "the" : selectedWord)] > 0 ? " similar" : " different"} directions.
                  {selectedWord === "it" && (
                    <span> Notice how "<strong>animal</strong>" has the highest score — the model is learning that "it" refers back to "animal"!</span>
                  )}
                  {selectedWord === "tired" && (
                    <span> Notice the strong connection to "<strong>animal</strong>" and "<strong>it</strong>" — the model tracks what entity is tired.</span>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <strong style={{ color: "#E8A838" }}>Why scale?</strong> All scores are divided by √d (here √4 = 2). In the real Transformer with 64-dimensional keys, this is √64 = 8. Without scaling, large dot products push softmax into extreme regions where gradients nearly vanish, making learning painfully slow.
                </>
              )}
              {step === 3 && (
                <>
                  <strong style={{ color: "#E8A838" }}>Softmax in action:</strong> The scaled scores have been converted into probabilities that sum to 100%. Notice how softmax amplifies the differences — the highest-scoring words get disproportionately large weights while low-scoring words are pushed toward zero. These are the <strong>attention weights</strong>.
                </>
              )}
              {step === 4 && (
                <>
                  <strong style={{ color: "#E8A838" }}>The final blend:</strong> Each word's Value vector is multiplied by its attention weight, and the results are summed. The new representation of "<strong>{selectedWord}</strong>" is now a weighted average of all words, dominated by the most relevant ones. This is the output of one attention head — the real Transformer runs 8 of these in parallel.
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 10, marginBottom: 10,
          }}>
            <button
              onClick={prevStep}
              disabled={step <= 1}
              style={{
                padding: "8px 20px", borderRadius: 6,
                border: "1px solid rgba(124,141,176,0.2)",
                background: step <= 1 ? "rgba(124,141,176,0.05)" : "rgba(124,141,176,0.1)",
                color: step <= 1 ? "#2D3748" : "#7C8DB0",
                cursor: step <= 1 ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 500,
              }}
            >
              ← Previous
            </button>
            <button
              onClick={playAll}
              style={{
                padding: "8px 20px", borderRadius: 6,
                border: "1px solid rgba(232,168,56,0.3)",
                background: "rgba(232,168,56,0.15)",
                color: "#E8A838",
                cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}
            >
              ▶ Play All Steps
            </button>
            <button
              onClick={nextStep}
              disabled={step >= 4}
              style={{
                padding: "8px 20px", borderRadius: 6,
                border: "1px solid rgba(124,141,176,0.2)",
                background: step >= 4 ? "rgba(124,141,176,0.05)" : "rgba(124,141,176,0.1)",
                color: step >= 4 ? "#2D3748" : "#7C8DB0",
                cursor: step >= 4 ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 500,
              }}
            >
              Next →
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#4A5568" }}>
            Try clicking different words above to see how attention patterns change
          </div>
        </div>
      )}

      {/* Equation reference */}
      <div style={{
        maxWidth: 900, margin: "24px auto 0", textAlign: "center",
        padding: "12px 16px",
        background: "rgba(124,141,176,0.04)",
        borderRadius: 8,
        border: "1px solid rgba(124,141,176,0.08)",
      }}>
        <div style={{ fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", color: "#5BA4CF", letterSpacing: 0.5 }}>
          Attention(Q, K, V) = softmax(QKᵀ / √d) × V
        </div>
        <div style={{ fontSize: 11, color: "#4A5568", marginTop: 4 }}>
          The core equation from "Attention Is All You Need" (Vaswani et al., 2017)
        </div>
      </div>
    </div>
  );
}
