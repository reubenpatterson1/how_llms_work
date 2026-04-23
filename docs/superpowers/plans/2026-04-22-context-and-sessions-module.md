# Module 3: Context & Sessions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new React/Vite slide-deck module (`context-and-sessions/`) teaching lost-in-the-middle, prompt-vs-context engineering, and session hygiene with 5 interactive components and a deep technical assessment. Insert as Module 3; renumber existing Modules 3–6 to 4–7.

**Architecture:** Standalone Vite + React 19 + `@react-three/fiber` app, following the pattern of `working-with-llms/`. 3D visualizations backed by precomputed lookup tables generated at build time. Assessment reuses the `SessionHygieneSimulator` in preset mode. Landing page gets a one-shot localStorage migrator extracted into a testable ES module.

**Tech Stack:** React 19, Vite 8, `@react-three/fiber` 9, `@react-three/drei` 10, `recharts` 3, Vitest, `@testing-library/react`, Playwright (landing page e2e only).

**Spec:** `docs/superpowers/specs/2026-04-22-context-and-sessions-module-design.md`

**Working directory:** `/Users/reubenpatterson/LLM_Presentation`

---

## Phase 0: Scaffold & Migrator

### Task 1: Scaffold the `context-and-sessions/` app

**Files:**
- Create: `context-and-sessions/package.json`
- Create: `context-and-sessions/vite.config.js`
- Create: `context-and-sessions/eslint.config.js`
- Create: `context-and-sessions/index.html`
- Create: `context-and-sessions/src/main.jsx`
- Create: `context-and-sessions/src/App.jsx` (stub)
- Create: `context-and-sessions/src/index.css`
- Create: `context-and-sessions/.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "context-and-sessions",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate-data": "node scripts/generate-attention-tables.mjs"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.5.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "recharts": "^3.8.0",
    "three": "^0.183.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "jsdom": "^25.0.0",
    "vite": "^8.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/part3/',
  server: { port: 5175 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
```

- [ ] **Step 3: Create `eslint.config.js`**

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/data/*.json']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Context & Sessions — LLM Engineering Course</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Create `src/App.jsx` (stub)**

```jsx
export default function App() {
  return (
    <div style={{ padding: 40, color: '#E2E8F0', background: '#0B1120', minHeight: '100vh' }}>
      <h1>Context &amp; Sessions — scaffolding</h1>
      <p>Module 3 is under construction.</p>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/index.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0B1120; color: #E2E8F0; font-family: 'IBM Plex Sans', sans-serif; }
@media print { body { background: #fff; color: #000; } }
```

- [ ] **Step 8: Create `src/test-setup.js`**

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 9: Create `.gitignore`**

```
node_modules
dist
.vite
*.log
```

- [ ] **Step 10: Install deps and verify dev server boots**

Run:
```bash
cd context-and-sessions && npm install
```
Expected: no errors.

Run:
```bash
cd context-and-sessions && npm run dev
```
Expected: Vite starts on `http://localhost:5175/part3/`. Visit it in a browser; scaffolding page renders. Stop with Ctrl-C.

- [ ] **Step 11: Commit**

```bash
git add context-and-sessions/
git commit -m "Scaffold context-and-sessions Vite+React app"
```

---

### Task 2: Extract landing-page migrator into a testable module

**Files:**
- Create: `deploy-landing/migrate-progress.js`
- Create: `deploy-landing/migrate-progress.test.js`
- Create: `deploy-landing/package.json` (for running tests in this dir)
- Modify: `deploy-landing/index.html` (will happen in Task 32 — not yet)

The migrator must handle existing users whose `localStorage.llm_course_progress` still uses the pre-renumber keys. Extract to a small ESM module now so we can unit-test it before wiring it back into the landing page in Phase 5.

- [ ] **Step 1: Create `deploy-landing/package.json`**

```json
{
  "name": "deploy-landing",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install deps**

```bash
cd deploy-landing && npm install
```
Expected: no errors.

- [ ] **Step 3: Write the failing test**

Create `deploy-landing/migrate-progress.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { migrateProgressV1toV2, CURRENT_VERSION } from './migrate-progress.js'

describe('migrateProgressV1toV2', () => {
  let store
  const fakeStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }

  beforeEach(() => { store = {} })

  it('no-ops when there is no stored progress', () => {
    migrateProgressV1toV2(fakeStorage)
    expect(store).toEqual({})
  })

  it('is idempotent when already migrated', () => {
    store.llm_course_progress = JSON.stringify({ __v: 2, part4: true })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({ __v: 2, part4: true })
  })

  it('leaves part1 and part2 unchanged', () => {
    store.llm_course_progress = JSON.stringify({ part1: true, part2: true })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({ __v: 2, part1: true, part2: true })
  })

  it('shifts old part3..part6 to new part4..part7', () => {
    store.llm_course_progress = JSON.stringify({
      part1: true, part2: true, part3: true, part4: true, part5: true, part6: true,
    })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({
      __v: 2, part1: true, part2: true, part4: true, part5: true, part6: true, part7: true,
    })
  })

  it('does not fabricate a part3 completion for existing users', () => {
    store.llm_course_progress = JSON.stringify({ part1: true, part3: true })
    migrateProgressV1toV2(fakeStorage)
    const out = JSON.parse(store.llm_course_progress)
    expect(out.part3).toBeUndefined()
    expect(out.part4).toBe(true)
  })

  it('clears malformed JSON and does not throw', () => {
    store.llm_course_progress = '{not valid json'
    expect(() => migrateProgressV1toV2(fakeStorage)).not.toThrow()
    expect(store.llm_course_progress).toBeUndefined()
  })

  it('exports CURRENT_VERSION = 2', () => {
    expect(CURRENT_VERSION).toBe(2)
  })
})
```

- [ ] **Step 4: Run the test and verify it fails**

```bash
cd deploy-landing && npm test
```
Expected: FAIL with `Cannot find module ./migrate-progress.js` or equivalent.

- [ ] **Step 5: Write the implementation**

Create `deploy-landing/migrate-progress.js`:

```js
export const CURRENT_VERSION = 2
const KEY = 'llm_course_progress'

export function migrateProgressV1toV2(storage = globalThis.localStorage) {
  const raw = storage.getItem(KEY)
  if (raw === null) return

  let p
  try {
    p = JSON.parse(raw)
  } catch {
    storage.removeItem(KEY)
    return
  }

  if (!p || typeof p !== 'object') return
  if (p.__v === CURRENT_VERSION) return

  const next = { __v: CURRENT_VERSION }
  if (p.part1) next.part1 = p.part1
  if (p.part2) next.part2 = p.part2
  // no part3 carryover — Context & Sessions is a new module
  if (p.part3) next.part4 = p.part3
  if (p.part4) next.part5 = p.part4
  if (p.part5) next.part6 = p.part5
  if (p.part6) next.part7 = p.part6

  storage.setItem(KEY, JSON.stringify(next))
}
```

- [ ] **Step 6: Run the tests and verify they pass**

```bash
cd deploy-landing && npm test
```
Expected: all 7 tests pass.

- [ ] **Step 7: Commit**

```bash
git add deploy-landing/migrate-progress.js deploy-landing/migrate-progress.test.js deploy-landing/package.json deploy-landing/package-lock.json
git commit -m "Add localStorage progress migrator (v1 → v2) with tests"
```

---

### Task 3: Verify Vitest wiring in the module app

**Files:**
- Create: `context-and-sessions/src/lib/smoke.test.js`

- [ ] **Step 1: Write a trivial smoke test**

```js
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs', () => {
    expect(2 + 2).toBe(4)
  })
})
```

- [ ] **Step 2: Run it**

```bash
cd context-and-sessions && npm test
```
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add context-and-sessions/src/lib/smoke.test.js
git commit -m "Verify Vitest wiring in context-and-sessions"
```

---

## Phase 1: Attention Math & Data Tables

All 3D visualizations are backed by precomputed lookup tables. This phase builds the attention-model library (pure functions, fully unit-tested) and the table generator script.

### Task 4: Attention recall model library

The "recall probability" surfaces in Components 1 and 2 come from a simple attention-budget model with a lost-in-the-middle correction. This is pedagogical, not empirical — it reproduces the qualitative shape of Liu et al. 2023's findings.

**The model:**
```
recall(position, window_size, noise_level, model_profile) =
    clip01(
      base_rate(model_profile, window_size)
      * primacy_boost(position, window_size, model_profile)
      * recency_boost(position, window_size, model_profile)
      * (1 - noise_level * model_profile.noise_sensitivity)
    )
```

Where:
- `position` is normalized to [0, 1] (0 = start, 1 = end)
- `base_rate` decreases as window_size grows (context saturation)
- `primacy_boost` is a gaussian bump centered at 0 with width ~0.1
- `recency_boost` is a gaussian bump centered at 1 with width ~0.15 (recency stronger than primacy)
- `model_profile` parameterizes the depth of the middle valley per model

**Files:**
- Create: `context-and-sessions/src/lib/attention-model.js`
- Create: `context-and-sessions/src/lib/attention-model.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
      expect(typeof p.middle_valley_depth).toBe('number')
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
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd context-and-sessions && npm test -- attention-model
```
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write the implementation**

Create `context-and-sessions/src/lib/attention-model.js`:

```js
export const MODEL_PROFILES = {
  'gpt-4-turbo':    { base_rate_at_4k: 0.95, base_rate_at_200k: 0.72, middle_valley_depth: 0.35, noise_sensitivity: 0.45 },
  'claude-sonnet':  { base_rate_at_4k: 0.96, base_rate_at_200k: 0.80, middle_valley_depth: 0.28, noise_sensitivity: 0.35 },
  'gemini-1.5':     { base_rate_at_4k: 0.94, base_rate_at_200k: 0.74, middle_valley_depth: 0.32, noise_sensitivity: 0.40 },
  'generic-short':  { base_rate_at_4k: 0.92, base_rate_at_200k: 0.45, middle_valley_depth: 0.55, noise_sensitivity: 0.60 },
}

export function clip01(x) {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

// log-interpolate base rate between 4k and 200k anchors
function baseRate(profile, window_size) {
  const t = Math.log(window_size / 4000) / Math.log(200000 / 4000)
  const clamped = clip01(t)
  return profile.base_rate_at_4k + clamped * (profile.base_rate_at_200k - profile.base_rate_at_4k)
}

function gaussian(x, center, width) {
  const d = (x - center) / width
  return Math.exp(-0.5 * d * d)
}

// Returns a multiplier in [1 - middle_valley_depth, 1]. At the ends it approaches 1;
// in the middle it dips. Primacy (at 0) + recency (at 1), recency slightly stronger.
function positionalMultiplier(position, profile) {
  const primacy = gaussian(position, 0, 0.12)
  const recency = 1.1 * gaussian(position, 1, 0.15)
  const edgeBoost = Math.max(primacy, recency)  // bump in [0, ~1.1]
  const normalizedBoost = Math.min(edgeBoost, 1)  // clamp recency cap
  // Multiplier goes from (1 - depth) in the middle (edgeBoost ≈ 0) to 1 at the ends
  return (1 - profile.middle_valley_depth) + profile.middle_valley_depth * normalizedBoost
}

export function recall({ position, window_size, noise_level, model }) {
  const base = baseRate(model, window_size)
  const pos = positionalMultiplier(position, model)
  const noisePenalty = 1 - noise_level * model.noise_sensitivity
  return clip01(base * pos * noisePenalty)
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd context-and-sessions && npm test -- attention-model
```
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add context-and-sessions/src/lib/attention-model.js context-and-sessions/src/lib/attention-model.test.js
git commit -m "Add attention recall model with model profiles"
```

---

### Task 5: Lookup table generator script

**Files:**
- Create: `context-and-sessions/scripts/generate-attention-tables.mjs`
- Create: `context-and-sessions/src/data/window-playground-table.json` (output — committed)

The script emits a lookup grid so components can interpolate at runtime without doing math in the render loop.

**Grid shape:**
- `models`: 4 entries
- `window_sizes`: [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]
- `positions`: 41 points (0.0 to 1.0 in 0.025 increments)
- `noise_levels`: [0, 0.25, 0.5, 0.75, 1.0]

Total: 4 × 8 × 41 × 5 = 6560 values. JSON size ~200KB. Fine to commit.

- [ ] **Step 1: Write the generator script**

Create `context-and-sessions/scripts/generate-attention-tables.mjs`:

```js
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
```

- [ ] **Step 2: Run the generator**

```bash
cd context-and-sessions && npm run generate-data
```
Expected: writes `src/data/window-playground-table.json`, prints `Entries: 6560`.

- [ ] **Step 3: Verify file was created**

```bash
ls -la context-and-sessions/src/data/window-playground-table.json
```
Expected: file exists, ~200KB or smaller.

- [ ] **Step 4: Commit**

```bash
git add context-and-sessions/scripts/generate-attention-tables.mjs context-and-sessions/src/data/window-playground-table.json
git commit -m "Add attention table generator and generate playground data"
```

---

### Task 6: Runtime lookup + interpolation helper

Components need a helper that looks up `recall(model, window_size, position, noise_level)` from the JSON table with bilinear interpolation over `position` and `noise_level`, and piecewise-linear interpolation over `window_size`.

**Files:**
- Create: `context-and-sessions/src/lib/recall-lookup.js`
- Create: `context-and-sessions/src/lib/recall-lookup.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { createRecallLookup } from './recall-lookup.js'
import table from '../data/window-playground-table.json'

describe('createRecallLookup', () => {
  const lookup = createRecallLookup(table)

  it('returns exact grid value when arguments land on grid points', () => {
    // Position index 0 (=0.0) at window_size 4000, noise 0, claude-sonnet
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
```

- [ ] **Step 2: Run and verify failure**

```bash
cd context-and-sessions && npm test -- recall-lookup
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the lookup**

Create `context-and-sessions/src/lib/recall-lookup.js`:

```js
function clamp(x, lo, hi) {
  if (x < lo) return lo
  if (x > hi) return hi
  return x
}

function findBracket(arr, value) {
  // Returns [loIdx, hiIdx, t] where value = arr[loIdx] + t * (arr[hiIdx] - arr[loIdx])
  if (value <= arr[0]) return [0, 0, 0]
  if (value >= arr[arr.length - 1]) return [arr.length - 1, arr.length - 1, 0]
  for (let i = 0; i < arr.length - 1; i++) {
    if (value >= arr[i] && value <= arr[i + 1]) {
      const span = arr[i + 1] - arr[i]
      const t = span === 0 ? 0 : (value - arr[i]) / span
      return [i, i + 1, t]
    }
  }
  return [arr.length - 1, arr.length - 1, 0]
}

function lerp(a, b, t) { return a + (b - a) * t }

export function createRecallLookup(tableData) {
  const { grid, table } = tableData
  const { window_sizes, noise_levels, position_steps } = grid

  return function recallLookup({ model, window_size, position, noise_level }) {
    if (!(model in table)) throw new Error(`unknown model: ${model}`)

    const p = clamp(position, 0, 1)
    const n = clamp(noise_level, 0, 1)
    const w = clamp(window_size, window_sizes[0], window_sizes[window_sizes.length - 1])

    const [wLo, wHi, wt] = findBracket(window_sizes, w)
    const [nLo, nHi, nt] = findBracket(noise_levels, n)

    const posIdxFloat = p * (position_steps - 1)
    const pLo = Math.floor(posIdxFloat)
    const pHi = Math.min(pLo + 1, position_steps - 1)
    const pt = posIdxFloat - pLo

    const modelTable = table[model]

    function at(wi, ni, pi) {
      return modelTable[window_sizes[wi]][noise_levels[ni]][pi]
    }

    // Trilinear interpolation over (window, noise, position)
    const c000 = at(wLo, nLo, pLo)
    const c001 = at(wLo, nLo, pHi)
    const c010 = at(wLo, nHi, pLo)
    const c011 = at(wLo, nHi, pHi)
    const c100 = at(wHi, nLo, pLo)
    const c101 = at(wHi, nLo, pHi)
    const c110 = at(wHi, nHi, pLo)
    const c111 = at(wHi, nHi, pHi)

    const c00 = lerp(c000, c001, pt)
    const c01 = lerp(c010, c011, pt)
    const c10 = lerp(c100, c101, pt)
    const c11 = lerp(c110, c111, pt)

    const c0 = lerp(c00, c01, nt)
    const c1 = lerp(c10, c11, nt)

    return lerp(c0, c1, wt)
  }
}
```

- [ ] **Step 4: Run and verify pass**

```bash
cd context-and-sessions && npm test -- recall-lookup
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add context-and-sessions/src/lib/recall-lookup.js context-and-sessions/src/lib/recall-lookup.test.js
git commit -m "Add trilinear-interpolating recall lookup over precomputed tables"
```

---

### Task 7: Data integrity tests for the generated table

**Files:**
- Create: `context-and-sessions/tests/data-integrity.test.js`

- [ ] **Step 1: Write the test**

```js
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
```

- [ ] **Step 2: Run and verify pass**

```bash
cd context-and-sessions && npm test -- data-integrity
```
Expected: all 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add context-and-sessions/tests/data-integrity.test.js
git commit -m "Add integrity tests for window-playground-table.json"
```

---

## Phase 2: Slide Engine & Shared Primitives

### Task 8: Slide definitions file (text slides first; component slides will wire in as they are built)

**Files:**
- Create: `context-and-sessions/src/slides.jsx`

Writing the full slide list up front gives every future task a stable target to render into. Component slides reference components by string name; the engine in Task 9 maps those strings to imports. Where components don't exist yet, the engine will render a placeholder.

- [ ] **Step 1: Create the slide list**

```jsx
// All 23 slides for Module 3. Each text slide has id + type + title + {subtitle | body | bullets | keyTakeaway}.
// Each component slide has id + type: "component" + component (string key) + instructions.
// Each assessment slide has id + type: "assessment".
export const SLIDES = [
  {
    id: 'title',
    type: 'text',
    title: 'Context & Sessions: The Hidden Mechanic',
    subtitle: 'Why your 200k-token context is lying to you',
    body: 'You already know how attention works (Module 1) and how to write dense prompts (Module 2). This module shows the hidden mechanic that decides whether either one actually helps: where your information sits in the context, and how sessions accumulate noise.',
  },
  {
    id: 'agenda',
    type: 'text',
    title: "What We'll Cover",
    bullets: [
      { label: 'The Hook', desc: 'Advertised context length vs. effective context length' },
      { label: 'Lost-in-the-Middle', desc: 'Liu et al. 2023 and the U-curve' },
      { label: 'Why It Happens', desc: 'Attention budget revisited in long contexts' },
      { label: 'Context ≠ Prompt', desc: 'Everything that competes for attention mass' },
      { label: 'Two Levers', desc: 'Prompt engineering vs. context engineering' },
      { label: 'Governance Surface', desc: 'Context as a compliance and policy concern' },
      { label: 'Session Hygiene', desc: 'Six practices + nuclear restart' },
      { label: 'Worked Example', desc: 'A messy session vs. a hygienic one' },
      { label: 'Assessment', desc: '15 MCQ + 4 diagnostic scenarios' },
    ],
  },
  {
    id: 'hook',
    type: 'text',
    title: "You've Been Lied to About Context Length",
    subtitle: '200k tokens advertised. ~40k tokens effective. That gap is where bugs live.',
    body: 'Providers quote context length as a hard cap: "up to 200k tokens." In practice, recall accuracy on a single fact buried deep in that context starts degrading well before the cap. A constraint placed at token 100,000 in a 200k context is often forgotten by the time the model answers.',
    keyTakeaway: 'Advertised context length is a maximum, not a guarantee. Effective context is where recall stays above a usable threshold.',
  },
  {
    id: 'lost-in-middle-intro',
    type: 'text',
    title: 'Lost-in-the-Middle',
    subtitle: 'Liu et al. 2023 — "Lost in the Middle: How Language Models Use Long Contexts"',
    body: 'The finding: when a single relevant fact is placed at varying positions in a long input, models recall it reliably when it sits near the start (primacy) or near the end (recency), but accuracy drops sharply when it sits in the middle. The result is a U-shaped curve, and it holds across model sizes and architectures.',
    keyTakeaway: 'Attention is not uniform across the context window. The middle is darker than the ends.',
  },
  {
    id: 'lost-in-middle-demo',
    type: 'component',
    component: 'LostInTheMiddleCurve',
    instructions: 'Drag the needle to any position. Adjust context length and noise. Watch the U-curve, then rotate the 3D surface to see how position × context length jointly shape recall.',
  },
  {
    id: 'why-it-happens',
    type: 'text',
    title: 'Why It Happens',
    subtitle: 'Attention dilution, revisited at scale',
    body: 'Module 1 showed softmax distributing probability mass across every token in the context. In a 200k-token context, every additional token steals a tiny slice of attention. Combine that with positional encodings that give stronger signal at sequence ends, and the middle becomes a relative desert. There is nothing special about the middle in the training data — the architecture itself produces the U-curve.',
    keyTakeaway: 'The U-curve is a structural property of transformer attention over long sequences. Not a bug — a budget problem.',
  },
  {
    id: 'effective-vs-advertised',
    type: 'text',
    title: 'Effective vs. Advertised Context',
    subtitle: 'Where does recall actually hold?',
    body: 'A useful rule of thumb: effective context for high-stakes retrieval is often 20–40% of advertised. GPT-4 Turbo at 128k advertised holds well to ~40k. Claude Sonnet at 200k holds better (historically to ~80k+), but still degrades. Smaller or older "long-context" models may effectively be half their advertised number.',
    keyTakeaway: 'Design for the effective length you can verify, not the number on the tin.',
  },
  {
    id: 'playground',
    type: 'component',
    component: 'ContextWindowPlayground',
    instructions: 'Place a needle anywhere in the context. Drag the window-size slider from 1k to 200k. Watch the landscape flatten and the middle recall collapse. Try different model presets.',
  },
  {
    id: 'context-vs-prompt',
    type: 'text',
    title: 'Context ≠ Prompt',
    subtitle: 'Your prompt is the tip of a much larger iceberg',
    body: '"Prompt" is the text you type this turn. "Context" is everything the model sees: system prompt, every prior turn, every tool call and its output, every attached file, retrieved documents, and finally — your current prompt. Every byte of that competes for the same attention budget.',
    keyTakeaway: 'Whenever someone says "just a prompt," ask what else is in the window.',
  },
  {
    id: 'anatomy',
    type: 'text',
    title: 'Anatomy of the Window',
    bullets: [
      { label: 'System prompt', desc: 'Persistent instructions; high-attention real estate at the start' },
      { label: 'Chat history', desc: 'Every prior user + assistant turn, in order' },
      { label: 'Tool outputs', desc: 'File reads, search results, API responses — often huge' },
      { label: 'Attachments', desc: 'Uploaded files, images, PDFs — tokenized inline' },
      { label: 'RAG / retrieved docs', desc: 'Any chunks you pre-pended for this turn' },
      { label: 'User turn', desc: 'What you actually typed — usually the smallest slice' },
    ],
    keyTakeaway: 'The user turn is often the smallest fraction of what the model reads.',
  },
  {
    id: 'budget-intro',
    type: 'text',
    title: 'Context as a Budget',
    subtitle: '100% attention mass. You have to allocate it.',
    body: 'If attention were infinite, you could dump everything and let the model sort it out. It is not infinite. Softmax guarantees the sum across all positions is exactly 1. Every chunk of context you add dilutes the share available to every other chunk.',
    keyTakeaway: 'Every token you include is a vote against every other token.',
  },
  {
    id: 'budget-demo',
    type: 'component',
    component: 'AttentionBudgetAllocator',
    instructions: 'Add chunks of different types and sizes. Watch the budget redistribute. Try to keep "attention per critical token" above 5%.',
  },
  {
    id: 'two-levers',
    type: 'text',
    title: 'The Two Levers',
    subtitle: 'Prompt engineering and context engineering are not in competition',
    body: 'Prompt engineering shapes the current turn — structure, role, constraints, examples, format. Context engineering shapes what else is in the window — what you include, what you exclude, what order, and what gets summarized. Both act on the same attention mechanism. Used together, they compound. Used alone, each hits a ceiling.',
    keyTakeaway: 'Prompt engineering makes each token count. Context engineering decides which tokens get to compete in the first place.',
  },
  {
    id: 'prompt-engineering-six',
    type: 'text',
    title: 'Prompt Engineering: Six Techniques',
    bullets: [
      { label: 'XML structure', desc: '<constraints>, <examples>, <instructions> — unambiguous sections' },
      { label: 'Role prime', desc: '"You are a senior security engineer…" — activates domain priors' },
      { label: 'Explicit constraints', desc: 'Hard rules stated as "MUST" and "MUST NOT"' },
      { label: 'Few-shot examples', desc: 'Concrete input→output pairs the model can pattern-match' },
      { label: 'Chain-of-thought', desc: '"Think step by step" or structured reasoning scaffolding' },
      { label: 'Output format spec', desc: 'Tight schema (JSON, table, fields) the model must match' },
    ],
  },
  {
    id: 'context-engineering-six',
    type: 'text',
    title: 'Context Engineering: Six Techniques',
    bullets: [
      { label: 'Front/tail-load critical', desc: 'Put constraints where attention is strongest: start and end' },
      { label: 'Summarize old turns', desc: 'Compress aged history; drop verbatim turns' },
      { label: 'Pin invariants', desc: 'Periodically re-assert constraints so they live in the recency window' },
      { label: 'Prune tool outputs', desc: 'Keep the excerpt you need, not the whole file' },
      { label: 'Scope sessions', desc: 'One concern per session; start fresh for new concerns' },
      { label: 'External memory', desc: 'Scratchpad files, indexed specs, policy docs — fetched on demand' },
    ],
  },
  {
    id: 'lever-demo',
    type: 'component',
    component: 'LeverComparisonTool',
    instructions: 'Same task, two panes. Toggle prompt levers (left) and context levers (right) and watch the score. Try "Match the other side" to push one lever as far as it will go.',
  },
  {
    id: 'governance',
    type: 'text',
    title: 'Context as Governance Surface',
    subtitle: "What goes into the window is not just an engineering decision — it's a policy decision",
    body: 'If your context includes PII, confidential customer data, or proprietary source code, the model sees it. Any downstream logging, any cache, any training pipeline sees it too. Context composition is therefore a compliance boundary. Organizations that treat it as one install guardrails on inputs (what data is allowed in), enforce attached indices (company API specs, policy docs), and audit what actually reached the model.',
    keyTakeaway: 'Every LLM invocation is a data-egress event. Context is the boundary.',
  },
  {
    id: 'external-memory',
    type: 'text',
    title: 'External Memory, Indices, and Guardrails',
    bullets: [
      { label: 'PII / confidential filters', desc: 'Strip sensitive fields before context assembly; policy-enforced' },
      { label: 'API spec index', desc: 'Pull canonical API specs on demand — one source of truth, not N reinvented wheels' },
      { label: 'Policy / compliance index', desc: 'Retrieve the rules that must bind a design; cite them explicitly' },
      { label: 'Scratchpad files', desc: 'Persist reasoning across sessions (e.g., MEMORY.md) without paying context tax' },
      { label: 'Outbound validators', desc: 'Screen model output before it acts on shared systems' },
    ],
    keyTakeaway: 'External memory earns its keep when it replaces a larger chunk of context than it adds.',
  },
  {
    id: 'hygiene-intro',
    type: 'text',
    title: 'Session Hygiene: Six Practices + Nuclear Restart',
    subtitle: 'The playbook for keeping long sessions useful',
    bullets: [
      { label: '1. Front/tail-load', desc: 'Critical constraints at start AND end — never stuck in the middle' },
      { label: '2. Summarize', desc: 'Compress aged turns; strip noise; keep the decisions' },
      { label: '3. Pin invariants', desc: 'Re-state hard rules periodically so they stay in recency' },
      { label: '4. Prune tool outputs', desc: 'Keep excerpts; drop raw dumps after the relevant bit is extracted' },
      { label: '5. Scope', desc: 'One concern per session; fork for new concerns' },
      { label: '6. Watch effective length', desc: "Don't trust the advertised number; watch for degradation" },
      { label: 'Nuclear restart', desc: 'When none of the above works: summarize, then start fresh' },
    ],
  },
  {
    id: 'simulator',
    type: 'component',
    component: 'SessionHygieneSimulator',
    instructions: 'This session has a critical fact at turn 2, then accumulates noise. Toggle interventions to get recall on the turn-2 fact above 90%.',
  },
  {
    id: 'worked-example',
    type: 'text',
    title: 'Worked Example: Before & After',
    subtitle: 'A real messy session vs. a hygienic one',
    body: 'On the left: a 30-turn session covering three different concerns, with four raw file dumps, no summarization, and a key constraint placed at turn 3 and never restated. On the right: the same work split into scoped sessions, with summaries, pinned invariants, and tool outputs pruned to excerpts. The hygienic session is half the tokens and delivers correct output on the first try.',
    keyTakeaway: "The cost of hygiene is small. The cost of skipping it is everything the model didn't catch.",
  },
  {
    id: 'assessment',
    type: 'assessment',
    instructions: '15 MCQ + 4 diagnostic scenarios. Pass threshold: 80% overall AND 75% on diagnostics.',
  },
  {
    id: 'recap',
    type: 'text',
    title: 'Recap & Bridge to Module 4',
    subtitle: 'You now have the hidden mechanic',
    body: 'Module 4 (Building with LLMs) relies on every practice here. Decomposition, orchestration, parallel agent dispatch — all of it fails without context hygiene. An orchestrator that dumps every sub-agent\'s full output into the parent context will lose the middle every time.',
    keyTakeaway: 'Context hygiene is the prerequisite for every agentic system.',
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add context-and-sessions/src/slides.jsx
git commit -m "Add slide definitions for Module 3"
```

---

### Task 9: Slide engine (App.jsx)

Reuse the pattern from `working-with-llms/src/App.jsx`. Component slides render via a string-keyed map; unknown keys render a placeholder so slides can be wired up as components are built.

**Files:**
- Modify: `context-and-sessions/src/App.jsx`

- [ ] **Step 1: Replace App.jsx stub with the full engine**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { SLIDES } from './slides.jsx'

const C = {
  bg: '#0B1120',
  surface: '#131B2E',
  border: '#1E293B',
  text: '#E2E8F0',
  textDim: '#94A3B8',
  accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)',
}

// Components register themselves here as they come online (Tasks 11-26).
// Unknown component keys render a visible placeholder so future slides are obvious.
const COMPONENT_MAP = {}

function registerComponent(key, Component) {
  COMPONENT_MAP[key] = Component
}
export { registerComponent }

function TextSlide({ slide }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px' }}>
      <h1 style={{ fontSize: 42, fontWeight: 700, color: C.text, marginBottom: 12 }}>
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p style={{ fontSize: 20, color: C.accent, marginBottom: 24 }}>{slide.subtitle}</p>
      )}
      {slide.body && (
        <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textDim, marginBottom: 24 }}>
          {slide.body}
        </p>
      )}
      {slide.bullets && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
          {slide.bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'baseline' }}>
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 16, minWidth: 220 }}>
                {b.label}
              </span>
              <span style={{ color: C.textDim, fontSize: 16, lineHeight: 1.5 }}>{b.desc}</span>
            </li>
          ))}
        </ul>
      )}
      {slide.keyTakeaway && (
        <div style={{ background: C.accentGlow, border: `1px solid ${C.accent}33`,
          borderRadius: 8, padding: '16px 20px', marginTop: 16 }}>
          <p style={{ fontSize: 14, color: C.accent, margin: 0, lineHeight: 1.6 }}>
            <strong>Key Takeaway:</strong> {slide.keyTakeaway}
          </p>
        </div>
      )}
    </div>
  )
}

function ComponentSlide({ slide }) {
  const Comp = COMPONENT_MAP[slide.component]
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {slide.instructions && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 20, background: `${C.surface}ee`,
          borderBottom: `1px solid ${C.border}`, padding: '8px 20px',
          backdropFilter: 'blur(8px)',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>{slide.instructions}</p>
        </div>
      )}
      {Comp ? <Comp /> : (
        <div style={{ padding: 40, color: C.textDim }}>
          Component <code style={{ color: C.accent }}>{slide.component}</code> not yet registered.
        </div>
      )}
    </div>
  )
}

function AssessmentSlide({ slide }) {
  const Assessment = COMPONENT_MAP.ContextSessionsAssessment
  return Assessment
    ? <Assessment />
    : <div style={{ padding: 40, color: C.textDim }}>Assessment not yet registered.</div>
}

function markPartComplete() {
  try {
    const raw = localStorage.getItem('llm_course_progress')
    const progress = raw ? JSON.parse(raw) : {}
    progress.__v = 2
    progress.part3 = true
    localStorage.setItem('llm_course_progress', JSON.stringify(progress))
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export default function App() {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]

  const go = useCallback((dir) => {
    setIdx((i) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, i + dir))
      if (next === SLIDES.length - 1 && i !== next) markPartComplete()
      return next
    })
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text,
      display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 56 }}>
        {slide.type === 'text' ? <TextSlide slide={slide} />
         : slide.type === 'assessment' ? <AssessmentSlide slide={slide} />
         : <ComponentSlide slide={slide} />}
      </div>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        background: 'rgba(19,27,46,0.95)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => go(-1)} disabled={idx === 0}
          style={{ background: 'none', border: `1px solid ${C.border}`,
            color: idx === 0 ? C.textDim : C.text, padding: '6px 16px',
            borderRadius: 6, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13 }}>
          Previous
        </button>
        <div style={{ display: 'flex', gap: 6 }} data-testid="slide-dots">
          {SLIDES.map((s, i) => (
            <div key={s.id} onClick={() => setIdx(i)}
              data-testid={`dot-${s.id}`}
              style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                background: i === idx ? C.accent
                 : (s.type === 'component' || s.type === 'assessment') ? C.accent + '66' : C.border }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === SLIDES.length - 1}
          style={{ background: 'none', border: `1px solid ${C.border}`,
            color: idx === SLIDES.length - 1 ? C.textDim : C.text, padding: '6px 16px',
            borderRadius: 6, cursor: idx === SLIDES.length - 1 ? 'default' : 'pointer', fontSize: 13 }}>
          Next
        </button>
        <span style={{ fontSize: 12, color: C.textDim, marginLeft: 8 }}>
          {idx + 1} / {SLIDES.length}
        </span>
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Create a component registry module**

Create `context-and-sessions/src/register-components.js`:

```js
// This file is imported once (by main.jsx via App). As each interactive component
// is built, import it here and add it to registerComponent.
import { registerComponent } from './App.jsx'

// Components register themselves in later tasks. Intentionally empty for now.
export {}
void registerComponent
```

- [ ] **Step 3: Wire registration into main.jsx**

Update `context-and-sessions/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './register-components.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Manual smoke test**

Run:
```bash
cd context-and-sessions && npm run dev
```
In the browser:
- Title slide renders
- Right arrow advances through 23 slides
- Component slides show the "not yet registered" placeholder
- Navigation dots are clickable

Stop with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add context-and-sessions/src/App.jsx context-and-sessions/src/register-components.js context-and-sessions/src/main.jsx
git commit -m "Implement slide engine with component registry"
```

---

### Task 10: Slide engine tests

**Files:**
- Create: `context-and-sessions/tests/slide-engine.test.jsx`

- [ ] **Step 1: Write the tests**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../src/App.jsx'
import { SLIDES } from '../src/slides.jsx'

describe('SLIDES data', () => {
  it('has exactly 23 entries', () => {
    expect(SLIDES).toHaveLength(23)
  })

  it('has unique ids', () => {
    const ids = SLIDES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every slide has a valid type', () => {
    const valid = new Set(['text', 'component', 'assessment'])
    for (const s of SLIDES) expect(valid.has(s.type)).toBe(true)
  })

  it('component slides reference a component name', () => {
    for (const s of SLIDES.filter((s) => s.type === 'component')) {
      expect(typeof s.component).toBe('string')
      expect(s.component.length).toBeGreaterThan(0)
    }
  })

  it('has exactly 5 component slides', () => {
    expect(SLIDES.filter((s) => s.type === 'component')).toHaveLength(5)
  })

  it('has exactly 1 assessment slide', () => {
    expect(SLIDES.filter((s) => s.type === 'assessment')).toHaveLength(1)
  })
})

describe('App slide engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the title slide first', () => {
    render(<App />)
    expect(screen.getByText(/Context & Sessions: The Hidden Mechanic/)).toBeInTheDocument()
  })

  it('ArrowRight advances to the next slide', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/What We'll Cover/)).toBeInTheDocument()
  })

  it('ArrowLeft at slide 0 stays at slide 0', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/Context & Sessions: The Hidden Mechanic/)).toBeInTheDocument()
  })

  it('writes progress.part3 = true when reaching the last slide', () => {
    render(<App />)
    for (let i = 0; i < SLIDES.length - 1; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    }
    const stored = JSON.parse(localStorage.getItem('llm_course_progress'))
    expect(stored.part3).toBe(true)
    expect(stored.__v).toBe(2)
  })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd context-and-sessions && npm test -- slide-engine
```
Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add context-and-sessions/tests/slide-engine.test.jsx
git commit -m "Add slide engine tests"
```

---

### Task 11: Shared color + theme constants

Components 1, 2, 3, 5, 6 and the assessment all share a color palette and a few measurement helpers. Extract now to prevent drift.

**Files:**
- Create: `context-and-sessions/src/lib/theme.js`

- [ ] **Step 1: Create theme**

```js
export const C = {
  bg: '#0B1120',
  surface: '#131B2E',
  surfaceDeep: '#0F172A',
  border: '#1E293B',
  text: '#E2E8F0',
  textDim: '#94A3B8',
  textFaint: '#64748B',
  accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)',
  green: '#22C55E',
  greenGlow: 'rgba(34,197,94,0.15)',
  red: '#EF4444',
  redGlow: 'rgba(239,68,68,0.15)',
  yellow: '#EAB308',
  purple: '#A855F7',
  orange: '#F97316',
  cyan: '#06B6D4',
}

export const CHUNK_COLORS = {
  system: '#A855F7',
  history: '#06B6D4',
  tool: '#F97316',
  attachment: '#EAB308',
  rag: '#22C55E',
  user: '#3B82F6',
}

export const FONT_SANS = "'IBM Plex Sans', sans-serif"
export const FONT_MONO = "'IBM Plex Mono', monospace"
```

- [ ] **Step 2: Commit**

```bash
git add context-and-sessions/src/lib/theme.js
git commit -m "Add shared theme constants"
```

---

## Phase 3: Interactive Components

Components are built in order of complexity so shared primitives emerge from real use.

### Task 12: Attention Budget math library

Component 3 (and the simulator in later tasks) computes how chunks of context share the attention budget. Extract the math first as pure functions.

**Model:** each chunk has `type` and `tokens`. The effective attention share of each chunk approximates `softmax` over `tokens * weight(type)`, where `weight` lets us model that the model typically attends more to system prompts and recent turns per-token, less to long raw tool dumps. Critical tokens live inside the `user` chunk; attention-per-critical-token = `userShare * (critical_count / user_chunk_tokens)`.

**Files:**
- Create: `context-and-sessions/src/lib/budget-math.js`
- Create: `context-and-sessions/src/lib/budget-math.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
})
```

- [ ] **Step 2: Run and verify failure**

```bash
cd context-and-sessions && npm test -- budget-math
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `context-and-sessions/src/lib/budget-math.js`:

```js
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

  // Each chunk's "attention mass" is tokens * weight.
  const weighted = chunks.map((c) => {
    const w = CHUNK_WEIGHTS[c.type] ?? 1.0
    return { id: c.id, mass: Math.max(1, c.tokens) * w, chunk: c }
  })

  const total = weighted.reduce((a, b) => a + b.mass, 0)
  const shares = {}
  for (const w of weighted) shares[w.id] = total > 0 ? w.mass / total : 0

  const userChunk = chunks.find((c) => c.type === 'user')
  let attentionPerCritical = 0
  if (userChunk) {
    const critical = userChunk.criticalTokens ?? 0
    const total = Math.max(1, userChunk.tokens)
    attentionPerCritical = (shares[userChunk.id] ?? 0) * (critical / total)
  }

  return { shares, attentionPerCritical }
}
```

- [ ] **Step 4: Run and verify pass**

```bash
cd context-and-sessions && npm test -- budget-math
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add context-and-sessions/src/lib/budget-math.js context-and-sessions/src/lib/budget-math.test.js
git commit -m "Add context attention budget math with tests"
```

---

### Task 13: AttentionBudgetAllocator component (Component 3)

**Files:**
- Create: `context-and-sessions/src/components/AttentionBudgetAllocator.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement**

Create `context-and-sessions/src/components/AttentionBudgetAllocator.jsx`:

```jsx
import { useState, useMemo } from 'react'
import { C, CHUNK_COLORS, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { computeBudget } from '../lib/budget-math.js'

const CHUNK_TYPES = [
  { type: 'system',     label: 'System prompt',  defaultTokens: 300 },
  { type: 'rag',        label: 'RAG doc',        defaultTokens: 1500 },
  { type: 'tool',       label: 'Tool output',    defaultTokens: 4000 },
  { type: 'history',    label: 'Prior turn',     defaultTokens: 600 },
  { type: 'attachment', label: 'Attachment',     defaultTokens: 3000 },
  { type: 'user',       label: 'User msg',       defaultTokens: 150, criticalDefault: 40 },
]

let nextId = 1
const makeChunk = (t) => ({
  id: `c${nextId++}`,
  type: t.type,
  label: t.label,
  tokens: t.defaultTokens,
  criticalTokens: t.criticalDefault ?? 0,
})

function initialChunks() {
  return [
    makeChunk(CHUNK_TYPES[0]),                    // system
    makeChunk(CHUNK_TYPES[5]),                    // user
  ]
}

export default function AttentionBudgetAllocator() {
  const [chunks, setChunks] = useState(initialChunks)

  const { shares, attentionPerCritical } = useMemo(() => computeBudget(chunks), [chunks])
  const totalTokens = chunks.reduce((a, c) => a + c.tokens, 0)

  const addChunk = (typeDef) => setChunks((prev) => [...prev, makeChunk(typeDef)])
  const removeChunk = (id) => setChunks((prev) => prev.filter((c) => c.id !== id))
  const updateTokens = (id, tokens) =>
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, tokens } : c))
  const updateCritical = (id, critical) =>
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, criticalTokens: critical } : c))

  const criticalPct = (attentionPerCritical * 100).toFixed(2)
  const criticalColor = attentionPerCritical >= 0.05 ? C.green
    : attentionPerCritical >= 0.02 ? C.yellow : C.red

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>Attention Budget Allocator</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
        Every chunk competes for the same 100% of attention. Try to keep attention-per-critical-token above 5%.
      </p>

      {/* Stacked bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', width: '100%', height: 48, borderRadius: 6, overflow: 'hidden',
          border: `1px solid ${C.border}`, background: C.surfaceDeep }} data-testid="budget-bar">
          {chunks.map((c) => {
            const pct = (shares[c.id] ?? 0) * 100
            return (
              <div key={c.id} data-testid={`bar-seg-${c.id}`} title={`${c.label} — ${pct.toFixed(1)}%`}
                style={{ width: `${pct}%`, background: CHUNK_COLORS[c.type], borderRight: `1px solid ${C.bg}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0B1120', fontSize: 11, fontFamily: FONT_MONO, fontWeight: 600 }}>
                {pct >= 4 ? `${pct.toFixed(0)}%` : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Critical-attention readout */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <span style={{ color: C.textDim, fontSize: 13 }}>Attention per critical token:</span>
        <span data-testid="critical-pct" style={{ color: criticalColor, fontFamily: FONT_MONO,
          fontSize: 22, fontWeight: 700 }}>{criticalPct}%</span>
        <span style={{ color: C.textFaint, fontSize: 12, marginLeft: 'auto' }}>
          Total tokens: <code>{totalTokens.toLocaleString()}</code>
        </span>
      </div>

      {/* Chunk controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {chunks.map((c) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '12px 140px 1fr 100px 32px',
            alignItems: 'center', gap: 12, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: CHUNK_COLORS[c.type] }} />
            <div style={{ color: C.text, fontSize: 14 }}>{c.label}</div>
            <input type="range" min="50" max="20000" value={c.tokens}
              onChange={(e) => updateTokens(c.id, +e.target.value)}
              data-testid={`tokens-${c.id}`} style={{ width: '100%' }} />
            <div style={{ color: C.textDim, fontSize: 12, fontFamily: FONT_MONO }}>
              {c.tokens.toLocaleString()} tok
              {c.type === 'user' && (
                <div style={{ fontSize: 11, color: C.accent }}>
                  {c.criticalTokens} critical
                </div>
              )}
            </div>
            <button onClick={() => removeChunk(c.id)} data-testid={`remove-${c.id}`}
              style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textDim,
                borderRadius: 4, cursor: 'pointer', padding: '4px 8px' }} aria-label={`Remove ${c.label}`}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CHUNK_TYPES.map((t) => (
          <button key={t.type} onClick={() => addChunk(t)} data-testid={`add-${t.type}`}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text,
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
              fontFamily: FONT_SANS, fontSize: 13 }}>
            + {t.label}
          </button>
        ))}
      </div>

      {/* User-chunk critical-count slider (only shown when a user chunk exists) */}
      {chunks.some((c) => c.type === 'user') && (
        <div style={{ marginTop: 24, padding: '12px 16px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <label style={{ color: C.textDim, fontSize: 13, display: 'block', marginBottom: 8 }}>
            Critical tokens inside the user chunk:
          </label>
          {chunks.filter((c) => c.type === 'user').map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="range" min="0" max={c.tokens} value={c.criticalTokens}
                onChange={(e) => updateCritical(c.id, Math.min(+e.target.value, c.tokens))}
                data-testid={`critical-${c.id}`} style={{ flex: 1 }} />
              <span style={{ color: C.accent, fontSize: 12, fontFamily: FONT_MONO, minWidth: 60 }}>
                {c.criticalTokens} / {c.tokens}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Register the component**

Update `context-and-sessions/src/register-components.js`:

```js
import { registerComponent } from './App.jsx'
import AttentionBudgetAllocator from './components/AttentionBudgetAllocator.jsx'

registerComponent('AttentionBudgetAllocator', AttentionBudgetAllocator)
```

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`; navigate to the "Context as a Budget" slide. Expected:
- Stacked bar renders with two segments (system + user)
- "Attention per critical token" displays a value ≈ 5-15%
- Adding a 20k Tool chunk drops the critical %
- Removing chunks restores it

Stop dev server.

- [ ] **Step 4: Component smoke test**

Create `context-and-sessions/tests/components/AttentionBudgetAllocator.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AttentionBudgetAllocator from '../../src/components/AttentionBudgetAllocator.jsx'

describe('AttentionBudgetAllocator', () => {
  it('renders without crashing', () => {
    render(<AttentionBudgetAllocator />)
    expect(screen.getByText(/Attention Budget Allocator/i)).toBeInTheDocument()
  })

  it('shows an initial critical-token percentage', () => {
    render(<AttentionBudgetAllocator />)
    const val = screen.getByTestId('critical-pct').textContent
    const pct = parseFloat(val)
    expect(pct).toBeGreaterThan(0)
  })

  it('adding a tool output lowers attention per critical token', () => {
    render(<AttentionBudgetAllocator />)
    const before = parseFloat(screen.getByTestId('critical-pct').textContent)
    fireEvent.click(screen.getByTestId('add-tool'))
    const after = parseFloat(screen.getByTestId('critical-pct').textContent)
    expect(after).toBeLessThan(before)
  })
})
```

- [ ] **Step 5: Run and verify pass**

```bash
cd context-and-sessions && npm test -- AttentionBudgetAllocator
```
Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add context-and-sessions/src/components/AttentionBudgetAllocator.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/AttentionBudgetAllocator.test.jsx
git commit -m "Add AttentionBudgetAllocator component (Component 3)"
```

---

### Task 14: RecallLandscape3D — shared 3D primitive

Components 1, 2, and 6 all render a 3D attention landscape with mostly-identical geometry. Extract once to prevent triplication.

**Files:**
- Create: `context-and-sessions/src/components/RecallLandscape3D.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { C } from '../lib/theme.js'

// props:
//   samples: array of { position: 0..1, y: 0..1 } OR 2D array of shape [rows][cols] (y-values)
//   width, depth: geometry size (default 4 x 2)
//   colorFn(y) => hex (optional)
export default function RecallLandscape3D({
  samples,
  width = 4,
  depth = 2,
  height = 1.2,
  colorFn,
  needlePosition = null,   // 0..1 or null
}) {
  const geometry = useMemo(() => {
    let grid
    if (Array.isArray(samples[0])) {
      grid = samples
    } else {
      // 1D — render as a single strip
      grid = [samples.map((s) => s.y), samples.map((s) => s.y)]
    }
    const rows = grid.length
    const cols = grid[0].length
    const geom = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1)
    const pos = geom.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const y = grid[row][col]
      pos.setZ(i, y * height)
      const color = new THREE.Color(
        colorFn ? colorFn(y) : interpolateColor(y)
      )
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geom.computeVertexNormals()
    return geom
  }, [samples, width, depth, height, colorFn])

  const needleX = needlePosition !== null
    ? (needlePosition - 0.5) * width
    : null

  return (
    <Canvas camera={{ position: [0, 3, 4], fov: 45 }} style={{ background: C.bg }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {needleX !== null && (
        <mesh position={[needleX, height * 1.2, 0]}>
          <coneGeometry args={[0.08, 0.3, 12]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} />
        </mesh>
      )}
      <axisLabel text="position" position={[0, -0.1, depth / 2 + 0.3]} />
      <OrbitControls enablePan={false} />
    </Canvas>
  )
}

function axisLabel({ text, position }) {
  return <Text position={position} fontSize={0.15} color="#64748B">{text}</Text>
}

function interpolateColor(y) {
  // y ∈ [0,1]; red (cold/low) → yellow → green (hot/high)
  if (y < 0.5) {
    const t = y / 0.5
    return new THREE.Color().setRGB(1.0, 0.25 + 0.75 * t, 0.25).getHex()
  }
  const t = (y - 0.5) / 0.5
  return new THREE.Color().setRGB(1.0 - t * 0.8, 1.0, 0.25 + 0.5 * t).getHex()
}
```

- [ ] **Step 2: Commit**

```bash
git add context-and-sessions/src/components/RecallLandscape3D.jsx
git commit -m "Add shared RecallLandscape3D primitive"
```

---

### Task 15: ContextWindowPlayground component (Component 1)

**Files:**
- Create: `context-and-sessions/src/components/ContextWindowPlayground.jsx`
- Create: `context-and-sessions/tests/components/ContextWindowPlayground.test.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement the component**

```jsx
import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { createRecallLookup } from '../lib/recall-lookup.js'
import tableData from '../data/window-playground-table.json'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const lookup = createRecallLookup(tableData)

const MODELS = [
  { key: 'gpt-4-turbo',   label: 'GPT-4 Turbo (128k)' },
  { key: 'claude-sonnet', label: 'Claude Sonnet (200k)' },
  { key: 'gemini-1.5',    label: 'Gemini 1.5 Pro (1M effective ~200k)' },
  { key: 'generic-short', label: 'Generic short-context' },
]
const WINDOW_SIZES = [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]

export default function ContextWindowPlayground() {
  const [modelKey, setModelKey] = useState('claude-sonnet')
  const [windowIdx, setWindowIdx] = useState(4)   // 64k
  const [noise, setNoise] = useState(0.25)
  const [needlePos, setNeedlePos] = useState(0.5)

  const windowSize = WINDOW_SIZES[windowIdx]

  const samples = useMemo(() => {
    const COLS = 41
    const row = Array.from({ length: COLS }, (_, i) => {
      const p = i / (COLS - 1)
      return lookup({ model: modelKey, window_size: windowSize, position: p, noise_level: noise })
    })
    // Two identical rows so the plane has some depth; depth axis represents the noise level implicitly.
    return [row, row]
  }, [modelKey, windowSize, noise])

  const needleRecall = useMemo(() =>
    lookup({ model: modelKey, window_size: windowSize, position: needlePos, noise_level: noise }),
    [modelKey, windowSize, noise, needlePos])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16,
      padding: '16px 20px', fontFamily: FONT_SANS, height: 'calc(100vh - 120px)' }}>
      <div style={{ background: C.surfaceDeep, borderRadius: 8, overflow: 'hidden' }}>
        <RecallLandscape3D samples={samples} needlePosition={needlePos} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ color: C.text, fontSize: 20, margin: 0 }}>Context Window Playground</h2>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>Model</label>
          <select value={modelKey} onChange={(e) => setModelKey(e.target.value)}
            data-testid="model-select"
            style={{ width: '100%', padding: 6, background: C.surface,
              color: C.text, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            {MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Window size: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {windowSize.toLocaleString()} tok
            </span>
          </label>
          <input type="range" min="0" max={WINDOW_SIZES.length - 1} value={windowIdx}
            onChange={(e) => setWindowIdx(+e.target.value)} data-testid="window-slider"
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Noise: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {(noise * 100).toFixed(0)}%
            </span>
          </label>
          <input type="range" min="0" max="1" step="0.01" value={noise}
            onChange={(e) => setNoise(+e.target.value)} data-testid="noise-slider"
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Needle position: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {(needlePos * 100).toFixed(0)}%
            </span>
          </label>
          <input type="range" min="0" max="1" step="0.01" value={needlePos}
            onChange={(e) => setNeedlePos(+e.target.value)} data-testid="needle-slider"
            style={{ width: '100%' }} />
        </div>
        <div style={{ padding: 12, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6 }}>
          <div style={{ color: C.textDim, fontSize: 12 }}>Recall at needle:</div>
          <div data-testid="needle-recall"
            style={{ color: needleRecall > 0.7 ? C.green : needleRecall > 0.4 ? C.yellow : C.red,
              fontSize: 28, fontFamily: FONT_MONO, fontWeight: 700 }}>
            {(needleRecall * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the smoke test**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContextWindowPlayground from '../../src/components/ContextWindowPlayground.jsx'

// Mock @react-three/fiber Canvas to avoid WebGL in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Text: ({ children }) => <span>{children}</span>,
}))
vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

describe('ContextWindowPlayground', () => {
  it('renders', () => {
    render(<ContextWindowPlayground />)
    expect(screen.getByText(/Context Window Playground/i)).toBeInTheDocument()
  })

  it('moving the window slider changes the needle recall readout', () => {
    render(<ContextWindowPlayground />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('window-slider'), { target: { value: '7' } })  // 200k
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })

  it('changing model changes the readout', () => {
    render(<ContextWindowPlayground />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('model-select'), { target: { value: 'generic-short' } })
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })
})
```

Note: the test file uses `vi.mock`; add `import { vi } from 'vitest'` at the top.

- [ ] **Step 3: Register**

Update `context-and-sessions/src/register-components.js`:

```js
import { registerComponent } from './App.jsx'
import AttentionBudgetAllocator from './components/AttentionBudgetAllocator.jsx'
import ContextWindowPlayground from './components/ContextWindowPlayground.jsx'

registerComponent('AttentionBudgetAllocator', AttentionBudgetAllocator)
registerComponent('ContextWindowPlayground', ContextWindowPlayground)
```

- [ ] **Step 4: Run tests**

```bash
cd context-and-sessions && npm test -- ContextWindowPlayground
```
Expected: 3 tests pass.

- [ ] **Step 5: Manual verification**

```bash
cd context-and-sessions && npm run dev
```
Navigate to the "Context Window Playground" slide; confirm: 3D landscape renders, sliders respond, model selector works, needle-recall readout updates. Stop server.

- [ ] **Step 6: Commit**

```bash
git add context-and-sessions/src/components/ContextWindowPlayground.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/ContextWindowPlayground.test.jsx
git commit -m "Add ContextWindowPlayground component (Component 1)"
```

---

### Task 16: LostInTheMiddleCurve component (Component 2)

**Files:**
- Create: `context-and-sessions/src/components/LostInTheMiddleCurve.jsx`
- Create: `context-and-sessions/tests/components/LostInTheMiddleCurve.test.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement**

```jsx
import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceDot, ResponsiveContainer, CartesianGrid } from 'recharts'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { createRecallLookup } from '../lib/recall-lookup.js'
import tableData from '../data/window-playground-table.json'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const lookup = createRecallLookup(tableData)
const WINDOW_SIZES = [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]

function humanSerialPosition(position) {
  // Classic U-curve from human memory research (approximation)
  const primacy = 0.6 * Math.exp(-Math.pow((position - 0) / 0.12, 2) / 2)
  const recency = 0.75 * Math.exp(-Math.pow((position - 1) / 0.10, 2) / 2)
  return 0.35 + Math.max(primacy, recency) * 0.5
}

export default function LostInTheMiddleCurve() {
  const [windowIdx, setWindowIdx] = useState(5)   // 100k
  const [noise, setNoise] = useState(0.2)
  const [needlePos, setNeedlePos] = useState(0.5)
  const [showHuman, setShowHuman] = useState(false)

  const windowSize = WINDOW_SIZES[windowIdx]

  const curve = useMemo(() => {
    const COLS = 41
    return Array.from({ length: COLS }, (_, i) => {
      const p = i / (COLS - 1)
      return {
        position: p,
        recall: lookup({ model: 'claude-sonnet', window_size: windowSize, position: p, noise_level: noise }),
        human: humanSerialPosition(p),
      }
    })
  }, [windowSize, noise])

  const surfaceSamples = useMemo(() => {
    const COLS = 41
    const ROWS = WINDOW_SIZES.length
    return WINDOW_SIZES.map((w) =>
      Array.from({ length: COLS }, (_, i) => {
        const p = i / (COLS - 1)
        return lookup({ model: 'claude-sonnet', window_size: w, position: p, noise_level: noise })
      })
    )
  }, [noise])

  const needleRecall = useMemo(() =>
    lookup({ model: 'claude-sonnet', window_size: windowSize, position: needlePos, noise_level: noise }),
    [windowSize, noise, needlePos])

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 20, margin: '0 0 12px 0' }}>Lost-in-the-Middle Recall Curve</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.surfaceDeep, borderRadius: 8, padding: 12, height: 340 }}>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>
            Recall by position (Claude Sonnet, window = {windowSize.toLocaleString()} tok)
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={curve} margin={{ top: 5, right: 20, left: 5, bottom: 20 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="position" type="number" domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke={C.textDim} fontSize={11} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke={C.textDim} fontSize={11} />
              <Tooltip
                formatter={(v) => `${(v * 100).toFixed(1)}%`}
                labelFormatter={(v) => `Position ${(v * 100).toFixed(0)}%`}
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="recall" stroke={C.accent} strokeWidth={2} dot={false} />
              {showHuman && <Line type="monotone" dataKey="human" stroke={C.purple} strokeDasharray="4 4" dot={false} />}
              <ReferenceDot x={needlePos} y={needleRecall} r={5} fill={C.green} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: C.surfaceDeep, borderRadius: 8, height: 340, overflow: 'hidden' }}>
          <RecallLandscape3D samples={surfaceSamples} depth={3} height={1.0} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Slider label={`Window: ${windowSize.toLocaleString()} tok`}
          min="0" max={WINDOW_SIZES.length - 1} value={windowIdx}
          onChange={(e) => setWindowIdx(+e.target.value)} testId="window-slider" />
        <Slider label={`Noise: ${(noise * 100).toFixed(0)}%`}
          min="0" max="1" step="0.01" value={noise}
          onChange={(e) => setNoise(+e.target.value)} testId="noise-slider" />
        <Slider label={`Needle: ${(needlePos * 100).toFixed(0)}%`}
          min="0" max="1" step="0.01" value={needlePos}
          onChange={(e) => setNeedlePos(+e.target.value)} testId="needle-slider" />
        <label style={{ color: C.textDim, fontSize: 12, display: 'flex',
          alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showHuman}
            onChange={(e) => setShowHuman(e.target.checked)} data-testid="human-toggle" />
          Overlay human memory curve
        </label>
      </div>
      <div style={{ marginTop: 12, color: C.textDim, fontSize: 13 }}>
        Needle recall: <span data-testid="needle-recall"
          style={{ color: needleRecall > 0.7 ? C.green : needleRecall > 0.4 ? C.yellow : C.red,
            fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700 }}>
          {(needleRecall * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function Slider({ label, testId, ...props }) {
  return (
    <div>
      <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="range" {...props} data-testid={testId} style={{ width: '100%' }} />
    </div>
  )
}
```

- [ ] **Step 2: Write smoke test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import LostInTheMiddleCurve from '../../src/components/LostInTheMiddleCurve.jsx'

describe('LostInTheMiddleCurve', () => {
  it('renders', () => {
    render(<LostInTheMiddleCurve />)
    expect(screen.getByText(/Lost-in-the-Middle/)).toBeInTheDocument()
  })

  it('moving needle updates readout', () => {
    render(<LostInTheMiddleCurve />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('needle-slider'), { target: { value: '0.1' } })
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })

  it('human toggle does not crash', () => {
    render(<LostInTheMiddleCurve />)
    fireEvent.click(screen.getByTestId('human-toggle'))
    expect(screen.getByTestId('human-toggle')).toBeChecked()
  })
})
```

- [ ] **Step 3: Register, run tests, commit**

Register in `register-components.js`, then:

```bash
cd context-and-sessions && npm test -- LostInTheMiddleCurve
```
Expected: 3 tests pass.

```bash
git add context-and-sessions/src/components/LostInTheMiddleCurve.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/LostInTheMiddleCurve.test.jsx
git commit -m "Add LostInTheMiddleCurve component (Component 2)"
```

---

### Task 17: Lever score data + scoring function

The Lever Comparison Tool shows the same task scored under different intervention sets. Rather than real scoring, use a deterministic rule: each intervention contributes a non-negative delta; the total is clipped to [0, 100]. Some interventions interact — e.g., `summarize_history` + `prune_tool_outputs` has a synergy bonus.

**Files:**
- Create: `context-and-sessions/src/lib/lever-scoring.js`
- Create: `context-and-sessions/src/lib/lever-scoring.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Implement**

Create `context-and-sessions/src/lib/lever-scoring.js`:

```js
export const BASE_SCORE = 35
export const MAX_SCORE = 98

export const PROMPT_LEVERS = [
  { key: 'xml_structure',     label: 'XML structure',          delta: 7  },
  { key: 'role_prime',        label: 'Role prime',             delta: 4  },
  { key: 'explicit_constraints', label: 'Explicit constraints', delta: 8 },
  { key: 'few_shot',          label: 'Few-shot examples',      delta: 6  },
  { key: 'chain_of_thought',  label: 'Chain-of-thought',       delta: 5  },
  { key: 'output_format',     label: 'Output format spec',     delta: 6  },
]

export const CONTEXT_LEVERS = [
  { key: 'front_tail_load',   label: 'Front/tail-load critical', delta: 9 },
  { key: 'summarize_history', label: 'Summarize history',        delta: 7 },
  { key: 'pin_invariants',    label: 'Pin invariants',           delta: 6 },
  { key: 'prune_tool_outputs',label: 'Prune tool outputs',       delta: 8 },
  { key: 'scope_session',     label: 'Scope session',            delta: 6 },
  { key: 'external_memory',   label: 'External memory',          delta: 7 },
]

const SYNERGIES = [
  { keys: ['summarize_history', 'prune_tool_outputs'], bonus: 5 },
  { keys: ['front_tail_load', 'pin_invariants'],       bonus: 4 },
  { keys: ['explicit_constraints', 'output_format'],   bonus: 3 },
]

const DELTA = new Map()
for (const l of [...PROMPT_LEVERS, ...CONTEXT_LEVERS]) DELTA.set(l.key, l.delta)

export function scoreLeverSet(active) {
  let score = BASE_SCORE
  for (const key of active) score += DELTA.get(key) ?? 0
  for (const syn of SYNERGIES) {
    if (syn.keys.every((k) => active.has(k))) score += syn.bonus
  }
  return Math.min(MAX_SCORE, score)
}
```

- [ ] **Step 3: Run and verify pass**

```bash
cd context-and-sessions && npm test -- lever-scoring
```
Expected: all 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add context-and-sessions/src/lib/lever-scoring.js context-and-sessions/src/lib/lever-scoring.test.js
git commit -m "Add lever scoring library"
```

---

### Task 18: LeverComparisonTool component (Component 5)

**Files:**
- Create: `context-and-sessions/src/components/LeverComparisonTool.jsx`
- Create: `context-and-sessions/tests/components/LeverComparisonTool.test.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement**

```jsx
import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { PROMPT_LEVERS, CONTEXT_LEVERS, scoreLeverSet, BASE_SCORE } from '../lib/lever-scoring.js'

const TASK_DESCRIPTION = "Design an idempotent webhook handler that deduplicates retries within 24h, validates HMAC signatures with key rotation, and stores events in PostgreSQL with a unique (source, external_id) constraint."

const SAMPLE_OUTPUTS = {
  low:    "Here's a webhook handler. It uses Express and MongoDB. It logs events and handles retries.",
  medium: "Webhook handler with Express + Mongo. Validates basic HMAC. Handles retries by checking a seen-ids cache.",
  high:   "POST /webhooks/:source — verifies HMAC(SHA-256) against current+previous key, inserts into events(id, source, external_id UNIQUE) via pg transaction; duplicate retries fail the unique constraint and return 200. See <constraints> for the 24h retention.",
}

function sampleOutputFor(score) {
  if (score >= 80) return SAMPLE_OUTPUTS.high
  if (score >= 55) return SAMPLE_OUTPUTS.medium
  return SAMPLE_OUTPUTS.low
}

function Pane({ title, levers, active, toggle, score, testPrefix }) {
  const scoreColor = score >= 80 ? C.green : score >= 55 ? C.yellow : C.red
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ color: C.text, fontSize: 16, margin: 0 }}>{title}</h3>
        <span data-testid={`${testPrefix}-score`}
          style={{ color: scoreColor, fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700 }}>
          {score}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {levers.map((l) => {
          const on = active.has(l.key)
          return (
            <button key={l.key} onClick={() => toggle(l.key)}
              data-testid={`${testPrefix}-${l.key}`}
              style={{ padding: '6px 10px', fontSize: 12,
                background: on ? C.accentGlow : 'transparent',
                border: `1px solid ${on ? C.accent : C.border}`,
                color: on ? C.accent : C.textDim, borderRadius: 4, cursor: 'pointer' }}>
              {l.label}
            </button>
          )
        })}
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: scoreColor,
          transition: 'width 0.2s' }} />
      </div>
      <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`,
        borderRadius: 4, padding: 10, fontFamily: FONT_MONO, fontSize: 12,
        color: C.textDim, lineHeight: 1.5, minHeight: 80 }}>
        {sampleOutputFor(score)}
      </div>
    </div>
  )
}

export default function LeverComparisonTool() {
  const [promptActive, setPromptActive] = useState(new Set())
  const [contextActive, setContextActive] = useState(new Set())

  const promptScore = useMemo(() => scoreLeverSet(promptActive), [promptActive])
  const contextScore = useMemo(() => scoreLeverSet(contextActive), [contextActive])

  const toggle = (setter) => (key) => setter((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: C.text, fontSize: 20, margin: '0 0 4px 0' }}>Lever Comparison Tool</h2>
      <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 12px 0' }}>
        Same task. Two levers. Same attention mechanism.
      </p>
      <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
        <strong style={{ color: C.accent }}>Task:</strong> {TASK_DESCRIPTION}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Pane title="Prompt Engineering" levers={PROMPT_LEVERS}
          active={promptActive} toggle={toggle(setPromptActive)} score={promptScore}
          testPrefix="prompt" />
        <Pane title="Context Engineering" levers={CONTEXT_LEVERS}
          active={contextActive} toggle={toggle(setContextActive)} score={contextScore}
          testPrefix="context" />
      </div>
      <div style={{ marginTop: 16, padding: 12, background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, color: C.textDim }}>
        <strong style={{ color: C.text }}>Tip:</strong> Try maxing out one side. Neither alone reaches 100 —
        the ceiling is lower than the sum of both levers working together.
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Smoke test**

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LeverComparisonTool from '../../src/components/LeverComparisonTool.jsx'

describe('LeverComparisonTool', () => {
  it('renders both panes', () => {
    render(<LeverComparisonTool />)
    expect(screen.getByText(/Prompt Engineering/)).toBeInTheDocument()
    expect(screen.getByText(/Context Engineering/)).toBeInTheDocument()
  })

  it('toggling a prompt lever raises the prompt score', () => {
    render(<LeverComparisonTool />)
    const before = parseInt(screen.getByTestId('prompt-score').textContent, 10)
    fireEvent.click(screen.getByTestId('prompt-xml_structure'))
    const after = parseInt(screen.getByTestId('prompt-score').textContent, 10)
    expect(after).toBeGreaterThan(before)
  })

  it('prompt and context scores are independent', () => {
    render(<LeverComparisonTool />)
    const cBefore = parseInt(screen.getByTestId('context-score').textContent, 10)
    fireEvent.click(screen.getByTestId('prompt-xml_structure'))
    const cAfter = parseInt(screen.getByTestId('context-score').textContent, 10)
    expect(cAfter).toBe(cBefore)
  })
})
```

- [ ] **Step 3: Register**

Add to `register-components.js`:
```js
import LeverComparisonTool from './components/LeverComparisonTool.jsx'
registerComponent('LeverComparisonTool', LeverComparisonTool)
```

- [ ] **Step 4: Run tests + commit**

```bash
cd context-and-sessions && npm test -- LeverComparisonTool
```
Expected: 3 tests pass.

```bash
git add context-and-sessions/src/components/LeverComparisonTool.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/LeverComparisonTool.test.jsx
git commit -m "Add LeverComparisonTool component (Component 5)"
```

---

### Task 19: Simulator session data + intervention rules

The Session Hygiene Simulator replays a pre-authored 25-turn session with a critical fact at turn 2 and accumulated noise through turns 5-20. Interventions apply deterministic effects.

**Files:**
- Create: `context-and-sessions/src/data/simulator-session.json`
- Create: `context-and-sessions/src/lib/simulator-rules.js`
- Create: `context-and-sessions/src/lib/simulator-rules.test.js`

- [ ] **Step 1: Create the session data**

```json
{
  "turns": [
    { "idx": 1,  "role": "user", "text": "Hi, I need help designing an event ingestion pipeline.", "critical": false, "tokens": 80 },
    { "idx": 2,  "role": "user", "text": "HARD CONSTRAINT: events must be idempotent on (source, external_id) and we retain only 90 days. This is non-negotiable — any design that violates this is wrong.", "critical": true, "tokens": 140 },
    { "idx": 3,  "role": "assistant", "text": "Understood — idempotency on (source, external_id) with 90-day retention. What's the expected volume?", "critical": false, "tokens": 110 },
    { "idx": 4,  "role": "user", "text": "~5M events/day, bursty.", "critical": false, "tokens": 30 },
    { "idx": 5,  "role": "tool", "text": "[Raw dump of 8000 tokens from schema registry — 12 event types, all fields, full type definitions]", "critical": false, "tokens": 8000, "isRawTool": true },
    { "idx": 6,  "role": "assistant", "text": "Reviewed the schema registry. Proposing Kafka → consumer → Postgres.", "critical": false, "tokens": 120 },
    { "idx": 7,  "role": "user", "text": "What about cost?", "critical": false, "tokens": 20 },
    { "idx": 8,  "role": "tool", "text": "[Raw dump of 6000 tokens — cost model spreadsheet export with every line-item]", "critical": false, "tokens": 6000, "isRawTool": true },
    { "idx": 9,  "role": "assistant", "text": "Cost estimate: $X/mo baseline...", "critical": false, "tokens": 150 },
    { "idx": 10, "role": "user", "text": "Actually can we also talk about the billing dashboard migration?", "critical": false, "tokens": 40, "scopeBleed": true },
    { "idx": 11, "role": "assistant", "text": "Sure, the billing dashboard is a React app on Vercel...", "critical": false, "tokens": 200, "scopeBleed": true },
    { "idx": 12, "role": "user", "text": "OK back to the pipeline — should we use Debezium?", "critical": false, "tokens": 35 },
    { "idx": 13, "role": "tool", "text": "[Raw dump of 7500 tokens — Debezium config examples, all connectors]", "critical": false, "tokens": 7500, "isRawTool": true },
    { "idx": 14, "role": "assistant", "text": "Debezium fits for CDC but here we ingest external events, so a Kafka producer from the webhook handler is simpler.", "critical": false, "tokens": 180 },
    { "idx": 15, "role": "user", "text": "Cool. Schema evolution strategy?", "critical": false, "tokens": 30 },
    { "idx": 16, "role": "assistant", "text": "Use a schema registry with backward-compatible changes only...", "critical": false, "tokens": 240 },
    { "idx": 17, "role": "user", "text": "DLQ pattern?", "critical": false, "tokens": 15 },
    { "idx": 18, "role": "tool", "text": "[Raw dump of 5500 tokens — DLQ patterns from 4 different blog posts]", "critical": false, "tokens": 5500, "isRawTool": true },
    { "idx": 19, "role": "assistant", "text": "Standard pattern: retry 3x with backoff, then DLQ topic.", "critical": false, "tokens": 90 },
    { "idx": 20, "role": "user", "text": "Security?", "critical": false, "tokens": 10 },
    { "idx": 21, "role": "assistant", "text": "HMAC signatures on inbound webhooks, rotate keys quarterly...", "critical": false, "tokens": 160 },
    { "idx": 22, "role": "user", "text": "PII concerns?", "critical": false, "tokens": 15 },
    { "idx": 23, "role": "assistant", "text": "For PII in events, we'd need to classify and scrub before storage...", "critical": false, "tokens": 180 },
    { "idx": 24, "role": "user", "text": "OK, give me the final design.", "critical": false, "tokens": 30 },
    { "idx": 25, "role": "assistant", "text": "Here's the final design: Kafka topic per source, consumers idempotent on event_id with a 30-day retention window...", "critical": false, "tokens": 350, "violatesCritical": true }
  ]
}
```

Note: the assistant response in turn 25 silently changes the retention from 90 days to 30 days — a classic lost-in-middle failure mode.

- [ ] **Step 2: Write the failing tests**

Create `context-and-sessions/src/lib/simulator-rules.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  INTERVENTIONS, recallOfCritical, applyInterventions, DEFAULT_SESSION_STATE
} from './simulator-rules.js'
import session from '../data/simulator-session.json'

describe('simulator-rules', () => {
  it('exports 8 interventions', () => {
    expect(INTERVENTIONS).toHaveLength(8)
  })

  it('every intervention has key, label, effect', () => {
    for (const i of INTERVENTIONS) {
      expect(typeof i.key).toBe('string')
      expect(typeof i.label).toBe('string')
      expect(typeof i.apply).toBe('function')
    }
  })

  it('base session has low recall on the critical turn', () => {
    const state = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    const recall = recallOfCritical(state)
    expect(recall).toBeLessThan(0.3)
  })

  it('applying all interventions lifts recall above 0.9', () => {
    const all = new Set(INTERVENTIONS.map((i) => i.key))
    const state = applyInterventions(session, all, DEFAULT_SESSION_STATE)
    const recall = recallOfCritical(state)
    expect(recall).toBeGreaterThanOrEqual(0.9)
  })

  it('pin_invariants alone improves recall', () => {
    const withPin = applyInterventions(session, new Set(['pin_invariants']), DEFAULT_SESSION_STATE)
    const without = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(recallOfCritical(withPin)).toBeGreaterThan(recallOfCritical(without))
  })

  it('prune_tool_outputs reduces token count', () => {
    const pruned = applyInterventions(session, new Set(['prune_tool_outputs']), DEFAULT_SESSION_STATE)
    const raw = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(pruned.totalTokens).toBeLessThan(raw.totalTokens)
  })

  it('nuclear_restart drops token count dramatically', () => {
    const nuke = applyInterventions(session, new Set(['nuclear_restart']), DEFAULT_SESSION_STATE)
    const raw = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(nuke.totalTokens).toBeLessThan(raw.totalTokens * 0.2)
  })
})
```

- [ ] **Step 3: Implement**

Create `context-and-sessions/src/lib/simulator-rules.js`:

```js
import { createRecallLookup } from './recall-lookup.js'
import tableData from '../data/window-playground-table.json'

const lookup = createRecallLookup(tableData)

export const DEFAULT_SESSION_STATE = {
  model: 'claude-sonnet',
}

// Each intervention transforms a session state. State shape:
//   { turns: [...], totalTokens, criticalAnchor: position }
// where criticalAnchor is the normalized position (0..1) where the critical fact
// effectively lives after interventions are applied.
export const INTERVENTIONS = [
  {
    key: 'front_tail_load',
    label: 'Front/tail-load critical',
    apply(state) {
      // Re-state the critical info near the end, pulling its effective position to ~0.95
      state.criticalAnchor = Math.max(state.criticalAnchor, 0.95)
      return state
    },
  },
  {
    key: 'summarize_history',
    label: 'Summarize old turns',
    apply(state) {
      // Replace turns 6..20 with a compact summary (1/10th tokens)
      const kept = state.turns.filter((t) => t.idx <= 4 || t.idx >= 21)
      const middle = state.turns.filter((t) => t.idx > 4 && t.idx < 21)
      const middleTokens = middle.reduce((a, t) => a + t.tokens, 0)
      kept.push({ idx: 99, role: 'system', text: '[summary of turns 5-20]', tokens: Math.max(100, Math.floor(middleTokens / 10)) })
      state.turns = kept.sort((a, b) => a.idx - b.idx)
      state.totalTokens = state.turns.reduce((a, t) => a + t.tokens, 0)
      return state
    },
  },
  {
    key: 'pin_invariants',
    label: 'Pin invariants',
    apply(state) {
      // Inject a pinned reminder near the recent window
      state.turns.push({ idx: 100, role: 'system', text: '[PINNED] 90-day retention, idempotent on (source, external_id)', tokens: 40 })
      state.criticalAnchor = Math.max(state.criticalAnchor, 0.92)
      state.totalTokens += 40
      return state
    },
  },
  {
    key: 'prune_tool_outputs',
    label: 'Prune tool outputs',
    apply(state) {
      // Shrink isRawTool turns to 20% of their original size
      state.turns = state.turns.map((t) =>
        t.isRawTool ? { ...t, tokens: Math.floor(t.tokens * 0.2) } : t
      )
      state.totalTokens = state.turns.reduce((a, t) => a + t.tokens, 0)
      return state
    },
  },
  {
    key: 'scope_session',
    label: 'Scope this concern',
    apply(state) {
      // Drop turns tagged scopeBleed
      state.turns = state.turns.filter((t) => !t.scopeBleed)
      state.totalTokens = state.turns.reduce((a, t) => a + t.tokens, 0)
      return state
    },
  },
  {
    key: 'watch_effective',
    label: 'Watch effective context',
    apply(state) {
      // Simulate: the user notices the window is too long and truncates oldest turns to keep under 16k
      while (state.totalTokens > 16000 && state.turns.length > 3) {
        const removed = state.turns.shift()
        state.totalTokens -= removed.tokens
      }
      return state
    },
  },
  {
    key: 'external_memory',
    label: 'External memory (indices + guardrails)',
    apply(state) {
      // Replace scope-bleed turns with pointers, and add a 50-tok reference
      state.turns.push({ idx: 101, role: 'system', text: '[ref: /indices/api-specs + PII filter ON]', tokens: 50 })
      state.totalTokens += 50
      return state
    },
  },
  {
    key: 'nuclear_restart',
    label: 'Nuclear restart',
    apply(state) {
      // Replace entire session with a 200-tok summary + the critical fact verbatim
      const critical = state.turns.find((t) => t.critical)
      state.turns = [
        { idx: 1, role: 'system', text: '[learned summary of prior session]', tokens: 200 },
        critical ? { ...critical, idx: 2 } : null,
      ].filter(Boolean)
      state.totalTokens = state.turns.reduce((a, t) => a + t.tokens, 0)
      state.criticalAnchor = 0.9
      return state
    },
  },
]

const BY_KEY = new Map(INTERVENTIONS.map((i) => [i.key, i]))

export function applyInterventions(session, activeKeys, baseState = DEFAULT_SESSION_STATE) {
  const turns = session.turns.map((t) => ({ ...t }))
  const totalTokens = turns.reduce((a, t) => a + t.tokens, 0)
  const criticalTurn = turns.find((t) => t.critical)
  const criticalIdx = criticalTurn?.idx ?? 1
  const lastIdx = turns[turns.length - 1]?.idx ?? 1
  const initialAnchor = criticalIdx / lastIdx

  let state = { turns, totalTokens, criticalAnchor: initialAnchor, model: baseState.model }

  // Apply in a stable order (intervention list order)
  for (const i of INTERVENTIONS) {
    if (activeKeys.has(i.key)) state = i.apply(state)
  }
  return state
}

export function recallOfCritical(state) {
  return lookup({
    model: state.model,
    window_size: Math.max(4000, state.totalTokens),
    position: state.criticalAnchor,
    noise_level: state.totalTokens > 30000 ? 0.5 : 0.2,
  })
}
```

- [ ] **Step 4: Run and verify pass**

```bash
cd context-and-sessions && npm test -- simulator-rules
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add context-and-sessions/src/data/simulator-session.json context-and-sessions/src/lib/simulator-rules.js context-and-sessions/src/lib/simulator-rules.test.js
git commit -m "Add simulator session data and intervention rules"
```

---

### Task 20: SessionHygieneSimulator component (Component 6)

**Files:**
- Create: `context-and-sessions/src/components/SessionHygieneSimulator.jsx`
- Create: `context-and-sessions/tests/components/SessionHygieneSimulator.test.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement**

```jsx
import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import session from '../data/simulator-session.json'
import { INTERVENTIONS, applyInterventions, recallOfCritical, DEFAULT_SESSION_STATE } from '../lib/simulator-rules.js'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const EXTERNAL_MEMORY_SUB_TOGGLES = [
  { key: 'em_pii',    label: 'PII/confidential guardrail' },
  { key: 'em_api',    label: 'Org API spec index' },
  { key: 'em_policy', label: 'Policy/compliance index' },
]

// Presets: a preset pre-selects some interventions and hides others.
// Used by the assessment's diagnostic scenarios.
export const SIMULATOR_PRESETS = {
  D1: { locked: new Set(), suggestedFix: ['pin_invariants', 'front_tail_load'] },
  D2: { locked: new Set(), suggestedFix: ['prune_tool_outputs', 'scope_session'] },
  D3: { locked: new Set(), suggestedFix: ['external_memory'] },
  D4: { locked: new Set(), suggestedFix: ['scope_session', 'nuclear_restart'] },
}

export default function SessionHygieneSimulator({ preset = null }) {
  const [active, setActive] = useState(new Set())
  const [emExpanded, setEmExpanded] = useState(false)
  const [emSub, setEmSub] = useState(new Set())

  const toggle = (key) => setActive((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const toggleEmSub = (key) => setEmSub((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const state = useMemo(() =>
    applyInterventions(session, active, DEFAULT_SESSION_STATE), [active])
  const recall = useMemo(() => recallOfCritical(state), [state])

  const surfaceSamples = useMemo(() => {
    // A 2D landscape: rows = turns in session, cols = hypothetical needle positions.
    const ROWS = 8
    const COLS = 33
    return Array.from({ length: ROWS }, (_, r) => {
      const windowFrac = 0.3 + (r / (ROWS - 1)) * 0.7
      return Array.from({ length: COLS }, (_, c) => {
        const pos = c / (COLS - 1)
        // At high intervention count, flatten less severely
        const base = Math.exp(-Math.pow((pos - 0.5) / 0.3, 2)) * (1 - recall)
        return Math.max(0, Math.min(1, 1 - base * windowFrac))
      })
    })
  }, [recall])

  const recallColor = recall >= 0.9 ? C.green : recall >= 0.6 ? C.yellow : C.red

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS, height: 'calc(100vh - 120px)',
      display: 'grid', gridTemplateRows: '30% 50% 20%', gap: 12 }}>
      {/* Transcript */}
      <div style={{ overflow: 'auto', background: C.surfaceDeep,
        border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
        {state.turns.map((t) => (
          <div key={t.idx} style={{ marginBottom: 6, fontSize: 12,
            color: t.critical ? C.accent : t.isRawTool ? C.orange : C.textDim,
            fontFamily: t.role === 'tool' ? FONT_MONO : FONT_SANS }}>
            <strong>[{t.idx}] {t.role}</strong> ({t.tokens} tok):{' '}
            {t.text.length > 160 ? t.text.slice(0, 160) + '…' : t.text}
          </div>
        ))}
      </div>

      {/* 3D landscape */}
      <div style={{ background: C.surfaceDeep, borderRadius: 6, overflow: 'hidden' }}>
        <RecallLandscape3D samples={surfaceSamples} width={5} depth={3} height={1.2} />
      </div>

      {/* Intervention panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignContent: 'start' }}>
          {INTERVENTIONS.filter((i) => i.key !== 'external_memory' && i.key !== 'nuclear_restart').map((i) => (
            <ToggleButton key={i.key} label={i.label} on={active.has(i.key)}
              testId={`iv-${i.key}`} onClick={() => toggle(i.key)} />
          ))}
          <div>
            <ToggleButton label="External memory"
              on={active.has('external_memory')} testId="iv-external_memory"
              onClick={() => { toggle('external_memory'); setEmExpanded(true) }} />
            {emExpanded && active.has('external_memory') && (
              <div style={{ marginTop: 4, padding: 4, background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 4 }}>
                {EXTERNAL_MEMORY_SUB_TOGGLES.map((s) => (
                  <label key={s.key} style={{ display: 'flex', gap: 6, fontSize: 11,
                    color: C.textDim, padding: 2, cursor: 'pointer' }}>
                    <input type="checkbox" checked={emSub.has(s.key)}
                      onChange={() => toggleEmSub(s.key)} data-testid={`em-${s.key}`} />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <ToggleButton label="🔴 Nuclear restart"
            on={active.has('nuclear_restart')} testId="iv-nuclear_restart"
            danger onClick={() => toggle('nuclear_restart')} />
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ color: C.textDim, fontSize: 12 }}>Recall on critical (turn 2):</div>
          <div data-testid="recall-readout" style={{ color: recallColor,
            fontSize: 36, fontFamily: FONT_MONO, fontWeight: 700 }}>
            {(recall * 100).toFixed(0)}%
          </div>
          <div style={{ color: C.textFaint, fontSize: 11 }}>
            Total: {state.totalTokens.toLocaleString()} tok
          </div>
          <div style={{ color: C.textFaint, fontSize: 11 }}>
            Target: ≥ 90%
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleButton({ label, on, onClick, testId, danger = false }) {
  const bg = on ? (danger ? C.redGlow : C.accentGlow) : 'transparent'
  const bd = on ? (danger ? C.red : C.accent) : C.border
  const fg = on ? (danger ? C.red : C.accent) : C.textDim
  return (
    <button onClick={onClick} data-testid={testId}
      style={{ background: bg, border: `1px solid ${bd}`, color: fg,
        padding: '6px 10px', borderRadius: 4, fontSize: 11,
        textAlign: 'left', cursor: 'pointer', height: 40 }}>
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Smoke test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import SessionHygieneSimulator from '../../src/components/SessionHygieneSimulator.jsx'

describe('SessionHygieneSimulator', () => {
  it('renders', () => {
    render(<SessionHygieneSimulator />)
    expect(screen.getByTestId('recall-readout')).toBeInTheDocument()
  })

  it('starting recall is below 90%', () => {
    render(<SessionHygieneSimulator />)
    const recall = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(recall).toBeLessThan(90)
  })

  it('toggling pin_invariants raises recall', () => {
    render(<SessionHygieneSimulator />)
    const before = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    fireEvent.click(screen.getByTestId('iv-pin_invariants'))
    const after = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(after).toBeGreaterThan(before)
  })

  it('enabling all interventions pushes recall ≥ 90%', () => {
    render(<SessionHygieneSimulator />)
    for (const id of ['iv-front_tail_load', 'iv-summarize_history', 'iv-pin_invariants',
                      'iv-prune_tool_outputs', 'iv-scope_session', 'iv-watch_effective',
                      'iv-external_memory', 'iv-nuclear_restart']) {
      fireEvent.click(screen.getByTestId(id))
    }
    const recall = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(recall).toBeGreaterThanOrEqual(90)
  })
})
```

- [ ] **Step 3: Register + test + commit**

Add to `register-components.js`:
```js
import SessionHygieneSimulator from './components/SessionHygieneSimulator.jsx'
registerComponent('SessionHygieneSimulator', SessionHygieneSimulator)
```

```bash
cd context-and-sessions && npm test -- SessionHygieneSimulator
```
Expected: all 4 tests pass.

```bash
git add context-and-sessions/src/components/SessionHygieneSimulator.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/SessionHygieneSimulator.test.jsx
git commit -m "Add SessionHygieneSimulator component (Component 6)"
```

---

## Phase 4: Assessment

### Task 21: Assessment grading library

**Files:**
- Create: `context-and-sessions/src/lib/assessment.js`
- Create: `context-and-sessions/src/lib/assessment.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { gradeMCQ, gradeDiagnostic, overallResult, PASS_RULES } from './assessment.js'

describe('gradeMCQ', () => {
  it('100% when all correct', () => {
    const answers = { q1: 2, q2: 0, q3: 1 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 3, total: 3, percent: 100 })
  })

  it('0% when all wrong', () => {
    const answers = { q1: 0, q2: 1, q3: 0 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 0, total: 3, percent: 0 })
  })

  it('unanswered counts as wrong', () => {
    const answers = { q1: 2 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 1, total: 3, percent: Math.round(100 / 3) })
  })
})

describe('gradeDiagnostic', () => {
  it('awards 0 when nothing correct', () => {
    const submission = { diagnosisChoice: 1, fixChoice: 1, recallAchieved: 0.4, rationale: '' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    expect(gradeDiagnostic(submission, key).total).toBe(0)
  })

  it('awards 100 when everything correct and recall ≥ target', () => {
    const submission = { diagnosisChoice: 0, fixChoice: 0, recallAchieved: 0.95, rationale: 'ok' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    expect(gradeDiagnostic(submission, key).total).toBe(100)
  })

  it('breaks down into diagnosis / fix / recall / rationale parts', () => {
    const submission = { diagnosisChoice: 0, fixChoice: 1, recallAchieved: 0.85, rationale: 'ok' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    const r = gradeDiagnostic(submission, key)
    expect(r.breakdown.diagnosis).toBe(30)
    expect(r.breakdown.fix).toBe(0)
    expect(r.breakdown.recall).toBe(0)
    expect(r.breakdown.rationale).toBe(10)
    expect(r.total).toBe(40)
  })
})

describe('overallResult', () => {
  it('passes at exactly 80% overall AND 75% diagnostics', () => {
    const r = overallResult({ mcqPercent: 80, diagnosticAvg: 75 })
    expect(r.passed).toBe(true)
  })

  it('fails when overall < 80%', () => {
    const r = overallResult({ mcqPercent: 70, diagnosticAvg: 80 })
    expect(r.passed).toBe(false)
  })

  it('fails when diagnostic < 75% even if MCQ is 100%', () => {
    const r = overallResult({ mcqPercent: 100, diagnosticAvg: 60 })
    expect(r.passed).toBe(false)
  })

  it('computes overall as weighted avg (15 MCQ ~60% weight, 4 diag ~40% weight)', () => {
    const r = overallResult({ mcqPercent: 80, diagnosticAvg: 90 })
    expect(r.overallPercent).toBeCloseTo(0.6 * 80 + 0.4 * 90, 1)
  })
})

describe('PASS_RULES', () => {
  it('exports thresholds', () => {
    expect(PASS_RULES.overall).toBe(80)
    expect(PASS_RULES.diagnostic).toBe(75)
  })
})
```

- [ ] **Step 2: Implement**

Create `context-and-sessions/src/lib/assessment.js`:

```js
export const PASS_RULES = { overall: 80, diagnostic: 75 }

export function gradeMCQ(answers, key) {
  const total = Object.keys(key).length
  let correct = 0
  for (const q of Object.keys(key)) {
    if (answers[q] === key[q]) correct++
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100)
  return { correct, total, percent }
}

export function gradeDiagnostic(submission, key) {
  const breakdown = { diagnosis: 0, fix: 0, recall: 0, rationale: 0 }
  if (submission.diagnosisChoice === key.diagnosis) breakdown.diagnosis = 30
  if (submission.fixChoice === key.fix)             breakdown.fix = 30
  if ((submission.recallAchieved ?? 0) >= key.recallTarget) breakdown.recall = 30
  if ((submission.rationale ?? '').trim().length >= 20)     breakdown.rationale = 10
  const total = breakdown.diagnosis + breakdown.fix + breakdown.recall + breakdown.rationale
  return { breakdown, total }
}

export function overallResult({ mcqPercent, diagnosticAvg }) {
  const overallPercent = 0.6 * mcqPercent + 0.4 * diagnosticAvg
  const passed = overallPercent >= PASS_RULES.overall && diagnosticAvg >= PASS_RULES.diagnostic
  return { overallPercent, passed, mcqPercent, diagnosticAvg }
}
```

- [ ] **Step 3: Run and verify pass**

```bash
cd context-and-sessions && npm test -- assessment.test
```
Expected: all 11 tests pass.

- [ ] **Step 4: Commit**

```bash
git add context-and-sessions/src/lib/assessment.js context-and-sessions/src/lib/assessment.test.js
git commit -m "Add assessment grading library"
```

---

### Task 22: MCQ question bank data

**Files:**
- Create: `context-and-sessions/src/data/assessment-questions.json`

- [ ] **Step 1: Create the 15-question bank**

```json
{
  "version": 1,
  "sections": [
    { "key": "A", "label": "Attention & Lost-in-the-Middle" },
    { "key": "B", "label": "Context vs. Prompt" },
    { "key": "C", "label": "Session Hygiene & Governance" }
  ],
  "questions": [
    {
      "id": "A1", "section": "A", "slideRef": 4,
      "q": "A model advertises 200k tokens. A single fact is placed at token position 100,000 in a 200k-token context. Empirically, what is most likely?",
      "options": [
        "The model recalls the fact with probability near 1.0, as 100k is still well within the advertised window",
        "The fact is likely missed: recall on middle-positioned facts in long contexts drops well below the start/end rates",
        "The model treats all positions uniformly, so position 100,000 is no different from position 500",
        "The model recalls facts best at the exact middle because that position is equidistant from both ends"
      ],
      "answer": 1,
      "rationale": "Liu et al. 2023 found recall follows a U-curve: strong at start (primacy) and end (recency), weak in the middle. This holds across model sizes."
    },
    {
      "id": "A2", "section": "A", "slideRef": 7,
      "q": "A model advertises 128k tokens. Your application consistently puts constraints at tokens 40,000-60,000 and gets inconsistent behavior. What is the most likely cause?",
      "options": [
        "The model is misconfigured",
        "Effective context is smaller than advertised; constraints in the middle are being forgotten",
        "The constraints contradict training data",
        "The temperature setting is too high"
      ],
      "answer": 1,
      "rationale": "Effective context is often 20-40% of advertised. Constraints buried in the middle of a long context are exactly where recall degrades fastest."
    },
    {
      "id": "A3", "section": "A", "slideRef": 6,
      "q": "Why does the lost-in-the-middle effect exist structurally in transformer attention?",
      "options": [
        "Training data over-represents information at document boundaries, biasing attention there",
        "Softmax distributes a fixed probability mass across every token; middle positions receive systematically less signal than ends due to positional encoding shape",
        "Models are fine-tuned specifically to prioritize openings and conclusions",
        "It is an artifact of RLHF alignment training"
      ],
      "answer": 1,
      "rationale": "The U-curve is a structural property of attention over long sequences, not a training-data artifact. Softmax must sum to 1, so more tokens = smaller slices, and positional encodings tilt the distribution toward ends."
    },
    {
      "id": "A4", "section": "A", "slideRef": 11,
      "q": "You add 10,000 tokens of tool output to a context that previously had 2,000 tokens. What happens to the attention share of the original 2,000 tokens?",
      "options": [
        "Unchanged — each token gets the same fixed attention regardless of context size",
        "It decreases; the new tokens claim attention mass previously held by the original tokens",
        "It increases; the model learns to prioritize shorter sections in long contexts",
        "It doubles, because attention is allocated per turn"
      ],
      "answer": 1,
      "rationale": "Softmax attention sums to 1 across all tokens. Adding 10k new tokens means less mass is available for the original 2k."
    },
    {
      "id": "A5", "section": "A", "slideRef": 5,
      "q": "Liu et al. 2023's main finding applies most directly to which operation?",
      "options": [
        "Code generation",
        "Retrieving a single specific fact from a long input",
        "Translating between languages",
        "Summarizing short documents"
      ],
      "answer": 1,
      "rationale": "The paper studied single-needle retrieval across long contexts. The U-curve is most pronounced for precise recall tasks."
    },
    {
      "id": "B1", "section": "B", "slideRef": 9,
      "q": "A user types a 40-word message. The model receives: a 2,000-token system prompt, 12 prior turns (total ~8,000 tokens), a 5,000-token retrieved document, and the 40-word user message. What is 'the context' for this turn?",
      "options": [
        "Just the 40-word user message",
        "The user message + retrieved document",
        "Everything the model reads: system + prior turns + retrieved doc + user message",
        "Only the current turn (user message + retrieved doc)"
      ],
      "answer": 2,
      "rationale": "Context is the full sequence the model attends to — every prior turn, every tool output, every attachment, plus the current message. The user message is a small slice."
    },
    {
      "id": "B2", "section": "B", "slideRef": 13,
      "q": "Prompt engineering and context engineering are best understood as:",
      "options": [
        "Competing approaches — use one or the other",
        "The same thing under different names",
        "Two levers acting on the same underlying attention mechanism; they compound when combined",
        "Prompt engineering is for simple tasks; context engineering is for RAG only"
      ],
      "answer": 2,
      "rationale": "Both shape attention allocation. Prompt engineering makes the current turn's tokens more effective; context engineering decides which tokens get into the window at all."
    },
    {
      "id": "B3", "section": "B", "slideRef": 15,
      "q": "Which of the following is a CONTEXT engineering technique, not a prompt engineering one?",
      "options": [
        "Wrapping instructions in <constraints> tags",
        "Adding few-shot examples",
        "Summarizing old turns to compress history",
        "Using a role prime like 'You are a senior security engineer'"
      ],
      "answer": 2,
      "rationale": "Summarizing history shapes what's in the window. The others shape the current turn's content."
    },
    {
      "id": "B4", "section": "B", "slideRef": 10,
      "q": "In a typical chat session with tool use, the user turn is often:",
      "options": [
        "The majority of the context window",
        "Roughly half of the context",
        "Often the smallest slice; tool outputs and history dominate",
        "Always exactly one-third"
      ],
      "answer": 2,
      "rationale": "Tool outputs (file reads, searches) and accumulated history usually dwarf the user's actual typed message."
    },
    {
      "id": "B5", "section": "B", "slideRef": 11,
      "q": "A developer says: 'I kept my prompt short to minimize attention dilution.' Why might this reasoning be incomplete?",
      "options": [
        "It is complete — a short prompt is always optimal",
        "A short user message does not mean a short context; system prompt, history, and tool outputs may still be huge",
        "Short prompts are ignored by the model",
        "Dilution only applies to tool outputs, not to the user turn"
      ],
      "answer": 1,
      "rationale": "The user turn is often the smallest piece of the context. Keeping it short has minimal effect if the rest of the context is bloated."
    },
    {
      "id": "C1", "section": "C", "slideRef": 19,
      "q": "You are 20 turns into a session. A critical constraint was stated at turn 3 and never restated. The model is now producing output that violates it. What is the highest-leverage intervention?",
      "options": [
        "Start over with no context",
        "Pin the invariant: re-state the constraint in the current turn so it lives in the recency window",
        "Lower the model temperature",
        "Add a second assistant message asking the model to be careful"
      ],
      "answer": 1,
      "rationale": "Pinning invariants is the surgical fix: it puts the constraint back in the high-attention tail of the context without discarding useful history."
    },
    {
      "id": "C2", "section": "C", "slideRef": 18,
      "q": "Why does an organization use a shared API spec index that every LLM-assisted design pulls from, rather than letting each session paste specs inline?",
      "options": [
        "To save money on API calls",
        "One source of truth prevents drift, reduces token spend across sessions, and enforces the canonical spec",
        "Because the model cannot read JSON",
        "To limit model training data"
      ],
      "answer": 1,
      "rationale": "Centralized indices prevent N different teams paraphrasing the same spec and drifting apart. The model gets the canonical version on demand."
    },
    {
      "id": "C3", "section": "C", "slideRef": 17,
      "q": "A proposal: strip PII from inputs to an LLM before sending. The motivation is:",
      "options": [
        "Smaller prompts cost less",
        "Context composition is a compliance boundary — PII in context is PII sent to the provider, and potentially logged/cached",
        "PII tokens confuse the model",
        "The model refuses PII outright, so we must strip it"
      ],
      "answer": 1,
      "rationale": "Every LLM call is a data-egress event. Treat context as a compliance boundary: govern what enters, not just what leaves."
    },
    {
      "id": "C4", "section": "C", "slideRef": 19,
      "q": "A 40-turn session accumulated three unrelated concerns. The 'nuclear restart' intervention means:",
      "options": [
        "Forcibly close the session and blame the user",
        "Summarize the relevant decisions, discard everything else, start fresh",
        "Switch to a different model",
        "Increase the context window allocation"
      ],
      "answer": 1,
      "rationale": "Nuclear restart is summarize-and-fork: carry forward only the decisions that matter, drop the noise."
    },
    {
      "id": "C5", "section": "C", "slideRef": 19,
      "q": "A long session keeps 12 raw tool-output dumps totaling 80,000 tokens. The best FIRST intervention is:",
      "options": [
        "Nuclear restart",
        "Prune tool outputs: keep the excerpts that were actually referenced; drop the raw dumps",
        "Summarize every turn",
        "Switch models"
      ],
      "answer": 1,
      "rationale": "Raw tool dumps are the fastest-growing source of context bloat. Pruning them is a surgical fix that often avoids needing a restart."
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add context-and-sessions/src/data/assessment-questions.json
git commit -m "Add 15 MCQ assessment question bank"
```

---

### Task 23: Diagnostic scenario data

**Files:**
- Create: `context-and-sessions/src/data/diagnostic-scenarios.json`

- [ ] **Step 1: Create**

```json
{
  "version": 1,
  "diagnoses": [
    { "key": "lost_in_middle",      "label": "Lost in middle — no pinning" },
    { "key": "tool_pollution",      "label": "Tool output pollution" },
    { "key": "inbound_governance",  "label": "No inbound context governance" },
    { "key": "scope_bleed",         "label": "Scope bleed between concerns" }
  ],
  "fixes": [
    { "key": "pin_invariants",        "label": "Pin invariants + front/tail-load" },
    { "key": "prune_tool_outputs",    "label": "Prune tool outputs + scope session" },
    { "key": "external_memory_pii",   "label": "External memory with PII guardrail" },
    { "key": "scope_then_restart",    "label": "Scope session + nuclear restart with summary" }
  ],
  "scenarios": [
    {
      "id": "D1",
      "title": "The 30-turn fade",
      "transcript": "A 30-turn architecture conversation. Turn 3 contains HARD CONSTRAINT: 90-day retention. By turn 25 the proposed design uses 30-day retention. No intermediate turns restate the constraint.",
      "correctDiagnosis": "lost_in_middle",
      "correctFix": "pin_invariants",
      "recallTarget": 0.9,
      "preset": "D1"
    },
    {
      "id": "D2",
      "title": "The 4-dump session",
      "transcript": "A 15-turn session contains four full tool-output dumps (schema registry, cost spreadsheet, Debezium docs, DLQ blog-post compilation) totaling ~27k tokens. The model's final answer misses a constraint stated once, early.",
      "correctDiagnosis": "tool_pollution",
      "correctFix": "prune_tool_outputs",
      "recallTarget": 0.85,
      "preset": "D2"
    },
    {
      "id": "D3",
      "title": "The PII leak",
      "transcript": "A user pastes a CSV containing customer names, emails, and phone numbers to ask about a data model. The model's output example uses those real names and emails verbatim. Logs show the data was sent upstream.",
      "correctDiagnosis": "inbound_governance",
      "correctFix": "external_memory_pii",
      "recallTarget": 0.8,
      "preset": "D3"
    },
    {
      "id": "D4",
      "title": "The two-topic tangle",
      "transcript": "A session mixes a billing-bug fix and a new feature design. The model keeps applying constraints from one to the other; every response conflates the two concerns.",
      "correctDiagnosis": "scope_bleed",
      "correctFix": "scope_then_restart",
      "recallTarget": 0.85,
      "preset": "D4"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add context-and-sessions/src/data/diagnostic-scenarios.json
git commit -m "Add 4 diagnostic scenarios"
```

---

### Task 24: ContextSessionsAssessment component

**Files:**
- Create: `context-and-sessions/src/components/ContextSessionsAssessment.jsx`
- Create: `context-and-sessions/tests/components/ContextSessionsAssessment.test.jsx`
- Modify: `context-and-sessions/src/register-components.js`

- [ ] **Step 1: Implement (MCQ phase)**

```jsx
import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import questionBank from '../data/assessment-questions.json'
import scenariosData from '../data/diagnostic-scenarios.json'
import SessionHygieneSimulator, { SIMULATOR_PRESETS } from './SessionHygieneSimulator.jsx'
import {
  gradeMCQ, gradeDiagnostic, overallResult, PASS_RULES,
} from '../lib/assessment.js'

const MCQ_KEY = Object.fromEntries(questionBank.questions.map((q) => [q.id, q.answer]))

export default function ContextSessionsAssessment() {
  const [phase, setPhase] = useState('mcq')  // mcq | diagnostic | results
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [mcqIndex, setMcqIndex] = useState(0)
  const [diagIndex, setDiagIndex] = useState(0)
  const [diagSubmissions, setDiagSubmissions] = useState({})

  const q = questionBank.questions[mcqIndex]
  const scenario = scenariosData.scenarios[diagIndex]

  function selectMCQ(choice) {
    setMcqAnswers((prev) => ({ ...prev, [q.id]: choice }))
  }
  function nextMCQ() {
    if (mcqIndex + 1 < questionBank.questions.length) setMcqIndex(mcqIndex + 1)
    else setPhase('diagnostic')
  }
  function nextDiag(submission) {
    setDiagSubmissions((prev) => ({ ...prev, [scenario.id]: submission }))
    if (diagIndex + 1 < scenariosData.scenarios.length) setDiagIndex(diagIndex + 1)
    else setPhase('results')
  }

  if (phase === 'mcq') return <MCQPhase q={q} index={mcqIndex} total={questionBank.questions.length}
    selected={mcqAnswers[q.id]} onSelect={selectMCQ} onNext={nextMCQ} />
  if (phase === 'diagnostic') return <DiagnosticPhase scenario={scenario} index={diagIndex}
    total={scenariosData.scenarios.length} onSubmit={nextDiag} />
  return <ResultsPhase mcqAnswers={mcqAnswers} diagSubmissions={diagSubmissions} />
}

function MCQPhase({ q, index, total, selected, onSelect, onNext }) {
  const answered = selected !== undefined
  const [revealed, setRevealed] = useState(false)
  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto', fontFamily: FONT_SANS }}>
      <div style={{ color: C.textDim, fontSize: 13, marginBottom: 8 }}>
        Question {index + 1} of {total} — Section {q.section}
      </div>
      <h3 style={{ color: C.text, fontSize: 18, marginBottom: 20, lineHeight: 1.5 }}>{q.q}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.options.map((opt, i) => {
          const isSel = selected === i
          const isCorrect = revealed && i === q.answer
          const isWrong = revealed && isSel && i !== q.answer
          const bd = isCorrect ? C.green : isWrong ? C.red : isSel ? C.accent : C.border
          return (
            <button key={i} onClick={() => !revealed && onSelect(i)}
              data-testid={`mcq-${q.id}-opt-${i}`}
              disabled={revealed}
              style={{ textAlign: 'left', padding: '10px 14px',
                background: isSel ? C.accentGlow : C.surface,
                border: `1px solid ${bd}`, color: C.text, borderRadius: 6,
                cursor: revealed ? 'default' : 'pointer', fontSize: 14 }}>
              <span style={{ color: C.accent, fontFamily: FONT_MONO, marginRight: 8 }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {revealed && (
        <div style={{ padding: '10px 14px', background: C.accentGlow,
          border: `1px solid ${C.accent}33`, borderRadius: 6, marginBottom: 16,
          fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          <strong style={{ color: C.accent }}>Rationale:</strong> {q.rationale}
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
            See slide {q.slideRef}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {!revealed ? (
          <button onClick={() => setRevealed(true)} disabled={!answered}
            data-testid="reveal-btn"
            style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
              border: 'none', borderRadius: 6, cursor: answered ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 600 }}>
            Reveal
          </button>
        ) : (
          <button onClick={() => { setRevealed(false); onNext() }}
            data-testid="next-btn"
            style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 14, fontWeight: 600 }}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}

function DiagnosticPhase({ scenario, index, total, onSubmit }) {
  const [diagnosisChoice, setDiagnosisChoice] = useState(null)
  const [fixChoice, setFixChoice] = useState(null)
  const [rationale, setRationale] = useState('')
  const [recallAchieved, setRecallAchieved] = useState(0)

  const diagnoses = scenariosData.diagnoses
  const fixes = scenariosData.fixes
  const correctDiagIdx = diagnoses.findIndex((d) => d.key === scenario.correctDiagnosis)
  const correctFixIdx = fixes.findIndex((f) => f.key === scenario.correctFix)

  function submit() {
    onSubmit({
      diagnosisChoice,
      fixChoice,
      recallAchieved,
      rationale,
      key: {
        diagnosis: correctDiagIdx,
        fix: correctFixIdx,
        recallTarget: scenario.recallTarget,
      },
    })
    setDiagnosisChoice(null)
    setFixChoice(null)
    setRationale('')
    setRecallAchieved(0)
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1000, margin: '0 auto', fontFamily: FONT_SANS }}>
      <div style={{ color: C.textDim, fontSize: 13, marginBottom: 4 }}>
        Diagnostic {index + 1} of {total}
      </div>
      <h3 style={{ color: C.text, fontSize: 18, margin: '0 0 12px 0' }}>{scenario.title}</h3>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
        {scenario.transcript}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Diagnose the failure:</div>
          {diagnoses.map((d, i) => (
            <label key={d.key} style={{ display: 'block', padding: 6, fontSize: 13,
              color: C.text, cursor: 'pointer' }}>
              <input type="radio" name="diag" value={i}
                checked={diagnosisChoice === i}
                onChange={() => setDiagnosisChoice(i)}
                data-testid={`diag-${scenario.id}-${i}`}
                style={{ marginRight: 8 }} />
              {d.label}
            </label>
          ))}
        </div>
        <div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Pick the fix:</div>
          {fixes.map((f, i) => (
            <label key={f.key} style={{ display: 'block', padding: 6, fontSize: 13,
              color: C.text, cursor: 'pointer' }}>
              <input type="radio" name="fix" value={i}
                checked={fixChoice === i}
                onChange={() => setFixChoice(i)}
                data-testid={`fix-${scenario.id}-${i}`}
                style={{ marginRight: 8 }} />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>
          Apply the fix in the simulator (target recall ≥ {(scenario.recallTarget * 100).toFixed(0)}%):
        </div>
        <div style={{ height: 380, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <SessionHygieneSimulator preset={scenario.preset} />
        </div>
        <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginTop: 8 }}>
          Recall achieved (drag to record your simulator result):
        </label>
        <input type="range" min="0" max="1" step="0.01" value={recallAchieved}
          onChange={(e) => setRecallAchieved(+e.target.value)}
          data-testid={`recall-${scenario.id}`} style={{ width: '100%' }} />
        <span style={{ color: C.accent, fontFamily: FONT_MONO, fontSize: 12 }}>
          {(recallAchieved * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Explain (2-3 sentences):</div>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)}
          data-testid={`rationale-${scenario.id}`}
          style={{ width: '100%', minHeight: 60, background: C.surface,
            color: C.text, border: `1px solid ${C.border}`, borderRadius: 4,
            padding: 8, fontFamily: FONT_SANS, fontSize: 13 }} />
      </div>
      <button onClick={submit}
        disabled={diagnosisChoice === null || fixChoice === null}
        data-testid={`submit-${scenario.id}`}
        style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontSize: 14, fontWeight: 600, float: 'right' }}>
        Submit
      </button>
    </div>
  )
}

function ResultsPhase({ mcqAnswers, diagSubmissions }) {
  const mcqResult = useMemo(() => gradeMCQ(mcqAnswers, MCQ_KEY), [mcqAnswers])
  const diagResults = useMemo(() =>
    scenariosData.scenarios.map((s) => {
      const sub = diagSubmissions[s.id] ?? {}
      const key = sub.key ?? {
        diagnosis: scenariosData.diagnoses.findIndex((d) => d.key === s.correctDiagnosis),
        fix: scenariosData.fixes.findIndex((f) => f.key === s.correctFix),
        recallTarget: s.recallTarget,
      }
      return { id: s.id, ...gradeDiagnostic(sub, key) }
    }), [diagSubmissions])
  const diagAvg = diagResults.reduce((a, r) => a + r.total, 0) / diagResults.length
  const overall = overallResult({ mcqPercent: mcqResult.percent, diagnosticAvg: diagAvg })

  // Persist completion
  if (overall.passed) {
    try {
      const raw = localStorage.getItem('llm_course_progress')
      const progress = raw ? JSON.parse(raw) : {}
      progress.__v = 2
      progress.part3 = true
      localStorage.setItem('llm_course_progress', JSON.stringify(progress))
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 26, marginBottom: 16 }}>Assessment Results</h2>
      <div style={{ padding: 20, background: overall.passed ? C.greenGlow : C.redGlow,
        border: `1px solid ${overall.passed ? C.green : C.red}`, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ color: overall.passed ? C.green : C.red, fontSize: 22, fontWeight: 700 }}
          data-testid="pass-banner">
          {overall.passed ? 'PASSED' : 'NOT YET PASSED'}
        </div>
        <div style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>
          Overall: {overall.overallPercent.toFixed(1)}% (need ≥ {PASS_RULES.overall}%)
          — Diagnostics: {diagAvg.toFixed(1)}% (need ≥ {PASS_RULES.diagnostic}%)
        </div>
      </div>
      <h3 style={{ color: C.text, fontSize: 18, marginBottom: 10 }}>Breakdown</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li style={{ color: C.textDim, fontSize: 14, marginBottom: 4 }}>
          MCQ: {mcqResult.correct}/{mcqResult.total} ({mcqResult.percent}%)
        </li>
        {diagResults.map((r) => (
          <li key={r.id} style={{ color: C.textDim, fontSize: 14, marginBottom: 4 }}>
            Diagnostic {r.id}: {r.total}/100 (D {r.breakdown.diagnosis}, F {r.breakdown.fix},
            R {r.breakdown.recall}, W {r.breakdown.rationale})
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Smoke test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import ContextSessionsAssessment from '../../src/components/ContextSessionsAssessment.jsx'

describe('ContextSessionsAssessment', () => {
  it('renders MCQ phase first', () => {
    render(<ContextSessionsAssessment />)
    expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument()
  })

  it('select option + reveal + next advances', () => {
    render(<ContextSessionsAssessment />)
    fireEvent.click(screen.getByTestId('mcq-A1-opt-0'))
    fireEvent.click(screen.getByTestId('reveal-btn'))
    fireEvent.click(screen.getByTestId('next-btn'))
    expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Register + test + commit**

Add to `register-components.js`:
```js
import ContextSessionsAssessment from './components/ContextSessionsAssessment.jsx'
registerComponent('ContextSessionsAssessment', ContextSessionsAssessment)
```

```bash
cd context-and-sessions && npm test -- ContextSessionsAssessment
```
Expected: 2 tests pass.

```bash
git add context-and-sessions/src/components/ContextSessionsAssessment.jsx context-and-sessions/src/register-components.js context-and-sessions/tests/components/ContextSessionsAssessment.test.jsx
git commit -m "Add assessment component with MCQ + diagnostic flow"
```

---

## Phase 5: Landing Page Renumber + Downstream App Updates

### Task 25: Wire the migrator into the landing page

**Files:**
- Modify: `deploy-landing/index.html`

- [ ] **Step 1: Read the current file**

```bash
cat deploy-landing/index.html
```
Expected: see the existing `MODULES` array and inline `<script>` block.

- [ ] **Step 2: Import the migrator as a module**

Find the `<script>` block that defines `MODULES` (currently starts around line 64). Before the existing `<script>` tag, add a new module-typed script:

```html
<script type="module">
  import { migrateProgressV1toV2 } from './migrate-progress.js'
  migrateProgressV1toV2(window.localStorage)
</script>
```

- [ ] **Step 3: Replace the `MODULES` array**

Replace the current `MODULES` and `TOOLS` declarations with:

```js
const MODULES = [
  { id:'part1', num:1, title:'How LLMs Actually Work', desc:'Self-attention, context density, hallucination mechanics, and feature activation landscapes.', path:'/part1/', slides:23, recording:'https://drive.google.com/file/d/1X9PWy9aUfCaIb97KgC12U_S4neNzxSDB/view?usp=sharing' },
  { id:'part2', num:2, title:'Working WITH LLMs', desc:'10-channel density methodology, comparative results, run-to-run consistency, and agentic systems.', path:'/part2/', slides:16, recording:'https://drive.google.com/file/d/1Cm0PhwRxaArwRjxv9DbK7vJpJcFvBFam/view' },
  { id:'part3', num:3, title:'Context & Sessions', desc:'Lost-in-the-middle, prompt vs. context engineering, session hygiene, and governance.', path:'/part3/', slides:23 },
  { id:'part4', num:4, title:'Building with LLMs', desc:'Decomposition, orchestration patterns, parallelism, and costing dashboards.', path:'/part4/', slides:24 },
  { id:'part5', num:5, title:'Testing with LLMs', desc:'Unit, functional, E2E, and load testing. The happy-path fallacy.', path:'/part5/', slides:22 },
  { id:'part6', num:6, title:'Deploying with LLMs', desc:'Environment management, versioning, pull/push deploy, and auto-scaling.', path:'/part6/', slides:19 },
  { id:'part7', num:7, title:'CI/CD with LLMs', desc:'Checkpoint pipelines, ownership models, speed-safety litmus, and logging.', path:'/part7/', slides:24 }
];

const TOOLS = [
  { id:'tool1', title:'Architecture Agent', desc:'10-channel structured intake that produces dense architecture specifications for one-shot LLM execution.', path:'/architect/' },
  { id:'tool2', title:'Decomposition Visualizer', desc:'Interactive wave-plan visualizer showing dependency-ordered parallel build planning.', path:'/decompose/' }
];
```

- [ ] **Step 4: Ship `migrate-progress.js` into the deploy-landing folder**

The migrator file created in Task 2 already lives at `deploy-landing/migrate-progress.js`. Confirm it is not in `.gitignore` and that the deploy pipeline ships it alongside `index.html`.

```bash
ls deploy-landing/migrate-progress.js
```
Expected: file exists.

- [ ] **Step 5: Manual verification**

Open `deploy-landing/index.html` in a browser (`file://` or via a local server). Expected:
- 7 module cards render in order 1-7
- Title of module 3 is "Context & Sessions"
- Progress label reads `0 / 7 modules completed`
- Opening devtools → Application → Local Storage: no errors

Seed the old progress and reload:
```js
localStorage.setItem('llm_course_progress', JSON.stringify({ part3: true }))
```
Reload: confirm part3 (Context & Sessions) is locked (gray) but part4 (Building) is now marked complete.

- [ ] **Step 6: Commit**

```bash
git add deploy-landing/index.html
git commit -m "Landing page: renumber modules to 1-7 and wire migrator"
```

---

### Task 26: Update Vite base paths for renumbered apps

Each of the four renumbered apps needs its `vite.config.js` `base:` updated so that built assets reference the new path.

**Files:**
- Modify: `building-with-llms/vite.config.js`
- Modify: `testing-with-llms/vite.config.js`
- Modify: `deploying-with-llms/vite.config.js`
- Modify: `cicd-with-llms/vite.config.js`

- [ ] **Step 1: Inspect each file**

```bash
grep -n "base\|port" building-with-llms/vite.config.js testing-with-llms/vite.config.js deploying-with-llms/vite.config.js cicd-with-llms/vite.config.js
```
Note whether each currently sets `base:`. If not, add it.

- [ ] **Step 2: Update each `vite.config.js`**

For each file, ensure `defineConfig` includes the correct `base`:

- `building-with-llms/vite.config.js` → `base: '/part4/'`
- `testing-with-llms/vite.config.js` → `base: '/part5/'`
- `deploying-with-llms/vite.config.js` → `base: '/part6/'`
- `cicd-with-llms/vite.config.js` → `base: '/part7/'`

Example final content (for building-with-llms — apply the same pattern to the others, changing the base):

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/part4/',
  server: { port: 5176 },
})
```

Ports should be unique; assign: 5173 (part1), 5174 (part2), 5175 (part3), 5176 (part4), 5177 (part5), 5178 (part6), 5179 (part7).

- [ ] **Step 3: Build each to confirm**

```bash
cd building-with-llms && npm run build
```
Expected: `dist/index.html` contains `"/part4/assets/..."` references. Confirm similarly for parts 5, 6, 7.

- [ ] **Step 4: Commit**

```bash
git add building-with-llms/vite.config.js testing-with-llms/vite.config.js deploying-with-llms/vite.config.js cicd-with-llms/vite.config.js
git commit -m "Update renumbered apps' Vite base paths to match new deploy layout"
```

---

### Task 27: Audit & update deploy scripts / nginx config

Commit `0b86d33` (Add EC2 deployment) introduced a deploy pipeline. Paths are likely hardcoded in shell scripts, Nginx config, or GitHub Actions. Locate and update.

- [ ] **Step 1: Find path-bearing deploy files**

```bash
grep -rln --include="*.sh" --include="*.yml" --include="*.yaml" --include="*.conf" --include="Dockerfile" -E "/part[3-6]/|building-with-llms|testing-with-llms|deploying-with-llms|cicd-with-llms" . 2>/dev/null | grep -v node_modules | grep -v dist
```
Expected: a list of files. Common suspects: `deploy.sh`, `.github/workflows/*.yml`, `nginx.conf`.

- [ ] **Step 2: Inspect each hit**

For each file returned, `Read` it and determine whether the references need to be renumbered. Record a mental map: old path → new path:
- `/part3/` → `/part4/` (building)
- `/part4/` → `/part5/` (testing)
- `/part5/` → `/part6/` (deploying)
- `/part6/` → `/part7/` (cicd)
- NEW `/part3/` → context-and-sessions

And directory-to-path mappings:
- `building-with-llms` → `/part4/`
- `testing-with-llms` → `/part5/`
- `deploying-with-llms` → `/part6/`
- `cicd-with-llms` → `/part7/`

- [ ] **Step 3: Update each file**

Edit in place using the mapping above. Add a new entry for `context-and-sessions` → `/part3/`. Preserve all other content.

- [ ] **Step 4: Add 301 redirects for old paths**

In Nginx (or equivalent), add 301 redirects so external bookmarks of `/part3/..part6/` resolve to their new location:

```nginx
location = /part3_old_building/ { return 301 /part4/; }
# ... etc — only add for paths users may have externally linked to
```

Because the old numbered paths (`/part3/` etc.) are being *reused* by the new module, we cannot 301-redirect the old URLs directly. Instead: document in release notes that external links to the old `/part3/` (Building) now point to Module 4, with new canonical path `/part4/`.

- [ ] **Step 5: Commit**

```bash
git add <files touched>
git commit -m "Update deploy pipeline paths for module renumber"
```

---

### Task 28: Audit certificate generation for module-name references

Commit `e81a4fb` mentioned PDF cert fixes. If cert generation references module numbers or titles, those need updating.

- [ ] **Step 1: Find cert generation code**

```bash
grep -rln --include="*.js" --include="*.jsx" --include="*.py" --include="*.html" -iE "certificate|cert[_-]?gen|pdfkit|jspdf" . 2>/dev/null | grep -v node_modules | grep -v dist
```

- [ ] **Step 2: Inspect each hit**

For each, check whether module numbers/titles are hardcoded. If so, update them to match the new numbering (see mapping in Task 27).

Common patterns:
- `certificates` endpoint on the admin backend
- Client-side PDF generation inside each module's Quiz/Assessment component

- [ ] **Step 3: Update strings**

Apply the numbering/title fix. Keep commits focused to one file or one related group.

- [ ] **Step 4: Commit**

```bash
git add <files>
git commit -m "Update certificate templates for renumbered modules"
```

If no cert references need changing, skip to Task 29.

---

### Task 29: Audit admin lock store

Commit `e81a4fb` mentioned admin module locks (`serverLocks` variable in the landing page). The backend lock store must be updated so that lock keys match the new module IDs.

- [ ] **Step 1: Find the backend**

```bash
grep -rln --include="*.py" --include="*.js" -iE "serverLocks|module_lock|admin_lock" . 2>/dev/null | grep -v node_modules
```

- [ ] **Step 2: Locate the endpoint that feeds `serverLocks`**

Inspect the landing page's fetch/request for the lock data, then trace back to the backend. Common pattern: a small Flask or Node endpoint returning `{ part3: false, part4: false, ... }`.

- [ ] **Step 3: Rename keys in any persistent store**

If the lock state is persisted (file, DB), update keys using the same mapping:
- existing `part3` lock → rename to `part4`
- existing `part4` lock → rename to `part5`
- existing `part5` lock → rename to `part6`
- existing `part6` lock → rename to `part7`
- add `part3` key (new module, default unlocked or as user prefers)

- [ ] **Step 4: Update endpoint code + tests if any**

Commit surgically.

```bash
git add <files>
git commit -m "Rename admin lock keys to match renumbered modules"
```

---

## Phase 6: Final Integration Tests & Deploy Prep

### Task 30: Landing-page e2e test

**Files:**
- Create: `deploy-landing/playwright.config.js`
- Create: `deploy-landing/tests/e2e/landing-renumber.spec.js`
- Modify: `deploy-landing/package.json` (add Playwright)

- [ ] **Step 1: Add Playwright**

Update `deploy-landing/package.json`:

```json
{
  "name": "deploy-landing",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

Install:
```bash
cd deploy-landing && npm install && npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.js`**

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { browserName: 'chromium', headless: true },
  webServer: {
    command: 'python3 -m http.server 8765 --directory .',
    port: 8765,
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 3: Write the e2e spec**

Create `deploy-landing/tests/e2e/landing-renumber.spec.js`:

```js
import { test, expect } from '@playwright/test'

const URL = 'http://localhost:8765/index.html'

test('renders 7 module cards with correct titles', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.module-card')).toHaveCount(7)
  await expect(page.locator('.module-card').nth(0)).toContainText('How LLMs Actually Work')
  await expect(page.locator('.module-card').nth(1)).toContainText('Working WITH LLMs')
  await expect(page.locator('.module-card').nth(2)).toContainText('Context & Sessions')
  await expect(page.locator('.module-card').nth(3)).toContainText('Building with LLMs')
  await expect(page.locator('.module-card').nth(6)).toContainText('CI/CD with LLMs')
})

test('migrates old progress keys on load', async ({ page }) => {
  await page.addInitScript(() => {
    // Old shape: part3 = Building completed
    localStorage.setItem('llm_course_progress', JSON.stringify({
      part1: true, part2: true, part3: true,
    }))
  })
  await page.goto(URL)
  const raw = await page.evaluate(() => localStorage.getItem('llm_course_progress'))
  const after = JSON.parse(raw)
  expect(after.__v).toBe(2)
  expect(after.part4).toBe(true)    // Building moved to part4
  expect(after.part3).toBeUndefined()  // Context & Sessions is new, no carryover
})

test('progress label reads X / 7', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('#progressLabel')).toContainText('/ 7 modules completed')
})
```

- [ ] **Step 4: Run the e2e**

```bash
cd deploy-landing && npm run test:e2e
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add deploy-landing/playwright.config.js deploy-landing/tests/e2e/landing-renumber.spec.js deploy-landing/package.json deploy-landing/package-lock.json
git commit -m "Add Playwright e2e for landing renumber + migration"
```

---

### Task 31: Full module suite run

- [ ] **Step 1: Run Vitest in the new module**

```bash
cd context-and-sessions && npm test
```
Expected: all tests pass (data-integrity, slide-engine, components smoke tests, all lib tests).

- [ ] **Step 2: Lint the new module**

```bash
cd context-and-sessions && npm run lint
```
Expected: no errors. Fix any linter findings before proceeding.

- [ ] **Step 3: Build the new module**

```bash
cd context-and-sessions && npm run build
```
Expected: `dist/` contains the built app, asset paths reference `/part3/`.

- [ ] **Step 4: Build every downstream renumbered app**

```bash
cd building-with-llms && npm run build && cd ../testing-with-llms && npm run build && cd ../deploying-with-llms && npm run build && cd ../cicd-with-llms && npm run build
```
Expected: all 4 builds succeed; asset paths reference their new base.

- [ ] **Step 5: If any step fails, stop and fix. Do not proceed to Task 32.**

---

### Task 32: Manual QA checklist

This task is not code — it is a walkthrough the engineer performs locally before declaring the module done.

- [ ] **Step 1: Start context-and-sessions and walk every slide**

```bash
cd context-and-sessions && npm run dev
```
Visit `http://localhost:5175/part3/` and for every slide:
- Text slide: title, subtitle/body, bullets, keyTakeaway render cleanly
- Component slide: component renders; all sliders/toggles respond
- Assessment: MCQ flow works end-to-end; diagnostic flow works end-to-end; results show pass/fail correctly

- [ ] **Step 2: Use Component 1 (playground) with each model preset**

- Verify the 3D landscape flattens as window_size grows
- Verify the needle readout updates
- Verify each of 4 model presets produces a visibly different surface

- [ ] **Step 3: Use Component 6 (simulator) to hit ≥90% recall**

- Confirm starting recall is visibly under 30%
- Verify toggling pin_invariants alone raises recall but usually not above 90%
- Verify that adding 4-5 interventions reliably pushes recall above 90%

- [ ] **Step 4: Complete the assessment**

- Answer all 15 MCQ honestly; confirm correct answers turn green, wrong red
- Complete all 4 diagnostic scenarios
- Confirm results screen shows overall score + per-bucket breakdown
- Confirm passing triggers localStorage update (`part3: true`)

- [ ] **Step 5: Verify landing page integration**

- Build context-and-sessions
- Place built `dist/` where the deploy script expects it for `/part3/`
- Open landing page
- Confirm Module 3 card unlocks (after Module 2 is complete) and navigates to the module

- [ ] **Step 6: Commit any last fixes**

If QA surfaced small issues, fix each as a focused commit. Do not bundle unrelated fixes.

---

### Task 33: Final commit and PR

- [ ] **Step 1: Confirm all changes are committed**

```bash
git status
```
Expected: working tree clean on this branch.

- [ ] **Step 2: Push the branch (user will coordinate merging / PR creation)**

```bash
git push -u origin <branch-name>
```

The user will create the PR. Do not do it automatically.

---

## Summary of Files Created / Modified

**Created:**
- `context-and-sessions/` — entire new module (scaffold + 5 components + assessment + tests + generated data)
- `deploy-landing/migrate-progress.js` + tests
- `deploy-landing/tests/e2e/landing-renumber.spec.js`
- `deploy-landing/playwright.config.js`
- `docs/superpowers/specs/2026-04-22-context-and-sessions-module-design.md` (already committed in brainstorming)
- `docs/superpowers/plans/2026-04-22-context-and-sessions-module.md` (this file)

**Modified:**
- `deploy-landing/index.html` (module list + migrator wiring)
- `deploy-landing/package.json`
- `building-with-llms/vite.config.js` (base path)
- `testing-with-llms/vite.config.js` (base path)
- `deploying-with-llms/vite.config.js` (base path)
- `cicd-with-llms/vite.config.js` (base path)
- Deploy scripts / Nginx config (identified by grep in Task 27)
- Certificate templates if applicable (Task 28)
- Admin lock backend if applicable (Task 29)

---

## Self-Review

**Spec coverage check:**
- Module scaffold matching M2 stack → Task 1 ✓
- SLIDES engine → Tasks 8-10 ✓
- Component 1 (Context Window Playground) → Task 15 ✓
- Component 2 (Lost-in-the-Middle Curve) → Task 16 ✓
- Component 3 (Attention Budget Allocator) → Task 13 ✓
- Component 5 (Lever Comparison Tool) → Task 18 ✓
- Component 6 (Session Hygiene Simulator, incl. external memory sub-toggles + nuclear restart) → Task 20 ✓
- Precomputed lookup tables + generator script → Tasks 5, 6, 7 ✓
- Assessment: 15 MCQ + 4 diagnostics with mini-simulator in presets → Tasks 21-24 ✓
- Assessment grading: 80% overall + 75% diagnostic thresholds → Task 21 ✓
- localStorage migrator → Task 2 ✓
- Landing renumber → Task 25 ✓
- Vite base path updates → Task 26 ✓
- Deploy scripts + Nginx → Task 27 ✓
- Cert + admin lock audits → Tasks 28, 29 ✓
- Playwright e2e for landing → Task 30 ✓
- Data integrity tests → Task 7 ✓
- Component smoke tests → Tasks 13, 15, 16, 18, 20, 24 ✓

**Known gaps flagged in spec §10:**
- Empirical recall curves: this plan uses pedagogical model profiles (Task 4) that produce the qualitative U-curve shape. If the user later wants empirical numbers, they can update `MODEL_PROFILES` in `attention-model.js` and re-run `npm run generate-data`. No further code changes needed.
- Reference PDFs (inaccessible during brainstorming): not load-bearing on this plan. Slide text is self-contained.






