# Module 4 DeployFlow Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Module 4's `DeployFlow` walkthrough and the `s8` screenshot slide with real data from a live deployment completed 2026-08-05 (the "Quote of the Day" app, run `d9331c480953`), replacing the stale `hello-world-735bac` capture from months earlier, and add a new slide showing the real deploy-handoff state plus the actual live app.

**Architecture:** Pure content/presentation update to an existing React/Vite module. No new dependencies, no new components — extend the existing `image` slide type in `App.jsx` to optionally render multiple images, refresh `DeployFlow.jsx`'s stage data, swap one screenshot asset and add two new ones.

**Tech Stack:** React 18, Vite, plain CSS (no CSS framework in this module).

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-08-05-module4-deployflow-refresh-design.md` — happy-path only, no bug/failure narrative (explicit user decision).
- Do not touch `DeploymentStack.jsx`, `BuildFlow.jsx`, `PipelineFlow.jsx`, or slide `s6`/`build-ui.png`.
- Do not change the DeployFlow 5-stage structure (Render → Docker Build → Push to ECR → kubectl apply → Poll Ingress) or its stepper/popover mechanism.
- All real data below was captured live from the actual architect webapp and EC2 host during this session — use it verbatim, do not paraphrase or invent additional detail.
- No test framework exists in `module4/` (no vitest, no test files) — verification is via `npm run dev` + visual check in a browser, matching this module's existing convention.

---

### Task 1: Extend the image-slide renderer to support multiple images

**Files:**
- Modify: `module4/src/App.jsx:221-228` (the `slide.type === 'image'` branch inside `renderBody()`)
- Modify: `module4/src/App.css` (add a rule for the new multi-image container)

**Interfaces:**
- Consumes: nothing new — existing `SLIDES` array shape (`{ id, type, title, image, caption }`).
- Produces: a new optional slide shape `{ id, type: 'image', title, images: [img1, img2], caption }` — an array of images instead of a single `image`. Task 3 relies on this. The existing single-`image` shape must keep working unmodified (Task 3 also updates an existing single-image slide, `s8`).

- [ ] **Step 1: Read the current renderer to confirm exact context**

Current code at `module4/src/App.jsx:221-228`:
```jsx
    if (slide.type === 'image') {
      return (
        <div className="image-slide">
          <img src={slide.image} alt={slide.title} />
          {slide.caption && <p className="caption">{slide.caption}</p>}
        </div>
      );
    }
```

- [ ] **Step 2: Extend the branch to support `slide.images` (array) alongside `slide.image` (single)**

Replace the block above with:
```jsx
    if (slide.type === 'image') {
      if (slide.images) {
        return (
          <div className="image-slide image-slide-multi">
            <div className="image-slide-grid">
              {slide.images.map((src, i) => (
                <img key={i} src={src} alt={`${slide.title} (${i + 1})`} />
              ))}
            </div>
            {slide.caption && <p className="caption">{slide.caption}</p>}
          </div>
        );
      }
      return (
        <div className="image-slide">
          <img src={slide.image} alt={slide.title} />
          {slide.caption && <p className="caption">{slide.caption}</p>}
        </div>
      );
    }
```

- [ ] **Step 3: Add CSS for the multi-image grid**

In `module4/src/App.css`, immediately after the existing `.image-slide .caption` rule (around line 94), add:
```css
.image-slide-grid {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.image-slide-grid img {
  width: 100%;
  max-width: 530px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  display: block;
}
```
(Two images side by side at 530px max-width each roughly match the existing single-image 1100px max-width when combined with the 1.5rem gap — same visual weight as the rest of the deck.)

- [ ] **Step 4: Verify with the dev server**

Run: `cd module4 && npm run dev`
Open the printed local URL in a browser. This won't show the new multi-image slide yet (that's Task 3) — just confirm the dev server starts clean and no console errors appear on the existing slides (e.g. navigate to slide `s8`, the existing single-image slide, and confirm it still renders exactly as before). Stop the dev server (Ctrl-C) when done.

- [ ] **Step 5: Commit**

```bash
cd /Users/reubenpatterson/LLM_Presentation
git add module4/src/App.jsx module4/src/App.css
git commit -m "$(cat <<'EOF'
Module 4: support multiple images on one image-slide

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Refresh `DeployFlow.jsx`'s stage data with the real Quote of the Day deployment

**Files:**
- Modify: `module4/src/components/DeployFlow.jsx:3-100` (the `STAGES` array only — nothing below line 100 changes)

**Interfaces:**
- Consumes: nothing (this is leaf content data, no props).
- Produces: nothing new — `STAGES` keeps its existing shape (`{ id, label, symbol, color, sub, sample }`), consumed unchanged by the rendering code at lines 102-161 (not touched by this task).

- [ ] **Step 1: Replace the `STAGES` array (lines 3-100) with this exact content**

```jsx
const STAGES = [
  {
    id: 'render',
    label: 'Render',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'Fill auto-derived fields',
    sample: `# Read template (built-in fubo Application template)
template = open('deploy_template.yaml').read()

# Auto-derived from workspace + config:
fields = {
  'name':              'quote-of-the-day-d9331c',       # spec_slug-run_short
  'namespace':         'training',
  'image':             '650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:d9331c',
  'port':              3000,                             # from generated app.listen()
  'host':              'quote-of-the-day-d9331c-training.tools.fubotv.net',
  'healthcheck_path':  '/healthz',                        # scanned from generated handler
}

rendered = render_yaml_text(template, **fields)
# → loaded into Monaco editor, user can edit before apply

# Note: the ECR repo ("architect-builds/app") is SHARED across every
# build regardless of spec_slug — only the image tag is per-run-unique.
# The K8s Application name/host still comes from spec_slug, so two
# different apps never collide on the same Application or ingress host.`
  },
  {
    id: 'docker_build',
    label: 'Docker Build',
    symbol: '◆',
    color: '#60a5fa',
    sub: '--platform=linux/amd64',
    sample: `> docker build --platform linux/amd64 -t \\
  650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:d9331c \\
  /var/www/llm-course/architect/workspaces/d9331c480953/

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 292B done
#2 [internal] load metadata for docker.io/library/python:3.12-slim
#3 [internal] load .dockerignore
#4 [internal] load build context
#4 transferring context: 382B done
#5 [1/5] FROM docker.io/library/python:3.12-slim@sha256:646fb0bc...
#6 [3/5] COPY requirements.txt ./
#6 CACHED
#7 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#7 CACHED
#8 [2/5] WORKDIR /app
#8 CACHED
#9 [5/5] COPY src ./src
#9 CACHED
#10 exporting to image
#10 writing image sha256:2fc055f523cdd3c75abbc79cfe49f6d4e9b0342ee6fe7eb8388a01d77d37185c done
#10 naming to 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:d9331c done`
  },
  {
    id: 'push',
    label: 'Push to ECR',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'One shared repo, per-run tag',
    sample: `# Pre-flight: create the shared repo if it doesn't exist yet
# (one-time; every future build reuses it, regardless of app name)
ensure_ecr_repository(image_tag, region, registry)

> docker push 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:d9331c

The push refers to repository [650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app]
1933659c1ae8: Layer already exists
362546fc9bff: Layer already exists
7cd89e51eab8: Layer already exists
f5b5bca81f27: Layer already exists
02bea5b709fa: Layer already exists
4bdf3c4a59c8: Layer already exists
eeece50a9eae: Layer already exists
6f9432833129: Layer already exists
d9331c: digest: sha256:94fda4b0d91aa01e7f37828947855cdd86bf6705cde2e05d7c6859a176b7aaa1 size: 1991

# On auth-stale: surface copy-pasteable
# 'aws ecr get-login-password ...' remediation`
  },
  {
    id: 'apply',
    label: 'kubectl apply',
    symbol: '◉',
    color: '#22d3ee',
    sub: 'fubo Application CRD',
    sample: `> kubectl apply -f rendered.yaml

application.app.smo.tools.fubotv.net/quote-of-the-day-d9331c created

# Operator reconciles into:
#   Deployment    quote-of-the-day-d9331c
#   Service       quote-of-the-day-d9331c
#   Ingress       quote-of-the-day-d9331c (ALB target group)
#   Route 53      quote-of-the-day-d9331c-training.tools.fubotv.net

# kubectl wasn't available on the agent host for this run — the app
# surfaced the YAML + a copy-pasteable command instead, and this apply
# was run from a laptop with cluster auth. See next slide.`
  },
  {
    id: 'poll',
    label: 'Poll Ingress',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Wait for HTTP 200',
    sample: `> kubectl get application quote-of-the-day-d9331c -n training

NAME                      IMAGE                                       REPLICAS   AVAILABLE   AGE
quote-of-the-day-d9331c   .../architect-builds/app:d9331c            1          True        26s

> curl -s -o /dev/null -w "%{http_code}" https://quote-of-the-day-d9331c-training.tools.fubotv.net/healthz
200

# {"status":"ok"} — live on the first attempt, no retries needed`
  },
];
```

- [ ] **Step 2: Verify with the dev server**

Run: `cd module4 && npm run dev`
Navigate to slide `s7` (title "The Deploy Agent's Pipeline"). Click through all 5 stages ("Next: Docker Build →", etc.) and confirm each popover shows the new real text above, with no rendering errors, no truncation, and the "Restart" button appears on the last stage. Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add module4/src/components/DeployFlow.jsx
git commit -m "$(cat <<'EOF'
Module 4: refresh DeployFlow with real 2026-08-05 deployment data

Replaces the stale hello-world-735bac capture with the actual Quote of
the Day deployment (run d9331c480953), including the shared-ECR-repo
behavior from today's fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update slide `s8` and add new slide `s8b`

**Files:**
- Modify: `module4/src/App.jsx:8-13` (image imports)
- Modify: `module4/src/App.jsx:150-152` (slide `s8` definition)
- Modify: `module4/src/App.jsx` (insert new slide `s8b` immediately after `s8`)

Screenshot assets already captured and saved this session at:
- `module4/src/assets/screenshots/deploy-ui.png` (already overwrites the old file at this same path — the real Deploy page for run `d9331c480953`, showing the rendered YAML, before any button is clicked)
- `module4/src/assets/screenshots/deploy-manual-apply.png` (new — the real "Manual apply needed" handoff panel after Build+Push complete and Apply is clicked, since this EC2 host has no kubectl)
- `module4/src/assets/screenshots/quote-app-live.png` (new — the actual live app's real response at `https://quote-of-the-day-d9331c-training.tools.fubotv.net/quote`)

**Interfaces:**
- Consumes: Task 1's `slide.images` support.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Confirm the three screenshot files exist and are non-trivial in size**

Run: `ls -la module4/src/assets/screenshots/deploy-ui.png module4/src/assets/screenshots/deploy-manual-apply.png module4/src/assets/screenshots/quote-app-live.png`
Expected: all three exist, each at least several KB (not zero-byte/corrupt). If any is missing, stop — do not fabricate a placeholder image.

- [ ] **Step 2: Add the two new image imports**

In `module4/src/App.jsx`, after the existing import at line 13 (`import deployUiImg from './assets/screenshots/deploy-ui.png';`), add:
```jsx
import deployManualApplyImg from './assets/screenshots/deploy-manual-apply.png';
import quoteAppLiveImg from './assets/screenshots/quote-app-live.png';
```

- [ ] **Step 3: Update slide `s8`'s caption to describe the real screenshot**

Current code at `module4/src/App.jsx:150-152`:
```jsx
  { id: 's8', type: 'image', title: 'The Deploy UI in Action',
    image: deployUiImg,
    caption: 'Live screenshot: rendered fubo Application manifest in Monaco editor, "Will deploy to" card showing the target URL with copy button, three sequential action buttons, and a custom-template upload card on the right.' },
```

Replace with:
```jsx
  { id: 's8', type: 'image', title: 'The Deploy UI in Action',
    image: deployUiImg,
    caption: 'Live screenshot: rendered fubo Application manifest for the "Quote of the Day" app (run d9331c480953) in Monaco editor, "Will deploy to" card showing the target URL with copy button, three sequential action buttons, and a custom-template upload card on the right.' },
```

- [ ] **Step 4: Insert new slide `s8b` immediately after `s8`**

Immediately after the `s8` slide entry (the block just edited in Step 3), insert:
```jsx
  { id: 's8b', type: 'image', title: 'The Real Handoff — and the Real Result',
    images: [deployManualApplyImg, quoteAppLiveImg],
    caption: 'Left: this agent host has no kubectl, so instead of applying directly it hands back the exact YAML and a copy-pasteable command — this is the correct, by-design outcome, not a failure. Right: after running that command from a machine with cluster auth, the app really is live — the actual HTTP response from the deployed pod.' },
```

- [ ] **Step 5: Verify with the dev server**

Run: `cd module4 && npm run dev`
Navigate to slide `s8` — confirm the caption mentions "Quote of the Day" and the image still renders. Advance one slide to `s8b` — confirm both images render side by side (or stacked if the viewport is narrow — the CSS from Task 1 uses `flex-wrap: wrap`) and the caption text matches Step 4. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add module4/src/App.jsx
git commit -m "$(cat <<'EOF'
Module 4: refresh Deploy UI screenshot, add real handoff + live-app slide

s8's screenshot and caption now reflect the real 2026-08-05 Quote of the
Day deployment. New slide s8b shows the real kubectl-missing handoff
panel alongside the actual live app response, proving the deploy
completed successfully end to end.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full-module visual pass

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server and step through the whole module**

Run: `cd module4 && npm run dev`
Starting from slide `s0a`, click "Next" through every slide to `s8b` at minimum (the last touched slide). Confirm:
- No console errors in the browser dev tools at any point.
- `s7` (DeployFlow) shows real Quote of the Day data at all 5 stages (spot-check the "Push to ECR" stage specifically — it should show the full real digest `sha256:94fda4b0d91aa01e7f37828947855cdd86bf6705cde2e05d7c6859a176b7aaa1`, not a placeholder).
- `s8` shows the refreshed screenshot with the updated caption.
- `s8b` (new) shows both images side by side with the correct caption.
- `s9` onward (untouched slides) still render exactly as before.

- [ ] **Step 2: Run the production build to confirm no build-time errors**

Run: `cd module4 && npm run build`
Expected: exits 0, no errors. This catches any import typo (e.g. a missing/misnamed screenshot file) that the dev server's HMR might mask.

- [ ] **Step 3: Stop the dev server, no commit needed for this task (verification only)**

---

## Self-Review

**Spec coverage:** Design doc's three scope items — (1) refresh DeployFlow text with real data → Task 2; (2) refresh `s8` screenshot/caption → Task 3 Step 3; (3) new combined-screenshot slide `s8b` → Task 3 Step 4, using Task 1's multi-image support. All three real screenshots were captured live this session and saved to their final destination paths already — no task re-captures them. Out-of-scope items (DeploymentStack.jsx, s6/build-ui.png, bug/failure narrative) are explicitly listed as untouched in Global Constraints and not referenced by any task.

**Placeholder scan:** No TBD/TODO. All `sample` strings in Task 2 are the actual real captured output (build digest `sha256:2fc055f5...`, push digest `sha256:94fda4b0...`, real run ID `d9331c480953`/`d9331c`, real hostname). All file paths are exact.

**Type consistency:** `slide.images` (Task 1) is consumed exactly once, by `s8b` (Task 3 Step 4), with the same two-element array shape defined in Task 1's Step 2 (`slide.images.map((src, i) => ...)`). The existing single-`image` slides (including the now-updated `s8`) are unaffected since Task 1's Step 2 falls through to the original single-image branch whenever `slide.images` is absent.
