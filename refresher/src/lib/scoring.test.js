import { it, expect } from 'vitest'
import { buildSequence, score, breakdownByPart, missedQuestions, isReady } from './scoring'

const mk = (p, n) => ({ id: `P${p}-${n}`, part: p, term: 't', review: { slideNumber: n, slideTitle: `T${n}` }, q: `Q${p}-${n}`,
  options: ['a', 'b', 'c', 'd'].map((x) => `${x}${p}${n}`), answer: n % 4, explanation: 'e' })
const BANK = [1, 2, 3].flatMap((p) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => mk(p, n)))
const correctAll = (seq) => Object.fromEntries(seq.map((s) => [s.id, s.answer]))

// deterministic seeded rng (mulberry32)
const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

it('buildSequence groups by part 1→2→3 with all 24 unique', () => {
  const seq = buildSequence(BANK)
  expect(seq.map((s) => s.part)).toEqual([...Array(8).fill(1), ...Array(8).fill(2), ...Array(8).fill(3)])
  expect(new Set(seq.map((s) => s.id)).size).toBe(24)
})
it('buildSequence remaps answer so options[answer] is the original correct text (200 runs)', () => {
  let moved = 0
  for (let r = 0; r < 200; r++) for (const s of buildSequence(BANK, seeded(r + 1))) {
    const o = BANK.find((b) => b.id === s.id)
    expect(s.options[s.answer]).toBe(o.options[o.answer])
    expect([...s.options].sort()).toEqual([...o.options].sort())
    if (s.answer !== o.answer) moved++
  }
  expect(moved).toBeGreaterThan(0)
})
it('buildSequence does not mutate input and honours rng', () => {
  const before = JSON.stringify(BANK)
  expect(buildSequence(BANK, () => 0)).toEqual(buildSequence(BANK, () => 0))
  expect(JSON.stringify(BANK)).toBe(before)
})
it('score / breakdown / missed / isReady', () => {
  const seq = buildSequence(BANK, () => 0)
  const ans = correctAll(seq)
  ;['P1-1', 'P1-2', 'P1-3'].forEach((id) => { const s = seq.find((x) => x.id === id); ans[id] = (s.answer + 1) % 4 })
  expect(score(seq, ans)).toBe(21)
  expect(breakdownByPart(seq, ans)).toEqual([
    { part: 1, correct: 5, total: 8, flagged: true }, { part: 2, correct: 8, total: 8, flagged: false },
    { part: 3, correct: 8, total: 8, flagged: false }])
  const missed = missedQuestions(seq, ans)
  expect(missed.map((m) => m.id).sort()).toEqual(['P1-1', 'P1-2', 'P1-3'])
  expect(missed.every((m) => m.href === '/part1/' && m.correctAnswer === BANK.find((b) => b.id === m.id).options[BANK.find((b) => b.id === m.id).answer])).toBe(true)
  expect(isReady(18)).toBe(true); expect(isReady(17)).toBe(false)
})
