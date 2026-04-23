import { describe, it, expect } from 'vitest'
import {
  PROMPT_LEVERS, CONTEXT_LEVERS, scoreLeverSet, BASE_SCORE, MAX_SCORE,
} from './lever-scoring.js'

describe('lever-scoring', () => {
  it('exports 6 prompt levers and 6 context levers', () => {
    expect(PROMPT_LEVERS).toHaveLength(6)
    expect(CONTEXT_LEVERS).toHaveLength(6)
  })

  it('score of empty set is BASE_SCORE', () => {
    expect(scoreLeverSet(new Set())).toBe(BASE_SCORE)
  })

  it('applying one lever raises the score', () => {
    const s = scoreLeverSet(new Set([PROMPT_LEVERS[0].key]))
    expect(s).toBeGreaterThan(BASE_SCORE)
  })

  it('applying all levers hits or approaches MAX_SCORE', () => {
    const all = new Set([...PROMPT_LEVERS.map((l) => l.key), ...CONTEXT_LEVERS.map((l) => l.key)])
    const s = scoreLeverSet(all)
    expect(s).toBeGreaterThanOrEqual(90)
    expect(s).toBeLessThanOrEqual(MAX_SCORE)
  })

  it('score never exceeds MAX_SCORE', () => {
    const all = new Set([...PROMPT_LEVERS.map((l) => l.key), ...CONTEXT_LEVERS.map((l) => l.key)])
    expect(scoreLeverSet(all)).toBeLessThanOrEqual(MAX_SCORE)
  })

  it('synergy: summarize + prune gives more than their individual sum relative to base', () => {
    const sumarizeKey = 'summarize_history'
    const pruneKey = 'prune_tool_outputs'
    const solo1 = scoreLeverSet(new Set([sumarizeKey])) - BASE_SCORE
    const solo2 = scoreLeverSet(new Set([pruneKey])) - BASE_SCORE
    const both = scoreLeverSet(new Set([sumarizeKey, pruneKey])) - BASE_SCORE
    expect(both).toBeGreaterThan(solo1 + solo2)
  })

  it('is a pure function (same input → same output)', () => {
    const set = new Set(['xml_structure', 'pin_invariants'])
    expect(scoreLeverSet(set)).toBe(scoreLeverSet(set))
  })
})
