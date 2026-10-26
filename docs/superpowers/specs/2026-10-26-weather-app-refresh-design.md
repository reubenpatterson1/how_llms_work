# Weather App Refresh (Parts 4 and 5, plus Refresher) — design

## What

Five pieces of work, done in this order because each depends on the one before:

1. **Test the Architecture Agent and Decomposition Visualizer** (`/architect/`, `/decompose/`, both served by the Flask app in `architect/`) and confirm they work as designed. Fix only what blocks step 2; document everything else.
2. **Run the full pipeline for real** (Intake → Spec → Decompose → Build → ECR push → deploy → live URL) for a Hello World weather app: the user types a city, the app calls the OpenWeather API, and the page shows the weather. Capture genuine output and screenshots.
3. **Update Part 4** (`module4/`). Replace the current worked examples with the real weather run. The slides stay a worked example that learners watch, and they also get a follow-along path so each learner can build their own copy in their own repo in the `fubotv` GitHub org and deploy it to the shared platform.
4. **Redesign Part 5** (`testing-with-llms/`, served at `/part5/`) around the weather app as "the second step". The learner changes their deployed app locally, runs tests, and opens a PR into `staging`. Merging to `staging` triggers a self-contained GitHub Actions workflow in the learner's own repo that builds, pushes, and deploys the app. The learner then verifies that the live URL shows the change.
5. **Build a Refresher module outside the learning path** (`refresher/`, served at `/refresher/`). It is a self-directed, scored, 10–15 minute check on Parts 1–3 vocabulary. Its purpose is that a learner can go through Parts 4 and 5 without hitting an unfamiliar term or process.

Parts 1–3 content does not change. The Part 5 admin lock does not change. Whether it is lifted is the user's call.

## Why

- **Part 4 has three unrelated worked examples.** It never shows one app going end to end:
  - a Team Task Tracker spec on `s4b`/`s4`, in `PipelineFlow.jsx` and in `BuildFlow.jsx`;
  - an older HelloWorld weather build on `s6` and in `module4/src/data/wave-trace.js`;
  - the "Quote of the Day" deploy on `s7`/`s8`/`s8b`/`s8c`, in `DeployFlow.jsx` and in the assessment.

  On top of that, the Quote run's `/quote` handler was a stub (`{"result":"value"}`). One real weather run fixes all of this, and it pays off the `s10` slide that already foreshadows `OPENWEATHER_API_KEY`.
- **Part 5 is stale and describes an app that does not exist.** It shows `slides:0` on the landing page and is admin-locked. Its content describes a fictional weather app (api.weather.gov, 15 cities, typewriter animation, "built in Part 3"). Its CI/CD half (`cicd-with-llms/`) is built for `/part7/` and is not wired into the unlock chain at all: it has no `__LLM_MODULE_ID__` and does not load `flow-through.js`.
- **Parts 4 and 5 use vocabulary taught in Parts 1–3**, such as context density, the 10 channels, dense spec, decompose, waves and session hygiene. Learners who skipped or forgot those Parts have no quick way to check themselves.

## Order of work and dependencies

| Stage | Depends on | Blocks |
| --- | --- | --- |
| 0a. Snapshot | — | every edit |
| 0b. OIDC trust spike (throwaway repo; **ask the user before creating it**) | user approval | 3b, 4 |
| 0c. CRD Secret-reference check (read-only, from the user's laptop; no throwaway repo) | — | Stage 2 deploy, 3b, 4 |
| 1. Test Architect + Decompose | 0a | 2 |
| 2. Real weather pipeline run (instructor's worked example, deployed through the existing architect Deploy page) | 1; 0c for the deploy step | 3a |
| 3a. Part 4 worked-example slide refresh | 2 | 3b |
| 3b. Part 4 follow-along path | 3a, 0b passed, 0c passed | 4 |
| 4. Part 5 redesign | 3b, 0b passed, 0c passed | — |
| 5. Refresher module + landing card | 0a only | — |

Stage 0b runs in parallel with Stages 1–3a, because its result decides whether the follow-along deploy can work at all (Claude's call: start it early rather than at the start of Stage 4). Stage 0c runs at the start, before Stage 2's deploy step. It is a read-only check that needs neither the spike nor the throwaway repo (Claude's call). Stage 5 does not depend on Stages 1–4 and may run in parallel with them, but it ships last (Claude's call).

**Only Stages 3b and 4 depend on the Stage 0b spike passing** (Claude's call). Stage 2's worked-example deploy uses the existing architect Deploy path, with its `kubectl` handoff to the user's laptop, and never uses the OIDC role. Stage 3a depends only on Stage 2. No fallback track is written in advance for 3b and 4. If the spike fails, stop and report to the user which way it failed: the trust policy rejected the repo, the EKS endpoint is private and unreachable from GitHub-hosted runners, or the role lacks Kubernetes RBAC in `training`. The user decides the next step.

## Process constraints (apply to every stage)

- **Snapshot before any edit.** Take a compressed snapshot of all project files before the first edit, and again before the first edit of each later stage. Store it as a `.tar.gz` under `.claude/snapshots/`. Exclude `node_modules/` and `dist/` (Claude's call: these are regenerable, not project files).
- **Who does what.** Code, tests, deploy scripts, workflow YAML and READMEs are written by the `code-executor` subagent from detailed specs. Question-bank content and slide copy are authored by an Opus pass (`spec-author`) and handed to `code-executor` verbatim (Claude's call). An Opus review (`design-reviewer` or `investigator`) happens before any stage is declared done. Every change has explicit success criteria and tests.
- **Commit by explicit path only.** The working tree is intentionally dirty (PDFs, screenshots, `weather-app-poc/.coverage`, `context-and-sessions/package-lock.json`, `.playwright-mcp/`, `.claude/snapshots/`). Never `git add -A` or `git add .`.
- **Don't restart the EC2 service mid-run.** Do not restart the EC2 architect service (`llm-architect.service`) mid-pipeline, because a restart wipes in-memory intake session state. Ship all fixes first, restart once, then run intake fresh.
- **Unlock gate.** Each module's `__LLM_MODULE_ID__` in `index.html`, the `MODULES`/`LABELS` arrays in `deploy-landing/flow-through.js`, and the `MODULES` array in `deploy-landing/index.html` must stay in sync. Verify this, don't assume it: a full Part 4 click-through from `s0a` to the last slide has never been run.
- **DNS lag is not failure.** An ingress 404 or NXDOMAIN right after `kubectl apply` is DNS/ALB lag, not failure. Wait up to 180s before declaring failure (Claude's call: 180s, matching the nginx ceiling and exceeding the ~90s observed first-deploy lag).
- **Ingress rule.** This applies to any `ingress.yaml` written in this work. Internal ingress (no `alb.ingress.kubernetes.io/scheme: internet-facing`) must NOT get `alb.ingress.kubernetes.io/ssl-redirect`, `nginx.ingress.kubernetes.io/ssl-redirect`, `nginx.ingress.kubernetes.io/force-ssl-redirect`, or any TLS/443 annotation. External internet-facing ingress requires `alb.ingress.kubernetes.io/ssl-redirect: '443'`.

  This work writes no raw `ingress.yaml`. Deploys use the fubo `Application` CRD. The CRD's `ingress:` block, including `tls.certificateArn`, is copied verbatim from `architect/templates/deploy_template.yaml` and gets no redirect fields added (Claude's call).

  Decided: the `*-training.tools.fubotv.net` hosts are internal, and every learner can reach them. Use internal ingress with no ssl-redirect or TLS annotations.
- **OpenWeather API keys.** Decided: the instructor's worked example uses the user's key, which the user supplies at implementation time. Each learner signs up at OpenWeather for their own free key as part of the training. Learners store it only as a GitHub repo secret named `OPENWEATHER_API_KEY`, and their deploy workflow copies it into a K8s Secret in `training` at deploy time. The Secret is named `<app-name>-openweather` (Claude's call): one per app, so each learner's workflow creates and patches only its own app's Secret, and the instructor's worked example has its own Secret. No key value ever appears in generated code, committed files (including learner kit files and learner repos), slide text, screenshots, the evidence file, or this document. Recorded commands write `appid=$OPENWEATHER_API_KEY`, never the expanded value.
- **No happy-path faking.** Slides use genuinely captured output only. Failure that looks like success counts as failure. Examples: a stale page after deploy, the `app.py` "Hello, World!" fallback page with no weather on it, a stub handler returning placeholder JSON, or a decompose that silently fell back to regex.

## Stage 0b — OIDC trust spike

**What.** Prove or disprove that a repo in the `fubotv` org can use `arn:aws:iam::650127479436:role/Github-Actions-OIDC-Policy` from GitHub Actions to do what the per-learner workflow needs. The user says the role should trust any `fubotv` repo. This is untested.

**Outward-facing.** Creating the throwaway repo, pushing ECR tags, and deleting the repo afterwards all require the user's explicit go-ahead first.

**Shape** (Claude's call):
- **Repo.** Private repo `fubotv/llm-course-oidc-spike`, default branch `staging`.
- **Workflow.** One workflow, `.github/workflows/spike.yml`. It triggers on `push` to `staging` and on `workflow_dispatch`, with `permissions: { id-token: write, contents: read }`, and runs on `ubuntu-latest`.
- **Steps.** Every check step uses `continue-on-error: true`, so one run reports every check:
  1. `aws-actions/configure-aws-credentials@v4` with the role above, region `us-east-1`.
  2. `aws sts get-caller-identity`.
  3. `aws-actions/amazon-ecr-login@v2`, then `aws ecr describe-repositories --repository-names architect-builds/app`.
  4. Pull `public.ecr.aws/docker/library/busybox:latest`, retag it as `650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:oidc-spike-${{ github.run_id }}`, and push it.
  5. `aws eks list-clusters`.
  6. `aws eks update-kubeconfig --name <cluster>` for each candidate cluster. Candidates: `eks-staging-observability`, plus whichever cluster hosts the `training` namespace, as found by the user's laptop check below.
  7. `kubectl version`. This proves the API endpoint is reachable from a GitHub-hosted runner.
  8. `kubectl auth can-i create applications.app.smo.tools.fubotv.net -n training`.
  9. `kubectl auth can-i get deployments -n training`.
  10. Create, patch and delete a Secret under a throwaway name, the same way the real workflow will (Claude's call):
      - Create: `kubectl create secret generic llm-course-oidc-spike-openweather -n training --from-literal=OPENWEATHER_API_KEY=spike-dummy --dry-run=client -o yaml | kubectl apply -f -`.
      - Patch: the same command again, with `spike-dummy-2`.
      - Delete: `kubectl delete secret llm-course-oidc-spike-openweather -n training`.

      This proves the role can create and patch a Secret in `training`, which every learner workflow does for `<app-name>-openweather`. The value is a dummy, never a real key. If the delete fails, report it so the user can remove the Secret.
- **Laptop-side companion check** (read-only, the user's SSO, no approval needed): `kubectl config current-context`, to find the cluster that holds `training`. The CRD check is Stage 0c.

**Success criteria.** The evidence file records pass/fail and the exact output for each of the 10 workflow steps and each laptop check. The spike counts as "trust confirmed" only if steps 1–4 and 7–10 all pass. Delete the spike repo afterwards only with the user's approval.

**If the spike fails.** Stop. Do not start Stages 3b or 4. Stages 1, 2, 3a and 5 continue. Report to the user which way it failed (Claude's call): the trust policy rejected the repo (step 1), the EKS endpoint is private and unreachable from GitHub-hosted runners (step 7), or the role lacks Kubernetes RBAC in `training` (steps 8–10). Include the exact error text. No fallback track is prepared in advance.

## Stage 0c — CRD Secret-reference check

This is a read-only check from the user's laptop, using the user's SSO. It needs neither the spike nor the throwaway repo (Claude's call).
- `kubectl explain application.spec --api-version=app.smo.tools.fubotv.net/v1alpha1 --recursive`.
- `kubectl get secrets -n training`, names only.

Find whether `Application.spec` supports an env var sourced from a Secret: a `secretKeyRef`/`valueFrom`, `envFrom`, or an equivalent field. Record the exact field path in the evidence file.

If no such field exists, stop and ask the user before Stage 2's deploy step and before Stages 3b and 4. A literal env value would put the key into rendered YAML, and that is not allowed.

## Stage 1 — Test Architect and Decompose

**What.** Run the checks below. Record the results in the evidence file. Fix only defects that block a check from producing correct output for the weather spec in Stage 2. Document the rest, each with a repro command.

**Checks:**

- **T0 — resolve the environment first** (Claude's call).
  - Find the current EC2 hostname serving the landing page and the architect service. The user cites `ec2-100-58-203-210…`; `scripts/refresh-ec2-ecr-auth.sh` still defaults to `ec2-52-91-187-71…`. Record which one is live. Run the ECR refresh script with `EC2_HOST` overridden to the live host; do not edit the script.
  - Read the live nginx config (read-only) to find whether `/build/*`, `/deploy/*` and `/architect/build/*` are proxied to Flask. Record the result. It decides whether T6 needs a fix.
- **T1 — test suite.** `python -m pytest architect/tests -q` passes with zero failures. Record the pass count. The last recorded count was 212.
- **T2 — clean install.** In a fresh venv: `pip install -r architect/requirements.txt && python -c "import architect.webapp"` succeeds. This proves the PyYAML fix.
- **T3 — EC2 health and model.**
  - The EC2 service answers `/api/status` through the public nginx path.
  - The settings endpoint reports the provider and model actually in use (expected `gemma4:e4b`, `active_model_found: true`).
  - Check `architect/webapp.py`'s hardcoded `gemma3:12b` fallback list did not silently win.
  - If the provider is not what is configured, stop and fix provisioning. Do not retry intake.
- **T4 — intake through the public URL.**
  - Every `/api/send` response's `method` starts with `ollama:`; any `regex` fails the check.
  - The generated spec contains no auth requirement other than "none".
  - The POC phantom-auth fix (commit `2c5d40f`) still holds.
- **T5 — decompose through the public `/decompose/` page.**
  - The output contains a component that implements the weather lookup and no `Auth*` component.
  - `journalctl -u llm-architect.service` for the run window does not contain `[Decomposer] LLM extraction failed, falling back to regex`. The `/api/decompose` JSON does not expose the extraction method; the journal is the only signal.
- **T6 — Build page through the public URL.** `/architect/build`, `POST …/build/start` and `GET …/build/status` work from a browser. They must work through nginx, not only via SSH-local calls; a prior note says `/build/*` is not proxied. If they are not reachable publicly, that blocks the follow-along path and is fixed in Stage 1.
- **T7 — Deploy page through the public URL.**
  - `/deploy/render` returns YAML with `containerPort: 3000` and `healthcheck.path: /healthz`.
  - `/deploy/image-build` succeeds.
  - `/deploy/image-push` succeeds, after refreshing the ECR token with `scripts/refresh-ec2-ecr-auth.sh`.
  - `/deploy/apply` returns the `kubectl_missing` handoff. That handoff is by design and is not a failure.

**Known open issues** (document them; fix only if one blocks T4–T7):
- The decomposer's regex fallback treats any auth constraint as "build auth" and has no purpose → feature-component rule. File: `architect/decompose_patterns.py`.
- The live EC2 nginx config is not in git.
- EC2 (account 443514608959) and ECR/EKS (account 650127479436) are in different accounts. The pipeline therefore hands off a manual `kubectl apply`, and ECR push depends on the laptop-refreshed docker token.
- The "poll ingress" button cannot work over http because of Private Network Access.

**Before editing the live nginx config**, back it up on the box as `<file>.bak-<YYYYMMDD>` and copy it to the session scratchpad (Claude's call). Whether to commit the config to git is an open question.

**Blocking-fix procedure** (Claude's call): write a failing pytest under `architect/tests/` → `code-executor` fixes it → the full T1 suite passes → Opus review → ship to EC2 → restart the service once → re-run the affected checks.

**Success criteria.** T0 is recorded, and T1–T7 all pass and are recorded, each with date, command and output excerpt. Each known open issue is listed as fixed or still open, with a repro.

## Stage 2 — Real weather pipeline run

**App definition.** The user's description is "type a city, call OpenWeather, show the weather". Everything else in the contract below is Claude's call and is fed to intake as answers. It is not hand-written code.

**Intake answer sheet** (Claude's call; phase `poc`). Answer each channel as written:
- **Purpose.**
  - A "Hello, World!" weather page: an `<h1>Hello, World!</h1>` heading, a text input, a "Get weather" button, and a result area.
  - The input is prefilled with the default city `New York`, and on first page load the page shows New York's weather.
  - Submitting any city shows the city name returned by OpenWeather, the current temperature in °F, and the weather description.
  - An unknown city shows "City not found".
  - Success means real current weather for any valid city.
- **Data model.** None, no persistence.
- **API.**
  - `GET /` serves the HTML page.
  - `GET /api/weather?city=<name>` → 200 `{"city": str, "temp_f": number, "description": str}`.
  - Error responses: 400 `{"error": "city is required"}` if `city` is missing or empty; 404 `{"error": "city not found"}` when OpenWeather returns 404; 502 `{"error": "weather service unavailable"}` on any other upstream failure or a timeout; 500 `{"error": "OPENWEATHER_API_KEY not set"}` if the env var is absent.
  - Upstream call: `https://api.openweathermap.org/data/2.5/weather?q=<city>&appid=<key>&units=imperial` with a 5s timeout.
- **Tech stack.** Python 3.12, Flask, `requests`, a single service (Claude's call: the Python shim and port-3000 path were last verified end to end on 2026-08-06; pytest suits Part 5).
- **Auth.** None: a public PoC with no login and no sessions.
- **Deployment.** The fubo platform, `training` namespace, through the architect Deploy stage. Config comes from the env var `OPENWEATHER_API_KEY`, which is never hard-coded.
- **Error handling.** As in the API channel.
- **Performance.** No targets beyond the 5s upstream timeout.
- **Security.** The key is read from `os.environ` only and is never logged, returned in a response, or rendered into the page.
- **Testing.** pytest, with `requests.get` mocked. No real network calls in tests.

**Key injection into the pod.** The key is never in generated code. The builder already writes `OPENWEATHER_API_KEY=` to `.env.example` (see `assemble_project()` in `architect/builder.py`). The pod gets the value from a K8s Secret through the CRD's Secret-reference field, which Stage 0c confirms. This deploy does not depend on the OIDC spike: it uses the existing architect Deploy path and the `kubectl` handoff to the user's laptop (Claude's call). If Stage 0c fails, Stage 2's deploy step does not start until the user answers. Intake through Build can proceed regardless.
- The worked-example deploy uses the Deploy page's existing custom-template upload (Claude's call). The template is the default one plus a Secret reference to `{{name}}-openweather` / `OPENWEATHER_API_KEY`. `render_yaml_text()` substitutes `{{name}}` everywhere, so the reference resolves to `<spec_slug>-<run_short>-openweather`.
- After rendering, and before running the handed-off apply, the user creates that Secret in `training` from their laptop. The user types their own key value at implementation time, and it is never written down. The worked example's Secret is separate from every learner's.
- `architect/templates/deploy_template.yaml` itself stays unchanged.
- Learners' apps never use the instructor's key. Each learner workflow writes the learner's own key into that app's `<app-name>-openweather` Secret (Stage 4).

**Run procedure:**
1. Stage 1 fixes are shipped and the service has been restarted once.
2. Refresh the ECR token.
3. On the public `/architect/` UI: run intake with the answer sheet, then Spec, then Decompose, then Build.
4. On the Deploy page: render (custom template), then image build, then image push, then apply. Apply returns the handoff.
5. The user creates the `<spec_slug>-<run_short>-openweather` Secret and then runs the handed-off `kubectl apply`, both from their laptop.
6. Wait for DNS.
7. Verify (see success criteria).

Screenshots to capture at the relevant steps: the intake dashboard, the dense spec, decompose with the spec loaded, the wave plan, the build UI on completion, the rendered Deploy page YAML, the manual-apply handoff, and the live app in a browser showing weather for a typed city other than the default (Claude's call: `Chicago`). Also capture the text artifacts: the dense spec, the build package, the build event log, the docker build/push logs, the `kubectl apply` output, and the curl output.

**If the generated handler is a stub** (placeholder JSON or the fallback page) **or decompose fell back to regex**, the run has failed:
- Do not hand-edit generated code for the worked example (Claude's call).
- Instead, tighten the intake answers, or fix the generator through the Stage 1 blocking-fix procedure, then do a fresh intake run.
- Allow at most 3 fresh runs (Claude's call). If the third also fails, stop and report honestly to the user what failed in each run, citing run ids. Do not dress up a partial result as success.
- Slides use the successful run only. Failed attempts are recorded in the evidence file and reported to the user (Claude's call).

**Success criteria.**
1. Every run has a recorded `run_id`.
2. Decompose produced a weather component, no `Auth*` component, and no regex fallback in the journal.
3. `curl -s https://<host>/api/weather?city=Chicago`, run from the user's laptop, returns 200 with `city`, `temp_f` and `description`. A direct OpenWeather call for Chicago made within 60 seconds of it returns the same `description` and a temperature within ±2°F. Both outputs are recorded, with the key redacted.
4. `curl -s https://<host>/` returns HTML that contains the input and the "Get weather" button, not only the shim's fallback `Hello, World!` page.
5. `curl -s https://<host>/api/weather?city=zzzznotacity` returns 404.
6. No file in the workspace contains the key value. Check with `grep -r` against the value, run locally and not recorded.

If the generated app exposes different route paths than the answer sheet asks for, the run is still valid only if criteria 3–5 hold on the real paths. Record those paths in the evidence file; Stages 3 and 4 use them.

## Stage 3 — Part 4 update

Stage 3 is split in two (Claude's call). **3a, the worked-example slide refresh,** depends only on Stage 2 and does not wait on the spike. **3b, the follow-along path,** starts only after Stage 0b and Stage 0c have both passed. If the spike fails, 3a still ships on its own, and Part 4 then has no follow-along slides until the user decides.

### 3a — Worked example

Replace every worked-example reference with the real weather run. Slide ids stay the same wherever a slide's role is unchanged, so assessment `slideRef`s keep resolving (Claude's call).

**Slide changes:**

| Slide | Change |
| --- | --- |
| `s4a` | New intake dashboard screenshot. |
| `s4b` | `SAMPLE_SPEC_HIGHLIGHT` becomes a real excerpt of the dense spec. The intro is rewritten. |
| `s4c` | New screenshot. |
| `s4d` | New screenshot. The title uses the real component, wave and time-savings numbers. The caption describes the real waves. |
| `s4` | The build-package excerpt becomes the real package, trimmed the way the current one is. |
| `s6` | New screenshot. The caption uses the real component names, build time and model. |
| `s7` | Content lives in `DeployFlow.jsx`. Replace the Quote transcript with the real render, build, push, apply and poll output. Keep the same 5-stage structure. |
| `s8` | New screenshot. The caption describes the real run. It points out that the rendered YAML names the app's own Secret, `<app-name>-openweather`, and contains no key value, and that in the worked example the instructor created that Secret by hand. |
| `s8b` | New screenshot. |
| `s8c` | New live-app screenshot; the image import is renamed to `weatherAppLiveImg`. The caption states the real result, including the curl comparison. |
| `s10` | Rewritten from foreshadowing into payoff. The code reads `os.environ`, and `.env.example` documents the variable. The value reaches the pod from the app's own cluster Secret, `<app-name>-openweather`, so it is never in code or YAML. In the worked example the instructor creates the Secret by hand. In the follow-along, each learner's own key goes from a GitHub repo secret into their app's Secret at deploy time. |
| `s15` | Becomes the entry slide of the follow-along section. |

**Screenshot files** (Claude's call): overwrite the existing screenshot files in place under the same filenames: `architect-dashboard.png`, `decompose-spec-loaded.png`, `decompose-wave-plan.png`, `build-ui.png`, `deploy-ui.png`, `deploy-manual-apply.png`. Add `weather-app-live.png`. Delete `quote-app-live.png`, which this change orphans.

**Other components.** In `PipelineFlow.jsx`, replace the task-tracker sample text and the `hello-world-abc123` names and host with the real run's values. In `BuildFlow.jsx`, change the `spec_slug` comment to the real slug.

**Left unchanged.** `DeploymentStack.jsx` is generic and stays as it is. `WaveGridReplay.jsx` and `wave-trace.js` are imported but not used by any slide; that is pre-existing dead code, so mention it but do not remove it.

**Assessment** (`module4/src/data/assessment-questions.json`):
- Rewrite A1–A5 against the real decompose numbers. A3 keeps its point, the naive versus complexity-weighted time-savings formula, but uses the real figures. If the real plan gives no gap between the two formulas, replace A3 with another wave-plan mechanism question.
- Rewrite B2 against the real wave and component names.
- Rewrite the explanations of C2 and C5 to use the real names, host and result.
- The question count stays 15, 5 per section, with the pass threshold of 11. Every number in a question must match the evidence file.
- Update the `s18` dead `body` string only if the section names change.

### 3b — Follow-along path (learners build their own)

**Deploy route** (Claude's call; valid because Stage 3b runs only after the spike has passed):
- Learners deploy through the self-contained workflow in their own repo, triggered by their first push to `staging`.
- They do not deploy through the Deploy page's `kubectl` handoff, because learners have no cluster credentials and the EC2 host has no cluster access.
- Part 4 presents the workflow as "your deploy agent" without dissecting it. Part 5 dissects and exercises it.

**New architect route** (Claude's call): `GET /build/download?run=<run_id>`:
- `run` must match `^[0-9a-f]{12}$`; otherwise it returns 400 `{"error": "invalid run id"}`.
- A missing workspace returns 404 `{"error": "Workspace not found: <run_id>"}`.
- Otherwise it returns `application/zip` as an attachment named `<spec_slug>-<run_short>.zip`. The zip holds every file under the workspace except top-level names starting with `_` (`_status.json`, `_package.yaml`) and any `__pycache__/` directory, with paths relative to the workspace root.
- `architect/templates/build.html` and `architect/static/build.js` show a "Download workspace (.zip)" link when the build completes. It uses the existing `window.PFX` prefix.
- Tests go in `architect/tests/test_build_download.py`: the zip contents and the exclusions, the 404, the 400 for `../etc`, and the 400 for a non-hex id.
- The route must be reachable through public nginx. That ties to T6.

**Kit files**, served statically from `module4/public/follow-along/`, which becomes `/part4/follow-along/…` (Claude's call):
- `deploy.yml`: the workflow, specified in Stage 4. It is authored here because the follow-along's first deploy uses it.
- `app.yaml`: the Application manifest with placeholders `__APP_NAME__`, `__IMAGE__` and `__HOST__`. It has `namespace: training`, `containerPort: 3000` and `healthcheck.path: /healthz`, a Secret reference to `__APP_NAME__-openweather` / `OPENWEATHER_API_KEY` using the field path recorded by Stage 0c, and the `ingress` block copied verbatim from `architect/templates/deploy_template.yaml`. The ingress is internal, with no ssl-redirect or TLS annotations added.
- `test_health.py`: loads `src/app.py` through `importlib` with `src/` on `sys.path`, and asserts that `app.test_client().get("/healthz")` returns 200.
- No kit file contains a key value or a key-shaped string. The kit only ever refers to `${{ secrets.OPENWEATHER_API_KEY }}` and the Secret name.

**Naming.** Decided by the platform owners: one Application per learner in the shared `training` namespace, named `llm-wx-<login>`. The remaining details are Claude's call:

| Item | Value |
| --- | --- |
| Repo | `fubotv/llm-wx-<github-login>`, lowercase, private, with `staging` as the only and default branch |
| Application name | the repo name, `llm-wx-<github-login>` |
| Host | `llm-wx-<github-login>-training.tools.fubotv.net`. This follows the existing `<name>-<namespace>.tools.fubotv.net` pattern from `_resolve_deploy_fields()` in `architect/webapp.py`. A 39-character GitHub login gives a 55-character DNS label, under the 63-character limit. |
| Image | `650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:<app-name>-<short-sha>` |

**New slides**, inserted after `s15` and before `s16` (Claude's call):

| Slide | Content |
| --- | --- |
| `s15` | "Follow Along: Build Your Own". Prerequisites: a GitHub account in the fubotv org with repo-create access (the user has verified that learners have view and create access), git, and Python 3.12. Every learner can reach `*-training.tools.fubotv.net`. |
| `s15a` | Get your own free OpenWeather key (decided). Sign up at OpenWeather and copy the key from the account's API keys page. Warn that new keys can take a while to activate and return 401 until then, so do this step first. Verify with `curl -s "https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY"`, with the key exported in your shell and not pasted into any file. Expect a 200 JSON body containing `"name":"London"`; a 401 means the key isn't active yet. Never commit the key and never put it in a file in the repo. |
| `s15b` | Run intake yourself. Shows the Stage 2 answer sheet verbatim. |
| `s15c` | Spec → Decompose → Build; note your run id. |
| `s15d` | Download your workspace zip. |
| `s15e` | Create your repo. Add `.github/workflows/deploy.yml`, `deploy/app.yaml` and `tests/test_health.py` from the kit. Add the repo secret `OPENWEATHER_API_KEY` (Settings → Secrets and variables → Actions) with your key. Push to `staging`. |
| `s15f` | Watch the Actions run go green. Screenshot from the instructor's rehearsal repo, with no key visible. |
| `s15g` | Verify with curl and a browser. Include a "looks like success but isn't" checklist: the fallback Hello World page, a stub JSON response, an old image tag, and the 500 "OPENWEATHER_API_KEY not set" error. |

**Instructor rehearsal.** The rehearsal repo `fubotv/llm-wx-<user-login>` is outward-facing: ask before creating it. The instructor walks the follow-along path once, end to end, and the rehearsal supplies the `s15f`/`s15g` screenshots. The user enters their own key as that repo's secret themselves.

**Success criteria.** Criteria 1–6 and 9 gate 3a. Criteria 7, 8 and 10 gate 3b; after 3b, criteria 1, 3 and 5 are re-run because 3b adds slides.
1. `module4`: `npm run build` and `npm run lint` pass clean.
2. `grep -rniE "quote of the day|quote-of-the-day|/quote|quoteApp|quote-app|d9331c|task tracker|team-task-tracker|hello-world-abc123" module4/src` returns nothing, except inside `WaveGridReplay.jsx` and `wave-trace.js`. Those are untouched dead code and must be listed in the stage report.
3. Every `slideRef` in `assessment-questions.json` matches an `id` in `SLIDES`. Check with a one-off `node -e` script; output recorded.
4. The bank holds exactly 15 questions, 5 per section, and every number in it matches the evidence file.
5. A manual (or Playwright) click-through from `s0a` to the last slide renders every slide without console errors. Reaching the last slide writes `{"__v":2,"part4":...}` into `llm_course_progress`.
6. On the landing page, `part5` still shows Admin Locked when `/api/analytics/locks` returns `{part5: true}`.
7. `/build/download` tests pass. The full `architect/tests` suite passes.
8. The instructor rehearsal deploys through the workflow. The live rehearsal URL returns real weather by the same check as Stage 2 criterion 3.
9. The landing `MODULES` entry for `part4` keeps `id` and `path`, and its `slides` field is updated to the real count (Claude's call: the field is unused by `render()`, but `18` is already wrong).
10. No key value is committed in any learner kit file. Concretely:
    - `grep -rnE "[0-9a-f]{32}" module4/public/follow-along/` returns nothing (OpenWeather keys are 32 hex characters).
    - The same grep across the rehearsal repo's full git history (`git log -p`) returns nothing.
    - The `s15a`/`s15e`/`s15f` slide copy and screenshots show no key value.

## Stage 4 — Part 5 redesign

This stage starts only after Stage 3b, and after Stage 0b and Stage 0c have both passed (Claude's call). Part 5 is fully built, but its admin lock is not changed (Claude's call). Lifting the lock stays the user's call.

**Home** (Claude's call): rebuild Part 5 inside `testing-with-llms/`. It already has `base: '/part5/'`, `__LLM_MODULE_ID__ = 'part5'` and a `markPartComplete()` that writes `part5`, so the unlock-gate wiring does not move.

Port `CheckpointPipeline.jsx` and `OwnershipModel.jsx` from `cicd-with-llms/src/components/` by copying them. Both are self-contained and import only React. `cicd-with-llms/` itself is left untouched and unlinked.

**Kept, cut, changed** (Claude's call):
- **Kept and re-pointed** to the real app (real routes, component names and OpenWeather; every api.weather.gov, typewriter, 15-cities and `CitySelector` reference removed): `HappyPathFallacy`, `UnitTestExplorer`, `FunctionalTestViz`, `CheckpointPipeline` (re-pointed to the real workflow jobs: test → build → push → apply → rollout check).
- **Kept as is:** `OwnershipModel`.
- **Rewritten:** `TestingQuiz`.
- **Cut:** `E2ETestRunner` and `LoadTestDashboard`. The loop runs neither. Delete both files, since this change orphans them. A single text slide names E2E and load testing as deliberately out of the loop.
- **Not ported:** `LoggingAlertingViz`, `SpeedSafetyLitmus`, `CICDQuiz`.
- **Labelling.** Simulated components get "Illustrative" in their slide `instructions`. Captured output appears only on slides that say "real".

**Renderer.** Add one optional `code` field to `TextSlide`, rendered as a monospace `<pre>` after `body` (Claude's call). Text slides already support `image` and `imageCaption`.

**The change the learner makes** (Claude's call). The learner picks one path. Each is given as a short dense change-spec for the learner to hand to their LLM:
- **Path A:** change the default city (`New York`) to a city of the learner's choice.
- **Path B:** add a °F/°C toggle, i.e. a `units` query param on `/api/weather` (`imperial` default, `metric` alternative) and a toggle on the page. The response field becomes `temp` plus `units`.

Each path requires at least one positive test and one negative test, with OpenWeather mocked. This applies the Happy Path Fallacy lesson.

**Workflow** (`deploy.yml`; Claude's call; self-contained, with no `uses:` of `fubotv/smo-cicd-pipeline` and no ArgoCD or Helm; `fubotv/student-agent`'s `main.yml` is a style reference only):
- **Triggers:** `push` to `staging`, `pull_request` to `staging`, and `workflow_dispatch`.
- **Permissions:** `{ id-token: write, contents: read }`.
- **Concurrency:** `group: deploy-${{ github.repository }}`, `cancel-in-progress: false`.
- **Job `test`** (all events): checkout; `actions/setup-python@v5` with 3.12; `pip install -r requirements.txt pytest`; `python -m pytest -q`. Exit code 5 (no tests collected) fails the job; that is strict on purpose.
- **Job `deploy`** (`needs: test`, `if: github.event_name != 'pull_request'`):
  0. **Key presence check**, the first step of `deploy`. With `env: OPENWEATHER_API_KEY: ${{ secrets.OPENWEATHER_API_KEY }}`, fail immediately with "repo secret OPENWEATHER_API_KEY is not set" if the value is empty. Never print it.
  1. `configure-aws-credentials@v4` with the OIDC role and `us-east-1`.
  2. `amazon-ecr-login@v2`.
  3. `docker build --platform linux/amd64` and push of the image described in Stage 3b.
  4. `aws eks update-kubeconfig --name <cluster from Stage 0b>`.
  5. **Create or update this app's K8s Secret.** The workflow copying the key into the cluster at every deploy is the user's decision; the per-app name is Claude's call. Run `kubectl create secret generic <app-name>-openweather -n training --from-literal=OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY" --dry-run=client -o yaml | kubectl apply -f -`, with the key passed only through the step's `env` from `${{ secrets.OPENWEATHER_API_KEY }}`. No `set -x`, no echo, and the generated Secret YAML is never written to a file or printed (Claude's call).
  6. Render `deploy/app.yaml` by `sed` replacement of the three placeholders: app name = repo name, host as in Stage 3b, image = the pushed tag.
  7. `kubectl apply -f`.
  8. `kubectl rollout status deployment/<app-name> -n training --timeout=180s`. The operator names the Deployment after the Application, as the real transcript in `DeployFlow.jsx` shows.
  9. Assert that `kubectl get deployment <app-name> -n training -o jsonpath='{.spec.template.spec.containers[0].image}'` equals the pushed image. If not, fail with "deployed image is stale".
- **No HTTP probe from the runner.** The workflow does not poll the live URL. The training hosts are internal; learners can reach them, but GitHub-hosted runners are outside the network. The learner checks the URL from their own machine.
- **Visible logs.** Log every step's command except the Secret step's literal. Never echo credentials or the key.
- The same `deploy.yml` is the Stage 3b kit file. Part 4's follow-along and Part 5 run one identical workflow.

**Slides** (Claude's call; ids in the existing string style):
1. `p5-title`
2. `p5-where` — your app is live; real screenshot
3. `p5-loop` — change → test → PR → merge → workflow → verify
4. `p5-green-not-working` — Part 4's 200 is not correctness
5. `HappyPathFallacy` component
6. `p5-choose-change` — Paths A and B
7. `p5-spec-the-change` — density applied to a diff
8. `p5-unit` — mocking OpenWeather; real test code from the rehearsal
9. `UnitTestExplorer` component
10. `p5-functional` — Flask test client
11. `FunctionalTestViz` component
12. `p5-not-running` — E2E and load testing named and deferred
13. `p5-branch-pr` — real screenshot of PR checks
14. `p5-workflow` — the real `deploy.yml` in `code`, including how the repo secret `OPENWEATHER_API_KEY` becomes the app's K8s Secret `<app-name>-openweather` without ever being committed or printed
15. `p5-oidc` — AWS access with no stored AWS credentials
16. `CheckpointPipeline` component
17. `p5-merge-run` — real screenshot of the green run
18. `p5-verify` — real curl plus screenshot, and the image-tag check
19. `p5-stale` — failure that looks like success
20. `OwnershipModel` component — you own the repo and workflow; the platform owns the cluster and role
21. `p5-lab` — single-slide checklist
22. `p5-takeaways`
23. `quiz-intro`
24. `quiz` — `TestingQuiz`
25. `p5-end` — "Course Complete". This stays the last slide so the existing last-slide `markPartComplete()` and `__LLM_AT_LAST_SLIDE__` logic is untouched.

**`TestingQuiz` changes.** Keep the mechanics; replace `SECTIONS` and `QUESTIONS`:
- 15 questions in 3 sections of 5: "Testing the Change", "The Staging Workflow", "Verifying & Owning It" (Claude's call). The pass threshold stays 11/15.
- Update the certificate body text.
- Every question that cites the workflow, the tests or the run must match the real files and the evidence file.

**Landing.** Update the `part5` `desc` to match the new content and `slides` to the real count (Claude's call). Do not change `id`, `path` or the admin lock.

**Success criteria:**
1. `testing-with-llms`: `npm run build` and `npm run lint` pass clean.
2. `grep -rniE "weather\.gov|typewriter|CitySelector|15 (US )?cities|localhost:517" testing-with-llms/src` returns nothing.
3. The quiz has exactly 15 questions, 5 per section.
4. A local click-through with `npm run dev` renders every slide. `flow-through.js` is not served by Vite dev, so the admin lock does not interfere. Reaching `p5-end` writes `part5`.
5. **The loop, demonstrated for real** in the instructor rehearsal repo:
   - a feature branch with a Path B change and its tests;
   - a PR into `staging` whose `test` job is green and whose `deploy` job is skipped;
   - a merge, after which the `deploy` job is green, including the stale-image assertion;
   - a curl from the user's laptop showing the change. For Path B, `?units=metric` returns `units: "metric"` and a Celsius value consistent with a direct OpenWeather metric call, within ±1°C.

   The workflow run URLs and the curl output are recorded in the evidence file.
6. A deliberately failing test pushed to a PR blocks that PR: the `test` job goes red and `deploy` does not run. This is recorded.
7. No file in the rehearsal repo, and nothing in its git history, contains the key value. The grep check is the same as Stage 3b's criterion 10.
8. The workflow log of the green deploy run contains no key value; GitHub's masking shows `***` if it is ever referenced. A `workflow_dispatch` run with the repo secret temporarily removed fails at step 0 with the "not set" message. Both results are recorded.
9. After the deploy, `kubectl get secret <app-name>-openweather -n training` exists, and no other app's Secret was modified. It is checked by name only; the value is never decoded or printed.
10. The landing page still shows `part5` as Admin Locked.

## Stage 5 — Refresher module

**What.** A new standalone Vite/React app in `refresher/` (`base: '/refresher/'`, dev port 5180; Claude's call). It is self-directed, retakeable and scored, and it covers Parts 1–3. It is outside the learning path:
- no certificate;
- no use of `localStorage` at all, so it never reads or writes `llm_course_progress` (Claude's call: no storage of any kind);
- it does not set `__LLM_MODULE_ID__` and does not load `/flow-through.js` (Claude's call: no gate, no completion bar, no analytics events);
- no effect on the unlock chain.

**Format** (Claude's call):
- 24 MCQs, 8 per Part. Questions are grouped by Part in order 1 → 2 → 3, and order is shuffled within each Part.
- Each question has 4 options, shuffled with Fisher–Yates and the answer index remapped, the same as the Module 4 assessment.
- The flow per question is select → Reveal → explanation of at most 40 words → Next. Target time is 10–15 minutes.
- The "ready" threshold is 18/24 (75%).

**Results screen** (Claude's call):
- Score and percentage.
- A verdict: "Ready for Parts 4 & 5" at 18 or more, otherwise "Review recommended".
- A per-Part breakdown table, `n/8` per Part. Any Part under 6/8 is flagged "Review".
- A list of every missed question, shown whenever at least one question was missed, not only on a low score. Each entry shows the question, the correct answer, and "Review: Part N — Slide S: <slide title>", with a link to `/partN/`.
- A "Retake" button that rebuilds a freshly shuffled sequence.

**Deep linking.** This was verified to be impossible. Every Part app keeps its slide index in `useState(0)` and reads no URL hash or query (`presentation/src/App.jsx`, `working-with-llms/src/App.jsx`, `context-and-sessions/src/App.jsx`). So links go to the Part only, and the slide number and title are shown as text. Do not add deep-linking, since that would change Parts 1–3.

Links use no `?nogate` (Claude's call). A learner who has not unlocked that Part is redirected home by `flow-through.js`. The results screen shows "(requires Part N unlocked)" beside each link.

**Question bank** (`refresher/src/data/refresher-questions.json`):
- Shape: `{ "version": 1, "questions": [ { "id": "P1-1", "part": 1, "term": str, "review": { "slideNumber": int, "slideTitle": str }, "q": str, "options": [4 × str], "answer": 0-3, "explanation": str } ] }`.
- Questions are drawn and adapted from `presentation/src/components/EngineeringProfQuiz.jsx`, `working-with-llms/src/components/WorkingWithQuiz.jsx` and `context-and-sessions/src/data/assessment-questions.json`, but aimed at vocabulary Parts 4–5 use.

Topic targets, 8 per Part (Claude's call):

| Part | Topics |
| --- | --- |
| Part 1 | self-attention (Q/K/V), attention dilution, context density, feature activation (vague vs. specific tokens), sampling defaults, hallucination vs. confabulation, confidence ≠ correctness, fluency ≠ reasoning |
| Part 2 | density principle, the 10 channels, Architecture Agent intake → dense spec, density score, vague vs. dense results, token grounding categories, run-to-run consistency, agentic pillars (monitoring, configurability, predictability) |
| Part 3 | effective vs. advertised context, lost-in-the-middle, context ≠ prompt, attention budget, prompt vs. context engineering levers, dense spec → wave plan (decompose, waves), sealed agent sessions, session hygiene |

Every `review.slideTitle` must be a real slide title in that Part's source. Every `slideNumber` is its 1-based position in that Part's slide array, confirmed by clicking through, with the result recorded.

**Files and structure** (Claude's call):
- `package.json` with the same dependency versions as `context-and-sessions` (React 19, Vite 8, ESLint 9, `eslint-plugin-react-hooks` 7, Vitest 2, jsdom 25, `@testing-library/react` 16, `@testing-library/jest-dom` 6), but without three.js, recharts or jspdf.
- `vite.config.js` with the Vitest jsdom config.
- `eslint.config.js` copied from `context-and-sessions`.
- `index.html`.
- `src/main.jsx`.
- `src/App.jsx`, the state machine `intro → quiz → results`, with the sequence built in a lazy `useState` initialiser.
- `src/lib/scoring.js`, pure functions: `score(sequence, answers)`, `breakdownByPart(...)`, `missedQuestions(...)`, `isReady(score)`.
- `src/test-setup.js`.
- Tests:
  - `src/lib/scoring.test.js`.
  - `src/data/bank.test.js`: exactly 24 questions, 8 per Part, unique ids, 4 options, an answer in range, and each `slideTitle` found as a string in that Part's source file, read from disk. The source files are `presentation/src/App.jsx`, `working-with-llms/src/App.jsx` and `context-and-sessions/src/slides.jsx`.
  - `src/App.test.jsx`: a full run-through. It spies on `Storage.prototype.getItem`, `setItem` and `removeItem` and asserts zero calls. It asserts per-Part rows, review links with `href` `/part1/`, `/part2/` and `/part3/`, a missed list that matches the wrong answers, and that Retake resets the state.
  - A test that `grep` finds no `llm_course_progress`, `flow-through` or `__LLM_MODULE_ID__` in `refresher/src` or `refresher/index.html`.

**Landing card.** In `deploy-landing/index.html`, add a static section with id `refresherSection` and the existing `.tools-section` styling, placed between the module grid and `#toolsSection`. It has the label "Before Parts 4 & 5 — Optional Refresher" and one `.tool-card` anchor with id `refresherCard`, `href="/refresher/"`, title "Parts 1–3 Refresher" and a one-line description stating that it is not part of course progress (Claude's call). The `MODULES` and `TOOLS` arrays, `render()` and the gate logic are unchanged.

New Playwright spec `deploy-landing/tests/e2e/refresher-card.spec.js`:
- `#refresherCard` is visible with `href` `/refresher/`;
- it is not a descendant of `#moduleGrid`;
- `.module-card` count is still 5;
- the existing `landing-renumber.spec.js` tests still pass unchanged.

**Deployment.** Build `refresher/dist` and place it beside the other Part apps on EC2, using the same mechanism they use (discover it on the box; the prior plan notes `/var/www/llm-course/`). Confirm that `curl -I http://<landing-host>:8080/refresher/` returns 200 and that a hashed asset under `/refresher/assets/` returns 200. If nginx needs a new location, follow the Stage 1 backup rule.

**Success criteria:**
1. `refresher`: `npm run build`, `npm run lint` and `npm test` all pass.
2. Exactly 24 questions, 8 per Part.
3. Every missed question maps to a real Part and slide title (by test), and every slide number was checked manually and recorded.
4. The test proves zero `localStorage` access.
5. A timed self-run takes 10–15 minutes.
6. The landing page shows the card outside the chain; the Playwright suite (old and new specs) passes; and with a progress state of `{part1:true}` the unlock behaviour is identical to before: part2 is unlocked, part3 is locked, and part5 is admin-locked.

## Overall success criteria

1. The Architect and Decompose checks T1–T7 are recorded in the evidence file, with the remaining known issues documented.
2. The live weather URL returns real weather for a chosen city, with curl evidence and a direct OpenWeather comparison (Stage 2, criteria 3–5).
3. Part 4 builds and lints clean, its slide refs resolve, no Quote of the Day (or other stale-example) references remain, the assessment builds, and the unlock gate behaves as before (3a). If the spike passed, the follow-along rehearsal also deployed (3b).
4. If the spike passed: the Part 5 loop has been demonstrated for real: a city or feature change merged to `staging` → workflow green → live URL reflects the change. A failing test blocks the PR.
5. The Refresher builds, lints and tests clean; has exactly 24 questions; maps every miss to a real Part; and never touches `llm_course_progress`. The landing card sits outside the chain and the chain is unchanged.
6. No key value (neither the instructor's nor a learner's) appears in git history, committed files, learner kit files, screenshots, workflow logs or the evidence file.

## Files

| Path | Action |
| --- | --- |
| `docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md` | **Created** (Claude's call). Run ids, commands, outputs (key redacted), check results, failed-run notes, OIDC spike results, real route paths. |
| `architect/webapp.py` | **Edited**: the `/build/download` route, plus any Stage 1 blocking fixes. |
| `architect/templates/build.html`, `architect/static/build.js` | **Edited**: the download link. |
| `architect/tests/test_build_download.py` | **Created**. |
| `architect/*` (other) | Only Stage 1 blocking fixes, each with a test. |
| `architect/templates/deploy_template.yaml` | **Unchanged**. |
| `module4/src/App.jsx` | **Edited**: slides as listed, `s15`–`s15g`, image imports. |
| `module4/src/components/DeployFlow.jsx`, `PipelineFlow.jsx`, `BuildFlow.jsx` | **Edited**: real-run content. |
| `module4/src/data/assessment-questions.json` | **Edited**: A1–A5, B2, C2/C5 explanations. |
| `module4/src/assets/screenshots/*.png` | **Overwritten** as listed; `weather-app-live.png` **created**; `quote-app-live.png` **deleted**. |
| `module4/public/follow-along/deploy.yml`, `app.yaml`, `test_health.py` | **Created**. |
| `testing-with-llms/src/App.jsx` | **Rewritten** slide list; `code` field on `TextSlide`; updated `COMPONENT_MAP`. |
| `testing-with-llms/src/components/HappyPathFallacy.jsx`, `UnitTestExplorer.jsx`, `FunctionalTestViz.jsx`, `TestingQuiz.jsx` | **Edited**. |
| `testing-with-llms/src/components/CheckpointPipeline.jsx`, `OwnershipModel.jsx` | **Created** (copied from `cicd-with-llms/src/components/`, then the former edited). |
| `testing-with-llms/src/components/E2ETestRunner.jsx`, `LoadTestDashboard.jsx` | **Deleted**. |
| `testing-with-llms/index.html` | **Unchanged** (`part5` id stays). |
| `cicd-with-llms/` | **Unchanged**. |
| `refresher/` (whole app) | **Created**. |
| `deploy-landing/index.html` | **Edited**: refresher section, plus `desc`/`slides` for part4/part5. |
| `deploy-landing/tests/e2e/refresher-card.spec.js` | **Created**. |
| `deploy-landing/flow-through.js` | **Unchanged**. |
| `presentation/`, `working-with-llms/`, `context-and-sessions/` | **Unchanged**. |
| EC2: Part app docroot, nginx (only if needed, with backup). K8s Secrets `<app-name>-openweather` in `training`, one per app: the worked example's is created by the user; each learner app's is created or updated only by that learner's workflow. | Live changes, outside git. |

## Out of scope

- Any change to Parts 1–3 content or code, including deep-linking.
- A certificate, progress write or unlock effect for the Refresher.
- ArgoCD, Helm, or the shared `fubotv/smo-cicd-pipeline` reusable workflow in Part 5.
- Changing the Part 5 admin lock or `/api/analytics/locks`.
- Fixing known architect issues that don't block the weather run, such as the regex fallback, the cross-account gap, the poll-ingress Private Network Access block, and the TypeScript template gap.
- E2E (browser) and load testing in the Part 5 loop.
- Cleanup or pruning of old per-run Applications in `training`.
- Removing pre-existing dead code (`WaveGridReplay.jsx`, `wave-trace.js`, unused screenshots, `building-with-llms/`, `deploying-with-llms/`).
- Committing anything without the user's instruction.

## Open questions / risks

1. **OIDC trust is untested.** The role may not trust arbitrary `fubotv` repos, or may restrict `sub` to particular branches or repos. Stages 3b and 4 are gated on the spike; Stages 2 and 3a are not. If it fails, the failure mode is reported to the user and nothing is built on it.
2. **Cluster access from Actions with only OIDC.** The shared pipeline is GitOps (it commits Helm values and never runs `kubectl`), so there is no evidence that the OIDC role has any Kubernetes RBAC, an EKS access entry, or rights to create or patch Secrets in `training`. The EKS API endpoint may also be private, and so unreachable from GitHub-hosted runners. Spike steps 7–10 decide. If they fail, the remedy (an access entry, self-hosted runners, or another route) is a user or platform decision.
3. **Which cluster hosts `training`.** It is not confirmed that it is `eks-staging-observability`. The Stage 0b laptop check (`kubectl config current-context`) decides.
4. **How the build package supplies the workflow file and env var.** This design chooses static kit files served from Part 4 (Claude's call) and leaves the architect generator unchanged. The alternative, having the builder emit `.github/workflows/deploy.yml` and `deploy/app.yaml` into every workspace, needs the user's decision if preferred.
5. **The platform approval may not cover Secrets.** The platform owners approved one Application per learner in `training`. Confirm with them that this also covers one Secret per learner app (`<app-name>-openweather`), created and patched by that learner's workflow, before learners are told to run the follow-along.

    Namespace-scoped Secret RBAC would technically let any learner's workflow modify any Secret in `training`. Keeping apps apart relies on each workflow touching only its own `<app-name>-openweather`; Stage 4 criterion 9 checks this in the rehearsal.
6. **New OpenWeather key activation lag.** New free keys can return 401 for a while after creation. Learners do the `s15a` verification curl first. The instructor validates their key with a direct call before Stage 2.
7. **ECR token TTL.** The EC2 push depends on a laptop-refreshed 12-hour docker token. This affects only the worked example's Deploy-page push. The follow-along deploy pushes through OIDC and needs only the Build page and download on EC2.
8. **Generated-code quality.** Small local models have produced stub handlers before. Up to 3 fresh runs are budgeted, then an honest report to the user.
9. **Committing the live nginx config to git.** This is the user's call.
10. **Whether to lift the Part 5 admin lock.** This is the user's call. Part 5 is built with the lock unchanged.

## Changes after review

- **Internal ingress, decided.** The training hosts are internal and every learner can reach them. Internal ingress, no ssl-redirect or TLS annotations. The VPN and external-ingress hedging and the network-access risk were removed.
- **Per-learner naming, decided.** Platform owners approve one Application per learner in `training`, named `llm-wx-<login>`. The naming/namespace verification risk was removed.
- **Per-learner OpenWeather keys, decided.** Each learner gets their own key. Changes that follow from this:
  - new Part 4 prerequisite slide `s15a` with an activation warning and a verification curl; the follow-along slides were renumbered `s15b`–`s15g`;
  - the learner stores the key as the repo secret `OPENWEATHER_API_KEY`;
  - the workflow creates or updates a K8s Secret holding the key at deploy time (new steps 0 and 5);
  - the `s8`/`s10` copy intent was updated;
  - the shared-key rate-limit risk was removed;
  - new no-key-committed checks: Stage 3 criterion 10 and Stage 4 criteria 7–9.
- **Per-app Secret name** (Claude's call; it was never the user's decision). Each app gets its own Secret, `<app-name>-openweather`, created and patched only by that app's workflow. The worked example has its own `<spec_slug>-<run_short>-openweather`, via `{{name}}-openweather` in the custom template. Updated: `app.yaml`, workflow step 5, the `s8`/`s10` copy and Stage 4 criterion 9. The shared-Secret open question was removed, and a risk was added: confirm that the platform approval covers one Secret per learner.
- **Stage 3 split** (Claude's call). 3a (worked-example slides) depends only on Stage 2. 3b (follow-along) and Stage 4 are gated on the spike, with no fallback track. A spike failure is reported by mode: trust policy, private EKS endpoint, or RBAC.
- **Stage 2's deploy is independent of the spike** (Claude's call). It uses the existing architect Deploy path and the laptop `kubectl` handoff, and is gated only by Stage 0c.
- **New spike step 10** (Claude's call). Create, patch and delete a throwaway Secret, `llm-course-oidc-spike-openweather`, in `training`, using a dummy value.
- **New Stage 0c** (Claude's call). The CRD Secret-reference check is a separate read-only laptop check, needing no throwaway repo and no spike, run before Stage 2's deploy. If the CRD has no such field, stop and ask the user.
- **New Stage 1 T0** (Claude's call). Resolve the current EC2 hostname, and whether `/build/*` is proxied by nginx, before any other check.
- **Run limit restated** (Claude's call). At most 3 fresh runs, no hand-edits to generated code, and failures reported honestly to the user.
- **Part 5 lock** (Claude's call). Part 5 is built, but its admin lock is not changed.
