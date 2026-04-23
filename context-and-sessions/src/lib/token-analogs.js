// Rough ≈ 0.75 words/token for English prose. These buckets pick a recognizable
// reference for each window size so learners have an emotional anchor for scale.
const ANALOGS = [
  { maxTokens: 500,    label: 'a tweet thread' },
  { maxTokens: 2500,   label: 'a blog post' },
  { maxTokens: 6000,   label: 'a magazine article' },
  { maxTokens: 12000,  label: 'a short story' },
  { maxTokens: 25000,  label: 'an academic paper' },
  { maxTokens: 50000,  label: 'a novella' },
  { maxTokens: 80000,  label: 'a short book' },
  { maxTokens: 120000, label: 'The Great Gatsby' },
  { maxTokens: 180000, label: 'Pride and Prejudice' },
  { maxTokens: 300000, label: 'a thick novel (~Harry Potter 3)' },
  { maxTokens: 800000, label: 'an encyclopedia volume' },
  { maxTokens: Infinity, label: 'an entire multi-volume encyclopedia' },
]

export function tokenAnalog(tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  for (const a of ANALOGS) if (tokens <= a.maxTokens) return a.label
  return ANALOGS[ANALOGS.length - 1].label
}

// Short-form for tight label space (prefix "≈").
export function tokenAnalogShort(tokens) {
  const a = tokenAnalog(tokens)
  return a ? `≈ ${a}` : ''
}
