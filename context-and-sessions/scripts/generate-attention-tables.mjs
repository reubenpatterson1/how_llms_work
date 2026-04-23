#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODEL_PROFILES, recall } from '../src/lib/attention-model.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'data')
mkdirSync(outDir, { recursive: true })

const WINDOW_SIZES = [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]
const NOISE_LEVELS = [0, 0.25, 0.5, 0.75, 1.0]
const POSITION_STEPS = 41   // 0.0, 0.025, ..., 1.0

const positions = Array.from({ length: POSITION_STEPS }, (_, i) => i / (POSITION_STEPS - 1))

const table = {}
for (const [modelName, profile] of Object.entries(MODEL_PROFILES)) {
  table[modelName] = {}
  for (const w of WINDOW_SIZES) {
    table[modelName][w] = {}
    for (const n of NOISE_LEVELS) {
      const row = positions.map((p) =>
        Number(recall({ position: p, window_size: w, noise_level: n, model: profile }).toFixed(4))
      )
      table[modelName][w][n] = row
    }
  }
}

const output = {
  version: 1,
  generated_at: new Date().toISOString(),
  grid: {
    models: Object.keys(MODEL_PROFILES),
    window_sizes: WINDOW_SIZES,
    noise_levels: NOISE_LEVELS,
    position_steps: POSITION_STEPS,
  },
  table,
}

const outPath = join(outDir, 'window-playground-table.json')
writeFileSync(outPath, JSON.stringify(output))
console.log(`Wrote ${outPath}`)
console.log(`Entries: ${Object.keys(MODEL_PROFILES).length * WINDOW_SIZES.length * NOISE_LEVELS.length * POSITION_STEPS}`)
