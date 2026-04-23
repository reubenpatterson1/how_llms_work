import { describe, it, expect } from 'vitest'
import { humanSerialPosition } from './human-memory.js'

describe('humanSerialPosition', () => {
  it('returns [0,1]', () => {
    for (const w of [4000, 16000, 64000, 200000]) {
      for (const n of [0, 0.5, 1]) {
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
          const v = humanSerialPosition(p, w, n)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })
  it('middle recall drops as window grows', () => {
    const a = humanSerialPosition(0.5, 4000,  0)
    const b = humanSerialPosition(0.5, 64000, 0)
    const c = humanSerialPosition(0.5, 200000,0)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })
  it('recency > primacy at all window sizes', () => {
    for (const w of [4000, 64000, 200000]) {
      expect(humanSerialPosition(1, w, 0)).toBeGreaterThan(humanSerialPosition(0, w, 0))
    }
  })
  it('noise halves-ish recall at max', () => {
    const clean = humanSerialPosition(0.5, 16000, 0)
    const noisy = humanSerialPosition(0.5, 16000, 1)
    expect(noisy).toBeLessThan(clean * 0.6)  // ≤ 60% of clean
  })
  it('human is strictly worse than LLM at large windows (soft check via known constants)', () => {
    // At 200k + middle + high noise, human is near-zero; base test just ensures it approaches 0.
    expect(humanSerialPosition(0.5, 200000, 0.8)).toBeLessThan(0.1)
  })
})
