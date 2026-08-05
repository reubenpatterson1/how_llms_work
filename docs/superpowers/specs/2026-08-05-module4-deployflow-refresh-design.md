# Module 4 DeployFlow refresh — design

## What
Refresh `module4/src/components/DeployFlow.jsx` (the 5-stage architect-pipeline deploy walkthrough: Render → Docker Build → Push to ECR → kubectl apply → Poll Ingress) with real data from a live deployment completed 2026-08-05, replacing the stale `hello-world-735bac` transcript (captured months earlier).

## Why
The existing walkthrough uses an old, stale capture. A fresh, fully-verified real deployment (the "Quote of the Day" app, run `d9331c`, driven end-to-end through the architect webapp's public URL) is available from today's session and is more authentic teaching material.

## Scope
- **Structure unchanged**: same 5 stages, same stepper/popover mechanism.
- **Text content** (all 5 stages): replaced with real, accurate output from today's run — real rendered YAML fields, real `docker build` log, real `docker push` log (showing the shared `architect-builds/app` repo), real `kubectl apply` confirmation, real ingress poll result.
- **Existing slide `s8`** (`type: 'image'`, `deploy-ui.png`, immediately after the `DeployFlow` component slide `s7`) already serves as the "Render stage screenshot" — replace its image with a fresh screenshot of today's actual Deploy page (rendered YAML for the Quote of the Day run), update its caption with real details. Established convention: images live in `module4/src/assets/screenshots/`, imported in `App.jsx`, referenced via `image: <importedVar>` on an `{ id, type: 'image', image, caption }` slide entry.
- **New slide `s8b`**, inserted immediately after `s8`: one combined slide with two screenshots — the real manual-apply handoff panel (this agent host has no kubectl, so it hands back the exact YAML plus a copy-pasteable command instead of applying directly — the correct, by-design outcome for this split-host setup, not a failure), and the actual live deployed app page in a browser after that command was run from a machine with cluster auth. Requires a small additive change to the image-slide renderer in `App.jsx` to support multiple images on one slide (e.g. `images: [img1, img2]` alongside the existing single-`image` case) — no other slide's rendering changes.
- Docker Build / Push to ECR / kubectl apply stay text-only — no natural screenshot exists for CLI-only output.
- **Explicitly not touched**: `s6`/`build-ui.png` (Build UI screenshot) — different slide, outside what was asked about.

## Out of scope
- No changes to `DeploymentStack.jsx` (the earlier abstract 8-stage intro) or any other Module 4 component.
- No narrative about the bugs/fixes hit during today's session — happy-path only, per explicit request.
- No changes to the pipeline order or slide sequence in `App.jsx` beyond whatever is needed to reference new image assets.
