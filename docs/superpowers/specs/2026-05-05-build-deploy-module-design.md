# Module 4: How to Build/Deploy with LLMs — Design Spec

**Date:** 2026-05-05
**Status:** Approved design, pending implementation plan
**Author:** Reuben Patterson (w/ Claude)

## 1. Summary

A new interactive module for the LLM Engineering Course, inserted as **Module 4** by collapsing the prior Building (3) and Deploying (5) modules into a single end-to-end walkthrough. Topic: **how the architect → decompose pipeline turns into running software**, demonstrated by generating and deploying a small HelloWorld app live to the fubo internal application platform.

The module ships as two coordinated artifacts:

1. **A standalone React/Vite slide deck** (`module4/`, port 5176, served at `/part4/`) — pattern matches Module 3 (`context-and-sessions/`). ~18 slides, one interactive component (wave-grid replay).
2. **Stage 3 of the existing architect Flask app** — a new `/build` route in `architect/webapp.py` plus two new modules (`builder.py`, `deployer.py`) that take a build-package YAML, run a local LLM via Ollama (default `mistral:7b`, configurable) wave-by-wave to generate code, build and push a container image to ECR, and apply a customizable `app.smo.tools.fubotv.net/v1alpha1` Application manifest to the fubo cluster. The end state is the HelloWorld app reachable at the URL declared in the deploy YAML.

The module also renumbers Testing (old #4) and CI/CD (old #6) into a combined future Module 5, which will deepen deploy configs, validation, and health monitoring.

## 2. Goals and Non-Goals

**Goals**
- Show the full pipeline working end-to-end on a small real app
- Make wave-parallel execution visible and obviously valuable (payoff for the Decompose module)
- Produce a tool fubo employees can use for their own projects after the course ends
- Set up the secrets / `.env` story as a foreshadowed callback for a later module
- Parity with Modules 1-3 on slide-deck shape, port convention, landing-page integration

**Non-Goals**
- Multi-provider LLM support (Ollama only; "LLM of choice" is rhetorical — the architect output is provider-portable, demo uses local Ollama with `mistral:7b` as the default model)
- Test execution as part of the build pipeline (→ Module 5)
- Health monitoring, validation depth, rollback strategies (→ Module 5)
- Multi-cluster or multi-environment deploys (single fubo `training` namespace)
- Authentication for the agent itself (assumes the employee has a working `KUBECONFIG` and AWS ECR creds in their shell)
- Redesign of old Building / Deploying decks (kept on disk, unlinked from landing)

## 3. Narrative Spine

**Through-line:** *The architect produced a spec. Decompose produced a build plan. Now: an LLM executes that plan in waves, the output gets containerized, and the container goes live at a URL on the fubo platform — all from a single page.*

Flow:
1. **Recap** — what comes out of Decompose (the build-package YAML)
2. **The Build Agent's job** — read the DAG, run prompts wave-by-wave, assemble project
3. **Wave-parallelism payoff** — sequential vs. parallel timeline, then the wave-grid animation
4. **LLM of choice** — the build-package is provider-agnostic; local Ollama (mistral:7b) is just one option
5. **What gets generated** — source files, project skeleton, Dockerfile, `.env.example` (foreshadow secrets module)
6. **The Deploy step** — fubo Application CRD, auto-derived fields, user customization
7. **Image build & push** — ECR, kubectl apply
8. **Live URL** — Route 53 ingress, app reachable
9. **Live walkthrough** — presenter switches to the architect tool
10. **What this doesn't cover** — tests, validation, health (→ Module 5)
11. **Assessment** — 8-10 MCQ

## 4. Architecture & Scaffolding

### Slide deck

- **New app:** `LLM_Presentation/module4/`
- **Stack:** React 19 + Vite 8 (matches Module 3)
- **Dev port:** 5176 (next free after 5173 M1 / 5174 M2 / 5175 M3)
- **Deploy path:** `/part4/` on the landing page
- **Slide engine:** reuse the `SLIDES = [{id, type, ...}]` array pattern
  - Slide types: `text`, `component`, `assessment`
- **Single interactive component:** `WaveGridReplay` — pre-recorded HelloWorld build animation (no live LLM call from the deck; the deck is deterministic)
- **Progress:** `localStorage.llm_course_progress.part4`, matches existing convention
- **Build output:** `dist/` consumed by the existing EC2 deploy pipeline

### Build/Deploy agent (Stage 3 of the architect Flask app)

- **New routes in `architect/webapp.py`:**
  - `GET /build` — render the build page, expects a `?package=<path>` query string with the build-package YAML
  - `POST /build/start` — kick off the wave-parallel build, returns a run-id
  - Socket.IO room `build:<run-id>` — streams per-component, per-wave events
  - `GET /deploy?run=<run-id>` — render the deploy page with rendered YAML and Monaco editor
  - `POST /deploy/render` — re-render YAML with form-fed values (no-op for raw editor mode)
  - `POST /deploy/image-build` — shell out to `docker build`, stream logs
  - `POST /deploy/image-push` — shell out to `docker push`, stream logs
  - `POST /deploy/apply` — shell out to `kubectl apply`, stream output, then poll for ingress readiness
- **New modules:**
  - `architect/builder.py` — wave orchestrator, Ollama HTTP client, project assembler
  - `architect/deployer.py` — YAML render, image build/push wrapper, kubectl wrapper, ingress poller
- **New templates:** `architect/templates/build.html`, `architect/templates/deploy.html`
- **New default deploy template:** `architect/templates/deploy_template.yaml` (mirror of `~/Documents/course_docs/deploy_template.yaml`)
- **Workspaces:** `architect/workspaces/<spec-name>-<timestamp>/` — persistent, contains generated source, project files, rendered deploy YAML, build/deploy logs
- **Config persistence:** extends existing `architect/.provider_config.json` with new keys: `ollama_model` (default `mistral:7b`), `ollama_base_url` (default `http://localhost:11434`), `ecr_registry`, `ecr_repository_prefix`, `default_namespace` (default `training`), `aws_region` (default `us-east-1`)

## 5. The Build Agent (`architect/builder.py`)

### Inputs

Path to a build-package YAML produced by Decompose (Stage 2 output). The YAML contains:
- `metadata` — `total_components`, `total_waves`, `max_parallelism`, time-savings figures
- `spec` — purpose, data_model, api, tech_stack (drives file extensions, Dockerfile base image)
- `dag` — components keyed by id, each with `name`, `type`, `wave`, `complexity`, `prompt`

### Behavior

1. **Parse** the YAML, group components by `wave`.
2. **For each wave (sequentially):** dispatch all components in the wave to the configured LLM **concurrently** using `concurrent.futures.ThreadPoolExecutor`. Cap concurrency at `max_parallelism`. (Ollama serializes generation server-side, but parallel client dispatch keeps the orchestration honest and keeps the UI animation accurate to the wave plan.)
3. **Wrap each component prompt** before dispatch. Validated against mistral:7b (Test A round 2, 2026-05-05) — wrapping the raw Decompose prompt with target file path, runtime version, allowed npm/pip packages, and a 3-5 line **shape example** dramatically improves output quality (correct npm `sqlite` API surfaced; arbitrary WebSQL hallucinations eliminated) AND cuts generation time ~3x (10s vs 33s) by suppressing prose. Wrapping format:
   ```
   You are generating one source file. Output the file CONTENTS ONLY — no markdown fences, no prose.
   The first character of your response must be the first character of the file.

   Target file: <relative_path>
   Runtime: <runtime_version> (<module_system>)
   Allowed packages (already installed): <comma-separated list from tech_stack>

   File shape (mimic this exactly):
   <3-5 line skeleton showing imports + exported function signature + return type>

   Component purpose: <name + type-derived purpose>
   Architecture constraints: <bullets from build-package `constraints` field>

   Produce <relative_path> now.
   ```
   The shape examples per component-type live in `architect/builder/templates/<type>.txt` (model, handler, config, etc.) keyed by language. The Decompose stage's bare per-component prompts are not used directly — they are inputs to the wrapping layer.
4. **Per component:** POST the wrapped prompt to `${ollama_base_url}/api/generate` (default `http://localhost:11434/api/generate`) with model `ollama_model` (default `mistral:7b`; configurable in `.provider_config.json`). `temperature: 0.1`. Stream the response.
5. **Post-process LLM output before writing to disk** — required, not optional. Validated against mistral:7b (Test A round 2) — even with explicit "no markdown fences" instruction, the model still wraps output in ` ```language ... ``` `. Post-processor:
   - Strip leading/trailing whitespace
   - If response begins with ` ```<lang>` and ends with ` ``` `, strip both
   - If response begins with prose followed by a fence, drop the prose preamble (split on first ` ``` `, keep the fenced block)
   - If response begins with prose followed by no fence, surface as a build error rather than write garbage to disk (component status: `error`, retry available)
   Treat the LLM as untrusted output regardless of prompt strictness.
6. **Write outputs:** post-processed text lands in `workspaces/<run>/src/<component-id>.<ext>`. Extension inferred from `spec.tech_stack` (`.js` for "JavaScript", `.py` for "Python", `.ts` for "TypeScript").
7. **Project assembly** (after all waves complete):
   - Detect language from tech_stack
   - Drop in language-appropriate manifest (`package.json` for Node, `requirements.txt` for Python)
   - Drop in `index.html` shell if frontend
   - Drop in `.env.example` with `OPENWEATHER_API_KEY=` placeholder (for the HelloWorld weather integration; intentional setup for a future secrets-management module)
   - Drop in a `Dockerfile` derived from tech_stack: `node:20-alpine` for JS, `python:3.12-slim` for Python; copies `src/`, installs deps, declares port (default 3000 for Node, 5000 for Python), entrypoint
8. **Emit Socket.IO events** to room `build:<run-id>`:
   - `build:start` `{run_id, total_components, total_waves}`
   - `build:wave:start` `{wave_index, components: [...]}`
   - `build:component:start` `{component_id}`
   - `build:component:chunk` `{component_id, text}` (streaming output)
   - `build:component:done` `{component_id, file_path, duration_ms}`
   - `build:component:error` `{component_id, error}`
   - `build:wave:done` `{wave_index, duration_ms}`
   - `build:complete` `{run_id, duration_ms, time_saved_ms}`

### UI (`architect/templates/build.html`)

- Header: spec name, total components, total waves, "estimated parallel time" countdown ticking down as waves complete; live "time saved vs. sequential" counter ticking up
- Body: wave-grid — each wave is a row, components are cards in the row
  - Card states: pending (grey) → running (animated border, spinner) → done (green) → error (red)
  - Each card has a collapsible panel showing streaming LLM output
- Footer: "Continue to Deploy →" button enabled when `build:complete` fires
- Failure path: per-card error surfaces stderr; per-card "Retry" button re-runs that one component

## 6. The Deploy Agent (`architect/deployer.py`)

### Inputs

- Workspace path (from completed build)
- Deploy template path (defaults to `architect/templates/deploy_template.yaml`)

### Behavior

1. **Render YAML** — load template, substitute auto-derived fields. **Resource naming must guarantee uniqueness across users and across re-runs of the same spec** — two people building the same HelloWorld spec must NOT collide on K8s Application name, ECR tag, or ingress host. Naming scheme:
   - `<spec_slug>` ← slugified `metadata.name` from the build-package YAML (lowercase, hyphenated, ≤40 chars; build-package YAML must include `metadata.name` — parser rejects packages without it)
   - `<run_short>` ← first 6 chars of the build's `run_id` (uniform random)
   - `<resource_name>` ← `<spec_slug>-<run_short>` (e.g. `hello-world-abc123`)
   - `metadata.name` ← `<resource_name>`
   - `metadata.namespace` ← `default_namespace` from config (default `training`)
   - `spec.image` ← `${ecr_registry}/${ecr_repository_prefix}/<spec_slug>:<run_short>` (one ECR repo per spec, one tag per run — repos don't grow unbounded; tags provide provenance)
   - `spec.ports[0].containerPort` ← inferred from generated server code or Dockerfile EXPOSE; default 3000 (Node) / 5000 (Python)
   - `spec.ingress.host` ← `<resource_name>-<namespace>.tools.fubotv.net`
   - `spec.healthcheck.path` ← **derived from generated app**, not defaulted. Strategy: scan generated handler/router files for the first GET route that returns 200 with no required params (e.g., `/health`, `/healthz`, `/`, `/ping`). If none found, prompt the user before deploy and refuse to render with a placeholder. Validated against Test B (2026-05-05): the sample `deploy_template.yaml` shipped with `/health` but the actual podinfo image serves `/healthz`, causing a crashloop on first apply. Blindly defaulting healthcheck path is the most likely failure mode for users on first deploy.
2. **User edits** — rendered YAML loads into a Monaco editor (raw YAML mode). Client-side YAML syntax check + required-fields check (`metadata.name`, `spec.image`, `spec.ports`, `spec.healthcheck`, `spec.ingress.host`). No CRD JSON-schema validation in v1 (defer to Module 5).
3. **Image build** — `docker build -t <image-tag> <workspace>`, stream logs to UI via Socket.IO
4. **Image push** — `docker push <image-tag>` to ECR
   - **Auth handling:** does not authenticate to ECR. On `docker push` failure with auth-related stderr (`no basic auth credentials`, `denied: User`), surface a clear message: `"ECR auth missing or expired. Run: aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <registry>"` rather than failing cryptically
5. **Apply** — `kubectl apply -f <rendered.yaml>` against the kubeconfig in `$KUBECONFIG`. Stream apply output to UI.
6. **Ingress poll** — after apply succeeds, poll the Application status (or directly `curl https://<host>/`) every 5s up to 90s. Surface "Live at <URL>" with a clickable link when the host responds with HTTP 200/302.
7. **Persist** the rendered/edited YAML to `workspaces/<run>/deploy.yaml` so the deploy can be re-applied without rebuild.

### Failure model

Any step failure surfaces raw stderr in the UI; user fixes the underlying problem (auth, kubeconfig, YAML edit) and clicks Retry on that step. No partial-rollback or auto-recovery in v1.

## 7. Module 4 Slide Deck

**~18 slides** in `module4/src/App.jsx`:

| # | Type | Title | Purpose |
|---|---|---|---|
| 1 | T | How to Build/Deploy with LLMs | Title |
| 2 | T | What We'll Cover | Agenda |
| 3 | T | The Pipeline End to End | Spec → Decompose → Build → Deploy diagram |
| 4 | T | Recap: What Comes Out of Decompose | The build-package YAML, annotated |
| 5 | T | The Build Agent's Job | Read DAG, run prompts wave-by-wave, assemble project |
| 6 | T | Why Wave-Parallel Matters | Sequential vs. parallel timeline |
| 7 | I | Wave-Grid Animation | Replay of HelloWorld build, components light up by wave (deterministic, no live LLM call) |
| 8 | T | LLM of Choice | Architect output is provider-agnostic; demo uses local Ollama with mistral:7b |
| 9 | T | What Gets Generated | Source files + project skeleton + Dockerfile + `.env.example` |
| 10 | T | Foreshadowing: That `.env.example` | Setup for later secrets/config-management module |
| 11 | T | The Deploy Step | Template → fill auto-fields → user customization |
| 12 | T | Anatomy of the Deploy YAML | Walk the fubo Application CRD field-by-field |
| 13 | T | Image Build & Push | ECR pipeline, `aws ecr get-login-password`, `docker push` |
| 14 | T | Live URL | Route 53 ingress, app reachable |
| 15 | T | Live Walkthrough | Cue presenter to switch to the architect tool |
| 16 | T | What This Doesn't Cover | Tests, validation, health monitoring (→ Module 5) |
| 17 | T | Recap | The four stages, the four artifacts |
| 18 | A | Assessment | 8-10 MCQ on pipeline mechanics |

## 8. Landing Page Updates (`deploy-landing/index.html`)

Edit the `MODULES` array (around `index.html:75-82`):

| Old # | New # | Title | Path | Action |
|---|---|---|---|---|
| 1 | 1 | How LLMs Actually Work | `/part1/` | unchanged |
| 2 | 2 | Working WITH LLMs | `/part2/` | unchanged |
| — | 3 | Context & Sessions | `/part3/` | already added per Module 3 spec |
| 3, 5 | 4 | How to Build/Deploy with LLMs | `/part4/` | NEW (collapses old Building + Deploying) |
| 4, 6 | 5 | Testing & CI/CD with LLMs | `/part5/` | placeholder, locked, redesign deferred |

- Update progress denominator (`MODULES.length` → 5; or 4 if Module 5 is rendered as locked-from-server).
- Drop old Building (slot 3) and Deploying (slot 5) entries.
- `building-with-llms/` and `deploying-with-llms/` source directories stay on disk; just unlinked from the landing UI.

## 9. The HelloWorld App

**Spec:** "Hello, World!" page that displays:
- The text "Hello, World!"
- The current time (client-side, updated each second)
- The current weather for a hardcoded city (e.g., New York), fetched from OpenWeatherMap

**Why this shape:** small enough that the build finishes in ~1-2 minutes against local Ollama mistral:7b (~10s/component validated in Test A round 2 with wrapped prompts); complex enough that the build package has 2-3 waves with parallelism (frontend component, weather-fetch service, config) so the wave-grid animation has something to show; includes an external API call so the `.env`/secrets story has a real anchor for the future module.

**Spec source:** authored fresh as `architect/examples/hello-world-spec.md` (does not reuse `weather-app-poc/` since that is the larger PoC). Run through Stages 1 and 2 to produce `architect/examples/hello-world-build-package.yaml`, which becomes the canonical input for the Module 4 walkthrough and the source of truth for the deck's wave-grid animation.

## 10. Risks & Open Items

- **R1: LLM output quality at small-model scale.** Validated against mistral:7b (2026-05-05): raw Decompose prompts produce hallucinated APIs (WebSQL `openDatabase` instead of npm `sqlite` `open`). *Mitigation:* the wrapping layer in §5 step 3 (file path + allowed packages + shape example) eliminated the hallucination in re-test, AND cut wall-clock time 3x. *Residual risk:* shape examples must be authored carefully per component-type; thin or generic shape examples will not save the model. Author and version-control the shape templates as part of v1.
- **R2: LLM ignores output-format instructions.** Validated against mistral:7b (2026-05-05): even with explicit "no markdown fences" instruction, model still returns ` ```language ... ``` `-wrapped code. *Mitigation:* §5 step 5 makes post-processing (fence stripping, prose-preamble detection) mandatory rather than relying on prompt obedience.
- **R3: ECR auth drift.** `docker login` to ECR expires every 12 hours. *Mitigation:* deployer detects auth-related push failures and surfaces a copy-pasteable `aws ecr get-login-password ...` remediation message rather than failing cryptically.
- **R4: First-deploy DNS/ingress lag.** Ingress + Route 53 record + ALB target registration take ~90s to be reachable after first apply (observed in Test B, 2026-05-05). *Mitigation:* deployer polls for ingress readiness with a visible spinner and a 120s timeout (~30s headroom over observed); doesn't claim "live" until the host responds with HTTP 200/302.
- **R5: Healthcheck path mismatch causes silent crashloops.** Validated against Test B (2026-05-05): the sample `deploy_template.yaml` declared `/health` but podinfo serves `/healthz` — pod entered crashloop, ingress returned 503, no useful UI signal pointed at the cause. *Mitigation:* §6 step 1 derives healthcheck path from the generated app rather than defaulting; deployer surfaces pod-restart events from `kubectl get events` in the apply step's UI panel so crashloops are immediately visible (not just "still pending").
- **R6: Project-assembly assumptions.** The Dockerfile/manifest generation is heuristic (looks at tech_stack strings). For tech_stack values outside the small set we test, assembly may produce a non-buildable project. *Mitigation:* support JS (Node 20-alpine) and Python (3.12-slim) in v1 explicitly; surface a clear error for other stacks rather than producing broken output.
- **R7: Cross-user / cross-run resource collisions.** If two users (or the same user twice) deploy the same spec with the same naming, the second deploy silently overwrites the first — same K8s Application, same ECR tag, same ingress host. *Mitigation:* §6 step 1 mandates `<spec_slug>-<run_short>` resource naming so each build run gets distinct cluster resources, and the build-package YAML must declare `metadata.name` for the slug (parser rejects packages without it). Trade-off: cleanup burden grows over time; deferred to Module 5 to add a "list and prune my deploys" view.
- **O1: Module 4 deck recording.** No drive link yet — added manually to the `MODULES` entry after the recording is done.
- **O2: ECR registry URL + repo prefix.** Account confirmed `650127479436`, region `us-east-1` (from kubectl context). Exact ECR repo prefix to be confirmed during implementation; default stubbed in `.provider_config.json` until then.
- **O3: Sample-doc fix needed.** `~/Documents/course_docs/deploy_template.yaml` healthcheck path needs updating from `/health` → `/healthz` to match podinfo (or swap example image to one that serves `/health`). Out of scope for the agent itself but needs fixing in the source-of-truth doc the agent will mirror.



- All four pipeline stages must be reachable from a single architect URL (employees install the architect once, get the whole flow)
- Builder must respect the build-package YAML faithfully — wave order, parallelism cap — no silent reinterpretation. Component prompts ARE wrapped (see §5 step 3); the Decompose stage's bare per-component prompt is an input, not the dispatched payload.
- Builder must treat all LLM output as untrusted — fence stripping and prose-preamble handling are mandatory regardless of prompt strictness (see §5 step 5)
- Deployer must derive healthcheck path from the generated app — never default. Refuse to render with a placeholder rather than ship a wrong default (see §6 step 1)
- Deployer must fail loudly and informatively on missing prerequisites (kubeconfig, AWS creds, docker daemon) — never silently swallow
- Deployer must surface pod-restart / crashloop events from `kubectl get events` during the apply step — silent 503s while a pod crashloops are the worst-case UX
- Workspaces are write-once per run — never mutate a prior run's workspace; new builds get new timestamps
- "LLM of choice" is rhetorical: only Ollama is wired up (default model `mistral:7b`); provider-portability is a spoken claim, not a code path

## 12. Phase 4 Smoke Test Findings (2026-05-06)

End-to-end smoke test on the `vat-development-blue` cluster, namespace `training`, building HelloWorld with mistral:7b. Live URL achieved: `https://hello-world-39f1f9-training.tools.fubotv.net/healthz` → 200. Findings folded back into the agent or noted for future iteration:

- **F1 (FIXED in commit 4e15778):** `docker_build` must pin `--platform=linux/amd64`. On Apple Silicon dev hosts, default builds produce arm64 images that hit `ImagePullBackOff` ("no match for platform in manifest") on the cluster's amd64 nodes. `docker_build(image, ws, platform="linux/amd64")` is now the default; second positional/keyword arg lets future multi-arch users override.
- **F2 (NOT FIXED, for future task):** AWS SSO session expiry causes both `docker push` (403) and `kubectl apply` (exit 255 "SSO session expired") to fail mid-pipeline with cryptic errors. Mitigation worth adding: a precheck in the deploy step (`aws sts get-caller-identity`) before docker_push that surfaces a clean "run `aws sso login`" message rather than letting the failure cascade through several seconds of work.
- **F3 (DOCUMENTED, no agent change):** ECR + K8s `imagePullPolicy: IfNotPresent` (the default) means re-pushing the same tag does NOT cause a pod restart to pull the new image — the node uses its cached copy. The agent's natural flow (`run_short` is uuid4-derived, unique per build) sidesteps this: every build run produces a new tag, every deploy pulls fresh. Manual re-pushes during smoke testing required `kubectl patch deployment ... imagePullPolicy: Always` to force a repull. Worth flagging in user-facing docs but no code change since the natural flow is correct.
- **F4 (R1 EVIDENCE):** Validated empirically — mistral:7b produces clean code for components 1-3 (model, simple handler, simple service) but garbled code for the wave-1 entry point (`app-server`). Two distinct failure modes observed: (a) re-implements other components' logic inline instead of importing them, with hardcoded placeholder strings (e.g. `'YOUR_API_KEY'` literal); (b) generates invalid JS — nested template literals not properly escaped, causing `SyntaxError: missing ) after argument list` at module load. **Concrete recommendation for the spec's R1 mitigation:** Module 4 walkthroughs should either (i) use a stronger model for the entry-point component (Claude Sonnet, GPT-4-class, or qwen2.5-coder:32b), (ii) explicitly hand-author the entry point in the build-package prompt with a much fuller shape example showing exactly which routers to import and mount, or (iii) make the build agent ship a known-good `app-server.<ext>` template instead of asking the LLM to generate it.
- **F5 (DOCUMENTED, agent already correct):** Resource naming `<spec_slug>-<run_short>` works in practice — observed `hello-world-39f1f9` for K8s Application, ECR tag, and ingress host without collision. No changes needed.
- **F6 (TIMING):** Real wall-clock numbers from the smoke test for future planning:
  - Build (4 components, mistral:7b, wave-parallel, max_par=3): **41s** (wave 0 = 17s, wave 1 = 24s)
  - Docker build with platform pin: **17-28s**
  - Docker push to ECR: **2-9s** (depending on layer cache)
  - kubectl apply + ingress ready: **~90s** observed when pod boots cleanly
  - Total walkthrough end-to-end (clean run, no fix loops): **~3-4 minutes**
