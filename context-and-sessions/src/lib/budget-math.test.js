import { describe, it, expect } from 'vitest'
import { CHUNK_WEIGHTS, computeBudget } from './budget-math.js'

describe('CHUNK_WEIGHTS', () => {
  it('has a weight for each chunk type', () => {
    expect(CHUNK_WEIGHTS.system).toBeGreaterThan(0)
    expect(CHUNK_WEIGHTS.user).toBeGreaterThan(0)
    expect(CHUNK_WEIGHTS.tool).toBeGreaterThan(0)
    expect(CHUNK_WEIGHTS.history).toBeGreaterThan(0)
    expect(CHUNK_WEIGHTS.attachment).toBeGreaterThan(0)
    expect(CHUNK_WEIGHTS.rag).toBeGreaterThan(0)
  })
})

describe('computeBudget', () => {
  it('returns shares summing to ~1 for any non-empty chunk set', () => {
    const chunks = [
      { id: 'a', type: 'system', tokens: 200 },
      { id: 'b', type: 'user', tokens: 100, criticalTokens: 30 },
    ]
    const { shares } = computeBudget(chunks)
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('returns an empty budget when there are no chunks', () => {
    const { shares, attentionPerCritical } = computeBudget([])
    expect(shares).toEqual({})
    expect(attentionPerCritical).toBe(0)
  })

  it('adding a large tool output reduces the share of other chunks', () => {
    const base = [
      { id: 'sys', type: 'system', tokens: 200 },
      { id: 'usr', type: 'user', tokens: 100, criticalTokens: 30 },
    ]
    const withTool = [...base, { id: 'tl', type: 'tool', tokens: 8000 }]
    const { shares: s1 } = computeBudget(base)
    const { shares: s2 } = computeBudget(withTool)
    expect(s2.usr).toBeLessThan(s1.usr)
    expect(s2.sys).toBeLessThan(s1.sys)
  })

  it('attentionPerCritical reflects the user chunk share', () => {
    const chunks = [
      { id: 'sys', type: 'system', tokens: 200 },
      { id: 'usr', type: 'user', tokens: 100, criticalTokens: 50 },
    ]
    const { shares, attentionPerCritical } = computeBudget(chunks)
    const expected = shares.usr * (50 / 100)
    expect(attentionPerCritical).toBeCloseTo(expected, 6)
  })

  it('attentionPerCritical is 0 when there is no user chunk', () => {
    const chunks = [{ id: 'sys', type: 'system', tokens: 200 }]
    const { attentionPerCritical } = computeBudget(chunks)
    expect(attentionPerCritical).toBe(0)
  })

  it('attentionPerCritical aggregates across multiple user chunks', () => {
    const chunks = [
      { id: 'sys', type: 'system', tokens: 200 },
      { id: 'u1',  type: 'user',   tokens: 100, criticalTokens: 50 },
      { id: 'u2',  type: 'user',   tokens: 200, criticalTokens: 80 },
    ]
    const { shares, attentionPerCritical } = computeBudget(chunks)
    const expected = shares.u1 * (50 / 100) + shares.u2 * (80 / 200)
    expect(attentionPerCritical).toBeCloseTo(expected, 6)
  })

  it('adding a second user chunk with critical tokens INCREASES attentionPerCritical', () => {
    const single = [
      { id: 'sys', type: 'system', tokens: 200 },
      { id: 'u1',  type: 'user',   tokens: 100, criticalTokens: 50 },
    ]
    const dual = [
      ...single,
      { id: 'u2', type: 'user', tokens: 100, criticalTokens: 50 },
    ]
    const a = computeBudget(single).attentionPerCritical
    const b = computeBudget(dual).attentionPerCritical
    expect(b).toBeGreaterThan(a)
  })
})
