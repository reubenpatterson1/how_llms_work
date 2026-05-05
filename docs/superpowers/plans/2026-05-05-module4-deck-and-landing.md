# Module 4 Deck + Landing Renumber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Module 4 React/Vite slide deck (`module4/` on port 5176, served at `/part4/`) with ~18 slides + one interactive WaveGridReplay component, and renumber the landing page to insert Module 4 (Build/Deploy) and collapse old Building/Deploying entries into a deferred Module 5 (Testing & CI/CD).

**Architecture:** New React + Vite app cloned from the `context-and-sessions/` (Module 3) scaffold. Slide engine is the existing `SLIDES = [{id, type, ...}]` array pattern. The WaveGridReplay component is deterministic — replays a hardcoded HelloWorld build trace (no live LLM call from the deck). Landing page is a vanilla HTML+JS file (`deploy-landing/index.html`) — only the `MODULES` array needs editing.

**Tech Stack:** React 19, Vite 8, no extra runtime deps for the deck (the wave grid is plain DOM + setTimeout-driven animation, matching the lightness of similar Module 2/3 components).

**Spec reference:** `docs/superpowers/specs/2026-05-05-build-deploy-module-design.md` §3 (narrative), §7 (slide list), §8 (landing updates).

**Prerequisites:** Plan A (Build/Deploy Agent) does not need to be merged for this plan to start, but the WaveGridReplay's hardcoded trace should match what the real agent emits. If Plan A is in flight, mock the trace from spec §5 step 8 (the Socket.IO event names + payloads).

---

## File Structure

**Create:**
- `module4/` — new React + Vite app (cloned scaffold from `context-and-sessions/`)
  - `module4/package.json`
  - `module4/vite.config.js` (port 5176, base `/part4/`)
  - `module4/index.html`
  - `module4/eslint.config.js` (mirror existing module pattern)
  - `module4/src/main.jsx`
  - `module4/src/App.jsx` (the SLIDES array + slide renderer)
  - `module4/src/index.css`
  - `module4/src/components/WaveGridReplay.jsx`
  - `module4/src/data/wave-trace.js` (hardcoded HelloWorld build event sequence)

**Modify:**
- `deploy-landing/index.html` — edit `MODULES` array (around `index.html:75-82`), update progress denominator

---

## Phase 1 — Scaffold module4 app

### Task 1.1: Clone module 3 scaffold structure

**Files:**
- Create: `module4/package.json`
- Create: `module4/vite.config.js`
- Create: `module4/index.html`
- Create: `module4/eslint.config.js`
- Create: `module4/src/main.jsx`
- Create: `module4/src/index.css`

- [ ] **Step 1: Inspect the Module 3 scaffold to mirror its setup**

```bash
ls /Users/reubenpatterson/LLM_Presentation/context-and-sessions/
cat /Users/reubenpatterson/LLM_Presentation/context-and-sessions/package.json
cat /Users/reubenpatterson/LLM_Presentation/context-and-sessions/vite.config.js
```

Note the React/Vite versions and any non-default Vite config (base path, port).

- [ ] **Step 2: Copy the scaffold to module4 then prune**

```bash
cp -r /Users/reubenpatterson/LLM_Presentation/context-and-sessions/ /Users/reubenpatterson/LLM_Presentation/module4
rm -rf /Users/reubenpatterson/LLM_Presentation/module4/node_modules
rm -rf /Users/reubenpatterson/LLM_Presentation/module4/dist
rm -rf /Users/reubenpatterson/LLM_Presentation/module4/src/components
rm -rf /Users/reubenpatterson/LLM_Presentation/module4/src/data
mkdir /Users/reubenpatterson/LLM_Presentation/module4/src/components
mkdir /Users/reubenpatterson/LLM_Presentation/module4/src/data
```

- [ ] **Step 3: Edit module4/package.json**

Change the `name` field to `"module4"`. Leave deps as-is (matches Module 3).

- [ ] **Step 4: Edit module4/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/part4/',
  server: { port: 5176 },
  build: { outDir: 'dist' },
});
```

- [ ] **Step 5: Strip Module 3 content from App.jsx**

Open `module4/src/App.jsx` and replace its body with an empty SLIDES array (real content added in Task 2):

```jsx
import { useState } from 'react';
import './index.css';

const SLIDES = [
  { id: 'placeholder', type: 'text', title: 'Module 4 — coming up', body: 'Slides land in Task 2.' },
];

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  return (
    <div className="app">
      <header>{slide.title}</header>
      <main>{slide.body}</main>
      <footer>
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Prev</button>
        <span>{idx + 1} / {SLIDES.length}</span>
        <button disabled={idx === SLIDES.length - 1} onClick={() => setIdx(idx + 1)}>Next</button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Install and run**

```bash
cd /Users/reubenpatterson/LLM_Presentation/module4 && npm install
cd /Users/reubenpatterson/LLM_Presentation/module4 && npm run dev
```

Verify http://localhost:5176/part4/ renders the placeholder.

- [ ] **Step 7: Commit**

```bash
git add module4/
git commit -m "Scaffold module4 React/Vite app on port 5176 (base /part4/)"
```

---

## Phase 2 — Slide content

### Task 2.1: Author the 18 slides

**Files:**
- Modify: `module4/src/App.jsx`

The slide list per spec §7. Each slide entry is `{id, type, title, body}` for text slides; component slides reference a React component (Task 3.1 supplies `WaveGridReplay`).

- [ ] **Step 1: Replace SLIDES array in App.jsx**

```jsx
import { useState } from 'react';
import WaveGridReplay from './components/WaveGridReplay';
import './index.css';

const SLIDES = [
  { id: 's1', type: 'text', title: 'How to Build/Deploy with LLMs',
    body: 'Module 4 — the architect → decompose → build → deploy pipeline, end to end on a real app.' },

  { id: 's2', type: 'text', title: "What We'll Cover",
    body: '1. Recap of Decompose output\n2. The Build Agent\n3. Wave-parallelism payoff\n4. The Deploy Agent\n5. Live URL\n6. What this doesn\'t cover (→ Module 5)' },

  { id: 's3', type: 'text', title: 'The Pipeline End to End',
    body: 'Spec → Decompose → Build → Deploy. Four stages, four artifacts: dense spec, build-package YAML, container image + manifest, live URL.' },

  { id: 's4', type: 'text', title: 'Recap: What Comes Out of Decompose',
    body: 'A YAML DAG. Each node is a component with: id, type, wave, complexity, constraints, prompt. Wave assignment encodes parallelism — Wave 0 components have no inter-dependencies, Wave 1 depends on Wave 0 outputs.' },

  { id: 's5', type: 'text', title: "The Build Agent's Job",
    body: 'For each wave (sequentially): dispatch all components in parallel to the LLM, write each output to disk, advance to next wave. Then assemble the project skeleton: manifest, Dockerfile, .env.example.' },

  { id: 's6', type: 'text', title: 'Why Wave-Parallel Matters',
    body: 'Sequential build of N components ≈ N × per-component time. Wave-parallel: max(wave_0_time) + max(wave_1_time) + ... For a 4-component build with 2 waves of 2, parallelism roughly halves wall-clock time.' },

  { id: 's7', type: 'component', title: 'Wave-Grid Animation', component: 'WaveGridReplay' },

  { id: 's8', type: 'text', title: 'LLM of Choice',
    body: 'The build-package YAML is provider-agnostic — any model that can follow the wrapped prompt format works. Default in this build: local Ollama with mistral:7b. Bigger models give better single-shot quality; the wrapping layer normalizes a lot of the gap.' },

  { id: 's9', type: 'text', title: 'What Gets Generated',
    body: 'Per component: one source file (.js or .py). Per project: package.json or requirements.txt, Dockerfile, .env.example, index.html shell if frontend. The build agent writes everything to a versioned workspace folder.' },

  { id: 's10', type: 'text', title: 'Foreshadowing: That .env.example',
    body: "We're emitting an OPENWEATHER_API_KEY= placeholder, which means the real key has to come from somewhere. That somewhere — secrets and config management — is its own module. For now: the .env.example exists so a developer knows what to fill in." },

  { id: 's11', type: 'text', title: 'The Deploy Step',
    body: 'Take the deploy YAML template, fill in auto-derived fields (image, port, healthcheck path, ingress host), let the user customize the rest, then build → push → apply.' },

  { id: 's12', type: 'text', title: 'Anatomy of the Deploy YAML',
    body: 'fubo Application CRD: apiVersion app.smo.tools.fubotv.net/v1alpha1. Key fields: image, replicas, resources, ports, healthcheck (must match what your app actually serves), ingress host (must be unique).' },

  { id: 's13', type: 'text', title: 'Image Build & Push',
    body: 'docker build → docker tag → docker push to ECR. The agent expects you to have a fresh ECR docker login (12hr TTL). On auth error it surfaces the exact "aws ecr get-login-password" command to copy-paste.' },

  { id: 's14', type: 'text', title: 'Live URL',
    body: 'After kubectl apply, the agent polls the ingress until it serves HTTP 200 — typically ~90s for first deploy as Route 53 + ALB target registration settle. Then the URL is clickable.' },

  { id: 's15', type: 'text', title: 'Live Walkthrough',
    body: 'Switch to architect tool now → walk Stages 1-3 with the HelloWorld spec.' },

  { id: 's16', type: 'text', title: "What This Doesn't Cover",
    body: 'No automated tests run as part of the build. No deploy-config validation. No health-monitoring dashboards. No rollback or blue-green. All of that is Module 5: Testing & CI/CD.' },

  { id: 's17', type: 'text', title: 'Recap',
    body: 'Four stages: Spec → Decompose → Build → Deploy. Four artifacts: dense spec, build-package YAML, container image, live URL. The agent is yours to run on your own apps now.' },

  { id: 's18', type: 'assessment', title: 'Assessment',
    body: '8-10 MCQ on pipeline mechanics. Skeleton MCQ component lives in src/components/Assessment.jsx (next task).' },
];

const COMPONENTS = { WaveGridReplay };

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const renderBody = () => {
    if (slide.type === 'component') {
      const Comp = COMPONENTS[slide.component];
      return <Comp />;
    }
    return <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{slide.body}</pre>;
  };

  return (
    <div className="app">
      <header>{slide.title}</header>
      <main>{renderBody()}</main>
      <footer>
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Prev</button>
        <span>{idx + 1} / {SLIDES.length}</span>
        <button disabled={idx === SLIDES.length - 1} onClick={() => setIdx(idx + 1)}>Next</button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Stub the Assessment component to keep build green**

`module4/src/components/Assessment.jsx`:
```jsx
export default function Assessment() {
  return <div>Assessment skeleton — MCQs land in a follow-up commit. Placeholder so the build is green.</div>;
}
```

(Then update `COMPONENTS` map in App.jsx to include `Assessment`, and the assessment slide to set `component: 'Assessment'`.)

- [ ] **Step 3: Run dev server and click through every slide**

```bash
cd /Users/reubenpatterson/LLM_Presentation/module4 && npm run dev
```

Verify all 18 slides render without errors (the wave grid will render a placeholder until Task 3.1).

- [ ] **Step 4: Commit**

```bash
git add module4/src/App.jsx module4/src/components/Assessment.jsx
git commit -m "Add 18 slide content for Module 4 (Build/Deploy)"
```

---

## Phase 3 — WaveGridReplay component

### Task 3.1: Hardcoded build trace

**Files:**
- Create: `module4/src/data/wave-trace.js`

The trace mimics what the live agent emits (per spec §5 step 8). Used to drive the deterministic animation in the deck.

- [ ] **Step 1: Create the trace data**

```js
// module4/src/data/wave-trace.js
// Mirrors the build event sequence the live agent emits for the HelloWorld spec.
// Times are simulated wall-clock ms — they paint the wave-parallel story
// at presentation pace (faster than real Ollama, slower than instant).

export const HELLO_WORLD_TRACE = [
  { t: 0,    event: 'build:start', payload: { total_components: 4, total_waves: 2 } },
  { t: 100,  event: 'build:wave:start', payload: { wave_index: 0, components: ['weather-service', 'health-handler'] } },
  { t: 200,  event: 'build:component:start', payload: { component_id: 'weather-service' } },
  { t: 250,  event: 'build:component:start', payload: { component_id: 'health-handler' } },
  { t: 1500, event: 'build:component:done', payload: { component_id: 'health-handler', file_path: 'src/health-handler.js', duration_ms: 1250 } },
  { t: 2400, event: 'build:component:done', payload: { component_id: 'weather-service', file_path: 'src/weather-service.js', duration_ms: 2200 } },
  { t: 2500, event: 'build:wave:done', payload: { wave_index: 0, duration_ms: 2400 } },
  { t: 2600, event: 'build:wave:start', payload: { wave_index: 1, components: ['weather-handler', 'app-server'] } },
  { t: 2700, event: 'build:component:start', payload: { component_id: 'weather-handler' } },
  { t: 2750, event: 'build:component:start', payload: { component_id: 'app-server' } },
  { t: 4000, event: 'build:component:done', payload: { component_id: 'weather-handler', file_path: 'src/weather-handler.js', duration_ms: 1300 } },
  { t: 4500, event: 'build:component:done', payload: { component_id: 'app-server', file_path: 'src/app-server.js', duration_ms: 1750 } },
  { t: 4600, event: 'build:wave:done', payload: { wave_index: 1, duration_ms: 2000 } },
  { t: 4700, event: 'build:complete', payload: { duration_ms: 4700 } },
];
```

- [ ] **Step 2: Commit**

```bash
git add module4/src/data/wave-trace.js
git commit -m "Add hardcoded HelloWorld build trace for WaveGridReplay"
```

---

### Task 3.2: Render the wave-grid + animation

**Files:**
- Create: `module4/src/components/WaveGridReplay.jsx`

- [ ] **Step 1: Implement WaveGridReplay**

```jsx
// module4/src/components/WaveGridReplay.jsx
import { useEffect, useState, useRef } from 'react';
import { HELLO_WORLD_TRACE } from '../data/wave-trace';

const STATE = { PENDING: 'pending', RUNNING: 'running', DONE: 'done' };

export default function WaveGridReplay() {
  const [waves, setWaves] = useState({}); // { 0: ['weather-service', 'health-handler'], ... }
  const [statuses, setStatuses] = useState({}); // { component_id: 'pending' | 'running' | 'done' }
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  const reset = () => {
    setWaves({});
    setStatuses({});
    setDone(false);
    setElapsed(0);
  };

  useEffect(() => {
    if (done) return;
    startRef.current = performance.now();
    const timeouts = HELLO_WORLD_TRACE.map(({ t, event, payload }) =>
      setTimeout(() => {
        setElapsed(Math.round(performance.now() - startRef.current));
        if (event === 'build:wave:start') {
          setWaves(w => ({ ...w, [payload.wave_index]: payload.components }));
          setStatuses(s => {
            const next = { ...s };
            payload.components.forEach(c => { next[c] = STATE.PENDING; });
            return next;
          });
        } else if (event === 'build:component:start') {
          setStatuses(s => ({ ...s, [payload.component_id]: STATE.RUNNING }));
        } else if (event === 'build:component:done') {
          setStatuses(s => ({ ...s, [payload.component_id]: STATE.DONE }));
        } else if (event === 'build:complete') {
          setDone(true);
        }
      }, t)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [done]);

  const cardClass = (status) => {
    if (status === STATE.RUNNING) return 'card running';
    if (status === STATE.DONE) return 'card done';
    return 'card pending';
  };

  return (
    <div className="wave-replay">
      <div className="wave-replay__header">
        <span>Elapsed: {elapsed}ms</span>
        {done && <button onClick={reset}>Replay</button>}
      </div>
      {Object.keys(waves).sort((a, b) => a - b).map(idx => (
        <div className="wave" key={idx}>
          <h4>Wave {idx}</h4>
          <div className="wave__row">
            {waves[idx].map(c => (
              <div key={c} className={cardClass(statuses[c])}>
                <div className="card__name">{c}</div>
                <div className="card__status">{statuses[c]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <style>{`
        .wave-replay { padding: 1rem; }
        .wave-replay__header { display: flex; justify-content: space-between; margin-bottom: 1rem; font-family: monospace; }
        .wave { margin-bottom: 1.5rem; }
        .wave h4 { margin: 0 0 .5rem; color: #94a3b8; font-weight: 600; }
        .wave__row { display: flex; gap: 1rem; }
        .card { flex: 1; background: #1e293b; border: 2px solid #334155; border-radius: 8px; padding: 1rem; transition: all .25s; }
        .card.running { border-color: #3b82f6; box-shadow: 0 0 12px rgba(59,130,246,.4); }
        .card.done { border-color: #22c55e; background: #162b1f; }
        .card__name { font-weight: 600; }
        .card__status { font-size: .75rem; color: #94a3b8; margin-top: .25rem; }
        button { background: #3b82f6; color: white; border: none; padding: .35rem .75rem; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd /Users/reubenpatterson/LLM_Presentation/module4 && npm run dev
```

Open http://localhost:5176/part4/, navigate to slide 7. Verify:
- Wave 0 row appears with two pending cards
- Both cards transition pending → running concurrently
- Cards transition to done at different times (matching trace)
- Wave 1 row appears after Wave 0 completes
- Wave 1 cards animate similarly
- "Replay" button appears at end and reruns the animation when clicked

- [ ] **Step 3: Commit**

```bash
git add module4/src/components/WaveGridReplay.jsx
git commit -m "Add WaveGridReplay: deterministic build animation from hardcoded trace"
```

---

## Phase 4 — Landing page renumber

### Task 4.1: Update MODULES array on the landing page

**Files:**
- Modify: `deploy-landing/index.html` (around lines 75-82, the `MODULES` array)

- [ ] **Step 1: Read the current MODULES array**

```bash
grep -n 'const MODULES' /Users/reubenpatterson/LLM_Presentation/deploy-landing/index.html
sed -n '70,90p' /Users/reubenpatterson/LLM_Presentation/deploy-landing/index.html
```

- [ ] **Step 2: Replace the MODULES array**

In `deploy-landing/index.html`, replace the existing `const MODULES = [...]` block with:

```javascript
const MODULES = [
  {id:'part1',num:1,title:'How LLMs Actually Work',desc:'Self-attention, context density, hallucination mechanics, and feature activation landscapes.',path:'/part1/',slides:23,recording:'https://drive.google.com/file/d/1X9PWy9aUfCaIb97KgC12U_S4neNzxSDB/view?usp=sharing'},
  {id:'part2',num:2,title:'Working WITH LLMs',desc:'10-channel density methodology, comparative results, run-to-run consistency, and agentic systems.',path:'/part2/',slides:16,recording:'https://drive.google.com/file/d/1Cm0PhwRxaArwRjxv9DbK7vJpJcFvBFam/view'},
  {id:'part3',num:3,title:'Context & Sessions',desc:'Lost-in-the-middle, attention-budget framing, prompt vs. context engineering, session hygiene, governance.',path:'/part3/',slides:23},
  {id:'part4',num:4,title:'How to Build/Deploy with LLMs',desc:'End-to-end walkthrough: build-package → wave-parallel code generation → containerize → deploy live to the fubo platform.',path:'/part4/',slides:18},
  {id:'part5',num:5,title:'Testing & CI/CD with LLMs',desc:'Unit / functional / E2E / load testing, deploy-config validation, health monitoring, ownership models.',path:'/part5/',slides:0},
];
```

Notes:
- Old `part3` (Building) is now `part4` (collapses old Building + Deploying)
- Old `part4` (Testing) and old `part6` (CI/CD) collapse into new `part5`
- Old `part5` (Deploying) is dropped (folded into `part4`)
- Module 3 entry assumes Module 3 (Context & Sessions) is already shipped — if not, leave the existing Module 3 row whatever it currently is and only edit rows 4 and 5

- [ ] **Step 3: Verify progress denominator updates automatically**

The `MODULES.length` is used dynamically in the existing `render()` function (`const completed=MODULES.filter(m=>progress[m.id]).length;` and similar). With 5 entries, the denominator becomes 5/5 instead of 6/6 — no other code change needed.

- [ ] **Step 4: Lock module 5 from selection until it's built**

Module 5 is intentionally a placeholder. The existing landing page logic locks unbuilt modules via `serverLocks` (loaded from a separate endpoint). For this plan, hardcode module 5 as locked client-side as a stopgap:

In `deploy-landing/index.html`, find the `var serverLocks={};` line and change to:
```javascript
var serverLocks={part5: true};
```

This prevents users from clicking through to a 404. When Module 5 ships, remove the lock.

- [ ] **Step 5: Manual smoke test**

```bash
cd /Users/reubenpatterson/LLM_Presentation/deploy-landing && python3 -m http.server 8000
```

Open http://localhost:8000/. Verify:
- 5 module cards render (not 6)
- Module 4 card shows the new title/desc
- Module 5 card appears locked
- Progress shows X/5 (not X/6)
- Clicking Module 4 navigates to `/part4/` (will 404 in local serving, that's expected — the EC2 deploy maps it to module4/dist)

- [ ] **Step 6: Commit**

```bash
git add deploy-landing/index.html
git commit -m "Renumber landing modules: insert Module 4 (Build/Deploy), collapse Testing+CI/CD into placeholder Module 5"
```

---

## Self-Review Checklist

- [ ] All 18 slides from spec §7 are present in `App.jsx`'s SLIDES array (count manually)
- [ ] WaveGridReplay matches the event names in spec §5 step 8 (`build:wave:start`, `build:component:start`, `build:component:done`, `build:complete`)
- [ ] The trace in `wave-trace.js` shows actual wave-parallelism (two components running concurrently in each wave) — not just a sequential chain
- [ ] Landing-page MODULES array entries: 1 (LLMs Work), 2 (Working with), 3 (Context), 4 (Build/Deploy NEW), 5 (Testing+CI/CD LOCKED)
- [ ] No leftover Module 3 / 5 / 6 entries that conflict with the new numbering
- [ ] `module4/vite.config.js` has `base: '/part4/'` and `port: 5176`
- [ ] `package.json` `name` is `"module4"`
- [ ] No "TBD" / "TODO" / placeholder text in any committed file (the Assessment stub is intentional and called out)
