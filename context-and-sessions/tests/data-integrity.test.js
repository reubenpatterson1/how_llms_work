import { describe, it, expect } from 'vitest'
import table from '../src/data/window-playground-table.json'

describe('window-playground-table.json', () => {
  it('has version 1', () => {
    expect(table.version).toBe(1)
  })

  it('has the expected models in the grid', () => {
    expect(table.grid.models.sort()).toEqual(['claude-sonnet', 'gemini-1.5', 'generic-short', 'gpt-4-turbo'])
  })

  it('has 8 window sizes from 4000 to 200000', () => {
    expect(table.grid.window_sizes).toEqual([4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000])
  })

  it('has 5 noise levels from 0 to 1', () => {
    expect(table.grid.noise_levels).toEqual([0, 0.25, 0.5, 0.75, 1.0])
  })

  it('has 41 position steps', () => {
    expect(table.grid.position_steps).toBe(41)
  })

  it('every (model, window, noise) slot has position_steps entries, all in [0, 1]', () => {
    for (const model of table.grid.models) {
      for (const w of table.grid.window_sizes) {
        for (const n of table.grid.noise_levels) {
          const row = table.table[model][w][n]
          expect(row).toHaveLength(table.grid.position_steps)
          for (const v of row) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })
})
