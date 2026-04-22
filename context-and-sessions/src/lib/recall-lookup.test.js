import { describe, it, expect } from 'vitest'
import { createRecallLookup } from './recall-lookup.js'
import table from '../data/window-playground-table.json'

describe('createRecallLookup', () => {
  const lookup = createRecallLookup(table)

  it('returns exact grid value when arguments land on grid points', () => {
    const expected = table.table['claude-sonnet'][4000][0][0]
    expect(lookup({ model: 'claude-sonnet', window_size: 4000, position: 0, noise_level: 0 })).toBeCloseTo(expected, 4)
  })

  it('clamps position outside [0, 1]', () => {
    const lo = lookup({ model: 'claude-sonnet', window_size: 32000, position: -0.5, noise_level: 0 })
    const atZero = lookup({ model: 'claude-sonnet', window_size: 32000, position: 0, noise_level: 0 })
    expect(lo).toBeCloseTo(atZero, 6)

    const hi = lookup({ model: 'claude-sonnet', window_size: 32000, position: 1.5, noise_level: 0 })
    const atOne = lookup({ model: 'claude-sonnet', window_size: 32000, position: 1, noise_level: 0 })
    expect(hi).toBeCloseTo(atOne, 6)
  })

  it('interpolates between window sizes', () => {
    const at16k = lookup({ model: 'claude-sonnet', window_size: 16000, position: 0.5, noise_level: 0 })
    const at32k = lookup({ model: 'claude-sonnet', window_size: 32000, position: 0.5, noise_level: 0 })
    const between = lookup({ model: 'claude-sonnet', window_size: 24000, position: 0.5, noise_level: 0 })
    const min = Math.min(at16k, at32k)
    const max = Math.max(at16k, at32k)
    expect(between).toBeGreaterThanOrEqual(min - 1e-6)
    expect(between).toBeLessThanOrEqual(max + 1e-6)
  })

  it('throws on unknown model', () => {
    expect(() => lookup({ model: 'nonexistent', window_size: 4000, position: 0, noise_level: 0 })).toThrow(/unknown model/i)
  })
})
