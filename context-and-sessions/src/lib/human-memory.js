// Human serial-position recall. Parameterized so the curve collapses as the
// "reading material" grows — humans have much smaller working memory than LLMs.
//
// Anchors (no noise, at position=0.5 middle):
//   4k tokens  (an article)       → ~58%
//   16k tokens (academic paper)   → ~32%
//   64k tokens (a short book)     → ~14%
//   200k tokens (a novel)         → ~4%
//
// Noise hits humans harder than modern LLMs — a full attention-demanding context
// with 50% distractors roughly halves recall everywhere.
export function humanSerialPosition(position, window_size, noise_level) {
  const w = Math.max(window_size, 4000)
  const windowGrowth = Math.log(w / 4000) / Math.log(200000 / 4000)  // 0..1
  // Humans degrade sharply with volume: base rate 0.90 at 4k → 0.18 at 200k.
  const base = 0.90 - 0.72 * windowGrowth
  // Humans are strongly noise-sensitive.
  const noisePenalty = 1 - 0.55 * noise_level
  // Recency is stronger than primacy for humans (classic serial-position).
  const primacy = 0.7 * Math.exp(-Math.pow(position / 0.10, 2) / 2)
  const recency = 1.2 * Math.exp(-Math.pow((position - 1) / 0.12, 2) / 2)
  const edgeBoost = Math.min(Math.max(primacy, recency), 1.0)
  // Middle valley DEEPENS with window: at 4k ≈ 0.30, at 200k ≈ 0.85.
  const valleyDepth = 0.30 + 0.55 * windowGrowth
  const positional = (1 - valleyDepth) + valleyDepth * edgeBoost
  return Math.max(0, Math.min(1, base * positional * noisePenalty))
}
