import { describe, it, expect } from 'vitest'
import { recall, MODEL_PROFILES, clip01 } from './attention-model.js'

describe('clip01', () => {
  it('clamps to [0, 1]', () => {
    expect(clip01(-0.5)).toBe(0)
    expect(clip01(0.5)).toBe(0.5)
    expect(clip01(1.5)).toBe(1)
  })
})

describe('MODEL_PROFILES', () => {
  it('includes the four required models', () => {
    expect(Object.keys(MODEL_PROFILES).sort()).toEqual(
      ['claude-sonnet', 'gemini-1.5', 'generic-short', 'gpt-4-turbo']
    )
  })

  it('each profile has required fields', () => {
    for (const p of Object.values(MODEL_PROFILES)) {
      expect(typeof p.base_rate_at_4k).toBe('number')
      expect(typeof p.base_rate_at_200k).toBe('number')
      expect(typeof p.middle_valley_depth_base).toBe('number')
      expect(typeof p.window_depth_scale).toBe('number')
      expect(typeof p.noise_depth_scale).toBe('number')
      expect(typeof p.noise_sensitivity).toBe('number')
    }
  })
})

describe('recall', () => {
  const claude = MODEL_PROFILES['claude-sonnet']

  it('returns a value in [0, 1]', () => {
    const r = recall({ position: 0.5, window_size: 32000, noise_level: 0, model: claude })
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
  })

  it('is higher at position=0 than position=0.5 for long contexts (primacy)', () => {
    const start = recall({ position: 0, window_size: 100000, noise_level: 0, model: claude })
    const middle = recall({ position: 0.5, window_size: 100000, noise_level: 0, model: claude })
    expect(start).toBeGreaterThan(middle)
  })

  it('is higher at position=1 than position=0.5 for long contexts (recency)', () => {
    const end = recall({ position: 1, window_size: 100000, noise_level: 0, model: claude })
    const middle = recall({ position: 0.5, window_size: 100000, noise_level: 0, model: claude })
    expect(end).toBeGreaterThan(middle)
  })

  it('end > start (recency stronger than primacy)', () => {
    const start = recall({ position: 0, window_size: 100000, noise_level: 0, model: claude })
    const end = recall({ position: 1, window_size: 100000, noise_level: 0, model: claude })
    expect(end).toBeGreaterThan(start)
  })

  it('middle recall decreases as window_size grows', () => {
    const short = recall({ position: 0.5, window_size: 4000, noise_level: 0, model: claude })
    const long = recall({ position: 0.5, window_size: 200000, noise_level: 0, model: claude })
    expect(short).toBeGreaterThan(long)
  })

  it('recall decreases as noise increases', () => {
    const clean = recall({ position: 0.5, window_size: 32000, noise_level: 0, model: claude })
    const noisy = recall({ position: 0.5, window_size: 32000, noise_level: 1, model: claude })
    expect(clean).toBeGreaterThan(noisy)
  })

  it('generic-short model has a deeper middle valley than claude-sonnet', () => {
    const genericMiddle = recall({ position: 0.5, window_size: 32000, noise_level: 0, model: MODEL_PROFILES['generic-short'] })
    const claudeMiddle = recall({ position: 0.5, window_size: 32000, noise_level: 0, model: claude })
    expect(genericMiddle).toBeLessThan(claudeMiddle)
  })

  it('absolute noise volume (noise_level * window_size) matters beyond the base_rate ratio', () => {
    // At equal noise_level, a larger window has more absolute noise tokens,
    // which deepens the valley beyond what base_rate shrinkage alone would do.
    const N = 0.5
    const shortMid = recall({ position: 0.5, window_size: 4000, noise_level: N, model: claude })
    const longMid = recall({ position: 0.5, window_size: 200000, noise_level: N, model: claude })
    // Expected plain: long < short because base_rate drops and valley deepens.
    expect(longMid).toBeLessThan(shortMid)
    // Key new property: the recall ratio must be tighter than the base-rate ratio,
    // i.e. absolute noise + window-depth scaling compound the loss.
    const baseRateRatio = claude.base_rate_at_200k / claude.base_rate_at_4k
    const recallRatio = longMid / shortMid
    expect(recallRatio).toBeLessThan(baseRateRatio)
  })

  it('valley deepens as window grows (ratio middle/start decreases with W)', () => {
    const startShort = recall({ position: 0, window_size: 4000, noise_level: 0, model: claude })
    const middleShort = recall({ position: 0.5, window_size: 4000, noise_level: 0, model: claude })
    const startLong = recall({ position: 0, window_size: 200000, noise_level: 0, model: claude })
    const middleLong = recall({ position: 0.5, window_size: 200000, noise_level: 0, model: claude })
    const ratioShort = middleShort / startShort
    const ratioLong = middleLong / startLong
    expect(ratioShort).toBeGreaterThan(ratioLong)
  })
})
