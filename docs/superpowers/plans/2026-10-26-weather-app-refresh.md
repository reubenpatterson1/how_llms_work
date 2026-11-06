# Weather App Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the architect pipeline end to end with one real OpenWeather "Hello, World!" app, rebuild Part 4 around that run (plus a learner follow-along), rebuild Part 5 around the change → test → PR → staging-deploy loop, and add an off-path Parts 1–3 Refresher.

**Architecture:** Stage 1 verifies and minimally fixes the Flask architect app (`architect/`) on EC2. Stage 2 runs the real pipeline and records everything in one evidence file, which becomes the single source of truth for all slide copy and question numbers. Parts 4/5 are content edits to existing React/Vite apps (`module4/`, `testing-with-llms/`), plus one new Flask route, three static kit files and a self-contained GitHub Actions workflow. The Refresher is a new isolated Vite app (`refresher/`) with no storage and no gate.

**Tech Stack:** Python 3.12 / Flask / pytest (architect); React 19, Vite 8, ESLint 9 (all apps); Vitest 2 + jsdom 25 + Testing Library 16 (refresher); Playwright 1.48 (deploy-landing); GitHub Actions with AWS OIDC, ECR, EKS, fubo `Application` CRD `app.smo.tools.fubotv.net/v1alpha1`.

**Spec:** `docs/superpowers/specs/2026-10-26-weather-app-refresh-design.md`

## Global Constraints

- Spec is authoritative; every value below is copied from it. Where this plan resolves an ambiguity it says "(plan resolution)".
- Repo root: `/Users/reubenpatterson/LLM_Presentation`. All paths below are relative to it unless absolute.
- `$WORK` = `/Users/reubenpatterson/LLM_Presentation/.claude/weather-refresh-work` (untracked, never committed, never holds a key value). `$EVID` = `docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md`.
- Who does what: code, tests, workflow YAML, READMEs → `code-executor` (verbatim). Slide copy, question banks, change-specs → `spec-author`, written to `$WORK/content/`, pasted verbatim by `code-executor`. Browser, ssh, `gh`, `kubectl` and live-run steps → the orchestrator.
- Snapshot before the first edit of every stage: `cd /Users/reubenpatterson/LLM_Presentation && mkdir -p .claude/snapshots && S=".claude/snapshots/weather-refresh-<stage>-$(date +%Y%m%dT%H%M%S).tar.gz" && tar -czf "$S" --exclude='node_modules' --exclude='dist' --exclude='./.claude/snapshots' . && tar -tzf "$S" | grep -cE '(^|/)(node_modules|dist)/'; ls -lh "$S"`. Expected: `0`, then the file size. Record the path in `$EVID §0a`.
- Commit by explicit path only. Never `git add -A`, `git add .`, `git add -u` or `git commit -a`. The tree is intentionally dirty: PDFs, PNGs at the root, `weather-app-poc/.coverage`, `context-and-sessions/package-lock.json`, `.playwright-mcp/`, `.claude/snapshots/`.
- Commits go on branch `weather-app-refresh`, and only after the Task 0a.1 authorization gate. If commits are not authorized, skip every "Commit" step and append its `git add …` path list to `$EVID §Commits` instead (plan resolution: the spec puts "committing without the user's instruction" out of scope).
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **OpenWeather key.** No key value ever goes into a file, commit, slide, screenshot, workflow log, `$EVID`, `$WORK` or chat. Recorded commands write `appid=$OPENWEATHER_API_KEY`. Only the user types the value, in their own shell or at a `gh secret set` prompt. The agent never asks for it in chat.
- Key-shaped scan: `grep -rnE "[0-9a-f]{32}"`. For git history use `git log -p --all --format= | grep -nE "[0-9a-f]{32}"`, because `--format=` drops the 40-hex commit headers that would always match (plan resolution). `$EVID` records image digests truncated to `sha256:<first 12 hex>…` and commit SHAs as 7 characters, so `$EVID` itself passes the scan (plan resolution).
- Never restart `llm-architect.service` while an intake, decompose or build run that this plan depends on is in flight. Ship all fixes, restart once, then start a fresh intake.
- Unlock gate: `__LLM_MODULE_ID__` in each Part's `index.html`, `MODULES`/`LABELS` in `deploy-landing/flow-through.js`, and `MODULES` in `deploy-landing/index.html` stay in sync. Check: `grep -h "__LLM_MODULE_ID__ = '" presentation/index.html working-with-llms/index.html context-and-sessions/index.html module4/index.html testing-with-llms/index.html; grep -n "var MODULES\|var LABELS" deploy-landing/flow-through.js; grep -o "{id:'part[0-9]'" deploy-landing/index.html`. Expected: part1–part5 in order in all three.
- Part 5 admin lock stays unchanged: `var serverLocks={part5: true};` in `deploy-landing/index.html`, and `/api/analytics/locks` in `architect/webapp.py`, are never edited.
- Worked example: at most 3 fresh intake runs. Never hand-edit generated code. A stub handler, the shim fallback page (`<div id="clock">`), or regex-fallback decompose counts as a failed run.
- Ingress: no raw `ingress.yaml` is written. The CRD `ingress:` block, including `tls.certificateArn`, is copied verbatim from `architect/templates/deploy_template.yaml`. Hosts are internal, so no `alb.ingress.kubernetes.io/ssl-redirect`, no `nginx.ingress.kubernetes.io/ssl-redirect`/`force-ssl-redirect`, and no TLS/443 annotation.
- DNS lag: after an apply, poll `curl -s -o /dev/null -w '%{http_code}' https://<host>/healthz` every 10s for up to 180s before declaring failure.
- Fixed names: role `arn:aws:iam::650127479436:role/Github-Actions-OIDC-Policy`; region `us-east-1`; ECR repo `650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app`; namespace `training`; Secret `<app-name>-openweather` with key `OPENWEATHER_API_KEY`; learner repo/app `llm-wx-<github-login>`; host `<app-name>-training.tools.fubotv.net`; image tag `<app-name>-<short-sha>`.
- Unchanged: `architect/templates/deploy_template.yaml`, `deploy-landing/flow-through.js`, `testing-with-llms/index.html`, `cicd-with-llms/`, `presentation/`, `working-with-llms/`, `context-and-sessions/`, `DeploymentStack.jsx`. Dead code (`WaveGridReplay.jsx`, `wave-trace.js`, `building-with-llms/`, `deploying-with-llms/`) is mentioned in stage reports and never removed.
- `$EVID` entry format: `- <check-id> | PASS/FAIL/INFO | <YYYY-MM-DD HH:MM TZ> | \`<command>\`` followed by a fenced output excerpt of at most 15 lines.
- Shared files and ordering: `deploy-landing/index.html` edits and their commit happen back to back and the file is never left dirty; `$EVID` commits include only completed sections; stages execute sequentially, Stage 5 after Stage 4 (or when Stage 4 is blocked at a human gate).

**Runtime values** (resolved during execution, recorded in `$EVID`, then used verbatim by later tasks):

| Name | Produced by | Meaning |
| --- | --- | --- |
| `LIVE_HOST`, `SSH_TARGET` (`ec2-user@$LIVE_HOST`), `PUB` | 1.1 | live EC2 hostname; public base URL (expected `http://$LIVE_HOST:8080`) |
| `BOX_ARCHITECT_DIR`, `BOX_VENV`, `DOCROOT_MAP`, `NGINX_FILE` | 1.1 | directory that contains the loaded `webapp.py` (not the systemd WorkingDirectory); venv from ExecStart; URL-path → box-dir map; nginx config path |
| `TRAINING_CLUSTER` | 0b.1 | EKS cluster name that hosts `training` |
| `SECRET_REF_FIELD_PATH`, `SECRET_REF_BLOCK` | 0c.1 | CRD field path, plus the exact YAML block under `spec:` that sources `OPENWEATHER_API_KEY` from a Secret |
| `RUN_ID`, `SPEC_SLUG`, `RUN_SHORT`, `APP_NAME`, `APP_HOST`, `WEATHER_ROUTE` | 2.2–2.4 | successful worked-example run; `APP_NAME=$SPEC_SLUG-$RUN_SHORT`; real weather route path (`WEATHER_ROUTE=/api/weather` unless 2.2 Step 6 records a different path) |
| `REHEARSAL_REPO`, `REHEARSAL_HOST` | 3b.4 | `fubotv/llm-wx-rpatterson-fubotv`; `llm-wx-rpatterson-fubotv-training.tools.fubotv.net` (login from `gh api user -q .login`) |
| `REHEARSAL_WEATHER_ROUTE` | 3b.4 Step 2 | real weather route path of the rehearsal generation (`/api/weather` unless the 3b.4 Step 2 Task 2.2 Step 6 check records a different path); used in 3b.4 Step 7, 4.3 and 4.4 |

## Review Focus

Five failure modes the spec implies that its own criteria do not catch, most likely first. Each one is pinned by a check in the task that owns it.

1. **Generated app needs the key at import time.** If generated code does `os.environ["OPENWEATHER_API_KEY"]` at module level, the CI `test` job (which has no secret) and `test_health.py` both fail in every learner repo, while the worked example looks fine. Pinned in Task 2.2, Step 6 (import smoke with the key unset: `/healthz` gives 200 and the weather call gives 500), and in Task 3b.3, Step 5.
2. **The CRD silently prunes the Secret-reference field.** The pod is healthy, rollout goes green and `/healthz` returns 200, but `/api/weather` returns 500 "not set". Pinned in Task 2.4, Step 3 and Task 3b.4, Step 8: the Deployment's container spec must show the `<app-name>-openweather` reference.
3. **Operator reconcile race.** `kubectl rollout status` can run before the operator patches the Deployment. That gives a false green against the old image, or NotFound on the first deploy. Pinned by the "Wait for operator" step in `deploy.yml` (Task 3b.3), and by Task 4.4, Step 9, which requires the merge run's log to show `deployed=<new tag>`.
4. **Download breaks behind the nginx prefix.** The link might be built without `window.PFX`, `/architect/build/download` might not be proxied, or the response might be HTML instead of a zip. Pinned by `test_build_js_download_link_uses_pfx` (Task 3b.1), and by the public `curl` + `unzip -l` in Task 3b.2, Step 4.
5. **Refresher option-shuffle remap bug.** Correct picks get graded wrong, which corrupts the score and the missed list. Pinned by `buildSequence remaps answer … (200 runs)` in Task 5.2.

## Stage order and parallelism

`0a → {0c, 0b, 1, 5}` start together. `0c` (read-only) must pass before Task 2.3 (deploy). `0b` runs alongside 1 → 2 → 3a. `3b` needs 3a + 0b PASS + 0c PASS. `4` needs 3b. `5` needs only 0a, but tasks execute one at a time (pre-flight ruling I6): Stage 5 runs after Stage 4, or earlier only while Stage 4 is parked at a human gate and never while `deploy-landing/index.html` is dirty. Task 5.7 (publish) runs last, after Stage 4 is done or stopped. If 0b FAILs: stop 3b and 4, and continue 1, 2, 3a and 5.

---

## Stage 0a — Setup

### Task 0a.1: Authorization gate, branch, work dir, evidence skeleton

**Files:** Create `docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md`; create dir `$WORK/{content,answers,shots,tools,artifacts}`.
**Interfaces:** Produces `$EVID`, with exactly these `##` headings in order: `0a Snapshots`, `Commits`, `Environment (T0)`, `0b OIDC spike`, `0c CRD Secret reference`, `Stage 1 checks`, `Stage 1 known open issues`, `Stage 1 blocking fixes`, `Intake answer sheet`, `Stage 2 runs`, `Stage 2 artifacts`, `Stage 2 verification`, `Real route paths`, `Stage 3a checks`, `Stage 3b rehearsal`, `Stage 4 loop`, `Stage 5 refresher`, `Publishes`, `Final verification`.

- [ ] **Step 1: HUMAN GATE (commits).** Ask the user: "May I commit each task to a new branch `weather-app-refresh` (explicit paths only)?" Record the answer in `$EVID §Commits`. If yes: `git switch -c weather-app-refresh`.
- [ ] **Step 2:** Run the Global snapshot command with `<stage>=0a`.
- [ ] **Step 3:** `mkdir -p $WORK/content $WORK/answers $WORK/shots $WORK/tools $WORK/artifacts docs/superpowers/evidence`, then write `$EVID` with the title `# Weather App Refresh — Evidence (2026-10-26)`, a first line `No key values anywhere in this file. Commands show appid=$OPENWEATHER_API_KEY.`, and the headings above, each followed by `(pending)`.
- [ ] **Step 4: Commit** `git add docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md` with message `Weather refresh: evidence file skeleton`.

### Task 0a.2: Click-through tool (scratch, not committed)

**Files:** Create `$WORK/tools/clickthrough.cjs`.
**Interfaces:** CLI `NODE_PATH=/Users/reubenpatterson/LLM_Presentation/deploy-landing/node_modules node $WORK/tools/clickthrough.cjs --url <url> --slides <N> [--progress-key <partN>] [--dump <out.json>]`. It prints one JSON line `{ "ok": bool, "slides": N, "counter": str|null, "errors": [str], "progress": object|null }` and exits 0 iff `ok`.

- [ ] **Step 1:** `cd deploy-landing && npm ci` (Chromium is already cached under `~/Library/Caches/ms-playwright`; if `npx playwright install chromium` reports it missing, run it).
- [ ] **Step 2:** `code-executor` writes the tool with this behaviour:
  1. Launch `require('@playwright/test').chromium` headless.
  2. Collect `pageerror` (message + stack) and `console` messages of type `error` (text + `location().url`). Drop any entry whose combined text contains `flow-through.js`.
  3. `goto(url, {waitUntil:'networkidle'})`.
  4. For `n = 1..N`: if `--dump` is set, push `{n, text: (await page.innerText('body')).slice(0,4000)}`. If `n < N`: click `page.getByRole('button',{name:'Next',exact:true}).last()` if it exists and is enabled, otherwise `page.keyboard.press('ArrowRight')`; then wait 300ms.
  5. `counter` = the last `/(\d+) \/ (\d+)/` match in the body text, or null.
  6. `ok` = no errors, AND `counter` is null or equals `N / N`, AND (if `--progress-key` is set) `JSON.parse(localStorage.llm_course_progress)` has `__v===2` and `[key]===true`.
  7. Write the dump file if requested.
- [ ] **Step 3:** Smoke test against the current Part 4: `cd module4 && npm run build && (npx vite preview --port 4176 --strictPort &) && sleep 3 && NODE_PATH=… node $WORK/tools/clickthrough.cjs --url http://localhost:4176/part4/ --slides 26 --progress-key part4`. Expected: `"ok":true` and `"counter":"26 / 26"`. Kill the preview server afterwards.

---

## Stage 0c — CRD Secret-reference check (read-only, laptop)

### Task 0c.1: Find the Secret-reference field

**Files:** Modify `$EVID §0c`.
**Interfaces:** Produces `SECRET_REF_FIELD_PATH: str` and `SECRET_REF_BLOCK: str` (YAML indented under `spec:`, using `{{name}}-openweather` for the worked example and `__APP_NAME__-openweather` for the kit).

- [ ] **Step 1:** `kubectl config current-context; kubectl explain application.spec --api-version=app.smo.tools.fubotv.net/v1alpha1 --recursive > $WORK/artifacts/crd-explain.txt; grep -nE "env|valueFrom|secretKeyRef|envFrom|secretRef" $WORK/artifacts/crd-explain.txt`.
- [ ] **Step 2:** `kubectl get secrets -n training -o name > $WORK/artifacts/training-secrets-before.txt; wc -l < $WORK/artifacts/training-secrets-before.txt` (names only).
- [ ] **Step 3:** Record in `$EVID §0c` the grep lines, the exact `SECRET_REF_FIELD_PATH` (for example `spec.env[].valueFrom.secretKeyRef`), and `SECRET_REF_BLOCK` written in that field's own shape. For the `secretKeyRef` shape the block is:
  ```yaml
    env:
      - name: OPENWEATHER_API_KEY
        valueFrom:
          secretKeyRef:
            name: {{name}}-openweather
            key: OPENWEATHER_API_KEY
  ```
- [ ] **Step 4: HUMAN GATE (no Secret-reference field).** If Step 1 shows no Secret-sourced env field, stop Task 2.3 and Stages 3b and 4. Tell the user: "The Application CRD has no Secret-reference field (output in $EVID §0c). A literal env value would put the key into rendered YAML. How do you want to proceed?" Wait for the answer.

---

## Stage 0b — OIDC trust spike (runs alongside Stages 1–3a)

### Task 0b.1: Laptop cluster check (read-only)

**Files:** Modify `$EVID §0b`. **Interfaces:** Produces `TRAINING_CLUSTER: str`.

- [ ] **Step 1:** `kubectl config current-context; kubectl get ns training -o name`. Expected: a context ARN ending `cluster/<name>`, and `namespace/training`. Set `TRAINING_CLUSTER=<name>` and record it.

### Task 0b.2: Spike repo and workflow

**Files:** Create (outside this repo) `$WORK/oidc-spike/.github/workflows/spike.yml`.
**Interfaces:** Consumes `TRAINING_CLUSTER`. Produces the spike run id and the `report` step output.

- [ ] **Step 1: HUMAN GATE (outward-facing).** Ask: "May I create private repo `fubotv/llm-course-oidc-spike` (default branch `staging`), push one workflow that pushes ECR tag `architect-builds/app:oidc-spike-<run_id>` and creates, patches and deletes a dummy Secret `llm-course-oidc-spike-openweather` in `training`?" Do not continue without a yes.
- [ ] **Step 2:** `code-executor` writes `spike.yml` exactly as below, with `__TRAINING_CLUSTER__` replaced:
  ```yaml
  name: oidc-spike
  on:
    push: { branches: [staging] }
    workflow_dispatch:
  permissions: { id-token: write, contents: read }
  defaults: { run: { shell: bash } }
  jobs:
    spike:
      runs-on: ubuntu-latest
      env:
        REG: 650127479436.dkr.ecr.us-east-1.amazonaws.com
        TRAINING_CLUSTER: __TRAINING_CLUSTER__
      steps:
        - { id: s1, continue-on-error: true, uses: aws-actions/configure-aws-credentials@v4,
            with: { role-to-assume: "arn:aws:iam::650127479436:role/Github-Actions-OIDC-Policy", aws-region: us-east-1 } }
        - { id: s2, continue-on-error: true, run: aws sts get-caller-identity }
        - { id: s3login, continue-on-error: true, uses: aws-actions/amazon-ecr-login@v2 }
        - { id: s3, continue-on-error: true, run: aws ecr describe-repositories --repository-names architect-builds/app --region us-east-1 }
        - id: s4
          continue-on-error: true
          run: |
            docker pull public.ecr.aws/docker/library/busybox:latest
            docker tag public.ecr.aws/docker/library/busybox:latest "$REG/architect-builds/app:oidc-spike-${{ github.run_id }}"
            docker push "$REG/architect-builds/app:oidc-spike-${{ github.run_id }}"
        - { id: s5, continue-on-error: true, run: aws eks list-clusters --region us-east-1 }
        - id: s6
          continue-on-error: true
          run: |
            aws eks update-kubeconfig --name eks-staging-observability --region us-east-1 || echo "observability kubeconfig failed"
            aws eks update-kubeconfig --name "$TRAINING_CLUSTER" --region us-east-1
        - { id: s7, continue-on-error: true, run: kubectl version }
        - { id: s8, continue-on-error: true, run: kubectl auth can-i create applications.app.smo.tools.fubotv.net -n training }
        - { id: s9, continue-on-error: true, run: kubectl auth can-i get deployments -n training }
        - { id: s10a, continue-on-error: true, run: "kubectl create secret generic llm-course-oidc-spike-openweather -n training --from-literal=OPENWEATHER_API_KEY=spike-dummy --dry-run=client -o yaml | kubectl apply -f -" }
        - { id: s10b, continue-on-error: true, run: "kubectl create secret generic llm-course-oidc-spike-openweather -n training --from-literal=OPENWEATHER_API_KEY=spike-dummy-2 --dry-run=client -o yaml | kubectl apply -f -" }
        - { id: s10c, continue-on-error: true, run: kubectl delete secret llm-course-oidc-spike-openweather -n training }
        - name: report
          if: always()
          run: |
            for s in s1:${{ steps.s1.outcome }} s2:${{ steps.s2.outcome }} s3login:${{ steps.s3login.outcome }} s3:${{ steps.s3.outcome }} s4:${{ steps.s4.outcome }} s5:${{ steps.s5.outcome }} s6:${{ steps.s6.outcome }} s7:${{ steps.s7.outcome }} s8:${{ steps.s8.outcome }} s9:${{ steps.s9.outcome }} s10a:${{ steps.s10a.outcome }} s10b:${{ steps.s10b.outcome }} s10c:${{ steps.s10c.outcome }}; do echo "$s"; done
  ```
  (Plan resolution: the `report` step and the split of step 10 into s10a–c make per-check pass/fail exact. `kubectl auth can-i` exits 1 on "no". In s6 the `TRAINING_CLUSTER` kubeconfig runs last, so it is the current context and the only command that can fail the step.)
- [ ] **Step 3:** Create and push: `gh repo create fubotv/llm-course-oidc-spike --private && cd $WORK/oidc-spike && git init -b staging && git add .github/workflows/spike.yml && git commit -m "OIDC spike" && git remote add origin git@github.com:fubotv/llm-course-oidc-spike.git && git push -u origin staging && gh repo edit fubotv/llm-course-oidc-spike --default-branch staging`.
- [ ] **Step 4:** `RID=$(gh run list -R fubotv/llm-course-oidc-spike -L1 --json databaseId -q '.[0].databaseId'); gh run watch $RID -R fubotv/llm-course-oidc-spike; gh run view $RID -R fubotv/llm-course-oidc-spike --log > $WORK/artifacts/spike-$RID.log`.

### Task 0b.3: Classify the spike result

**Files:** Modify `$EVID §0b`. **Interfaces:** Produces `SPIKE = PASS | FAIL(<mode>)`.

- [ ] **Step 1:** Record each `sN:<outcome>` line from `report`, with the error text from the log for every non-success step.
- [ ] **Step 2:** `SPIKE=PASS` iff s1, s2, s3login, s3, s4, s7, s8, s9, s10a, s10b and s10c are all `success`. Otherwise use mode `trust-policy` (s1), `private-endpoint` (s7) or `rbac` (s8–s10, as the first failing one). If s10a passed and s10c failed, flag "dummy Secret left in training".
- [ ] **Step 3: Opus review gate:** `investigator` re-reads the log and confirms the classification. Record the verdict.
- [ ] **Step 4: HUMAN GATE (spike failure, report mode).** If FAIL: stop Stages 3b and 4. Report to the user the mode, the failing step ids and the exact error text, plus the leftover-Secret flag if any. Wait for the user's decision.
- [ ] **Step 5: HUMAN GATE (cleanup).** Ask: "Delete `fubotv/llm-course-oidc-spike` now? Also delete ECR tag `oidc-spike-$RID`?" On yes: `gh repo delete fubotv/llm-course-oidc-spike --yes`, and (if approved) `aws ecr batch-delete-image --repository-name architect-builds/app --image-ids imageTag=oidc-spike-$RID --region us-east-1`. Record both.

---

## Stage 1 — Test Architect and Decompose

All live checks use the public URL. Run the snapshot (`<stage>=1`) before Task 1.6's first edit.

### Task 1.1: T0 — resolve the environment

**Files:** Modify `$EVID §Environment (T0)`. **Interfaces:** Produces `LIVE_HOST`, `SSH_TARGET`, `PUB`, `BOX_ARCHITECT_DIR`, `BOX_VENV`, `DOCROOT_MAP`, `NGINX_FILE`, and `NGINX_PROXIES_BUILD: bool`.

- [ ] **Step 1:** `for h in ec2-100-58-203-210.compute-1.amazonaws.com ec2-52-91-187-71.compute-1.amazonaws.com; do echo "$h $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://$h:8080/)"; done`. The host returning 200 is `LIVE_HOST`. If neither does, ask the user for the host.
- [ ] **Step 2:** `ssh -i ~/key.pem $SSH_TARGET 'systemctl cat llm-architect.service; systemctl is-active llm-architect.service; ls -la /var/www/llm-course/'`. Set `BOX_ARCHITECT_DIR` to the directory that contains the loaded `webapp.py`, NOT the WorkingDirectory: WorkingDirectory + `/architect` when ExecStart uses `-m architect.webapp`, otherwise the directory of the `webapp.py` path in ExecStart. Verify with `ssh -i ~/key.pem $SSH_TARGET "test -f $BOX_ARCHITECT_DIR/webapp.py && echo ok"`, expected `ok`; if not `ok`, stop and ask the user. Record `BOX_ARCHITECT_DIR`, the WorkingDirectory, the ExecStart interpreter dir as `BOX_VENV`, any `URL_PREFIX`, and the docroot listing.
- [ ] **Step 3 (read-only):** `ssh -i ~/key.pem $SSH_TARGET 'sudo nginx -T 2>/dev/null' > $WORK/artifacts/nginx-T.txt; grep -nE "server_name|listen|location|proxy_pass|root |alias" $WORK/artifacts/nginx-T.txt`. Record `NGINX_FILE`, `DOCROOT_MAP` (`/`, `/part1/`…`/part5/`, `/architect/`, `/decompose/` → dir or upstream), and whether `/build/`, `/deploy/` and `/architect/build/` reach Flask (`NGINX_PROXIES_BUILD`).
- [ ] **Step 4:** `EC2_HOST=$SSH_TARGET ./scripts/refresh-ec2-ecr-auth.sh`. Expected output includes `Login Succeeded`. Do not edit the script.
- [ ] **Step 5:** Define the ship command in `$EVID`: `rsync -az -e "ssh -i ~/key.pem" --exclude workspaces/ --exclude __pycache__/ --exclude .provider_config.json --exclude .build_deploy_config.json --exclude analytics.db --exclude test_results.json architect/ $SSH_TARGET:$BOX_ARCHITECT_DIR/` (no `--delete`; plan resolution). The first ship is a dry run, made now, before any real run: the same command with `-n -i` added after `rsync`, piped to `tee $WORK/artifacts/ship-dryrun.txt`, then `grep -cE '^(>f\++ webapp\.py|cd\++ (templates|static)/)$' $WORK/artifacts/ship-dryrun.txt`. Expected `0` (a new `webapp.py`, `templates/` or `static/` means the destination is the wrong directory); if not `0`, stop and fix `BOX_ARCHITECT_DIR` before any real ship. Record the dry-run output excerpt in `$EVID`. Restart command: `ssh -i ~/key.pem $SSH_TARGET 'sudo systemctl restart llm-architect.service && sleep 3 && systemctl is-active llm-architect.service'`, expected `active`.

### Task 1.2: T1 + T2 — local suite and clean install

**Files:** Modify `$EVID §Stage 1 checks`.

- [ ] **Step 1 (T1):** `python -m pytest architect/tests -q 2>&1 | tail -3`. Expected: `N passed`, 0 failed, with N ≥ 212. Record N.
- [ ] **Step 2 (T2):** `python3.12 -m venv $WORK/t2venv && $WORK/t2venv/bin/pip install -q -r architect/requirements.txt && $WORK/t2venv/bin/python -c "import architect.webapp; print('ok')"`. Expected: `ok`.

### Task 1.3: T3 — EC2 health and model

- [ ] **Step 1:** `curl -s $PUB/architect/api/status | python3 -m json.tool | head -20`. Expected: 200 JSON.
- [ ] **Step 2:** `curl -s $PUB/architect/api/settings | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["config"]["type"],d["config"]["model"],d["provider_status"].get("active_model_found"),d["ollama_models"])'`. Expected: `ollama gemma4:e4b True [...]`, where the list is non-empty and contains `gemma4:e4b`. An empty `ollama_models` means the hard-coded `gemma3:12b` fallback list in `architect/webapp.py` won, which is a FAIL.
- [ ] **Step 3:** On FAIL, stop. Fix provisioning on the box (a blocking fix, Task 1.6). Do not retry intake until it passes.

### Task 1.4: T4 + T5 — intake and decompose via public URL

**Files:** Create `$WORK/answers/01-purpose.txt` … `10-testing.txt`; modify `$EVID §Intake answer sheet` and `§Stage 1 checks`.
**Interfaces:** Produces answer files in channel order: purpose, data-model, api, tech-stack, auth, deployment, error-handling, performance, security, testing. Their text is the spec's "Intake answer sheet" bullets for that channel, verbatim.

- [ ] **Step 1:** Write the 10 answer files, and paste them verbatim into `$EVID §Intake answer sheet`.
- [ ] **Step 2 (T4):** `SID=t4-$(date +%Y%m%d%H%M); P=$PUB/architect; curl -s -X POST $P/api/reset -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\"}" >/dev/null; curl -s -X POST $P/api/phase -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\",\"phase\":\"poc\"}" | head -c 200; for f in $WORK/answers/*.txt; do python3 -c 'import json,sys;print(json.dumps({"sid":sys.argv[1],"message":open(sys.argv[2]).read()}))' "$SID" "$f" | curl -s -X POST $P/api/send -H 'Content-Type: application/json' -d @- | python3 -c 'import json,sys;print(json.load(sys.stdin).get("method"))'; done`. Expected: 10 lines, each starting `ollama:`. Any `regex` is a FAIL.
- [ ] **Step 3 (T4):** `curl -s "$P/api/spec?sid=$SID" | python3 -c 'import json,sys;print(json.load(sys.stdin)["spec"])' > $WORK/artifacts/t4-spec.md; grep -niE "auth" $WORK/artifacts/t4-spec.md`. Expected: the only auth requirement is "none". Any JWT, OAuth, session or login requirement is a FAIL (a regression of `2c5d40f`).
- [ ] **Step 4 (T5):** Note the UTC start time. In a browser on `$PUB/decompose/`, paste `t4-spec.md`, run Decompose, note the end time, save the JSON/markdown to `$WORK/artifacts/t5-decompose.md`, and save the YAML from the Decompose page's "Download Build Package" to `$WORK/artifacts/t5/build-package.yaml`. Never click "Continue to Build →" (it points at a canned example package). Expected: a component implementing the weather lookup, and no component whose name starts with `Auth`.
- [ ] **Step 5 (T5):** `ssh -i ~/key.pem $SSH_TARGET "sudo journalctl -u llm-architect.service --since '<start>' --until '<end>' --no-pager | grep -c 'LLM extraction failed, falling back to regex'"`. Expected: `0`.

### Task 1.5: T6 + T7 — Build and Deploy pages via public URL

- [ ] **Step 1 (T6):** In a browser, open `$PUB/architect/build` directly (never via "Continue to Build →", which points at a canned example), upload `$WORK/artifacts/t5/build-package.yaml`, Start Build. Expected: `POST …/build/start` returns `run_id`, `GET …/build/status?run=` polls to `complete:true`, and "Continue to Deploy →" appears. Record the run id. Then `ssh -i ~/key.pem $SSH_TARGET "cat $BOX_ARCHITECT_DIR/workspaces/<run_id>/_package.yaml" | head -20`. Expected: it names the weather spec (not the canned example).
- [ ] **Step 2 (T6):** If any build request 404s or reaches the static docroot instead of Flask, T6 FAILs. Go to Task 1.6 with the nginx variant.
- [ ] **Step 3 (T7):** `curl -s -X POST $PUB/architect/deploy/render -H 'Content-Type: application/json' -d "$(python3 -c 'import json,sys;print(json.dumps({"run_id":sys.argv[1],"template_text":open("architect/templates/deploy_template.yaml").read()}))' <run_id>)" | python3 -c 'import json,sys;y=json.load(sys.stdin)["yaml"];print(y)' | grep -nE "containerPort|path:"`. Expected: `containerPort: 3000` and `path: /healthz`.
- [ ] **Step 4 (T7):** On the Deploy page click image build (expect a success log) and image push (expect a digest; if you get 401, rerun Task 1.1 Step 4 and retry once). Then click apply. Expected: the `kubectl_missing` handoff panel. That outcome is a PASS by design.

### Task 1.6: Blocking-fix procedure (repeat per defect found in 1.2–1.5)

**Files:** Create `architect/tests/test_<defect_slug>.py`; modify only the `architect/*` file(s) the defect lives in. Nginx variant: the live `NGINX_FILE` (outside git).
**Interfaces:** Each fix is recorded in `$EVID §Stage 1 blocking fixes` as `defect → test name → files → commit`.

- [ ] **Step 1:** Write a failing pytest named `test_<observable_behaviour>` that reproduces the defect without network access (use the Flask test client or a monkeypatch). Run `python -m pytest architect/tests/test_<defect_slug>.py -q` and confirm it FAILs with the observed symptom.
- [ ] **Step 2:** `code-executor` fixes it in the smallest diff. Run that test (PASS), then the whole `python -m pytest architect/tests -q` (0 failures).
- [ ] **Step 3: Opus review gate:** `design-reviewer` reviews the diff and the test.
- [ ] **Step 4: Commit** the test file and the changed file(s) by explicit path, message `Architect: fix <defect> (blocks weather run)`.
- [ ] **Nginx variant: HUMAN GATE.** Before any edit on the box, show the user the exact proposed `location` diff and ask for approval. On yes: `ssh … "sudo cp $NGINX_FILE $NGINX_FILE.bak-$(date +%Y%m%d)"`, then `scp -i ~/key.pem $SSH_TARGET:$NGINX_FILE $WORK/artifacts/`, then apply, `sudo nginx -t && sudo systemctl reload nginx`, and record the diff in `$EVID`.
- [ ] **Step 5 (once, after all fixes):** Run the ship command, then `$BOX_VENV/bin/pip install -r $BOX_ARCHITECT_DIR/requirements.txt` if `architect/requirements.txt` changed, then the restart command, exactly once. Rerun only the affected checks (T3–T7).

### Task 1.7: Known open issues and stage close

- [ ] **Step 1:** In `$EVID §Stage 1 known open issues`, list each of these as `fixed` or `open`, with a repro command: regex fallback auth/no-feature rule (`architect/decompose_patterns.py`); live nginx config not in git; cross-account EC2 (443514608959) vs ECR/EKS (650127479436); poll-ingress PNA block.
- [ ] **Step 2: Opus review gate:** `investigator` confirms that T0 is recorded and that T1–T7 are all PASS, each with date, command and excerpt.

---

## Stage 2 — Real weather pipeline run

Snapshot `<stage>=2` before Task 2.1.

### Task 2.1: Pre-run

**Files:** Create `$WORK/artifacts/weather-deploy-template.yaml` (the custom template; contains no key).
**Interfaces:** Consumes `SECRET_REF_BLOCK`. Produces the custom template = `architect/templates/deploy_template.yaml` byte-for-byte, with `SECRET_REF_BLOCK` (`{{name}}-openweather`) inserted between the `healthcheck:` block and `ingress:`.

- [ ] **Step 1: HUMAN GATE (key).** Ask the user to run this in their own terminal: `read -rs OPENWEATHER_API_KEY; export OPENWEATHER_API_KEY; curl -s -o /dev/null -w '%{http_code}\n' "https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY"`, and to report only the status code. Expected `200`. A `401` means the key isn't active yet, so wait.
- [ ] **Step 2:** Confirm Task 1.6 Step 5 is done (shipped and restarted once) and that nothing is in flight. Run `EC2_HOST=$SSH_TARGET ./scripts/refresh-ec2-ecr-auth.sh` (expect `Login Succeeded`).
- [ ] **Step 3:** Write the custom template. Check it with `diff architect/templates/deploy_template.yaml $WORK/artifacts/weather-deploy-template.yaml`: the only additions are the `SECRET_REF_BLOCK` lines. Paste it into `$EVID §Stage 2 runs`.

### Task 2.2: Intake → Spec → Decompose → Build (run n of at most 3)

**Files:** Create `$WORK/shots/run-<n>/{architect-dashboard,dense-spec,decompose-spec-loaded,decompose-wave-plan,build-ui}.png` and `$WORK/artifacts/run-<n>/{dense-spec.md,build-package.yaml,build-events.json}`.
**Interfaces:** Produces `RUN_ID` (12 hex), `SPEC_SLUG`, `RUN_SHORT=${RUN_ID:0:6}`, and the decompose metrics (`total_components`, `total_waves`, `max_parallelism`, `time_savings_percent`, `estimated_sequential_minutes`, `estimated_parallel_minutes`).

- [ ] **Step 1:** On `$PUB/architect/` (fresh session, phase PoC), answer each intake question with the `$WORK/answers` file for the channel it targets. If a question spans several channels, send their files concatenated. Never add text outside the files. Screenshot the dashboard → `architect-dashboard.png`.
- [ ] **Step 2:** Generate the spec (screenshot `dense-spec.png`, save `dense-spec.md`). Decompose with the spec loaded (screenshots `decompose-spec-loaded.png`, `decompose-wave-plan.png`; save the YAML from the Decompose page's "Download Build Package" to `$WORK/artifacts/run-<n>/build-package.yaml`, and save the metrics). Never click "Continue to Build →" (it points at a canned example package). Note the UTC window and run the Task 1.4 Step 5 journal grep. Expected `0`.
- [ ] **Step 3:** Open `$PUB/architect/build` directly and upload `$WORK/artifacts/run-<n>/build-package.yaml` (never via "Continue to Build →"). On completion, screenshot `build-ui.png`, then `curl -s "$PUB/architect/build/status?run=$RUN_ID" > $WORK/artifacts/run-<n>/build-events.json`.
- [ ] **Step 4:** `scp -r -i ~/key.pem $SSH_TARGET:$BOX_ARCHITECT_DIR/workspaces/$RUN_ID $WORK/artifacts/run-<n>/ws` (read-only copy; never edited). Then `head -20 $WORK/artifacts/run-<n>/ws/_package.yaml`. Expected: it names the weather spec (not the canned example); otherwise the run failed.
- [ ] **Step 5 (stub check):** `grep -rnE '\{"result": ?"value"\}|TODO|placeholder' $WORK/artifacts/run-<n>/ws/src; grep -rn "openweathermap.org/data/2.5/weather" $WORK/artifacts/run-<n>/ws/src`. Expected: the first command returns nothing, and the second returns at least one hit.
- [ ] **Step 6 (Review Focus 1):** `cd $WORK/artifacts/run-<n>/ws && python3.12 -m venv .v && .v/bin/pip install -q -r requirements.txt && env -u OPENWEATHER_API_KEY .v/bin/python -c "import sys,importlib.util as u; sys.path.insert(0,'src'); s=u.spec_from_file_location('app','src/app.py'); m=u.module_from_spec(s); s.loader.exec_module(m); c=m.app.test_client(); print(c.get('/healthz').status_code, c.get('/api/weather').status_code, c.get('/api/weather?city=X').status_code)"`. Expected: first `200` (the import did not crash without the key) and third `500`. The second is `400` or `500`, because the spec does not fix the precedence between missing city and missing key. Use the real route if it differs, and record it under `§Real route paths`. `WEATHER_ROUTE=/api/weather` unless this step records a different path.
- [ ] **Step 7:** Record the run in `$EVID §Stage 2 runs` (run n, `RUN_ID`, result). If any of Steps 2, 5 or 6 FAILed, the run failed. Tighten the answers or apply a generator fix via Task 1.6 (then ship and restart once), and repeat this task as run n+1. **After a third failure: stop and report to the user what failed in each run, with run ids.**

### Task 2.3: Deploy (render → build → push → apply handoff)

**Files:** Create `$WORK/shots/run-<n>/{deploy-ui,deploy-manual-apply}.png` and `$WORK/artifacts/run-<n>/{rendered.yaml,docker-build.log,docker-push.log}`.
**Interfaces:** Consumes the custom template and `RUN_ID`. Produces `APP_NAME=$SPEC_SLUG-$RUN_SHORT` and `APP_HOST=$APP_NAME-training.tools.fubotv.net`.

- [ ] **Step 1:** Gate check: `$EVID §0c` shows PASS. Otherwise wait for the Task 0c.1 gate answer.
- [ ] **Step 2:** On `$PUB/architect/deploy?run=$RUN_ID`, upload the custom template. Expected: the rendered YAML shows `name: $APP_NAME-openweather` inside the Secret reference, and no key. Screenshot `deploy-ui.png` and save `rendered.yaml`.
- [ ] **Step 3:** Run image build and image push (save both logs), then apply. Screenshot the handoff → `deploy-manual-apply.png`.
- [ ] **Step 4: HUMAN GATE (key + laptop apply).** Ask the user to run, in the shell where `OPENWEATHER_API_KEY` is exported: `kubectl create secret generic $APP_NAME-openweather -n training --from-literal=OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY"`, then the handed-off `cat <<'EOF' | kubectl apply -f - …` command, and to paste back only the two `kubectl` output lines (`secret/… created`, `application… created`). Record them.

### Task 2.4: Verify the live app

**Files:** Create `$WORK/shots/run-<n>/weather-app-live.png`; modify `$EVID §Stage 2 verification` and `§Real route paths`.

- [ ] **Step 1:** DNS wait (Global rule), then `kubectl get application $APP_NAME -n training; kubectl get deployment $APP_NAME -n training`.
- [ ] **Step 2:** `curl -s https://$APP_HOST/ > $WORK/artifacts/root.html; grep -c 'Get weather' $WORK/artifacts/root.html; grep -c '<input' $WORK/artifacts/root.html; grep -c 'id="clock"' $WORK/artifacts/root.html; curl -s -o /dev/null -w '%{http_code}\n' "https://$APP_HOST$WEATHER_ROUTE?city=zzzznotacity"`. Expected: ≥1, ≥1, `0`, `404` (criteria 4–5).
- [ ] **Step 3 (Review Focus 2):** Names only, never env values: `kubectl get deployment $APP_NAME -n training -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"<-"}{.valueFrom.secretKeyRef.name}{"\n"}{end}{.spec.template.spec.containers[0].envFrom[*].secretRef.name}'`. Expected: it contains `$APP_NAME-openweather` (for example `OPENWEATHER_API_KEY<-$APP_NAME-openweather`). Then the boolean-only literal-value check: `kubectl get deployment $APP_NAME -n training -o json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(any(e.get("name")=="OPENWEATHER_API_KEY" and "value" in e for e in d["spec"]["template"]["spec"]["containers"][0].get("env",[])))'`. Expected: `False`.
- [ ] **Step 4: HUMAN GATE (key).** Ask the user to run: `date -u +%T; curl -s "https://$APP_HOST$WEATHER_ROUTE?city=Chicago"; echo; curl -s "https://api.openweathermap.org/data/2.5/weather?q=Chicago&appid=$OPENWEATHER_API_KEY&units=imperial" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(json.dumps({"city":d["name"],"temp_f":d["main"]["temp"],"description":d["weather"][0]["description"]}))'; date -u +%T`, and paste the output. Expected: both lines have the same `description`, `|Δtemp| ≤ 2`, and the two times are ≤ 60s apart (criterion 3). Record it, with the command shown as typed.
- [ ] **Step 5:** In a browser, type `Chicago`, submit, and screenshot → `weather-app-live.png`. Expected: the city, °F temperature and description are visible.
- [ ] **Step 6: HUMAN GATE (key).** Ask the user to run `grep -rlF -- "$OPENWEATHER_API_KEY" /Users/reubenpatterson/LLM_Presentation --exclude-dir=node_modules | wc -l; git -C /Users/reubenpatterson/LLM_Presentation log -p --all | grep -cF -- "$OPENWEATHER_API_KEY"` and report the two numbers. Expected `0` and `0` (criterion 6). Also run `grep -cE "[0-9a-f]{32}" $EVID`, expected `0`.
- [ ] **Step 7:** Embed the dense spec, the trimmed build package, the build event summary, the trimmed docker logs, the apply output and the curl output in `$EVID §Stage 2 artifacts`, with digests truncated to 12 hex.
- [ ] **Step 8: Opus review gate:** `investigator` audits `$EVID` Stage 2 against criteria 1–6 and the "no happy-path faking" rule. Record the verdict.

---

## Stage 3a — Part 4 worked-example refresh (depends on Stage 2 only)

Snapshot `<stage>=3a` before Task 3a.2.

### Task 3a.1: Author the 3a content (spec-author)

**Files:** Create `$WORK/content/3a-content.md` and `$WORK/content/3a-assessment.json`.
**Interfaces:** `3a-content.md` has one `###` heading per target, each followed by one fenced block of raw replacement text. Targets: `SAMPLE_SPEC_HIGHLIGHT`, `s4b.intro`, `s4d.title`, `s4d.caption`, `s4.intro`, `s4.code`, `s6.caption`, `s8.caption`, `s8b.caption`, `s8c.title`, `s8c.caption`, `s10.title`, `s10.body`, `DeployFlow.STAGES` (complete JS array), `PipelineFlow.idea.sample`, `PipelineFlow.architect.sample`, `PipelineFlow.decompose.sample`, `PipelineFlow.build.sample`, `PipelineFlow.deploy.sample`, `PipelineFlow.deployedMockUrl`, `BuildFlow.parse.specSlugLine`. `3a-assessment.json` = `{ "replace": [full question objects for A1–A5 and B2, same id/section], "explanations": { "C2": str, "C5": str } }`.

- [ ] **Step 1:** Dispatch `spec-author` with `$EVID` (Stage 2 sections), `module4/src/App.jsx`, the three Flow components and `module4/src/data/assessment-questions.json`. Rules:
  - Every name and number comes from `$EVID`.
  - `DeployFlow.STAGES` keeps the five ids `render, docker_build, push, apply, poll` and the existing `label`/`symbol`/`color`, and uses real output only.
  - `s8.caption` says the rendered YAML names `$APP_NAME-openweather`, contains no key, and that the instructor created the Secret by hand.
  - `s10` turns the foreshadowing into payoff: `os.environ`, `.env.example`, the value arrives from the app's own Secret, and the instructor created it by hand. No follow-along sentence (that is added in 3b; plan resolution).
  - `s8c.caption` states the curl comparison numbers.
  - `s4.code` is trimmed the same way the current one is (≤ 60 lines).
  - A3 keeps the naive vs complexity-weighted formula point when the real numbers differ; otherwise it is replaced with another wave-plan mechanism question.
  - `slideRef`s use only existing ids.
  - Only the `BuildFlow` `spec_slug` comment changes (other task-tracker text in `BuildFlow.jsx` is left per the spec and listed in the stage report).
  - No key or 32-hex string anywhere.

### Task 3a.2: Screenshots and App.jsx slides

**Files:** Modify `module4/src/App.jsx`. Overwrite `module4/src/assets/screenshots/{architect-dashboard,decompose-spec-loaded,decompose-wave-plan,build-ui,deploy-ui,deploy-manual-apply}.png`. Create `module4/src/assets/screenshots/weather-app-live.png`. Delete `module4/src/assets/screenshots/quote-app-live.png`.
**Interfaces:** Import `quoteAppLiveImg` is replaced by `import weatherAppLiveImg from './assets/screenshots/weather-app-live.png';`, which is used by `s8c.image`. Slide ids and count (26) are unchanged. `s15` is unchanged in 3a (plan resolution: its rewrite is 3b's entry slide).

- [ ] **Step 1:** `cp $WORK/shots/run-<ok>/{architect-dashboard,decompose-spec-loaded,decompose-wave-plan,build-ui,deploy-ui,deploy-manual-apply,weather-app-live}.png module4/src/assets/screenshots/ && git rm module4/src/assets/screenshots/quote-app-live.png`.
- [ ] **Step 2:** `code-executor` pastes the targets `SAMPLE_SPEC_HIGHLIGHT`, `s4b.intro`, `s4d.*`, `s4.*`, `s6.caption`, `s8*`, `s10.*` into `App.jsx` verbatim. Inside template literals, escape backtick as `` \` `` and `${` as `\${`. Swap the import.
- [ ] **Step 3:** `cd module4 && npm run lint && npm run build`. Expected: both exit 0.

### Task 3a.3: Flow components

**Files:** Modify `module4/src/components/DeployFlow.jsx` (`STAGES` only), `module4/src/components/PipelineFlow.jsx` (the five `sample` strings and the `deployed-mock-url` span text), and `module4/src/components/BuildFlow.jsx` (the `package.spec_slug` comment line only).

- [ ] **Step 1:** `code-executor` pastes the matching `3a-content.md` targets verbatim.
- [ ] **Step 2:** `grep -rniE "quote of the day|quote-of-the-day|/quote|quoteApp|quote-app|d9331c|task tracker|team-task-tracker|hello-world-abc123" module4/src | grep -vE "WaveGridReplay.jsx|wave-trace.js"`. Expected: no output. (The assessment JSON is fixed in 3a.4, so run this again there.)

### Task 3a.4: Assessment

**Files:** Modify `module4/src/data/assessment-questions.json`.

- [ ] **Step 1:** `code-executor` replaces the A1–A5 and B2 objects by `id`, and the C2/C5 `explanation` strings, from `3a-assessment.json`. `version`, `sections` and the other questions stay unchanged. Leave `s18.body` as is (section names are unchanged).
- [ ] **Step 2:** `node -e "const fs=require('fs');const s=fs.readFileSync('module4/src/App.jsx','utf8');const ids=new Set([...s.matchAll(/\{ id: '([^']+)'/g)].map(m=>m[1]));const b=JSON.parse(fs.readFileSync('module4/src/data/assessment-questions.json','utf8'));const per={};b.questions.forEach(q=>per[q.section]=(per[q.section]||0)+1);console.log(JSON.stringify({total:b.questions.length,per,bad:b.questions.filter(q=>!ids.has(q.slideRef)).map(q=>q.id),slides:ids.size}))"`. Expected: `{"total":15,"per":{"A":5,"B":5,"C":5},"bad":[],"slides":26}`. Record it in `$EVID §Stage 3a checks`.
- [ ] **Step 3:** Rerun the Task 3a.3 Step 2 grep. Expected: no output.

### Task 3a.5: Landing count, verification, publish, close

**Files:** Modify `deploy-landing/index.html` (part4 `slides:18` → `slides:26` only).

- [ ] **Step 1:** Edit the number. `git diff deploy-landing/index.html` should show exactly one changed line.
- [ ] **Step 2:** `cd module4 && npm run lint && npm run build`, then serve and run the click-through tool exactly as in Task 0a.2 Step 3 (`--slides 26 --progress-key part4`). Expected: `"ok":true`. Run `cd deploy-landing && npx playwright test tests/e2e/landing-renumber.spec.js`, expected 3 passed. Run the unlock-gate check.
- [ ] **Step 3: Opus review gate:** `design-reviewer` checks the diff against `$EVID` (every number in the bank and in the slides matches; criteria 1–6 and 9).
- [ ] **Step 4: Commit** `git add module4/src/App.jsx module4/src/components/DeployFlow.jsx module4/src/components/PipelineFlow.jsx module4/src/components/BuildFlow.jsx module4/src/data/assessment-questions.json module4/src/assets/screenshots/architect-dashboard.png module4/src/assets/screenshots/decompose-spec-loaded.png module4/src/assets/screenshots/decompose-wave-plan.png module4/src/assets/screenshots/build-ui.png module4/src/assets/screenshots/deploy-ui.png module4/src/assets/screenshots/deploy-manual-apply.png module4/src/assets/screenshots/weather-app-live.png deploy-landing/index.html docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md`, with message `Module 4: replace worked examples with the real weather run`. (The `quote-app-live.png` deletion is already staged by the `git rm` in Task 3a.2 Step 1, so it is not in the `git add` list.)
- [ ] **Step 5 (publish, plan resolution):** `ssh … "cp -a <part4 dir> <part4 dir>.bak-$(date +%Y%m%d)"` then `rsync -az -e "ssh -i ~/key.pem" --delete module4/dist/ $SSH_TARGET:<part4 dir>/` (dir from `DOCROOT_MAP`). Check: `curl -s -o /dev/null -w '%{http_code}' $PUB/part4/`, expected `200`. Record under `$EVID §Publishes`.

---

## Stage 3b — Part 4 follow-along (needs 3a, 0b PASS, 0c PASS)

Snapshot `<stage>=3b` before Task 3b.1.

### Task 3b.1: `GET /build/download` route and link

**Files:** Create `architect/tests/test_build_download.py`. Modify `architect/webapp.py`, `architect/templates/build.html` and `architect/static/build.js`.
**Interfaces:** Produces `@app.get("/build/download") def build_download() -> Response`.
- `run` must `re.fullmatch(r"[0-9a-f]{12}", run or "")`, else 400 `{"error": "invalid run id"}` (a missing `run` also gets this; plan resolution).
- If `os.path.isdir(_workspace_path(run))` is false: 404 `{"error": "Workspace not found: <run>"}`.
- If `_package.yaml` is missing: 404 `{"error": "Workspace <run> missing _package.yaml — re-run build"}` (plan resolution, same text as `_resolve_deploy_fields`).
- Otherwise `send_file(BytesIO zip, mimetype="application/zip", as_attachment=True, download_name=f"{spec_slug}-{run[:6]}.zip")`, using `ZIP_DEFLATED`. Walk the workspace and skip top-level entries whose name starts with `_`, and any `__pycache__` directory at any depth. Arcnames are relative with `/`.

- [ ] **Step 1: Write the failing tests:**
  ```python
  import io, os, zipfile, pytest
  from architect.webapp import app

  RUN = "abcdef123456"
  PKG = 'metadata: {name: weather-lookup, total_components: 0, total_waves: 0, max_parallelism: 1}\nspec: {tech_stack: ["Language: Python"]}\ndag: {}\n'

  @pytest.fixture
  def client():
      app.config["TESTING"] = True
      with app.test_client() as c:
          yield c

  @pytest.fixture
  def ws(tmp_path, monkeypatch):
      w = tmp_path / RUN
      (w / "src" / "__pycache__").mkdir(parents=True)
      for rel, text in {"_status.json": "{}", "_package.yaml": PKG, "Dockerfile": "FROM python:3.12-slim\n",
                        ".env.example": "OPENWEATHER_API_KEY=\n", "src/app.py": "app = None\n",
                        "src/_helper.py": "x = 1\n", "src/__pycache__/app.cpython-312.pyc": "\x00"}.items():
          (w / rel).write_text(text)
      monkeypatch.setattr("architect.webapp._workspace_path", lambda rid: str(tmp_path / rid))
      return w

  def test_download_zip_contains_files_minus_exclusions(client, ws):
      r = client.get(f"/build/download?run={RUN}")
      assert r.status_code == 200 and r.mimetype == "application/zip"
      names = set(zipfile.ZipFile(io.BytesIO(r.data)).namelist())
      assert names == {"Dockerfile", ".env.example", "src/app.py", "src/_helper.py"}

  def test_download_attachment_name_is_slug_and_run_short(client, ws):
      r = client.get(f"/build/download?run={RUN}")
      assert "attachment" in r.headers["Content-Disposition"]
      assert "weather-lookup-abcdef.zip" in r.headers["Content-Disposition"]

  def test_download_missing_workspace_404(client, ws):
      r = client.get("/build/download?run=0123456789ab")
      assert r.status_code == 404 and r.get_json() == {"error": "Workspace not found: 0123456789ab"}

  def test_download_missing_package_yaml_404(client, ws):
      os.remove(ws / "_package.yaml")
      r = client.get(f"/build/download?run={RUN}")
      assert r.status_code == 404 and "missing _package.yaml" in r.get_json()["error"]

  @pytest.mark.parametrize("bad", ["../etc", "ABCDEF123456", "zzzzzzzzzzzz", "abcdef12345", ""])
  def test_download_rejects_invalid_run_id(client, ws, bad):
      r = client.get(f"/build/download?run={bad}")
      assert r.status_code == 400 and r.get_json() == {"error": "invalid run id"}

  def test_build_page_has_hidden_download_anchor(client):
      html = client.get("/build").data.decode()
      assert 'id="download-workspace"' in html and "Download workspace (.zip)" in html and "hidden" in html

  def test_build_js_download_link_uses_pfx():
      js = open(os.path.join(os.path.dirname(__file__), "..", "static", "build.js")).read()
      assert '`${window.PFX || ""}/build/download?run=${runId}`' in js
  ```
- [ ] **Step 2:** `python -m pytest architect/tests/test_build_download.py -q`. Expected: all FAIL (404 route / missing anchor).
- [ ] **Step 3:** `code-executor` implements the route per the interface (imports `re`, `io`, `zipfile`, and `send_file` from flask). In `build.html`, directly after `<div id="wave-grid"></div>`, add `<a id="download-workspace" class="btn btn-ghost" hidden style="margin-top:1rem;">Download workspace (.zip)</a>`. In `build.js`, add the function below and call `showDownloadLink()` in both `build:complete` paths (the `socket.on` handler and the `applyEvent` case):
  ```js
  function showDownloadLink() {
    const el = document.getElementById("download-workspace");
    if (!el || !runId) return;
    el.href = `${window.PFX || ""}/build/download?run=${runId}`;
    el.hidden = false;
  }
  ```
- [ ] **Step 4:** Run the new tests (all PASS), then `python -m pytest architect/tests -q` (0 failures).
- [ ] **Step 5: Commit** `git add architect/webapp.py architect/templates/build.html architect/static/build.js architect/tests/test_build_download.py` with message `Architect: add /build/download workspace zip + link`.

### Task 3b.2: Ship and public reachability

- [ ] **Step 1:** Confirm no intake/build run is in flight. Run the ship command, then the restart command (once).
- [ ] **Step 2:** If `NGINX_PROXIES_BUILD` is false, `/architect/build/download` needs a location. That is the Task 1.6 nginx variant, with a HUMAN GATE.
- [ ] **Step 3:** In the browser, rebuild the Stage 2 package on `$PUB/architect/build` (or use any completed run id). Expected: the "Download workspace (.zip)" link appears.
- [ ] **Step 4 (Review Focus 4):** `curl -s -D - -o $WORK/artifacts/dl.zip "$PUB/architect/build/download?run=<run>" | grep -iE "content-type|content-disposition"; unzip -l $WORK/artifacts/dl.zip | grep -cE "_status.json|_package.yaml|__pycache__"; unzip -l $WORK/artifacts/dl.zip | grep -c "src/app.py"`. Expected: `application/zip`, `<slug>-<short>.zip`, `0`, `1`.

### Task 3b.3: Kit files

**Files:** Create `module4/public/follow-along/deploy.yml`, `module4/public/follow-along/app.yaml` and `module4/public/follow-along/test_health.py`.
**Interfaces:** `app.yaml` placeholders are exactly `__APP_NAME__`, `__IMAGE__` and `__HOST__`. `deploy.yml` is the single workflow used by Part 4 and Part 5.

- [ ] **Step 1:** `app.yaml` = `architect/templates/deploy_template.yaml` with `{{name}}→__APP_NAME__`, `{{namespace}}→training`, `{{image}}→__IMAGE__`, `{{port}}→3000`, `{{healthcheck_path}}→/healthz` and `{{host}}→__HOST__`, plus `SECRET_REF_BLOCK` (with `__APP_NAME__-openweather`) inserted between `healthcheck:` and `ingress:`. The `ingress:` block is otherwise byte-identical, with no annotations added.
- [ ] **Step 2:** `test_health.py`:
  ```python
  import importlib.util, pathlib, sys

  SRC = pathlib.Path(__file__).resolve().parent.parent / "src"

  def _load_app():
      sys.path.insert(0, str(SRC))
      spec = importlib.util.spec_from_file_location("app", SRC / "app.py")
      mod = importlib.util.module_from_spec(spec)
      spec.loader.exec_module(mod)
      return mod.app

  def test_healthz_returns_200():
      assert _load_app().test_client().get("/healthz").status_code == 200
  ```
- [ ] **Step 3:** `deploy.yml` (replace `__TRAINING_CLUSTER__` with `TRAINING_CLUSTER`; plan resolutions: checkout follows step 0; `defaults.run.shell: bash` gives `-eo pipefail`; the "Wait for operator" step and the unrendered-placeholder guard close Review Focus 3):
  ```yaml
  name: deploy
  on:
    push: { branches: [staging] }
    pull_request: { branches: [staging] }
    workflow_dispatch:
  permissions: { id-token: write, contents: read }
  concurrency: { group: "deploy-${{ github.repository }}", cancel-in-progress: false }
  defaults: { run: { shell: bash } }
  env:
    AWS_REGION: us-east-1
    ECR_REPO: 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app
    EKS_CLUSTER: __TRAINING_CLUSTER__
    NAMESPACE: training
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with: { python-version: "3.12" }
        - run: pip install -r requirements.txt pytest
        - run: python -m pytest -q
    deploy:
      needs: test
      if: github.event_name != 'pull_request'
      runs-on: ubuntu-latest
      steps:
        - name: Check repo secret OPENWEATHER_API_KEY is set
          env: { OPENWEATHER_API_KEY: "${{ secrets.OPENWEATHER_API_KEY }}" }
          run: |
            if [ -z "$OPENWEATHER_API_KEY" ]; then echo "::error::repo secret OPENWEATHER_API_KEY is not set"; exit 1; fi
        - uses: actions/checkout@v4
        - name: Compute app name, host and image
          run: |
            APP_NAME="${{ github.event.repository.name }}"
            echo "APP_NAME=$APP_NAME" >> "$GITHUB_ENV"
            echo "HOST=$APP_NAME-training.tools.fubotv.net" >> "$GITHUB_ENV"
            echo "IMAGE=$ECR_REPO:$APP_NAME-${GITHUB_SHA::7}" >> "$GITHUB_ENV"
        - uses: aws-actions/configure-aws-credentials@v4
          with: { role-to-assume: "arn:aws:iam::650127479436:role/Github-Actions-OIDC-Policy", aws-region: us-east-1 }
        - uses: aws-actions/amazon-ecr-login@v2
        - name: Build and push image
          run: |
            docker build --platform linux/amd64 -t "$IMAGE" .
            docker push "$IMAGE"
        - name: Configure kubectl
          run: aws eks update-kubeconfig --name "$EKS_CLUSTER" --region "$AWS_REGION"
        - name: Create or update this app's OpenWeather Secret
          env: { OPENWEATHER_API_KEY: "${{ secrets.OPENWEATHER_API_KEY }}" }
          run: |
            kubectl create secret generic "$APP_NAME-openweather" -n "$NAMESPACE" \
              --from-literal=OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY" \
              --dry-run=client -o yaml | kubectl apply -f -
        - name: Render deploy/app.yaml
          run: |
            sed -e "s|__APP_NAME__|$APP_NAME|g" -e "s|__IMAGE__|$IMAGE|g" -e "s|__HOST__|$HOST|g" deploy/app.yaml > "$RUNNER_TEMP/app.yaml"
            if grep -n '__[A-Z_]*__' "$RUNNER_TEMP/app.yaml"; then echo "::error::unrendered placeholder"; exit 1; fi
            cat "$RUNNER_TEMP/app.yaml"
        - name: Apply
          run: kubectl apply -f "$RUNNER_TEMP/app.yaml"
        - name: Wait for operator to roll the Deployment to the pushed image
          run: |
            for i in $(seq 1 36); do
              CUR=$(kubectl get deployment "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)
              echo "attempt $i: deployment image=${CUR:-<none>}"
              if [ "$CUR" = "$IMAGE" ]; then exit 0; fi
              sleep 5
            done
            echo "::error::deployed image is stale"; exit 1
        - name: Rollout status
          run: kubectl rollout status "deployment/$APP_NAME" -n "$NAMESPACE" --timeout=180s
        - name: Assert deployed image is the pushed image
          run: |
            DEPLOYED=$(kubectl get deployment "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
            echo "deployed=$DEPLOYED expected=$IMAGE"
            if [ "$DEPLOYED" != "$IMAGE" ]; then echo "::error::deployed image is stale"; exit 1; fi
  ```
- [ ] **Step 4:** Static checks: `grep -rnE "[0-9a-f]{32}" module4/public/follow-along/` (no output); `grep -nE 'smo-cicd-pipeline|argocd|helm|set -x|echo .*\$\{?OPENWEATHER_API_KEY|(echo|run:) .*secrets\.' module4/public/follow-along/deploy.yml` (no output; it matches `$OPENWEATHER_API_KEY`/`${OPENWEATHER_API_KEY}` and `secrets.` expansions in echo/run lines, not the bare name in the step-0 error message); `grep -nE "ssl-redirect|annotations" module4/public/follow-along/app.yaml` (no output); `python3 -c "import yaml;[yaml.safe_load(open(f'module4/public/follow-along/{f}')) for f in ('deploy.yml','app.yaml')];print('ok')"` (`ok`).
- [ ] **Step 5 (Review Focus 1):** `mkdir -p $WORK/artifacts/run-<ok>/ws/tests && cp module4/public/follow-along/test_health.py $WORK/artifacts/run-<ok>/ws/tests/ && cd $WORK/artifacts/run-<ok>/ws && env -u OPENWEATHER_API_KEY .v/bin/python -m pip install -q pytest && env -u OPENWEATHER_API_KEY .v/bin/python -m pytest -q tests/test_health.py`. Expected: `1 passed`.
- [ ] **Step 6: Commit** the three kit files by explicit path, with message `Module 4: follow-along kit (deploy workflow, app manifest, health test)`.

### Task 3b.4: Instructor rehearsal

**Files:** Outside this repo: `$WORK/rehearsal/llm-wx-rpatterson-fubotv/`. Create `$WORK/shots/rehearsal/follow-along-actions-green.png`.
**Interfaces:** Produces `REHEARSAL_REPO`, `REHEARSAL_HOST`, the rehearsal `run_id`, and the first deploy run URL.

- [ ] **Step 1: HUMAN GATE (outward-facing).** Ask: "May I create private repo `fubotv/llm-wx-rpatterson-fubotv` (branch `staging` only) for the rehearsal? It deploys Application `llm-wx-rpatterson-fubotv` and Secret `llm-wx-rpatterson-fubotv-openweather` into `training`."
- [ ] **Step 2:** Walk `s15b`–`s15d` for real on `$PUB/architect/`: fresh intake with the answer files, then spec, decompose (save the YAML from "Download Build Package" to `$WORK/artifacts/rehearsal/build-package.yaml`; never click "Continue to Build →", which points at a canned example), build by uploading that file on `$PUB/architect/build`, and download the zip. After the build, `ssh -i ~/key.pem $SSH_TARGET "cat $BOX_ARCHITECT_DIR/workspaces/<rehearsal run_id>/_package.yaml" | head -20`; expected: it names the weather spec. The Task 2.2 Step 5/6 checks and the 3-run limit apply here too. Set `REHEARSAL_WEATHER_ROUTE=/api/weather` unless the Task 2.2 Step 6 check on this generation records a different path; record it in `$EVID §Real route paths`.
- [ ] **Step 3:** `K=/Users/reubenpatterson/LLM_Presentation/module4/public/follow-along; gh repo create fubotv/llm-wx-rpatterson-fubotv --private && mkdir -p $WORK/rehearsal/llm-wx-rpatterson-fubotv && cd $WORK/rehearsal/llm-wx-rpatterson-fubotv && git init -b staging && unzip -q <downloaded zip> -d . && mkdir -p .github/workflows deploy tests && cp $K/deploy.yml .github/workflows/ && cp $K/app.yaml deploy/ && cp $K/test_health.py tests/`.
- [ ] **Step 4: HUMAN GATE (key).** Ask the user to run `gh secret set OPENWEATHER_API_KEY -R fubotv/llm-wx-rpatterson-fubotv` and paste the key at the hidden prompt.
- [ ] **Step 5:** `git add Dockerfile requirements.txt .env.example src .github deploy tests && git commit -m "Initial weather app" && git remote add origin git@github.com:fubotv/llm-wx-rpatterson-fubotv.git && git push -u origin staging`.
- [ ] **Step 6:** `gh run watch -R fubotv/llm-wx-rpatterson-fubotv $(gh run list -R fubotv/llm-wx-rpatterson-fubotv -L1 --json databaseId -q '.[0].databaseId')`. Expected: `test` and `deploy` green. Screenshot the run page → `follow-along-actions-green.png` (no key visible). Record the run URL.
- [ ] **Step 7:** Repeat Task 2.4 Steps 2 and 4 against `REHEARSAL_HOST`, with `$REHEARSAL_WEATHER_ROUTE` in place of `$WEATHER_ROUTE` (Step 4 is a HUMAN GATE for the key). Expected: `/` has "Get weather" with no `id="clock"`, the 404 for `zzzznotacity`, and the Chicago comparison within ±2°F (criterion 8).
- [ ] **Step 8 (Review Focus 2):** Names only, never env values: `kubectl get deployment llm-wx-rpatterson-fubotv -n training -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"<-"}{.valueFrom.secretKeyRef.name}{"\n"}{end}{.spec.template.spec.containers[0].envFrom[*].secretRef.name}{"\n"}{.spec.template.spec.containers[0].image}'`. Expected: it contains `llm-wx-rpatterson-fubotv-openweather` and the image tag the run pushed. Then `kubectl get deployment llm-wx-rpatterson-fubotv -n training -o json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(any(e.get("name")=="OPENWEATHER_API_KEY" and "value" in e for e in d["spec"]["template"]["spec"]["containers"][0].get("env",[])))'`. Expected: `False` (no literal `value` for `OPENWEATHER_API_KEY`).
- [ ] **Step 9:** `cd $WORK/rehearsal/llm-wx-rpatterson-fubotv && git log -p --all --format= | grep -cE "[0-9a-f]{32}"`. Expected `0` (criterion 10). Record it in `$EVID §Stage 3b rehearsal`.

### Task 3b.5: Follow-along slides

**Files:** Create `$WORK/content/3b-content.md`. Modify `module4/src/App.jsx` and `deploy-landing/index.html` (part4 `slides:26` → `slides:33`). Create `module4/src/assets/screenshots/follow-along-actions-green.png` (plan resolution: the spec names no file for `s15f`).
**Interfaces:** Inserts slides `s15a`–`s15g` between `s15` and `s16`. Types: `s15` text, `s15a` codeblock, `s15b` codeblock, `s15c` text, `s15d` text, `s15e` codeblock, `s15f` image (`followAlongActionsImg`), `s15g` codeblock. It also appends the follow-along sentence to `s10.body`.

- [ ] **Step 1:** `spec-author` writes `3b-content.md` with targets `s15.title`/`s15.body`, `s15a…s15g` (`title` + `body` / `intro` + `code` / `caption`) and `s10.body.followAlongSentence`, following the spec's `s15`–`s15g` table and these rules:
  - `s15a.code` contains the exact curl `curl -s "https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY"`, the expected `"name":"London"`, and the 401 activation warning.
  - `s15b.code` is the `$WORK/answers` files concatenated under channel headers.
  - `s15d` uses the real `$PUB/architect/build` path and the link text "Download workspace (.zip)".
  - `s15e.code` uses `git init -b staging`, explicit-path `git add`, `gh secret set OPENWEATHER_API_KEY -R fubotv/llm-wx-<your-login>` (prompted, never a file), and kit URLs `$PUB/part4/follow-along/{deploy.yml,app.yaml,test_health.py}`.
  - `s15g` uses real rehearsal curl output and the four-item "looks like success but isn't" checklist.
  - No key or 32-hex string anywhere.
- [ ] **Step 2:** `cp $WORK/shots/rehearsal/follow-along-actions-green.png module4/src/assets/screenshots/`. `code-executor` adds the import `import followAlongActionsImg from './assets/screenshots/follow-along-actions-green.png';`, then pastes the slides and the `s10` sentence verbatim. Edit the landing number.
- [ ] **Step 3:** Rerun the 3a checks with 33: `npm run lint && npm run build`; the Task 3a.4 Step 2 node check, expected `…"bad":[],"slides":33}`; the click-through tool (`--slides 33 --progress-key part4`), expected `"ok":true`. Run `grep -rnE "[0-9a-f]{32}" module4/public/follow-along/` (no output).

### Task 3b.6: Approval gate, commit, publish, close

- [ ] **Step 1: HUMAN GATE (platform approval).** Ask: "Have the platform owners confirmed that their one-Application-per-learner approval also covers one Secret per learner app (`<app-name>-openweather`), created and patched by that learner's workflow in `training`?" Do not publish the 3b slides until the answer is yes.
- [ ] **Step 2: Opus review gate:** `design-reviewer` reviews the download route, the kit (secret handling, ingress rule, placeholder guard, operator wait) and the slides against `$EVID` (criteria 7, 8, 10, then 1, 3, 5 again).
- [ ] **Step 3: Commit** `git add module4/src/App.jsx module4/src/assets/screenshots/follow-along-actions-green.png deploy-landing/index.html docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md` with message `Module 4: follow-along path (s15–s15g)`.
- [ ] **Step 4:** Publish module4 as in Task 3a.5 Step 5. Then `for f in deploy.yml app.yaml test_health.py; do curl -s $PUB/part4/follow-along/$f | cmp - module4/public/follow-along/$f && echo "$f identical"; done`. Expected: three `identical` lines.

---

## Stage 4 — Part 5 redesign (needs 3b, 0b PASS, 0c PASS)

Snapshot `<stage>=4` before Task 4.1.

### Task 4.1: Port, cut, and lint-clean components

**Files:** Create (copy) `testing-with-llms/src/components/CheckpointPipeline.jsx` and `testing-with-llms/src/components/OwnershipModel.jsx`. Modify `testing-with-llms/src/App.jsx` (imports and `COMPONENT_MAP` only). Delete `testing-with-llms/src/components/E2ETestRunner.jsx` and `testing-with-llms/src/components/LoadTestDashboard.jsx`. Modify `testing-with-llms/src/components/TestingQuiz.jsx` and `testing-with-llms/src/components/UnitTestExplorer.jsx` (fixing pre-existing lint errors is in scope, because criterion 1 requires lint clean; plan resolution).

- [ ] **Step 1:** `cp cicd-with-llms/src/components/CheckpointPipeline.jsx cicd-with-llms/src/components/OwnershipModel.jsx testing-with-llms/src/components/ && git rm testing-with-llms/src/components/E2ETestRunner.jsx testing-with-llms/src/components/LoadTestDashboard.jsx`. In `App.jsx`, remove the two imports and their `COMPONENT_MAP` entries, and add `CheckpointPipeline` and `OwnershipModel` to both. The old slides that reference the cut components are replaced in Task 4.6.
- [ ] **Step 2:** `cd testing-with-llms && npm run lint`. Expected FAIL, showing exactly the known errors: TestingQuiz 323 `watermark`, 355 impure; UnitTestExplorer 168 setState-in-effect, 208 `cov`.
- [ ] **Step 3:** `code-executor` makes these fixes:
  - TestingQuiz: delete the unused `watermark = "LLM ENGINEERING COURSE"` parameter from `downloadCertPDF`, and change the cert id to ``const [id] = useState(() => `TLLM-${hashCode(name + score)}-${Date.now().toString(36).toUpperCase()}`);``.
  - UnitTestExplorer: delete the `useEffect` that resets on `activeTab`, and add `const selectTab = (tab) => { setActiveTab(tab); setTestStatuses(null); setRunning(false); setHasRun(false); };`. Every tab `onClick` that called `setActiveTab(x)` now calls `selectTab(x)`. Delete the `cov` line, and also `llmCoverage`/`completeCoverage` if they then have no references. Remove `useEffect` from the import if it is unused.
- [ ] **Step 4:** `npm run lint`. Expected: 0 problems.

### Task 4.2: `code` field on TextSlide

**Files:** Modify `testing-with-llms/src/App.jsx`.
**Interfaces:** Optional slide field `code: string`, rendered directly after the `body` `<p>` as `<pre data-testid="slide-code" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.5, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", margin: "0 0 24px 0", whiteSpace: "pre", overflowX: "auto" }}>{slide.code}</pre>`.

- [ ] **Step 1:** Implement. `npm run lint && npm run build`. Expected: exit 0.

### Task 4.3: Change-specs for Paths A and B (spec-author)

**Files:** Create `$WORK/content/4-change-specs.md`.
**Interfaces:** Two dense change-specs.
- **Path A:** the default city `New York` becomes `<learner's city>` in the input prefill and the first-load fetch. Tests: positive (page HTML contains the new default) and negative (`/api/weather` with an empty city still returns 400).
- **Path B:** `GET /api/weather?city=<name>&units=<imperial|metric>`, default `imperial`, response `{"city": str, "temp": number, "units": "imperial"|"metric", "description": str}`. An invalid `units` returns 400 `{"error": "units must be imperial or metric"}` (plan resolution). The upstream call passes `units=<units>`. The page gets a °F/°C toggle that refetches. Tests use mocked `requests.get`: positive `test_units_metric_passed_upstream_and_echoed`, negative `test_units_invalid_returns_400`.

- [ ] **Step 1:** Dispatch `spec-author`. Both specs must use the real route (`REHEARSAL_WEATHER_ROUTE`) and the real file names from the rehearsal repo.

### Task 4.4: The loop, for real, in the rehearsal repo

**Files:** In the rehearsal repo, branches `path-b-units` and `deliberate-fail`. Create `$WORK/shots/part5/{rehearsal-live,pr-checks,merge-run-green,verify-change-live}.png`.
**Interfaces:** Produces the PR URL, three run URLs (PR, deliberate-fail, merge), the dispatch-without-secret run URL, and the real test code and curl output for the Part 5 slides.

- [ ] **Step 1:** Screenshot the current live rehearsal app → `rehearsal-live.png`.
- [ ] **Step 2:** `cd $WORK/rehearsal/llm-wx-rpatterson-fubotv && git switch -c path-b-units`. `code-executor` (acting as the learner's LLM) implements the Path B change-spec and its two tests. Then `pip install -r requirements.txt pytest && python -m pytest -q`. Expected: all pass, including `test_health.py`.
- [ ] **Step 3:** `git add <changed files> && git commit -m "Path B: °F/°C units toggle" && git push -u origin path-b-units && gh pr create -R fubotv/llm-wx-rpatterson-fubotv --base staging --title "Path B: units toggle" --body "Path B change"`. Watch the run. Expected: `test` success, `deploy` skipped. Screenshot the PR checks → `pr-checks.png`.
- [ ] **Step 4 (criterion 6):** `git switch staging && git switch -c deliberate-fail`, then add `tests/test_deliberate_fail.py` containing `def test_deliberately_fails():\n    assert False, "deliberate failure to show the PR gate"`. Push and open a PR. Expected: `test` failure and `deploy` not run. Record the URL, then `gh pr close <n> -R … --delete-branch`.
- [ ] **Step 5:** `kubectl get secrets -n training -o custom-columns=NAME:.metadata.name,RV:.metadata.resourceVersion --no-headers > $WORK/artifacts/secrets-before.txt`.
- [ ] **Step 6:** `gh pr merge <path-b pr> -R … --merge`, then watch the staging run. Expected: `deploy` green, including "Wait for operator" and "Assert deployed image". Screenshot → `merge-run-green.png`.
- [ ] **Step 7 (criterion 9):** Run the same `kubectl get secrets …` into `secrets-after.txt`, then `diff secrets-before.txt secrets-after.txt`. Expected: no changed line other than `llm-wx-rpatterson-fubotv-openweather`. Run `kubectl get secret llm-wx-rpatterson-fubotv-openweather -n training -o name` (exists; never decoded).
- [ ] **Step 8: HUMAN GATE (key).** Ask the user to run: `date -u +%T; curl -s "https://$REHEARSAL_HOST$REHEARSAL_WEATHER_ROUTE?city=Chicago&units=metric"; echo; curl -s "https://api.openweathermap.org/data/2.5/weather?q=Chicago&appid=$OPENWEATHER_API_KEY&units=metric" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["main"]["temp"],d["weather"][0]["description"])'; date -u +%T`. Expected: `"units":"metric"` and `|Δtemp| ≤ 1`. Toggle °C in the browser and screenshot → `verify-change-live.png`.
- [ ] **Step 9 (Review Focus 3):** `gh run view <merge run> -R … --log | grep -E "attempt [0-9]+: deployment image=|deployed="`. Expected: the final line shows `deployed=…:llm-wx-rpatterson-fubotv-<merge short sha>`. A prior attempt showing the old tag is fine.
- [ ] **Step 10: HUMAN GATE (key).** Ask the user to run `gh run view <merge run> -R fubotv/llm-wx-rpatterson-fubotv --log | grep -cF -- "$OPENWEATHER_API_KEY"`, and report the number. Expected `0`.
- [ ] **Step 11:** With the user's go-ahead (part of this gate): `gh secret delete OPENWEATHER_API_KEY -R fubotv/llm-wx-rpatterson-fubotv && gh workflow run deploy.yml -R fubotv/llm-wx-rpatterson-fubotv --ref staging`. Expected: the run fails at the first `deploy` step with `repo secret OPENWEATHER_API_KEY is not set`. **HUMAN GATE (key):** the user re-adds the secret with `gh secret set OPENWEATHER_API_KEY -R fubotv/llm-wx-rpatterson-fubotv`.
- [ ] **Step 12:** `git log -p --all --format= | grep -cE "[0-9a-f]{32}"`. Expected `0` (criterion 7). Record all URLs and outputs in `$EVID §Stage 4 loop`.

### Task 4.5: Part 5 content (spec-author)

**Files:** Create `$WORK/content/4-content.md` and `$WORK/content/4-quiz.js`.
**Interfaces:**
- `4-content.md` holds:
  - the 25 slide objects in spec order;
  - replacement constants `happyPathTests`, `edgeCases` (HappyPathFallacy), `codeLines`, `llmTests`, `completeTests` (UnitTestExplorer), `REQUIREMENTS` (FunctionalTestViz), and `STAGES`, `FAILURE_OPTIONS`, `FAILURE_LOGS` (CheckpointPipeline: ids `test, build, push, apply, rollout`, labels `Test, Build, Push, Apply, Rollout check`), each in its existing shape;
  - IntroScreen blurb, `quiz-intro` subtitle `15 Questions · 3 Sections · Certificate on Completion`, the certificate `body`;
  - landing `part5.desc`.
- `4-quiz.js` exports `SECTIONS` (3: `Testing the Change`, `The Staging Workflow`, `Verifying & Owning It`) and `QUESTIONS` (15, 5 per section, existing shape `{section, q, options[4], answer, explanation}`).

- [ ] **Step 1:** Dispatch `spec-author` with `$EVID §Stage 3b`/`§Stage 4`, the real `deploy.yml`, and the rehearsal test files. Slide ids and types (plan resolution for component-slide ids and media):

| # | id | type | media |
| --- | --- | --- | --- |
| 1 | p5-title | text | — |
| 2 | p5-where | text | image `rehearsal-live.png` (real) |
| 3 | p5-loop | text | bullets |
| 4 | p5-green-not-working | text | — |
| 5 | p5-happy-path-demo | component HappyPathFallacy | instructions start `Illustrative:` |
| 6 | p5-choose-change | text | code: both change-specs |
| 7 | p5-spec-the-change | text | — |
| 8 | p5-unit | text | code: real Path B unit test (real) |
| 9 | p5-unit-demo | component UnitTestExplorer | `Illustrative:` |
| 10 | p5-functional | text | code: real Flask test-client test (real) |
| 11 | p5-functional-demo | component FunctionalTestViz | `Illustrative:` |
| 12 | p5-not-running | text | — |
| 13 | p5-branch-pr | text | image `pr-checks.png` (real) |
| 14 | p5-workflow | text | code: `deploy.yml` verbatim (real) |
| 15 | p5-oidc | text | — |
| 16 | p5-checkpoint-demo | component CheckpointPipeline | `Illustrative:` |
| 17 | p5-merge-run | text | image `merge-run-green.png` (real) |
| 18 | p5-verify | text | image `verify-change-live.png` + code: real curl and image-tag check |
| 19 | p5-stale | text | — |
| 20 | p5-ownership-demo | component OwnershipModel | instructions: repo/workflow vs cluster/role |
| 21 | p5-lab | text | bullets checklist |
| 22 | p5-takeaways | text | bullets |
| 23 | quiz-intro | text | — |
| 24 | quiz | component TestingQuiz | — |
| 25 | p5-end | text `Course Complete` | no `nextModuleUrl` |

  Rules: "real" slides use only `$EVID` output. Nothing mentions api.weather.gov, typewriter, 15 cities, `CitySelector` or `localhost:517`. No key or 32-hex string.

### Task 4.6: Apply the Part 5 content

**Files:** Modify `testing-with-llms/src/App.jsx` (`SLIDES` replaced, image imports added), `HappyPathFallacy.jsx`, `UnitTestExplorer.jsx`, `FunctionalTestViz.jsx`, `CheckpointPipeline.jsx` (constants only) and `TestingQuiz.jsx` (`SECTIONS`, `QUESTIONS`, intro blurb, cert body). Create `testing-with-llms/src/assets/screenshots/{rehearsal-live,pr-checks,merge-run-green,verify-change-live}.png` (plan resolution for file names).

- [ ] **Step 1:** Copy the four PNGs. `code-executor` pastes the content verbatim.
- [ ] **Step 2:** `cd testing-with-llms && npm run lint && npm run build`. Expected: exit 0. Then `grep -rniE "weather\.gov|typewriter|CitySelector|15 (US )?cities|localhost:517" src` (no output). Then `node -e "const s=require('fs').readFileSync('src/components/TestingQuiz.jsx','utf8');const m=[...s.matchAll(/section: (\d)/g)].map(x=>x[1]);console.log(m.length,['0','1','2'].map(k=>m.filter(v=>v===k).length).join(','))"`. Expected: `15 5,5,5`.
- [ ] **Step 3:** `npm run dev -- --port 5177 --strictPort &`, then the click-through tool `--url http://localhost:5177/part5/ --slides 25 --progress-key part5`. Expected: `"ok":true`, `"counter":"25 / 25"`.

### Task 4.7: Landing, commit, publish, close

**Files:** Modify `deploy-landing/index.html` (part5 `desc` → `4-content.md` value, `slides:0` → `slides:25`; `id`, `path` and `serverLocks` untouched).

- [ ] **Step 1:** Edit. `git diff deploy-landing/index.html` shows only the part5 line changed. Run the unlock-gate check.
- [ ] **Step 2: Opus review gate:** `design-reviewer` checks Part 5 against criteria 1–10 and the "Illustrative"/"real" labelling.
- [ ] **Step 3: Commit** `git add testing-with-llms/src/App.jsx testing-with-llms/src/components/HappyPathFallacy.jsx testing-with-llms/src/components/UnitTestExplorer.jsx testing-with-llms/src/components/FunctionalTestViz.jsx testing-with-llms/src/components/TestingQuiz.jsx testing-with-llms/src/components/CheckpointPipeline.jsx testing-with-llms/src/components/OwnershipModel.jsx testing-with-llms/src/assets/screenshots/rehearsal-live.png testing-with-llms/src/assets/screenshots/pr-checks.png testing-with-llms/src/assets/screenshots/merge-run-green.png testing-with-llms/src/assets/screenshots/verify-change-live.png deploy-landing/index.html docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md` with message `Part 5: rebuild around the weather app staging loop`. (The `E2ETestRunner.jsx` and `LoadTestDashboard.jsx` deletions are already staged by the `git rm` in Task 4.1 Step 1, so they are not in the `git add` list.)
- [ ] **Step 4 (publish, plan resolution; stays admin-locked):** Back up and rsync `testing-with-llms/dist/` to the part5 dir from `DOCROOT_MAP` (`rsync -az -e "ssh -i ~/key.pem" --delete testing-with-llms/dist/ $SSH_TARGET:<part5 dir>/`). Check `curl -s -o /dev/null -w '%{http_code}' $PUB/part5/`, expected `200`.

---

## Stage 5 — Refresher (needs 0a only; Task 5.7 runs last)

Snapshot `<stage>=5` before Task 5.1.

### Task 5.1: Scaffold `refresher/`

**Files:** Create `refresher/package.json`, `refresher/package-lock.json` (from `npm install`), `refresher/vite.config.js`, `refresher/eslint.config.js` (a byte copy of `context-and-sessions/eslint.config.js`), `refresher/index.html`, `refresher/src/main.jsx`, `refresher/src/test-setup.js` (`import '@testing-library/jest-dom/vitest'`), `refresher/src/App.jsx` (placeholder) and `refresher/src/isolation.test.js`.
**Interfaces:**
- `package.json`: `"name": "refresher"`; scripts `dev`, `build`, `lint`, `preview`, `test` (`vitest run`), `test:watch`; dependencies `react`/`react-dom` `^19.2.4`; devDependencies identical to `context-and-sessions/package.json`'s devDependencies (no three.js, recharts or jspdf).
- `vite.config.js`: `plugins: [react()]`, `base: '/refresher/'`, `server: { port: 5180 }`, `esbuild: { jsx: 'automatic' }`, `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.js'] }`.
- `index.html`: title `Parts 1–3 Refresher`, `<div id="root">`, the module script `/src/main.jsx`, and nothing else.
- Every refresher test file explicitly imports what it uses from `'vitest'` (`it`, `expect`, `vi`, `describe`, `beforeEach`, `afterEach`), so the byte-copied eslint config lints it clean.

- [ ] **Step 1: Failing test** `refresher/src/isolation.test.js`:
  ```js
  import { it, expect } from 'vitest'
  import { readFileSync, readdirSync, statSync } from 'node:fs'
  import { join, dirname } from 'node:path'
  import { fileURLToPath } from 'node:url'
  const SRC = dirname(fileURLToPath(import.meta.url))
  const FORBIDDEN = ['llm_course_progress', 'flow-through', '__LLM_MODULE_ID__']
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
  it('refresher src and index.html never reference progress or gate plumbing', () => {
    const files = [...walk(SRC).filter((p) => !p.endsWith('isolation.test.js')), join(SRC, '..', 'index.html')]
    const hits = files.flatMap((f) => FORBIDDEN.filter((s) => readFileSync(f, 'utf8').includes(s)).map((s) => `${f}: ${s}`))
    expect(hits).toEqual([])
  })
  ```
- [ ] **Step 2:** Write `package.json`, `vite.config.js`, `eslint.config.js` and `src/test-setup.js`, then `cd refresher && npm install && npm test`. Expected: FAIL with `ENOENT … index.html`.
- [ ] **Step 3:** Write `index.html` and `src/main.jsx` (`createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)`, importing `./App`; create a placeholder `src/App.jsx` exporting `function App(){ return null }`, which Task 5.4 replaces). `npm test && npm run lint`. Expected: PASS and clean.
- [ ] **Step 4: Commit** the listed files plus `refresher/src/App.jsx` by explicit path, with message `Refresher: scaffold isolated Vite app`.

### Task 5.2: `src/lib/scoring.js`

**Files:** Create `refresher/src/lib/scoring.js` and `refresher/src/lib/scoring.test.js`.
**Interfaces:**
- `READY_THRESHOLD = 18`, `REVIEW_THRESHOLD = 6`.
- `buildSequence(questions, rng = Math.random) → SeqItem[]`. The output is grouped by part 1→2→3. Within each part, question order is Fisher–Yates shuffled with `j = Math.floor(rng() * (i + 1))`. Each item's options are shuffled the same way and `answer` is remapped. Input is never mutated. `SeqItem = { id, part, term, review, q, options: string[4], answer: 0-3, explanation }`. (Plan resolution: `buildSequence` lives in `scoring.js`.)
- `score(sequence, answers) → number`, where `answers: { [id]: selectedIndex }`.
- `breakdownByPart(sequence, answers) → [{ part, correct, total, flagged }]` for parts 1, 2 and 3, with `flagged = correct < REVIEW_THRESHOLD`.
- `missedQuestions(sequence, answers) → [{ id, part, q, correctAnswer, review, href }]` in sequence order, with `href = '/part' + part + '/'`.
- `isReady(score) → score >= READY_THRESHOLD`.

- [ ] **Step 1: Failing tests:**
  ```js
  import { it, expect } from 'vitest'
  import { buildSequence, score, breakdownByPart, missedQuestions, isReady } from './scoring'
  const mk = (p, n) => ({ id: `P${p}-${n}`, part: p, term: 't', review: { slideNumber: n, slideTitle: `T${n}` }, q: `Q${p}-${n}`,
    options: ['a', 'b', 'c', 'd'].map((x) => `${x}${p}${n}`), answer: n % 4, explanation: 'e' })
  const BANK = [1, 2, 3].flatMap((p) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => mk(p, n)))
  const correctAll = (seq) => Object.fromEntries(seq.map((s) => [s.id, s.answer]))

  it('buildSequence groups by part 1→2→3 with all 24 unique', () => {
    const seq = buildSequence(BANK)
    expect(seq.map((s) => s.part)).toEqual([...Array(8).fill(1), ...Array(8).fill(2), ...Array(8).fill(3)])
    expect(new Set(seq.map((s) => s.id)).size).toBe(24)
  })
  it('buildSequence remaps answer so options[answer] is the original correct text (200 runs)', () => {
    for (let r = 0; r < 200; r++) for (const s of buildSequence(BANK)) {
      const o = BANK.find((b) => b.id === s.id)
      expect(s.options[s.answer]).toBe(o.options[o.answer])
      expect([...s.options].sort()).toEqual([...o.options].sort())
    }
  })
  it('buildSequence does not mutate input and honours rng', () => {
    const before = JSON.stringify(BANK)
    expect(buildSequence(BANK, () => 0)).toEqual(buildSequence(BANK, () => 0))
    expect(JSON.stringify(BANK)).toBe(before)
  })
  it('score / breakdown / missed / isReady', () => {
    const seq = buildSequence(BANK, () => 0)
    const ans = correctAll(seq)
    ;['P1-1', 'P1-2', 'P1-3'].forEach((id) => { const s = seq.find((x) => x.id === id); ans[id] = (s.answer + 1) % 4 })
    expect(score(seq, ans)).toBe(21)
    expect(breakdownByPart(seq, ans)).toEqual([
      { part: 1, correct: 5, total: 8, flagged: true }, { part: 2, correct: 8, total: 8, flagged: false },
      { part: 3, correct: 8, total: 8, flagged: false }])
    const missed = missedQuestions(seq, ans)
    expect(missed.map((m) => m.id).sort()).toEqual(['P1-1', 'P1-2', 'P1-3'])
    expect(missed.every((m) => m.href === '/part1/' && m.correctAnswer === BANK.find((b) => b.id === m.id).options[BANK.find((b) => b.id === m.id).answer])).toBe(true)
    expect(isReady(18)).toBe(true); expect(isReady(17)).toBe(false)
  })
  ```
- [ ] **Step 2:** `npm test -- scoring`. Expected: FAIL (module missing).
- [ ] **Step 3:** `code-executor` implements per the interface. `npm test -- scoring` passes, and `npm run lint` is clean.
- [ ] **Step 4: Commit** both files, with message `Refresher: pure scoring and sequence functions`.

### Task 5.3: Question bank

**Files:** Create `$WORK/content/refresher-questions.json` (spec-author), then `refresher/src/data/refresher-questions.json` and `refresher/src/data/bank.test.js`.
**Interfaces:** The spec's shape: `{ "version": 1, "questions": [{ "id": "P<part>-<1..8>", "part", "term", "review": { "slideNumber", "slideTitle" }, "q", "options": [4], "answer", "explanation" }] }`. Topics come from the spec's Part 1/2/3 table, one question per topic.

- [ ] **Step 1:** Dispatch `spec-author` with the three quiz sources (`presentation/src/components/EngineeringProfQuiz.jsx`, `working-with-llms/src/components/WorkingWithQuiz.jsx`, `context-and-sessions/src/data/assessment-questions.json`) and the three slide sources. Rules: each `slideTitle` is copied character-for-character from the Part's source; explanations are ≤ 40 words; options are distinct; `q` strings are unique.
- [ ] **Step 2: Failing test** `bank.test.js`:
  ```js
  import { it, expect } from 'vitest'
  import { readFileSync } from 'node:fs'
  import { fileURLToPath } from 'node:url'
  import bank from './refresher-questions.json'
  const SRC = { 1: '../../../presentation/src/App.jsx', 2: '../../../working-with-llms/src/App.jsx', 3: '../../../context-and-sessions/src/slides.jsx' }
  const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const Q = bank.questions
  it('version 1, 24 questions, 8 per Part', () => {
    expect(bank.version).toBe(1); expect(Q).toHaveLength(24)
    expect([1, 2, 3].map((p) => Q.filter((q) => q.part === p).length)).toEqual([8, 8, 8])
  })
  it('ids match P<part>-<1..8> and are unique; q unique', () => {
    expect(Q.every((q) => new RegExp(`^P${q.part}-[1-8]$`).test(q.id))).toBe(true)
    expect(new Set(Q.map((q) => q.id)).size).toBe(24); expect(new Set(Q.map((q) => q.q)).size).toBe(24)
  })
  it('4 distinct options, answer in range, explanation ≤ 40 words', () => {
    for (const q of Q) {
      expect(new Set(q.options).size).toBe(4); expect(q.answer >= 0 && q.answer <= 3).toBe(true)
      expect(q.explanation.trim().split(/\s+/).length).toBeLessThanOrEqual(40)
    }
  })
  it('review.slideNumber is a positive integer and slideTitle exists in that Part source', () => {
    const src = { 1: read(SRC[1]), 2: read(SRC[2]), 3: read(SRC[3]) }
    expect(Q.filter((q) => !(Number.isInteger(q.review.slideNumber) && q.review.slideNumber > 0)).map((q) => q.id)).toEqual([])
    expect(Q.filter((q) => !src[q.part].includes(q.review.slideTitle)).map((q) => q.id)).toEqual([])
  })
  ```
- [ ] **Step 3:** `npm test -- bank` FAILs (file missing). Then `cp $WORK/content/refresher-questions.json refresher/src/data/` and run `npm test -- bank`. Expected: PASS. If a title is missing, send it back to `spec-author`; never edit the Part sources.
- [ ] **Step 4: Commit** both files, with message `Refresher: 24-question Parts 1–3 bank`.

### Task 5.4: `App.jsx`

**Files:** Modify `refresher/src/App.jsx` (replaces the 5.1 placeholder); create `refresher/src/App.test.jsx`.
**Interfaces:** `export default function App()`. Phases are `intro → quiz → results`. `const [sequence, setSequence] = useState(() => buildSequence(bank.questions))`. Inline styles reuse the colour constants `C` from `module4/src/components/Assessment.jsx`. Required `data-testid`s:
- intro: `start-btn`.
- quiz: `question-counter` (`Question n of 24`), `part-label` (`Part N`), `question-text`, `opt-0`…`opt-3`, `reveal-btn` (shown only after a selection), `explanation`, `next-btn`.
- results: `score` (`Score: X/24 (P%)`, with `P = Math.round(X/24*100)`); `verdict` (`Ready for Parts 4 & 5` if `isReady`, else `Review recommended`); `part-row-1..3` (`Part N`, `c/8`, plus a `Review` badge only when flagged); `missed-list` (rendered when there is at least one miss), containing `missed-item-<id>` with the question, `Correct answer: <text>`, `Review: Part N — Slide S: <title>`, `<a href="/partN/">Open Part N</a>` and `(requires Part N unlocked)`; `retake-btn`.

Retake sets a fresh `buildSequence(...)`, clears answers, sets the index to 0, and goes to phase `quiz`. No `localStorage`/`sessionStorage`, analytics or certificate.

- [ ] **Step 1: Failing tests** `App.test.jsx`:
  ```jsx
  import { it, expect, vi, beforeEach, afterEach } from 'vitest'
  import { render, screen, fireEvent, within } from '@testing-library/react'
  import App from './App'
  import bank from './data/refresher-questions.json'
  let spies
  beforeEach(() => { spies = ['getItem', 'setItem', 'removeItem'].map((m) => vi.spyOn(Storage.prototype, m)) })
  afterEach(() => vi.restoreAllMocks())
  function runThrough(wrongIds) {
    fireEvent.click(screen.getByTestId('start-btn'))
    for (let i = 0; i < 24; i++) {
      expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 24`)
      const o = bank.questions.find((q) => q.q === screen.getByTestId('question-text').textContent)
      const right = o.options[o.answer]
      const opts = [0, 1, 2, 3].map((k) => screen.getByTestId(`opt-${k}`))
      fireEvent.click(wrongIds === 'all' || wrongIds.includes(o.id) ? opts.find((x) => x.textContent !== right) : opts.find((x) => x.textContent === right))
      fireEvent.click(screen.getByTestId('reveal-btn'))
      expect(screen.getByTestId('explanation')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('next-btn'))
    }
  }
  it('one miss per Part: ready, rows 7/8, missed list and links match, no storage access', () => {
    render(<App />); runThrough(['P1-1', 'P2-1', 'P3-1'])
    expect(screen.getByTestId('score')).toHaveTextContent('Score: 21/24 (88%)')
    expect(screen.getByTestId('verdict')).toHaveTextContent('Ready for Parts 4 & 5')
    ;[1, 2, 3].forEach((p) => { const r = screen.getByTestId(`part-row-${p}`); expect(r).toHaveTextContent('7/8'); expect(r).not.toHaveTextContent('Review') })
    const items = within(screen.getByTestId('missed-list')).getAllByTestId(/^missed-item-/)
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual(['missed-item-P1-1', 'missed-item-P2-1', 'missed-item-P3-1'])
    expect(items.map((el) => within(el).getByRole('link').getAttribute('href'))).toEqual(['/part1/', '/part2/', '/part3/'])
    items.forEach((el) => expect(el).toHaveTextContent('(requires Part'))
    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
  })
  it('all wrong: review recommended, every row flagged, 24 missed', () => {
    render(<App />); runThrough('all')
    expect(screen.getByTestId('verdict')).toHaveTextContent('Review recommended')
    ;[1, 2, 3].forEach((p) => expect(screen.getByTestId(`part-row-${p}`)).toHaveTextContent(/0\/8.*Review/))
    expect(within(screen.getByTestId('missed-list')).getAllByTestId(/^missed-item-/)).toHaveLength(24)
  })
  it('retake resets to question 1 with no results', () => {
    render(<App />); runThrough([])
    expect(screen.queryByTestId('missed-list')).toBeNull()
    fireEvent.click(screen.getByTestId('retake-btn'))
    expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 24')
    expect(screen.queryByTestId('score')).toBeNull()
  })
  ```
- [ ] **Step 2:** `npm test -- App` FAILs. `code-executor` implements. Then `npm test && npm run lint && npm run build`. Expected: all pass and exit 0.
- [ ] **Step 3: Commit** both files, with message `Refresher: quiz flow and results screen`.

### Task 5.5: Slide-number verification and timed run

- [ ] **Step 1:** Serve each Part on its own port: `presentation` → 5191 (`/part1/`), `working-with-llms` → 5192 (`/part2/`), `context-and-sessions` → 5193 (`/part3/`), using `(cd <dir> && npx vite --port <port> --strictPort &)`. For each p, run `NODE_PATH=/Users/reubenpatterson/LLM_Presentation/deploy-landing/node_modules node $WORK/tools/clickthrough.cjs --url http://localhost:<port>/part<p>/ --slides <max slideNumber used for p> --dump $WORK/artifacts/part<p>-dump.json`. Then from the repo root run `node -e "const b=require('./refresher/src/data/refresher-questions.json');const d={1:require('$WORK/artifacts/part1-dump.json'),2:require('$WORK/artifacts/part2-dump.json'),3:require('$WORK/artifacts/part3-dump.json')};console.log(b.questions.filter(q=>!d[q.part][q.review.slideNumber-1].text.includes(q.review.slideTitle)).map(q=>q.id))"`. Expected: `[]`. Record all three per-Part results in `$EVID §Stage 5 refresher`. A mismatch goes back to Task 5.3 Step 1.
- [ ] **Step 2: HUMAN CHECK.** Ask the user to take the Refresher once at `cd refresher && npm run dev` (`http://localhost:5180/refresher/`) with a timer, and report the minutes. Expected: 10–15. If it falls outside, send it back to `spec-author` to adjust explanation length.

### Task 5.6: Landing card and Playwright spec

**Files:** Modify `deploy-landing/index.html`. Create `deploy-landing/tests/e2e/refresher-card.spec.js`.
**Interfaces:** Insert this between `<div class="module-grid" id="moduleGrid"></div>` and `<div class="tools-section" id="toolsSection" …>`:
```html
  <div class="tools-section" id="refresherSection">
    <div class="section-label">Before Parts 4 &amp; 5 — Optional Refresher</div>
    <div class="tools-grid">
      <a class="tool-card" id="refresherCard" href="/refresher/"><h3>Parts 1–3 Refresher</h3><p>A 10–15 minute self-check on Parts 1–3 vocabulary. Not part of course progress.</p></a>
    </div>
  </div>
```
`MODULES`, `TOOLS`, `render()`, `serverLocks` and the gate logic stay unchanged.

- [ ] **Step 1: Failing spec:**
  ```js
  import { test, expect } from '@playwright/test'
  const URL = 'http://localhost:8765/index.html'
  test('refresher card visible, links to /refresher/', async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('#refresherCard')).toBeVisible()
    await expect(page.locator('#refresherCard')).toHaveAttribute('href', '/refresher/')
    await expect(page.locator('#refresherCard')).toContainText('Parts 1–3 Refresher')
  })
  test('card is outside #moduleGrid, between grid and tools', async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('#moduleGrid #refresherCard')).toHaveCount(0)
    expect(await page.evaluate(() => [...document.querySelectorAll('#moduleGrid, #refresherSection, #toolsSection')].map((e) => e.id)))
      .toEqual(['moduleGrid', 'refresherSection', 'toolsSection'])
  })
  test('module card count is still 5', async ({ page }) => {
    await page.goto(URL); await expect(page.locator('.module-card')).toHaveCount(5)
  })
  test('unlock behaviour unchanged with {part1:true}; part5 Admin Locked', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('llm_course_progress', JSON.stringify({ part1: true })))
    await page.route('**/api/analytics/locks', (r) => r.fulfill({ json: { part5: true } }))
    await page.goto(URL)
    const c = page.locator('.module-card')
    await expect(c.nth(1)).toHaveClass(/(^|\s)unlocked(\s|$)/)
    await expect(c.nth(2)).toHaveClass(/(^|\s)locked(\s|$)/)
    await expect(c.nth(4).locator('.module-badge')).toHaveText('Admin Locked')
  })
  ```
- [ ] **Step 2:** `cd deploy-landing && npx playwright test tests/e2e/refresher-card.spec.js`. Expected: the first two tests FAIL. Insert the HTML. `npx playwright test`. Expected: 7 passed (3 old + 4 new).
- [ ] **Step 3: Commit** `git add deploy-landing/index.html deploy-landing/tests/e2e/refresher-card.spec.js` with message `Landing: optional Refresher card outside the module chain`.

### Task 5.7: Publish (last) and close

- [ ] **Step 1:** Confirm Stage 4 is done or stopped. `cd refresher && npm run build`.
- [ ] **Step 2:** `ssh … "mkdir -p <docroot>/refresher"`, then `rsync -az -e "ssh -i ~/key.pem" --delete refresher/dist/ $SSH_TARGET:<docroot>/refresher/`. Back up and copy `deploy-landing/index.html` to the landing dir from `DOCROOT_MAP` with `scp -i ~/key.pem` (`flow-through.js` is not copied).
- [ ] **Step 3:** `curl -sI $PUB/refresher/ | head -1; A=$(curl -s $PUB/refresher/ | grep -oE '/refresher/assets/[^"]+\.js' | head -1); curl -sI $PUB$A | head -1; curl -s $PUB/ | grep -c refresherCard`. Expected: `200`, `200`, `1`. If `/refresher/` is not 200, an nginx location is needed: the Task 1.6 nginx variant (HUMAN GATE).
- [ ] **Step 4: Opus review gate:** `design-reviewer` checks Stage 5 against criteria 1–6.
- [ ] **Step 5: Commit** `$EVID` by explicit path, with message `Weather refresh: Stage 5 evidence`.

---

## Final task F.1: Whole-plan verification

- [ ] **Step 1:** Builds and lints: `for d in module4 testing-with-llms refresher; do (cd $d && npm run lint && npm run build) || echo "FAIL $d"; done; (cd refresher && npm test); (cd deploy-landing && npm test && npx playwright test); python -m pytest architect/tests -q`. Expected: no `FAIL`, and every suite at 0 failures. (Refresher lint passes because every refresher test file explicitly imports what it uses from `'vitest'`: `it`, `expect`, `vi`, `describe`, `beforeEach`, `afterEach`.)
- [ ] **Step 2:** slideRefs: the Task 3a.4 Step 2 node check. Expected: `"bad":[]` and `"slides":33` (or `26` if 0b failed).
- [ ] **Step 3:** No leftovers: the Task 3a.3 Step 2 grep and the Task 4.6 Step 2 grep, both with no output.
- [ ] **Step 4:** Refresher isolation: `cd refresher && npx vitest run src/isolation.test.js src/App.test.jsx`. Expected: pass (Storage spies show zero calls).
- [ ] **Step 5:** Landing chain: the unlock-gate check, plus `git diff main HEAD -- deploy-landing/flow-through.js testing-with-llms/index.html module4/index.html architect/templates/deploy_template.yaml cicd-with-llms presentation working-with-llms context-and-sessions | wc -l`. Expected `0`. Run `grep -c "var serverLocks={part5: true};" deploy-landing/index.html`, expected `1`.
- [ ] **Step 6:** Evidence: `grep -c "(pending)" $EVID`, expected `0` (any stage skipped because of a gate says `SKIPPED — <gate>`). `grep -cE "[0-9a-f]{32}" $EVID`, expected `0`. **HUMAN GATE (key):** the user reruns the Task 2.4 Step 6 grep pair over the repo and both rehearsal histories, and reports `0`s.
- [ ] **Step 7: Opus review gate:** `design-reviewer` reads `$EVID` end to end against the spec's six "Overall success criteria" and lists the dead code that was left (`WaveGridReplay.jsx`, `wave-trace.js`, and the non-slug task-tracker text in `BuildFlow.jsx`).
- [ ] **Step 8: Commit** `$EVID` (explicit path), with message `Weather refresh: final verification evidence`.

---

## Self-Review

**Spec coverage**

| Spec section | Task(s) |
| --- | --- |
| Process constraints (snapshot, roles, explicit-path commits, restart, unlock gate, DNS, ingress, keys, no faking) | Global Constraints; 0a.1; every stage's snapshot line; 1.6 Step 5; 3a.5, 4.7 and F.1 gate checks |
| 0b OIDC spike (10 steps, success rule, failure modes, cleanup) | 0b.1–0b.3 |
| 0c CRD Secret-reference check | 0c.1 |
| Stage 1 T0–T7, known issues, nginx backup, blocking-fix procedure | 1.1–1.7 |
| Stage 2 answer sheet, key injection, custom template, run procedure, screenshots, 3-run limit, criteria 1–6, real paths | 1.4 Step 1, 2.1–2.4 |
| 3a slide table, screenshots, other components, unchanged files, assessment, criteria 1–6 and 9 | 3a.1–3a.5 |
| 3b deploy route, `/build/download`, kit files, naming, `s15`–`s15g`, rehearsal, criteria 7, 8, 10 (+1, 3, 5) | 3b.1–3b.6 |
| Stage 4 home, port/cut, renderer `code`, Paths A/B, workflow, slides 1–25, TestingQuiz, landing, criteria 1–10 | 3b.3 (workflow), 4.1–4.7 |
| Stage 5 format, results, deep-link limits, bank, files, tests, landing card, deployment, criteria 1–6 | 5.1–5.7 |
| Overall success criteria 1–6 | F.1 |
| Open questions 1–3 / 5 / 6 / 9 / 10 | 0b (1–3), 3b.6 Step 1 (5), 2.1 Step 1 (6), 1.6 nginx gate (9), Global lock rule (10) |

**Type and name consistency.**
- `SECRET_REF_BLOCK` comes from 0c.1 and is used in 2.1, with `{{name}}-openweather`, and in 3b.3, with `__APP_NAME__-openweather`.
- `TRAINING_CLUSTER` comes from 0b.1 and is used in 0b.2 (`spike.yml`) and 3b.3 (`deploy.yml` `EKS_CLUSTER`).
- `_workspace_path` (existing, `architect/webapp.py:267`) is used by both the route and the test monkeypatch.
- The zip name `{spec_slug}-{run[:6]}` matches `run_short = run_id[:6]` in `_resolve_deploy_fields`.
- `buildSequence`/`score`/`breakdownByPart`/`missedQuestions`/`isReady` have the same signatures in 5.2 and 5.4. Bank ids `P<part>-<n>` are the same in 5.2, 5.3 and 5.4.
- Slide counts: Part 4 is 26 after 3a and 33 after 3b; Part 5 is 25. These match the landing `slides` values and the click-through `--slides` values.
- The secret name `<app-name>-openweather` and the Path B response `{city,temp,units,description}` are consistent between 4.3, 4.4 Step 8 and 4.5.

**Proportion.** The spec is 549 lines. This plan stays under 2.5× that. Code appears only where the signature and tests don't settle the behaviour, or where the exact text matters for security: the two workflows, the kit manifest rules, the route tests, and the refresher tests.
