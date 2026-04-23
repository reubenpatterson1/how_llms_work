export const CHUNK_WEIGHTS = {
  system: 1.30,
  user: 1.20,
  rag: 1.05,
  history: 1.00,
  tool: 0.85,
  attachment: 0.80,
}

export function computeBudget(chunks) {
  if (!chunks || chunks.length === 0) {
    return { shares: {}, attentionPerCritical: 0 }
  }

  const weighted = chunks.map((c) => {
    const w = CHUNK_WEIGHTS[c.type] ?? 1.0
    return { id: c.id, mass: Math.max(1, c.tokens) * w, chunk: c }
  })

  const total = weighted.reduce((a, b) => a + b.mass, 0)
  const shares = {}
  for (const w of weighted) shares[w.id] = total > 0 ? w.mass / total : 0

  // Aggregate across ALL user chunks: each contributes its share * (critical/total).
  // The result is the fraction of the total attention budget that lands on critical tokens.
  let attentionPerCritical = 0
  for (const uc of chunks) {
    if (uc.type !== 'user') continue
    const critical = uc.criticalTokens ?? 0
    const ucTotal = Math.max(1, uc.tokens)
    attentionPerCritical += (shares[uc.id] ?? 0) * (critical / ucTotal)
  }

  return { shares, attentionPerCritical }
}
