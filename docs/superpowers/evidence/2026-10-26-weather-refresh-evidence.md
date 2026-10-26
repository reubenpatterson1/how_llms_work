# Weather App Refresh — Evidence (2026-10-26)

No key values anywhere in this file. Commands show appid=$OPENWEATHER_API_KEY.

## 0a Snapshots

.claude/snapshots/weather-refresh-0a-20261026T103153.tar.gz

## Commits

User authorized per-task commits on branch weather-app-refresh (explicit paths only), 2026-10-26.

## Environment (T0)

- T0.1 | PASS | 2026-10-26 11:12 EDT | `curl -s -m 10 -o /dev/null -w '%{http_code}' http://<h>:8080/` for both candidates
```
ec2-100-58-203-210.compute-1.amazonaws.com 200
ec2-52-91-187-71.compute-1.amazonaws.com 000
```
- LIVE_HOST=ec2-100-58-203-210.compute-1.amazonaws.com; SSH_TARGET=ec2-user@ec2-100-58-203-210.compute-1.amazonaws.com; PUB=http://ec2-100-58-203-210.compute-1.amazonaws.com:8080
- T0.2 | PASS | 2026-10-26 11:13 EDT | `ssh -i ~/key.pem $SSH_TARGET 'systemctl cat llm-architect.service; systemctl is-active ...; ls -la /var/www/llm-course/'`
```
WorkingDirectory=/var/www/llm-course
ExecStart=/opt/pytorch/bin/python3 -m architect --port 5001 --no-debug
Environment=URL_PREFIX=/architect
active
docroot: architect/ flow-through.js index.html migrate-progress.js part1..part7
test -f /var/www/llm-course/architect/webapp.py -> ok
```
- BOX_ARCHITECT_DIR=/var/www/llm-course/architect; BOX_VENV=/opt/pytorch/bin (interpreter /opt/pytorch/bin/python3); URL_PREFIX=/architect; workspaces under $BOX_ARCHITECT_DIR/workspaces/
- T0.3 | PASS | 2026-10-26 11:13 EDT | `ssh -i ~/key.pem $SSH_TARGET 'sudo nginx -T' > $WORK/artifacts/nginx-T.txt` (read-only)
```
NGINX_FILE=/etc/nginx/conf.d/llm-course.conf  (listen 8080, upstream architect_app=127.0.0.1:5001, proxy_read_timeout 180s)
/ -> /var/www/llm-course/index.html ; /part1/../part7/ -> alias /var/www/llm-course/partN/
/architect/ -> proxy_pass http://architect_app/ ; /decompose/ -> http://architect_app/decompose
/api/ -> http://architect_app/api/ ; /socket.io/ -> architect_app
location ~* \.(js|css|png|...)$ -> static docroot cache block (regex, no ^~ on /architect/)
NGINX_PROXIES_BUILD=true (/architect/build, /architect/deploy reach Flask; verified by T6/T7 live). /build/ and /deploy/ bare: not proxied.
```
- T0.4 | FAIL (blocked) | 2026-10-26 11:14 EDT | `EC2_HOST=$SSH_TARGET ./scripts/refresh-ec2-ecr-auth.sh`
```
Denied by the Claude Code auto-mode classifier ([Remote Shell Writes]); not run, no workaround attempted.
Consequence: ECR token on box is expired (see T7 push). Needs user to run it or allow it.
```
- T0.5 | PASS | 2026-10-26 11:14 EDT | `rsync -n -i -az -e "ssh -i ~/key.pem" --exclude workspaces/ --exclude __pycache__/ --exclude .provider_config.json --exclude .build_deploy_config.json --exclude analytics.db --exclude test_results.json architect/ $SSH_TARGET:$BOX_ARCHITECT_DIR/ | tee ship-dryrun.txt`
```
grep -cE '^(>f\++ webapp\.py|cd\++ (templates|static)/)$' -> 0   (76 lines total)
<f..t.... webapp.py (all box source files differ by mtime only; no size/checksum change)
<f.st.... tests/test_build_deploy_config.py ; tests/test_decomposer.py (size differs)
<f+++++++ tests/test_builder_python_shim.py ; test_deploy_shared_ecr_repo.py ; test_poc_auth_regression.py (new)
```
- Ship command (no --delete): `rsync -az -e "ssh -i ~/key.pem" --exclude workspaces/ --exclude __pycache__/ --exclude .provider_config.json --exclude .build_deploy_config.json --exclude analytics.db --exclude test_results.json architect/ $SSH_TARGET:$BOX_ARCHITECT_DIR/`; restart: `ssh -i ~/key.pem $SSH_TARGET 'sudo systemctl restart llm-architect.service && sleep 3 && systemctl is-active llm-architect.service'` (expect active). Real ship NOT run.
- DOCROOT_MAP: see T0.3 above.

## 0b OIDC spike

- 0b.1 | PASS | 2026-10-26 11:12 MDT | `AWS_PROFILE=fubo-tools kubectl --context vat-dev get ns training -o name` -> `namespace/training`
- Context ARN: `arn:aws:eks:us-east-1:650127479436:cluster/vat-development-blue`
- TRAINING_CLUSTER=vat-development-blue (NOT eks-staging-observability: `get ns training` there returns NotFound; kube context `smo-mgmt` (the default current context) returns a credentials error)
- Laptop recipe: `export AWS_PROFILE=fubo-tools; kubectl --context vat-dev ...` (aws sso session for profile fubo-tools, account 650127479436)

## 0c CRD Secret reference

- 0c.1 | PASS | 2026-10-26 11:12 MDT | `AWS_PROFILE=fubo-tools kubectl --context vat-dev explain application.spec --api-version=app.smo.tools.fubotv.net/v1alpha1 --recursive | grep -nE "env|valueFrom|secretKeyRef|envFrom|secretRef"`
```
12:  env	<[]Object>
15:    valueFrom	<Object>
32:      secretKeyRef	<Object>   (fields: key <string> -required-, name <string>, optional <boolean>)
```
- SECRET_REF_FIELD_PATH: `spec.env[].valueFrom.secretKeyRef`
- SECRET_REF_BLOCK (under `spec:`; `{{name}}-openweather` for the worked example, `__APP_NAME__-openweather` for the kit):
```yaml
  env:
    - name: OPENWEATHER_API_KEY
      valueFrom:
        secretKeyRef:
          name: {{name}}-openweather
          key: OPENWEATHER_API_KEY
```
- 0c.1 step 2 | INFO | 2026-10-26 11:12 MDT | `kubectl --context vat-dev get secrets -n training -o name | wc -l` -> 0 Secret names visible (names only recorded)
- Human gate (no Secret-reference field): NOT triggered, the CRD supports it.

## Stage 1 checks

- T1 | FAIL | 2026-10-26 11:13 EDT | `python -m pytest architect/tests -q 2>&1 | tail -3`
```
FAILED architect/tests/test_analyzer.py::TestAmbiguityDetection::test_detects_simple
FAILED architect/tests/test_analyzer.py::TestAmbiguityDetection::test_detects_etc
2 failed, 214 passed in 2.64s
```
(N=214 >= 212 but 2 failures: ambiguity detector returns [] where >=1 expected; analyzer.py untouched since 97e88f1.)
- T2 | PASS | 2026-10-26 11:14 EDT | `python3.12 -m venv $WORK/t2venv && pip install -q -r architect/requirements.txt && python -c "import architect.webapp; print('ok')"`
```
ok
```
- T3 (before fix) | PASS | 2026-10-26 11:13 EDT | `curl -s $PUB/architect/api/settings | python3 -c '...print(type,model,active_model_found,ollama_models)'`
```
ollama gemma4:e4b True ['gemma4:e4b', 'gemma4:12b', 'gemma4:31b', 'mistral:7b', 'gemma3:12b', 'gemma3:4b', 'gemma:7b', 'sve-llm:latest', 'llama3.2:latest']
(/architect/api/status -> 200 JSON, analysis_method gemma4:e4b)
```
- T4 (before fix) | PASS | 2026-10-26 11:16 EDT | 10 answers POSTed to `$PUB/architect/api/send`, sid t4-202610261113, phase poc
```
10 x ollama:gemma4:e4b  (no regex)
spec auth: "## Auth" -> "No login required for PoC", "No sessions required for PoC"; no JWT/OAuth requirement
(note: dense spec is lossy: Tech Stack has 5 "N/A" bullets, Deployment omits env var / Secret, Error Handling only the 400 case)
```
- T5 (before fix) | FAIL | 2026-10-26 11:17 EDT | browser `$PUB/decompose/`, spec pasted, PoC, Run Decompose (start 15:16:59Z, end ~15:17:48Z)
```
Components: AuthService, ErrorHandler, DeploymentConfig, TestSuite (wave 0); AuthMiddleware (wave 1). No weather component, Auth* present.
journal: [LLM Judge] Failed to parse response (LLM did return WeatherService/OpenWeatherConfig JSON, 2899 chars, ```json fenced)
journal: [Decomposer] LLM extraction failed, falling back to regex  (count in window = 1, expected 0)
journal: [Decomposer] Phase pruning (poc) removed all components; keeping unpruned plan
```
Screenshot .claude/weather-refresh-work/shots/t5-decompose.png; package artifacts/t5/build-package.yaml (build-package-poc.yaml).
- T6 (before fix) | PASS | 2026-10-26 11:19 EDT | browser `$PUB/architect/build`, upload t5/build-package.yaml, Start Build (package is the regex/Auth one from T5)
```
POST /architect/build/start -> run_id 18c40b01bb22; GET /architect/build/status?run=... polled -> complete:true; "Continue to Deploy ->" href /architect/deploy?run=18c40b01bb22
_package.yaml on box names the weather spec ("A weather page that displays current weather information."); workspace has Dockerfile requirements.txt src/ (no app.py listed)
no 404s; nginx routes /architect/build to Flask
```
Screenshot shots/t6-build.png.
- T7.render | PASS | 2026-10-26 11:20 EDT | `curl -s -X POST $PUB/architect/deploy/render ... | grep -nE "containerPort|path:"`
```
14:      containerPort: 3000
16:    path: /healthz
21:    path: /
```
- T7.build | PASS | 2026-10-26 11:20 EDT | Deploy page "1. Build Image"
```
> docker build --platform linux/amd64 -t 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:18c40b <workspace>
(image built)
```
- T7.push | FAIL | 2026-10-26 11:21 EDT | Deploy page "2. Push to ECR"
```
ERROR: ECR auth missing or expired. Run: aws ecr get-login-password ...
Original error: denied: Your authorization token has expired. Reauthenticate and try again.
```
Retry after ECR refresh not possible: refresh script run was blocked (T0.4).
- T7.apply | BLOCKED | 2026-10-26 11:21 EDT | Apply button stays disabled until push succeeds; kubectl_missing handoff not exercised. Screenshot shots/t7-deploy.png.
- T3 (after fix 1580c6c) | PASS | 2026-10-26 11:38 EDT | `curl -s $PUB/architect/api/settings | python3 -c '...'` (service restarted once)
```
status 200; ollama gemma4:e4b True ['gemma4:e4b', 'gemma4:12b', 'gemma4:31b', 'mistral:7b', 'gemma3:12b', 'gemma3:4b', 'gemma:7b', 'sve-llm:latest', 'llama3.2:latest']
```
- T4 (after fix 1580c6c) | PASS | 2026-10-26 11:41 EDT | fresh intake sid t4b-202610261138, phase poc, 10 answers to `$PUB/architect/api/send`
```
10 x ollama:gemma4:e4b (no regex)
spec "## Auth": "no login and no sessions (public PoC)", "no sessions required for public PoC"; no JWT/OAuth/login requirement
```
- T5 (after fix 1580c6c) | PASS | 2026-10-26 11:42 EDT | browser `$PUB/decompose/`, spec t4b-spec.md pasted, PoC, Run Decompose (15:41:51Z -> 15:42:15Z, 24s)
```
6 components / 3 waves: ErrorHandlingMiddleware, ApiConfig, WeatherTestSuite | OpenWeatherApiClient | WeatherService, WeatherHandler
no Auth* component; weather feature + route handler (WeatherHandler) + config + tests present
journalctl 15:41:45-15:42:30Z: grep -c 'LLM extraction failed, falling back to regex' = 0 ; grep -c 'done_reason=length' = 0
minor: dependency graph names "weather-middleware" for the component named ErrorHandlingMiddleware; Interface Contracts shows IWeatherApiClient with empty body
```
Screenshot shots/t5-decompose-after-fix.png; package artifacts/t5/build-package.yaml.
- T6 (after fix 1580c6c) | PASS | 2026-10-26 11:45 EDT | browser `$PUB/architect/build`, upload t5/build-package.yaml, Start Build
```
POST /architect/build/start 200 -> run_id cef24f1f47b6; status polled to complete:true (build:complete, no failure events); "Continue to Deploy" -> /architect/deploy?run=cef24f1f47b6
box _package.yaml names weather spec; src/ has weather-handler, weather-service, openweather-api-client, api-config, weather-middleware, weather-test-suite, app.py; Dockerfile, requirements.txt, .env.example
```
Screenshot shots/t6-build-after-fix.png.
- T7.render (after fix, run cef24f1f47b6) | PASS | 2026-10-26 11:46 EDT | `curl -s -X POST $PUB/architect/deploy/render ... | grep -nE "containerPort|path:"`
```
14:      containerPort: 3000
16:    path: /healthz
21:    path: /
```
T7 image build/push/apply NOT re-run (push pending user's ECR token refresh).

## Stage 1 known open issues

- Regex-fallback auth/no-feature rule | open | not on the weather path after fix | repro: decompose with the LLM unreachable (e.g. no Ollama / bad model) and observe Auth* components and no feature component
- Live nginx config (/etc/nginx/conf.d/llm-course.conf) not in git | open | repro: `ssh -i ~/key.pem $SSH_TARGET 'sudo nginx -T'` vs `git ls-files | grep -i nginx`
- Cross-account EC2 443514608959 vs ECR/EKS 650127479436 | open | manual kubectl handoff by design | repro: `ssh -i ~/key.pem $SSH_TARGET 'aws sts get-caller-identity'` vs the ECR/EKS account
- Poll-ingress button dead on http (browser Private Network Access block) | open | repro: Deploy page poll ingress on http://<host>:8080 hangs "still waiting"
- 2 pre-existing test_analyzer failures | open, unrelated | repro: `python -m pytest architect/tests/test_analyzer.py -q` (test_detects_simple, test_detects_etc)
- D1 decompose truncation (LLM response failed to parse, regex fallback) | fixed by 1580c6c | repro: T5 journal count of 'falling back to regex' (0 after fix)

## Stage 1 blocking fixes

- D1 decompose truncation -> test_decompose_ollama_think.py (7 tests) -> architect/llm_judge.py, architect/decomposer.py -> commit 1580c6c

## Intake answer sheet

Verbatim answers, files in .claude/weather-refresh-work/answers/ (channel order).

### purpose (01-purpose.txt)
```
A "Hello, World!" weather page: an `<h1>Hello, World!</h1>` heading, a text input, a "Get weather" button, and a result area.
The input is prefilled with the default city `New York`, and on first page load the page shows New York's weather.
Submitting any city shows the city name returned by OpenWeather, the current temperature in °F, and the weather description.
An unknown city shows "City not found".
Success means real current weather for any valid city.
```
### data-model (02-data-model.txt)
```
None, no persistence.
```
### api (03-api.txt)
```
`GET /` serves the HTML page.
`GET /api/weather?city=<name>` → 200 `{"city": str, "temp_f": number, "description": str}`.
Error responses: 400 `{"error": "city is required"}` if `city` is missing or empty; 404 `{"error": "city not found"}` when OpenWeather returns 404; 502 `{"error": "weather service unavailable"}` on any other upstream failure or a timeout; 500 `{"error": "OPENWEATHER_API_KEY not set"}` if the env var is absent.
Upstream call: `https://api.openweathermap.org/data/2.5/weather?q=<city>&appid=<key>&units=imperial` with a 5s timeout.
```
### tech-stack (04-tech-stack.txt)
```
Python 3.12, Flask, `requests`, a single service (Claude's call: the Python shim and port-3000 path were last verified end to end on 2026-08-06; pytest suits Part 5).
```
### auth (05-auth.txt)
```
None: a public PoC with no login and no sessions.
```
### deployment (06-deployment.txt)
```
The fubo platform, `training` namespace, through the architect Deploy stage. Config comes from the env var `OPENWEATHER_API_KEY`, which is never hard-coded.
```
### error-handling (07-error-handling.txt)
```
As in the API channel.
```
### performance (08-performance.txt)
```
No targets beyond the 5s upstream timeout.
```
### security (09-security.txt)
```
The key is read from `os.environ` only and is never logged, returned in a response, or rendered into the page.
```
### testing (10-testing.txt)
```
pytest, with `requests.get` mocked. No real network calls in tests.
```

## Stage 2 runs

(pending)

## Stage 2 artifacts

(pending)

## Stage 2 verification

(pending)

## Real route paths

(pending)

## Stage 3a checks

(pending)

## Stage 3b rehearsal

(pending)

## Stage 4 loop

(pending)

## Stage 5 refresher

(pending)

## Publishes

(pending)

## Final verification

(pending)

