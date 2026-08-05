# Module 4 Assessment — design

## What

Replace the 3-line placeholder in `module4/src/components/Assessment.jsx` with a real 15-question assessment plus certificate, following the mechanics already established and shipped in Module 3's `context-and-sessions/src/components/ContextSessionsAssessment.jsx`.

Current stub (all of it):

```js
export default function Assessment() {
  return <div>Assessment skeleton — MCQs land in a follow-up commit. Placeholder so the build is green.</div>;
}
```

It is already wired: `module4/src/App.jsx` slide `s18` has `type: 'assessment'`, and `renderBody()` renders `COMPONENTS['Assessment']` for that slide type. No routing or slide-array change is needed to make the new component appear.

## Why

Module 4 is the only module in the curriculum whose final slide is a stub. Module 3 shipped the pattern (question bank in JSON, section-interleaved sequence, reveal-per-question, pass-gated certificate that writes course progress), so this is a port with new content — not a new design.

## Success criteria

1. `module4/npm run build` and `module4/npm run lint` both pass clean.
2. Navigating to slide `s18` (last slide, 26 of 26) renders the intro screen; "Begin Assessment" is disabled until a name is entered.
3. Walking all 15 questions with ≥11 correct renders a green-bordered certificate showing name, score, percentage, tier, per-section breakdown, and a cert ID matching `/^ARCH-\d+-[A-Z0-9]+$/`.
4. On a passing run, `localStorage.llm_course_progress` contains `{"__v":2,"part4":true}` (merged into whatever else was already there).
5. On a failing run (≤10 correct), a red-bordered "Assessment Result" panel renders, no PDF button, and `part4` is **not** written by the certificate.
6. "Download PDF" produces a landscape-A4 PDF named `<Name>_Certificate.pdf` with no npm dependency added to `module4/package.json`.
7. Question bank is exactly 15 questions, 5 per section, every `slideRef` resolves to a real `id` in `App.jsx`'s `SLIDES`.

## Files

| Path | Action |
| --- | --- |
| `module4/src/data/assessment-questions.json` | **Created** (already written as part of this design — see below) |
| `module4/src/components/Assessment.jsx` | **Replaced** — stub → full component |
| `module4/src/App.jsx` | **One-line edit**: slide `s18`'s stale `body` string |
| `module4/package.json` | **Unchanged** — no new dependency |

The `s18` body is dead text (the `assessment` branch of `renderBody()` never reads `slide.body`) but it currently documents a stub that will no longer exist. Replace exactly:

```
'8-10 MCQ on pipeline mechanics. Skeleton MCQ component lives in src/components/Assessment.jsx (will be expanded in a follow-up).'
```

with:

```
'15 MCQ across 3 sections: Decompose & Wave Planning, The Build Agent, Deploy Agent & K8s Reconcile. Pass threshold 11/15. Certificate on pass.'
```

Nothing else in `App.jsx` changes.

## Data contract — `module4/src/data/assessment-questions.json`

Shape is identical to Module 3's bank, with one difference: `slideRef` is a **string slide id** (`"s4d"`), not a number, because Module 4's `SLIDES` array is keyed by string ids rather than positional index.

```jsonc
{
  "version": 2,
  "sections": [ { "key": "A", "label": "Decompose & Wave Planning" }, … ],
  "questions": [
    {
      "id": "A1",              // <section letter><1-based index within section>
      "section": "A",          // "A" | "B" | "C"
      "slideRef": "s4d",       // must exist as an id in App.jsx SLIDES
      "q": "…",                // stem
      "options": ["…","…","…","…"],   // exactly 4
      "answer": 2,             // 0-indexed into the UNSHUFFLED options array
      "explanation": "…"       // teaches why the answer is right AND why each distractor is wrong
    }
  ]
}
```

`slideRef` is authoring provenance only — no runtime code reads it. It exists so a future content edit to a slide can be traced to the questions that depend on it.

The file is written and complete: 15 questions, 5 per section. Sections and their grounding:

- **A — Decompose & Wave Planning** (`s4`, `s4d`): what determines wave membership (topological depth, not complexity/channel/alphabetical), where `7× parallelism` comes from and that the Build Agent uses it as its thread-pool worker cap, the complexity-weighted time-savings formula (and why the naive `(components − waves) / components` gives 80% instead of 73%), why interface `Owner:` is pinned before generation, what a single component build prompt does and does not contain.
- **B — The Build Agent** (`s5`, `s6`, `s9`): what Wrap Prompt adds (target path, runtime, allowed packages, shape template), one LLM call per component with intra-wave concurrency and strict inter-wave sequencing, the entrypoint-shim pattern (`CMD ["python","src/app.py"]` vs. Blueprint-fragment output, write-only-if-absent, always-on `/healthz`), post-process rejection of prose output scoped to one component, the full set of assembled workspace files.
- **C — Deploy Agent & K8s Reconcile** (`s0b`, `s7`, `s16`): healthcheck-path derivation by priority-ordered route scan and the refuse-rather-than-default rule, the shared `architect-builds/app` ECR repo with per-run tag uniqueness and spec-slug-derived K8s names, the `--platform linux/amd64` pin as a late-binding-failure guard, the reconcile loop (new ReplicaSet, maxSurge 1 / maxUnavailable 0, readiness gate, async `apply`), and the explicit Module 4/5 boundary — no tests, no config validation, no monitoring, no rollback.

Every mechanical claim in the bank was verified against the implementing Python (`architect/decomposer.py`, `architect/wave_plan.py`, `architect/builder.py`, `architect/deployer.py`), not just the slide copy.

## Component architecture — `module4/src/components/Assessment.jsx`

Single file, same function breakdown as the Module 3 reference, in this order:

1. **`C`** — colour constants object (`bg`, `surface`, `border`, `text`, `textDim`, `accent`, `green`, `red`, `yellow`). Copy the reference's values verbatim; Module 4's `App.css` is a different stylesheet and the assessment styles itself inline, so it must not depend on module-level CSS.
2. **`SECTIONS`** — `[{ name, icon }]`, three entries. `name` values must match the JSON's `sections[].label` character-for-character. Icons: `⊞` (A), `◆` (B), `◉` (C) — drawn from the glyph vocabulary already used by `BuildFlow.jsx` / `DeployFlow.jsx`.
3. **`SECTION_KEY_TO_INDEX`** — `{ A: 0, B: 1, C: 2 }`.
4. **`QUESTIONS`** — `questionBank.questions.map(...)` projecting to `{ section: <index>, q, options, answer, explanation }`. `id` and `slideRef` are intentionally dropped at this boundary; nothing downstream uses them.
5. **`PASS_THRESHOLD = 11`** — 11/15 = 73%.
6. **`buildSequence()`** — returns a flat array. For each section index `s`: push `{ type: 'section', section: s }`, then for each question in that section push `{ type: 'question', question: {...}, globalIdx }` where `globalIdx` is the question's index in `QUESTIONS`. Options are shuffled per question with a Fisher–Yates pass over an index array using `Math.random()`, and `answer` is remapped to `indices.indexOf(q.answer)` so it keeps pointing at the correct option. **Not seeded** — same as the reference; reproducibility is not a requirement here and a seeded RNG would be a gratuitous divergence.
7. **`hashCode(str)`** — the reference's 32-bit string hash (`hash = ((hash << 5) - hash) + char; hash |= 0`), returning `Math.abs(hash)`.
8. **`IntroScreen({ onStart, name, setName })`** — 🎓 glyph, title "Build & Deploy Assessment", subtitle "Decompose, Build, Deploy", blurb stating 15 questions across 3 sections and `Pass threshold: {PASS_THRESHOLD}/{QUESTIONS.length} ({Math.round(PASS_THRESHOLD / QUESTIONS.length * 100)}%)` — computed, not hardcoded. Name input (`data-testid="name-input"`), Begin button (`data-testid="begin-btn"`) disabled at 50% opacity while `!name.trim()`.
9. **`SectionHeader({ section, questionCount })`** — icon, `Section: {name}`, `{n} questions`.
10. **`QuestionScreen({ q, qNum, total, selected, setSelected, revealed, onReveal, onNext })`** — `Question {qNum} of {total}` counter, stem, 4 clickable option rows (`data-testid="opt-{i}"`). Pre-reveal: clicking sets `selected`, highlighted with accent border + `${C.accent}15` background. "Reveal Answer" (`data-testid="reveal-btn"`) appears only when `selected !== null`. Post-reveal: options become non-interactive; correct option goes green, the selected-and-wrong option goes red, others stay neutral; a Correct!/Incorrect banner plus the `explanation` renders; "Next" (`data-testid="next-btn"`) appears.
11. **`downloadCertPDF({ title, subtitle, name, body, fields })`** — see PDF section below.
12. **`Certificate({ name, score, total, sectionScores })`** — computes `pct`, `passed = score >= PASS_THRESHOLD`, and `tier = pct >= 93 ? 'Distinction' : pct >= 73 ? 'Pass' : 'Below Threshold'`. Cert ID captured in a lazy `useState` initialiser so re-renders don't regenerate it mid-view:

    ```js
    const [id] = useState(() => `ARCH-${hashCode(name + score)}-${Date.now().toString(36).toUpperCase()}`)
    ```

    `ARCH-` (for *architect*) is Module 4's prefix, distinct from Module 3's `CTXS-`.

    Progress write happens in `useEffect(..., [passed])`, never during render, and returns early when `!passed`:

    ```js
    useEffect(() => {
      if (!passed) return
      try {
        const raw = localStorage.getItem('llm_course_progress')
        const progress = raw ? JSON.parse(raw) : {}
        progress.__v = 2
        progress.part4 = true
        localStorage.setItem('llm_course_progress', JSON.stringify(progress))
      } catch { /* ignore */ }
    }, [passed])
    ```

    This is the same read/merge/write shape as `markPartComplete()` in `module4/src/App.jsx` — same key, same `__v: 2`, same `part4` flag, same swallowed-error behaviour for private-mode storage. It must not diverge; the landing page's unlock gate reads this key.

    Render: card with a 2px border, green when passed and red when not; heading "Certificate of Comprehension" / "Assessment Result"; name (`data-testid="cert-name"`); `Score: {score}/{total} ({pct}%) — {tier}` (`data-testid="cert-score"`); a 3-row section-breakdown table (`{sectionScores[i]}/{sectionTotal}`); cert ID; date. The "Download PDF" button (`data-testid="download-pdf"`) renders **only when `passed`**.
13. **`export default function Assessment()`** — the state machine.

## State machine

Three phases in one `phase` state variable: `'intro' → 'sequence' → 'done'`. Transitions are one-way; there is no back-navigation and no retry button — matching the reference. A learner who fails retries by reloading the slide, which remounts the component and rebuilds a freshly shuffled sequence.

State: `phase`, `name`, `seqIdx`, `answers` (`{ [globalIdx]: selectedIndex }`), `selected`, `revealed`, and `sequence` from `useState(() => buildSequence())` — a lazy initialiser rather than `useMemo`, because `Math.random()` is impure and the React-hooks purity lint flags it in `useMemo`. `module4` runs the same `eslint-plugin-react-hooks@^7` as the reference module, so this matters.

- **intro** → `IntroScreen`. "Begin Assessment" sets `phase = 'sequence'`.
- **sequence** → renders `sequence[seqIdx]`. A `section` step renders `SectionHeader` + a "Start Section" button (`data-testid="start-section-btn"`) wired to `handleNext`. A `question` step renders `QuestionScreen`.
- **`handleNext()`** — if the current step is a question with a selection, record `answers[globalIdx] = selected`; reset `selected`/`revealed`; advance `seqIdx`, or set `phase = 'done'` if this was the last step.
- **done** → filter `sequence` to question steps, score by comparing `answers[globalIdx]` against that step's post-shuffle `question.answer`, compute `sectionScores` the same way per section index, render `Certificate`.

The question counter shown to the learner is `Object.keys(answers).length + 1`, so section-header steps don't inflate it.

Scoring lives entirely in the `done` branch and is derived from `answers` — there is no running score state to drift.

## PDF certificate

Load jsPDF **from CDN at click time**, not as a bundled dependency:

```js
if (!window.jspdf) {
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}
const { jsPDF } = window.jspdf
```

`module4/package.json` gets **no** `jspdf` entry and the file uses **no** ES import of it. (Module 3 lists `jspdf` in its `package.json` yet still loads it from CDN — the dependency there is vestigial. Replicating only the CDN mechanism keeps Module 4's `node_modules` and bundle untouched.)

Document: `new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })`, `W = 297`, `H = 210`. Background `#0F172A` fill. Gold (`232,168,56`) double border inset at 12mm and 15mm plus 8mm corner ticks. Centred text stack: title at y=38, subtitle at y=45, "This certifies that" at y=60, name at 28pt bold at y=75, a 40mm rule at y=82, the wrapped body (`doc.splitTextToSize(body, 180)`) at y=92, then a row of labelled fields at y=135 spaced `W / (fields.length + 1)`. Fields: Score, Percentage, Result, Date, Certificate ID. Footer line at `H − 20`. Saves as `` `${name.replace(/\s+/g, '_')}_Certificate.pdf` ``.

Body text: *"has demonstrated engineering-level comprehension of spec decomposition into dependency-ordered build waves, per-component LLM code generation and project assembly, and containerised deployment to Kubernetes with health-gated rollout."*

### Intentional deviation: no watermark image

Module 3's PDF tiles a ~35 KB base64 PNG logo at 6% opacity across the page. Module 4 **omits the raster watermark entirely** and instead draws a tiled diagonal-line pattern in a very dark slate (`30, 41, 59`) at 0.25mm line width, on a 25mm grid, before the border is drawn.

This is a deliberate choice, not an oversight:

- The base64 blob is Module 3's specific branding asset; copying it into Module 4 would duplicate 35 KB of unrelated artwork into a second source file.
- A vector pattern costs a handful of lines, has no encoding to keep in sync, and needs no `doc.saveGraphicsState()` / `GState` opacity dance.

Anyone comparing the two certificates side by side will see different background treatments. That is expected. Do not "fix" it by porting the blob.

## Out of scope

- **No test harness.** `module4` has no `vitest`, no `jsdom`, and no `test` script, unlike `context-and-sessions`. Adding a test runner is a separate change; verification for this one is `npm run lint`, `npm run build`, and the manual walkthrough in Success Criteria 2–6.
- **No retry button, no back navigation, no progress bar** beyond the `Question N of 15` counter — reference parity.
- **No answer persistence.** Reloading mid-assessment starts over.
- **No changes** to `PipelineFlow.jsx`, `BuildFlow.jsx`, `DeployFlow.jsx`, `DeploymentStack.jsx`, `WaveGridReplay.jsx`, `App.css`, or any slide other than `s18`'s dead `body` string.
- **No landing-page change.** `deploy-landing` already reads `part4` from `llm_course_progress`; the certificate writes the flag the gate already expects.

## Nice-to-haves (explicitly deferred)

- Rendering `slideRef` as a "review this slide" link on incorrect answers. Requires plumbing a slide-navigation callback from `App.jsx` into `Assessment`; not worth the coupling for v1.
- A seeded RNG so a given learner sees a stable option order across reloads.
- Sharing the assessment shell between Modules 3 and 4 as a common component. Real duplication exists, but the modules are separately built Vite apps with no shared package, so extraction is its own project.
