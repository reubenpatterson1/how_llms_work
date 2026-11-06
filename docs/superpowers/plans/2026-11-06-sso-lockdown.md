# SSO and Port Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the open-internet exposure of the EC2 course box today (Phase 0), then prepare and stand up Google sign-in on `https://llm-course.tools.fubotv.net` alongside the existing `:8080` site (Phase 1), so that Phase 2 (origin cutover) and Phase 3 (port closure) can follow.

**Architecture:** Phase 0 binds Flask to loopback, removes the in-git secret fallbacks, restricts Socket.IO origins, trims the security group, and puts shared basic auth on `:8080`. Phase 1 adds a `listen 443` nginx server that gates every path with `auth_request` against a local oauth2-proxy (Google, Internal consent), passes the signed-in email to Flask as `X-Forwarded-Email`, and teaches the landing, module and Architect pages to tell an SSO 401 apart from Flask's JSON 401. All nginx, systemd and oauth2-proxy files are committed under `deploy/` with placeholders only; secrets are typed on the box by the user.

**Tech Stack:** Python 3 / Flask 3 / Flask-SocketIO 5 (python-engineio 4) / SQLite / pytest (architect); vanilla ES5 JS + Vitest 2 + jsdom 25 + Playwright 1.48 (deploy-landing); nginx (`auth_request`, `auth_basic`); oauth2-proxy v7.15.6; certbot (Let's Encrypt HTTP-01) in its own venv; systemd; AWS CLI v2 (EC2 security groups, account 443514608959).

**Spec:** `docs/superpowers/specs/2026-11-06-sso-and-port-lockdown-design.md` (decisions in its section 8, recorded 2026-11-06).

## Global Constraints

- Spec is authoritative. Where this plan resolves something the spec leaves open or adjusts a detail, it says "(plan resolution)".
- Repo root `/Users/reubenpatterson/LLM_Presentation`; paths below are relative to it. `$WORK=.claude/sso-work` (untracked, never committed, never holds a secret). `$EVID=docs/superpowers/evidence/2026-11-06-sso-lockdown-evidence.md`. Evidence line format: `- <id> | PASS/FAIL/SKIP/INFO | <YYYY-MM-DD HH:MM TZ> | \`<command>\`` plus a fenced output excerpt of at most 15 lines.
- Fixed values: `HOST=ec2-100-58-203-210.compute-1.amazonaws.com`; `SSH="ssh -i ~/key.pem ec2-user@$HOST"`; `COURSE_HOST=llm-course.tools.fubotv.net` (D1); box architect dir `/var/www/llm-course/architect`; box docroot `/var/www/llm-course`; interpreter `/opt/pytorch/bin/python3`; region `us-east-1`; account `443514608959`.
- Who acts: **AGENT** = the orchestrator dispatching `code-executor` for repo files and local tests (no ssh, no AWS, no network to the box). **USER** = the user in their own terminal, AWS console/CLI, or browser (the user is also the instructor). **GROUP ADMIN** = the person who controls DNS and Google admin (D1, D6 tentative). **PILOTS** = 2 non-admin @fubo.tv learners. The agent shell cannot ssh: every box or AWS command is a human-run command, given verbatim with its expected output.
- **HUMAN GATE** marks every outward or risky step. The user runs the exact command, compares with the expected output, and pastes the result (never a secret) back; the agent records it in `$EVID`. A mismatch stops the task.
- **Never restart `llm-architect.service` mid-pipeline (A4).** Before every restart run the idle check (spec 0.1) verbatim:
  `ssh -i ~/key.pem ec2-user@$HOST 'cd /var/www/llm-course/architect/workspaces && find . -name _status.json -mmin -30 | xargs -r grep -L "\"complete\": true"; sudo ss -Htn state established "( sport = :5001 )" | wc -l'`
  Proceed only if no file is listed and the count is `0`; otherwise wait 10 minutes and repeat. One restart in Phase 0, one in Phase 1.
- **Part 5 lock behavior preserved (A5).** `var serverLocks={part5: true};` in `deploy-landing/index.html` stays byte-identical; `GET /api/analytics/locks` stays public and `POST /api/analytics/locks` stays behind `session["settings_auth"]` in `architect/webapp.py`. A failed locks fetch still leaves Part 5 "Admin Locked"; it is only no longer silent.
- **Unlock gate three-file sync (A6).** `MODULES`/`LABELS` in `deploy-landing/flow-through.js`, `MODULES` in `deploy-landing/index.html`, and `__LLM_MODULE_ID__` in each Part's `index.html` are not edited. Check: `grep -h "__LLM_MODULE_ID__ = '" presentation/index.html working-with-llms/index.html context-and-sessions/index.html module4/index.html testing-with-llms/index.html; grep -n "var MODULES\|var LABELS" deploy-landing/flow-through.js; grep -o "{id:'part[0-9]'" deploy-landing/index.html`. Expected: part1-part5 in order in all three. `/flow-through.js` stays served from the origin root of each course host.
- **No secrets.** No key, password, client ID/secret, cookie secret, htpasswd hash, cookie value or ACME account data in any repo file, commit, `$EVID`, `$WORK` or chat. Repo templates use `__CLIENT_ID__`, `__CLIENT_SECRET__`, `__COOKIE_SECRET__`. Secrets are generated or typed on the box only. Scan before every commit: `git diff --cached | grep -cE '[0-9a-f]{32}'` must be `0`.
- **Ingress rule.** No Kubernetes ingress is created by this plan. Internal ingresses never get `alb.ingress.kubernetes.io/ssl-redirect`, `nginx.ingress.kubernetes.io/ssl-redirect`, `nginx.ingress.kubernetes.io/force-ssl-redirect` or TLS/443 annotations. If option (a) is ever expressed as an Ingress, it is internet-facing (`alb.ingress.kubernetes.io/scheme: internet-facing`) and must carry `alb.ingress.kubernetes.io/ssl-redirect: '443'`.
- **Commits by explicit path only.** Never `git add -A`, `git add .`, `git add -u` or `git commit -a`. The working tree is intentionally dirty (`context-and-sessions/package-lock.json`, `.claude/snapshots/`, `.claude/weather-refresh-work/`, `.playwright-mcp/`, root PDFs/PNGs, `weather-app-poc/.coverage`); leave it so. Commits only after the Task 1 gate. Each message ends with the Co-Authored-By line given in the executing session's attribution reminder.
- **Ship to EC2** only with `rsync -c -e "ssh -i ~/key.pem"` (checksum mode), human-run, followed by an md5 parity check (local `md5 -r` vs box `md5sum`, `diff` must print nothing). Before shipping `architect/`, `git status --short architect/` must be empty so the shipped tree equals a commit. Architect ship command (no `--delete`):
  `rsync -c -az -e "ssh -i ~/key.pem" --exclude workspaces/ --exclude __pycache__/ --exclude .provider_config.json --exclude .build_deploy_config.json --exclude analytics.db --exclude test_results.json architect/ ec2-user@$HOST:/var/www/llm-course/architect/`
  Config files go to `/tmp/` on the box with `rsync -c -e "ssh -i ~/key.pem" <file> ec2-user@$HOST:/tmp/`, then `sudo install` into place.
- nginx changes: back up the live file to `/etc/nginx/backup/` first, then `sudo nginx -t && sudo systemctl reload nginx`. Never `restart` nginx.
- `:8080` keeps working for learners until Phase 3 (A2). Do not stop/start the instance (its public DNS name, and with it the old origin, would change) before the Phase 3 Elastic IP.
- Snapshot before the first edit of each phase: `cd /Users/reubenpatterson/LLM_Presentation && mkdir -p .claude/snapshots && S=".claude/snapshots/sso-<phase>-$(date +%Y%m%dT%H%M%S).tar.gz" && tar -czf "$S" --exclude='node_modules' --exclude='dist' --exclude='./.claude/snapshots' . && ls -lh "$S"`. Record the path in `$EVID`.
- Open decisions: D6 (who creates the Google OAuth client; tentatively the group admin) blocks Task 16. D8 (secrets status) is resolved by Task 2.

**Runtime values** (recorded in `$EVID` by the task that produces them; `MYIP` goes in `$WORK/runtime.txt` only):

| Name | Task | Meaning |
|---|---|---|
| `D8_RESULT` | 2 | `ok` or `rotate` |
| `BOX_NGINX_VERSION`, `BOX_ARCH`, `CERTBOT_PY` | 2 | `nginx -v`; `uname -m`; `python3` if box `python3` is 3.9 or newer, else `/opt/pytorch/bin/python3` |
| `AWS_PROFILE_443`, `INSTANCE_ID`, `SG_IDS` | 7 | laptop profile for 443514608959; instance; security groups attached to it |
| `MYIP` | 7 | the laptop's egress IP for ssh (`curl -s https://checkip.amazonaws.com`) |

## Review Focus

1. **Instructor lockout.** The /32 on port 22 is tied to one egress IP (VPN on/off, home/office change it), and 0.4 removes the password fallback. Pinned in Task 7 (add the /32 rule and prove ssh before revoking the world rule; record console break-glass), Task 4 (`test_login_fails_when_password_env_unset`, `test_login_succeeds_with_env_password`), and Task 6 Step 8 (the instructor logs in to `/architect/admin` right after the restart).
2. **WebSocket through `auth_request`.** If the include loses `Upgrade`/`Connection`/`proxy_http_version 1.1`, or `socket.io` paths are treated as pages, Socket.IO silently degrades or gets a 302 HTML page. Pinned by `test_ws_locations_have_upgrade_headers` and `test_map_classifies_fetch_paths_as_api` (Task 14), and by the DevTools `101` check in Task 22 (T4).
3. **401 vs 302 for `fetch()`.** A fetch that follows a 302 to Google fails as an opaque CORS error, and analytics events and the locks fetch die silently; a Flask JSON 401 must not raise the SSO banner. Pinned by `test_map_classifies_fetch_paths_as_api` / `test_map_classifies_pages_as_redirect` (Task 14), `test_flask_own_401s_are_json` (Task 11), the vitest cases `module: json 401 does not show auth banner` and `landing: sso 401 on locks shows auth banner, not availability banner` (Task 12), and the non-admin dashboard fetch in Task 22 Step 3.
4. **Session expiry mid-build.** The build keeps running server-side, but the page must not break: `build.js` keeps polling when it gets a 401 (`if (!r.ok) return;`), and the wrapper must return the response unchanged. Pinned by `test_base_fetch_wrapper_checks_auth_and_returns_response` (Task 13) and Task 22 Step 9 (delete the cookie during a build; banner shows; the run's `_status.json` still reaches `"complete": true`). Known limitation: "Sign in again" reloads the page, which drops the in-page `runId` (open question Q1).
5. **Port closure breaks the ship path, ECR refresh or dashboards.** Pinned in Task 7 Steps 7-9: after the security-group change, the rsync dry-run, `scripts/refresh-ec2-ecr-auth.sh` (expected `Login Succeeded`) and ssh `-L` forwards to 8781/8099 must all work, and Step 3 stops if any world rule lives in a security group shared with another instance.

---

## PHASE 0: Immediate hardening

### Task 1: Setup and commit authorization (AGENT, HUMAN GATE)

**Files:** Create `$EVID` and `$WORK/` (with `$WORK/artifacts/`).
**Interfaces:** Produces `$EVID` with these `##` headings in order: `Snapshots`, `Commits`, `Runtime values`, `Phase 0`, `Phase 1 repo`, `Phase 1 rollout`, `Verification`.

- [ ] **Step 1: HUMAN GATE (commits).** Ask: "May I commit each task to a new branch `sso-lockdown` created from the current HEAD (explicit paths only)?" If yes: `git switch -c sso-lockdown`. Expected: `Switched to a new branch 'sso-lockdown'`. If no: skip every Commit step and append its `git add` path list to `$EVID §Commits`.
- [ ] **Step 2:** Run the Global snapshot command with `<phase>=phase0`; record the path.
- [ ] **Step 3:** `mkdir -p .claude/sso-work/artifacts docs/superpowers/evidence`, then write `$EVID` with title `# SSO and Port Lockdown: Evidence (2026-11-06)`, first line `No secret values anywhere in this file.`, and the headings above, each followed by `(pending)`.
- [ ] **Step 4: Baseline.** `python -m pytest architect/tests -q 2>&1 | tail -3` and `cd deploy-landing && npx vitest run 2>&1 | tail -5`. Expected: the 2 known `test_analyzer` failures and nothing else; vitest all pass. Record both lines.
- [ ] **Step 5: Commit** `git add docs/superpowers/evidence/2026-11-06-sso-lockdown-evidence.md` with message `SSO lockdown: evidence file skeleton`.

### Task 2: Box preflight, secrets check (D8) and live config pull (USER, read-only, HUMAN GATE)

**Files:** Create `deploy/nginx/llm-course.conf` and `deploy/nginx/flask-app.conf` (byte copies of the live files; committed in Task 5).
**Interfaces:** Produces `D8_RESULT`, `BOX_NGINX_VERSION`, `BOX_ARCH`, `CERTBOT_PY`.

- [ ] **Step 1: HUMAN GATE (unit and drop-ins).** `$SSH 'systemctl cat llm-architect.service; ls /etc/systemd/system/llm-architect.service.d/ 2>/dev/null'`. Expected: `ExecStart=/opt/pytorch/bin/python3 -m architect --port 5001 --no-debug`, `Environment=URL_PREFIX=/architect`, and no drop-in that sets `ExecStart=` (if one does, STOP and record it; Task 5's drop-in would be overridden).
- [ ] **Step 2: HUMAN GATE (D8: names and git-literal equality, values never printed).** Must run before Task 6 ships the code that deletes the literals.
  `$SSH 'PID=$(systemctl show -p MainPID --value llm-architect.service); for N in SETTINGS_PASSWORD FLASK_SECRET; do L=$(grep -oP "\"$N\", \"\K[^\"]+" /var/www/llm-course/architect/webapp.py); printf "%s present=%s equals_git_literal=%s\n" $N "$(sudo tr "\0" "\n" < /proc/$PID/environ | grep -c "^$N=")" "$(sudo tr "\0" "\n" < /proc/$PID/environ | grep -cxF "$N=$L")"; done; systemctl show -p EnvironmentFiles llm-architect.service'`
  Expected for `D8_RESULT=ok`: `SETTINGS_PASSWORD present=1 equals_git_literal=0` and `FLASK_SECRET present=1 equals_git_literal=0`. Any `present=0` or `equals_git_literal=1` sets `D8_RESULT=rotate` (Task 3 is then mandatory). Record the two lines and `D8_RESULT` (this closes D8 in the spec's terms).
- [ ] **Step 3: HUMAN GATE (tools).** `$SSH 'nginx -v 2>&1; uname -m; python3 --version; command -v sqlite3 openssl curl; sudo ss -ltnp | grep -E ":(80|443|3000|4180|5001|8080|8099|8781|11434) "'`. Expected: an nginx version, `x86_64` (if `aarch64`, Task 19 uses the `linux-arm64` asset), a Python version, three tool paths, and `:5001` on `0.0.0.0` (today's exposure), nothing on `:443` or `:4180`. Set `CERTBOT_PY` by the rule in Runtime values. If `sqlite3` is missing, every later `sqlite3 <db> "<sql>"` becomes `sudo /opt/pytorch/bin/python3 -c "import sqlite3;print(sqlite3.connect('<db>').execute(\"<sql>\").fetchall())"`.
- [ ] **Step 4: HUMAN GATE (pull live nginx files).** `mkdir -p deploy/nginx && scp -i ~/key.pem ec2-user@$HOST:/etc/nginx/conf.d/llm-course.conf ec2-user@$HOST:/etc/nginx/conf.d/flask-app.conf deploy/nginx/`, then `diff <(md5 -r deploy/nginx/llm-course.conf deploy/nginx/flask-app.conf | awk '{print $1}') <($SSH 'md5sum /etc/nginx/conf.d/llm-course.conf /etc/nginx/conf.d/flask-app.conf' | awk '{print $1}')`. Expected: no output. Sanity: `grep -c "listen 8080" deploy/nginx/llm-course.conf` gives `1`, and the location list matches `.claude/weather-refresh-work/artifacts/nginx-T.txt:1194-1304`.

### Task 3: Rotate admin password and Flask secret if D8 says so (USER, conditional, HUMAN GATE)

Run only if `D8_RESULT=rotate`. No restart here; the env file takes effect at the Task 6 restart (via `EnvironmentFile=-/etc/llm-architect/env` from Task 5). Effect: the instructor's `/admin` session ends after Task 6; learners are unaffected.

- [ ] **Step 1:** In the password manager, generate a new admin password: 24+ characters, letters and digits only (systemd env-file quoting stays trivial; plan resolution).
- [ ] **Step 2: HUMAN GATE.** Open `ssh -t -i ~/key.pem ec2-user@$HOST` and run:
  ```
  sudo install -d -m 0700 -o root -g root /etc/llm-architect
  sudo install -m 0600 -o root -g root /dev/null /etc/llm-architect/env
  read -rs -p 'New SETTINGS_PASSWORD: ' P; echo; printf 'SETTINGS_PASSWORD=%s\n' "$P" | sudo tee -a /etc/llm-architect/env >/dev/null; unset P
  sudo sh -c 'printf "FLASK_SECRET=%s\n" "$(openssl rand -base64 48 | tr -d "\n")" >> /etc/llm-architect/env'
  sudo stat -c '%a %U:%G' /etc/llm-architect/env; sudo cut -d= -f1 /etc/llm-architect/env
  ```
  Expected: `600 root:root`, then `SETTINGS_PASSWORD` and `FLASK_SECRET` (names only).
- [ ] **Step 3: HUMAN GATE (tamper check).** `$SSH 'sqlite3 /var/www/llm-course/architect/analytics.db "select module,locked from module_locks"'`. Expected: `part1|0` … `part7|0` (all unlocked, the known live state), unless the instructor locked a part on purpose. Any unexpected `1`: the instructor fixes it in `/admin` after Task 6.

### Task 4: Flask loopback default, no literal fallbacks, Socket.IO origins (AGENT)

**Files:** Modify `architect/__main__.py:17`, `architect/webapp.py:56-57,432-438,1130`. Create `architect/tests/test_settings_auth_env.py`, `architect/tests/test_bind_and_origins.py`.
**Interfaces:**
- `architect/webapp.py`: `def _resolve_secret_key(environ: Mapping[str, str]) -> str | bytes`: the `FLASK_SECRET` value if non-empty; else `os.urandom(32)` and prints exactly `[Security] FLASK_SECRET unset; sessions reset on restart` (flush=True). Module level: `app.secret_key = _resolve_secret_key(os.environ)`.
- `def _socketio_cors_origins(raw: str | None) -> list[str] | None`: split on `,`, strip, drop empties; `None` if the list is empty. Module level: `socketio = SocketIO(app, cors_allowed_origins=_socketio_cors_origins(os.environ.get("SOCKETIO_CORS_ORIGINS")))` (`None` = the library's same-origin check, used in local dev).
- `settings_login()`: reads `os.environ.get("SETTINGS_PASSWORD")` per request. Unset or empty: no session change, `render_template("settings_login.html", error="Admin disabled: SETTINGS_PASSWORD not set")`. Otherwise as today. Both literal fallbacks are deleted. `settings_page`, `admin_page` and the template are unchanged.
- `def run(host="127.0.0.1", port=5001, debug=True)`; `__main__.py` `--host` default `"127.0.0.1"`.

- [ ] **Step 1: Write the failing tests.** `architect/tests/test_settings_auth_env.py` (fixture `client` as in `test_build_deploy_routes.py`):
  ```python
  def test_login_fails_when_password_env_unset(client, monkeypatch):
      monkeypatch.delenv("SETTINGS_PASSWORD", raising=False)
      r = client.post("/settings/login", data={"password": "anything"})
      assert r.status_code == 200 and b"Admin disabled: SETTINGS_PASSWORD not set" in r.data
      assert b"Course Analytics" not in client.get("/admin").data
  def test_login_fails_when_password_env_empty(client, monkeypatch):
      monkeypatch.setenv("SETTINGS_PASSWORD", "")
      assert b"Admin disabled: SETTINGS_PASSWORD not set" in client.post("/settings/login", data={"password": ""}).data
  def test_login_succeeds_with_env_password(client, monkeypatch):
      monkeypatch.setenv("SETTINGS_PASSWORD", "test-pw-123")
      assert client.post("/settings/login", data={"password": "test-pw-123"}).status_code == 302
      assert b"Course Analytics" in client.get("/admin").data
  def test_wrong_password_shows_incorrect(client, monkeypatch):
      monkeypatch.setenv("SETTINGS_PASSWORD", "test-pw-123")
      assert b"Incorrect password" in client.post("/settings/login", data={"password": "nope"}).data
  def test_secret_key_random_when_env_unset(capsys):
      k1, k2 = webapp._resolve_secret_key({}), webapp._resolve_secret_key({"FLASK_SECRET": ""})
      assert isinstance(k1, bytes) and len(k1) == 32 and k1 != k2
      assert "[Security] FLASK_SECRET unset; sessions reset on restart" in capsys.readouterr().out
  def test_secret_key_from_env():
      assert webapp._resolve_secret_key({"FLASK_SECRET": "abc"}) == "abc"
  def test_no_literal_fallbacks_in_source():
      src = open(webapp.__file__).read()
      assert 'os.environ.get("SETTINGS_PASSWORD", "' not in src and 'os.environ.get("FLASK_SECRET", "' not in src
  ```
  `architect/tests/test_bind_and_origins.py`:
  ```python
  def test_main_host_default_is_loopback():   # ast, never import architect.__main__ (it monkey-patches eventlet)
      tree = ast.parse(open(os.path.join(os.path.dirname(webapp.__file__), "__main__.py")).read())
      calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and getattr(n.func, "attr", "") == "add_argument"
               and any(isinstance(a, ast.Constant) and a.value == "--host" for a in n.args)]
      assert len(calls) == 1 and {k.arg: k.value.value for k in calls[0].keywords}["default"] == "127.0.0.1"
  def test_run_host_default_is_loopback():
      assert inspect.signature(webapp.run).parameters["host"].default == "127.0.0.1"
  @pytest.mark.parametrize("raw,expected", [(None, None), ("", None), (" , ", None),
      ("http://a.example:8080", ["http://a.example:8080"]),
      (" http://a.example:8080 , https://llm-course.tools.fubotv.net ,", ["http://a.example:8080", "https://llm-course.tools.fubotv.net"])])
  def test_socketio_cors_origins_parsing(raw, expected):
      assert webapp._socketio_cors_origins(raw) == expected
  def test_socketio_not_wildcard():
      assert webapp.socketio.server.eio.cors_allowed_origins != "*"
  # fixture: monkeypatch.setattr(webapp.socketio.server.eio, "cors_allowed_origins", ["http://allowed.example"]) + test client
  def test_polling_rejects_foreign_origin(origin_client):
      assert origin_client.get("/socket.io/?EIO=4&transport=polling", headers={"Origin": "https://evil.example"}).status_code == 400
  def test_polling_accepts_allowed_origin(origin_client):
      assert origin_client.get("/socket.io/?EIO=4&transport=polling", headers={"Origin": "http://allowed.example"}).status_code == 200
  ```
- [ ] **Step 2:** `python -m pytest architect/tests/test_settings_auth_env.py architect/tests/test_bind_and_origins.py -q`. Expected: FAIL (missing helpers, wrong defaults; `test_polling_*` may already pass).
- [ ] **Step 3:** `code-executor` implements the Interfaces block.
- [ ] **Step 4:** Rerun Step 2 (all PASS), then `python -m pytest architect/tests -q` (only the 2 known `test_analyzer` failures).
- [ ] **Step 5: Commit** `git add architect/__main__.py architect/webapp.py architect/tests/test_settings_auth_env.py architect/tests/test_bind_and_origins.py` with message `Architect: loopback bind default, no secret fallbacks, Socket.IO origin allowlist`.

### Task 5: Commit live nginx, systemd drop-in, and the :8080 basic-auth change (AGENT)

**Files:** Add `deploy/nginx/llm-course.conf`, `deploy/nginx/flask-app.conf` (from Task 2). Create `deploy/systemd/10-sso-lockdown.conf`, `architect/tests/test_deploy_configs.py`.
**Interfaces:** Box install path of the drop-in: `/etc/systemd/system/llm-architect.service.d/10-sso-lockdown.conf` (named so it never collides with an `override.conf`; plan resolution). `deploy/systemd/10-sso-lockdown.conf` is exactly:
```
[Service]
ExecStart=
ExecStart=/opt/pytorch/bin/python3 -m architect --host 127.0.0.1 --port 5001 --no-debug
EnvironmentFile=-/etc/llm-architect/env
Environment=SOCKETIO_CORS_ORIGINS=http://ec2-100-58-203-210.compute-1.amazonaws.com:8080,https://llm-course.tools.fubotv.net
```
(plan resolution: D1 is decided, so the Phase 1 origin is included now and Phase 1 needs no drop-in change.)

- [ ] **Step 1: Commit the untouched live copies first** (rollback reference): `git add deploy/nginx/llm-course.conf deploy/nginx/flask-app.conf`, message `deploy/nginx: live llm-course.conf and flask-app.conf as of 2026-11-06`.
- [ ] **Step 2: Write the failing tests** in `architect/tests/test_deploy_configs.py` (`ROOT = <repo root>`, `read(rel)` helper):
  ```python
  def test_dropin_binds_loopback_and_sets_origins():
      t = read("deploy/systemd/10-sso-lockdown.conf")
      assert "ExecStart=\n" in t and "--host 127.0.0.1 --port 5001 --no-debug" in t
      assert "EnvironmentFile=-/etc/llm-architect/env" in t
      assert "SOCKETIO_CORS_ORIGINS=http://ec2-100-58-203-210.compute-1.amazonaws.com:8080,https://llm-course.tools.fubotv.net" in t
  def test_course_conf_has_basic_auth_at_server_scope():
      t = read("deploy/nginx/llm-course.conf")
      assert 'auth_basic "LLM course";' in t and "auth_basic_user_file /etc/nginx/llm-course.htpasswd;" in t
      first = min(i for i in (t.find("location "), t.find("include /etc/nginx/llm-course-locations.inc")) if i >= 0)
      assert t.index("auth_basic ") < first   # holds before and after Task 14
  def test_no_secret_values_under_deploy():
      for p in all files under ROOT/deploy:
          t = open(p).read()
          assert not re.search(r"[0-9a-f]{32}", t)
          assert not re.search(r"(client_secret|cookie_secret|client_id)\s*=\s*\"(?!__[A-Z_]+__\")", t)
          assert not re.search(r"(SETTINGS_PASSWORD|FLASK_SECRET)=\S", t)
  ```
- [ ] **Step 3:** `python -m pytest architect/tests/test_deploy_configs.py -q`. Expected: FAIL (drop-in missing, no auth_basic).
- [ ] **Step 4:** Create the drop-in. In `deploy/nginx/llm-course.conf`, insert directly after the `proxy_send_timeout 180s;` server-scope line:
  ```
      # Phase 0 interim gate (spec 0.6, D7). Removed in Phase 3.
      auth_basic "LLM course";
      auth_basic_user_file /etc/nginx/llm-course.htpasswd;
  ```
- [ ] **Step 5:** Rerun Step 3 (PASS).
- [ ] **Step 6: Commit** `git add deploy/systemd/10-sso-lockdown.conf deploy/nginx/llm-course.conf architect/tests/test_deploy_configs.py`, message `deploy: llm-architect loopback drop-in and :8080 interim basic auth`.

### Task 6: Ship Phase 0 Flask code and drop-in; one gated restart (USER, HUMAN GATE)

**Consumes:** Tasks 2-5. Precondition: `D8_RESULT=ok`, or Task 3 done.

- [ ] **Step 1:** `git status --short architect/ deploy/` → empty.
- [ ] **Step 2: HUMAN GATE (dry run).** The Global architect ship command with `-n -i` added after `rsync`, piped to `tee $WORK/artifacts/ship0-dryrun.txt`; then `grep -cE '^(>f\++ webapp\.py|cd\++ (templates|static)/)$' $WORK/artifacts/ship0-dryrun.txt`. Expected: `0` (a new `webapp.py`, `templates/` or `static/` means the wrong destination). `webapp.py` and `__main__.py` appear as changed (`>fc`).
- [ ] **Step 3: HUMAN GATE (ship).** The Global architect ship command, then:
  `diff <(cd architect && md5 -r webapp.py __main__.py | awk '{print $1, $2}') <($SSH 'cd /var/www/llm-course/architect && md5sum webapp.py __main__.py' | awk '{print $1, $2}')`. Expected: no output.
- [ ] **Step 4: HUMAN GATE (drop-in).** `rsync -c -e "ssh -i ~/key.pem" deploy/systemd/10-sso-lockdown.conf ec2-user@$HOST:/tmp/ && $SSH 'sudo install -D -m 0644 -o root -g root /tmp/10-sso-lockdown.conf /etc/systemd/system/llm-architect.service.d/10-sso-lockdown.conf && sudo systemctl daemon-reload && systemctl show -p ExecStart --value llm-architect.service | grep -c -- "--host 127.0.0.1"'`. Expected: `1`. Parity: `diff <(md5 -q deploy/systemd/10-sso-lockdown.conf) <($SSH 'md5sum /etc/systemd/system/llm-architect.service.d/10-sso-lockdown.conf' | cut -d' ' -f1)` prints nothing.
- [ ] **Step 5: HUMAN GATE (idle check).** Global idle check. Expected: no file listed, then `0`.
- [ ] **Step 6: HUMAN GATE (restart).** `$SSH 'sudo systemctl restart llm-architect.service && sleep 3 && systemctl is-active llm-architect.service; journalctl -u llm-architect.service --since "-2 min" | grep -c "FLASK_SECRET unset"'`. Expected: `active`, then `0`.
- [ ] **Step 7: HUMAN GATE (verify, spec 0.3/0.4).**
  - `$SSH 'sudo ss -ltn | grep ":5001"'` → only `127.0.0.1:5001`.
  - `nc -z -w5 $HOST 5001 && echo OPEN || echo closed` → `closed`.
  - `curl -s -o /dev/null -w '%{http_code}\n' http://$HOST:8080/architect/` → `200`.
  - `curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://evil.example' "http://$HOST:8080/architect/socket.io/?EIO=4&transport=polling"` → `400`; the same with `-H "Origin: http://$HOST:8080"` → `200`.
- [ ] **Step 8: HUMAN GATE (no lockout).** The instructor opens `http://$HOST:8080/architect/admin`, logs in with the current (or Task 3) password and sees "Course Analytics". They confirm the module locks and the provider type/model/base_url under settings (the key is never shown). Then a short intake message on `/architect/intake` gets a reply (proves the service works after the restart).
- [ ] **Rollback:** `$SSH 'sudo rm /etc/systemd/system/llm-architect.service.d/10-sso-lockdown.conf && sudo systemctl daemon-reload'`, `git revert` the Task 4 commit and re-ship, idle check, restart. Break-glass for the admin lock (spec 5.4) needs no SSO.

### Task 7: Security group (spec 0.5) (USER, HUMAN GATE)

D2: the user holds the rights in 443514608959. `export AWS_PROFILE=<AWS_PROFILE_443> AWS_REGION=us-east-1` for every command.

- [ ] **Step 1: HUMAN GATE.** `aws sts get-caller-identity --query Account --output text` → `443514608959`. `aws ec2 describe-instances --filters Name=dns-name,Values=$HOST --query 'Reservations[].Instances[].[InstanceId,SecurityGroups[].GroupId]' --output text` → the instance ID, then its security-group IDs; record `INSTANCE_ID`, `SG_IDS`.
- [ ] **Step 2: Backup.** For each `<SG_ID>`: `aws ec2 describe-security-group-rules --filters Name=group-id,Values=<SG_ID> --query 'SecurityGroupRules[?!IsEgress].[SecurityGroupRuleId,IpProtocol,FromPort,ToPort,CidrIpv4,CidrIpv6]' --output text | tee $WORK/artifacts/sg-before-<SG_ID>.txt`. Mark the world rules (`0.0.0.0/0` or `::/0`) on 22, 3000, 5001, 8781, 8099, 11434.
- [ ] **Step 3: HUMAN GATE (shared-SG stop).** For each SG holding a marked rule: `aws ec2 describe-network-interfaces --filters Name=group-id,Values=<SG_ID> --query 'NetworkInterfaces[].Attachment.InstanceId' --output text`. Expected: only `INSTANCE_ID`. Anything else: STOP and record (revoking would affect another instance); open question Q2.
- [ ] **Step 4: HUMAN GATE (add before revoke).** With the laptop on the network it uses for ssh and the ECR cron: `MYIP=$(curl -s https://checkip.amazonaws.com)` (write to `$WORK/runtime.txt`), then `aws ec2 authorize-security-group-ingress --group-id <SG_ID of the 22 rule> --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MYIP/32,Description=instructor-ssh}]"`, then `ssh -i ~/key.pem -o ConnectTimeout=10 ec2-user@$HOST true && echo SSH_OK` → `SSH_OK`.
- [ ] **Step 5: HUMAN GATE (revoke).** `aws ec2 revoke-security-group-ingress --group-id <SG_ID> --security-group-rule-ids <marked rule ids in that SG>` per SG. Expected: `"Return": true`. Leave 80 and 8080 world-open (A2). Break-glass if the egress IP changes later: re-run Step 4 from the AWS console or CLI.
- [ ] **Step 6: HUMAN GATE (T1, Phase 0 shape).** `for p in 22 80 3000 5001 8080 8099 8781 11434; do nc -z -w5 $HOST $p && echo "$p OPEN" || echo "$p closed"; done`. Expected: `22 OPEN`, `80 OPEN`, `8080 OPEN`, all others `closed`.
- [ ] **Step 7: HUMAN GATE (ship path).** The Global architect ship command with `-n -i` → exits 0 and lists no changes.
- [ ] **Step 8: HUMAN GATE (ECR refresh).** `EC2_HOST=ec2-user@$HOST AWS_PROFILE=fubo-tools ./scripts/refresh-ec2-ecr-auth.sh` → output contains `Login Succeeded`. (The script's default host is the dead `ec2-52-91-187-71` host until Phase 3; a laptop cron without `EC2_HOST` is already broken and stays so; record it.)
- [ ] **Step 9: HUMAN GATE (dashboards, plan resolution: ssh `-L` until Phase 3 sets up SSM).** `ssh -i ~/key.pem -N -L 8781:127.0.0.1:8781 -L 8099:127.0.0.1:8099 ec2-user@$HOST` in one terminal; in another, `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/` → `200`, and the same for `:8781` → `200` or `401` (its own basic auth).
- [ ] **Rollback:** `aws ec2 authorize-security-group-ingress` for any line from `sg-before-*.txt`.

### Task 8: Interim basic auth on :8080 (spec 0.6, D7) (USER, HUMAN GATE)

- [ ] **Step 1: HUMAN GATE (credential file).** In the password manager, generate the shared learner password (letters and digits, 16+). In `ssh -t -i ~/key.pem ec2-user@$HOST`: `P=$(openssl passwd -apr1)` (type it twice), `printf 'learner:%s\n' "$P" | sudo tee /etc/nginx/llm-course.htpasswd >/dev/null; unset P; sudo chown root:nginx /etc/nginx/llm-course.htpasswd; sudo chmod 0640 /etc/nginx/llm-course.htpasswd; sudo cut -d: -f1 /etc/nginx/llm-course.htpasswd`. Expected: `learner`.
- [ ] **Step 2: HUMAN GATE (install).** `rsync -c -e "ssh -i ~/key.pem" deploy/nginx/llm-course.conf ec2-user@$HOST:/tmp/ && $SSH 'sudo install -d -m 0755 /etc/nginx/backup && sudo cp -a /etc/nginx/conf.d/llm-course.conf /etc/nginx/backup/llm-course.conf.$(date +%Y%m%d%H%M) && sudo install -m 0644 -o root -g root /tmp/llm-course.conf /etc/nginx/conf.d/llm-course.conf && sudo nginx -t && sudo systemctl reload nginx'`. Expected: `syntax is ok`, `test is successful`. Parity: `diff <(md5 -q deploy/nginx/llm-course.conf) <($SSH 'md5sum /etc/nginx/conf.d/llm-course.conf' | cut -d' ' -f1)` prints nothing.
- [ ] **Step 3: HUMAN GATE (verify).** `curl -s -o /dev/null -w '%{http_code}\n' http://$HOST:8080/` → `401`. `curl -s -o /dev/null -w '%{http_code}\n' -u learner http://$HOST:8080/` (password prompt) → `200`; same for `/part1/` and `/architect/` → `200`. In a browser: sign in once, open Part 1, then `/architect/intake` and send one message (fetch carries the cached credential).
- [ ] **Step 4:** The instructor posts the credential in the course channel. Rotate it if it is ever posted publicly.
- [ ] **Rollback:** reinstall the newest `/etc/nginx/backup/llm-course.conf.*`, `sudo nginx -t && sudo systemctl reload nginx`.

### Task 9: VPN fact-finding (spec 0.7, non-blocking) (USER)

- [ ] **Step 1:** From a phone hotspot with VPN off: `dig +short llm-wx-rpatterson-fubotv-training.tools.fubotv.net; curl -sk -m10 -o /dev/null -w '%{http_code}\n' https://llm-wx-rpatterson-fubotv-training.tools.fubotv.net/`. Record. No answer, a private IP, or `000` means training apps are VPN-only (affects Module 4 "Live at" links only).

### Task 10: Phase 0 verification (AGENT + USER, HUMAN GATE)

- [ ] **Step 1 (AGENT):** `python -m pytest architect/tests/test_settings_auth_env.py architect/tests/test_bind_and_origins.py architect/tests/test_deploy_configs.py -q` → all pass; full suite → only the 2 known failures.
- [ ] **Step 2 (USER, T1):** Task 7 Step 6 loop again → same shape.
- [ ] **Step 3 (USER, T10):** `$SSH 'sudo ss -ltn | grep 5001'` → `127.0.0.1:5001` only.
- [ ] **Step 4 (USER, T11 on the box, independent of auth layers):** `$SSH 'for o in https://evil.example http://ec2-100-58-203-210.compute-1.amazonaws.com:8080 https://llm-course.tools.fubotv.net; do printf "%s " $o; curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: $o" "http://127.0.0.1:5001/socket.io/?EIO=4&transport=polling"; done'` → `400`, `200`, `200`.
- [ ] **Step 5 (AGENT):** Record all Phase 0 results in `$EVID §Phase 0`. Commit `git add docs/superpowers/evidence/2026-11-06-sso-lockdown-evidence.md`, message `SSO lockdown: Phase 0 evidence`.

---

## PHASE 1: Identity layer at https://llm-course.tools.fubotv.net (alongside :8080)

Tasks 11-15 (AGENT, repo only) and Task 16 (GROUP ADMIN) can run in parallel. Tasks 17-21 (USER) run in order. Run the Global snapshot with `<phase>=phase1` before Task 11.

### Task 11: Analytics email column and X-Forwarded-Email (spec 1.6) (AGENT)

**Files:** Modify `architect/analytics.py` (`init_db`, `record_event`, `get_dashboard_data` quiz query), `architect/webapp.py:1087-1101`. Create `architect/tests/test_analytics_sso_email.py`.
**Interfaces:**
- `init_db()`: the `CREATE TABLE users` text is unchanged; afterwards, if `email` is not among `PRAGMA table_info(users)` names, run `ALTER TABLE users ADD COLUMN email TEXT` (one code path for old and new DBs; plan resolution). Idempotent.
- `record_event(user_id, event_type, module=None, data=None, user_agent=None, email=None)`: the insert writes `email`; the conflict branch sets `email=COALESCE(?, email)`.
- `get_dashboard_data()`: the quiz query selects `u.email`; each `quiz_results` row adds `"email": r["email"]`. Other rows unchanged.
- `analytics_event()` passes `email=request.headers.get("X-Forwarded-Email") or None` (trusted only because Flask is loopback-bound).

- [ ] **Step 1: Write the failing tests** (fixture `db`: `monkeypatch.setattr(analytics, "DB_PATH", str(tmp_path / "a.db"))`; fixture `client` = `db` + `analytics.init_db()` + Flask test client; helper `_email(db, uid)`):
  ```python
  def test_init_db_adds_email_to_old_schema(db):  # create the pre-change users table + one row, then init_db() twice
      assert columns(db).count("email") == 1 and rows(db) == [("u_old", None)]
  def test_init_db_fresh_has_email(db): ...  # "email" in columns after init_db()
  def test_event_stores_forwarded_email(client, db):
      r = client.post("/api/analytics/event", json={"user_id": "u_a1", "event_type": "module_start", "module": "part1"},
                      headers={"X-Forwarded-Email": "alice@fubo.tv"})
      assert r.status_code == 200 and _email(db, "u_a1") == "alice@fubo.tv"
  def test_event_without_header_keeps_email(client, db): ...   # header once, then no header -> still alice@fubo.tv
  def test_event_never_with_header_is_null(client, db): ...    # -> None
  def test_empty_header_is_null(client, db): ...               # X-Forwarded-Email: "" -> None
  def test_dashboard_quiz_rows_include_email(db):
      analytics.init_db()
      analytics.record_event("u_q1", "quiz_complete", module="part1", data={"score": 10, "total": 12, "passed": True, "name": "A"}, email="q@fubo.tv")
      assert analytics.get_dashboard_data()["quiz_results"][0]["email"] == "q@fubo.tv"
  def test_flask_own_401s_are_json(client):
      for method, path in [("POST", "/api/analytics/locks"), ("GET", "/api/analytics/dashboard"), ("POST", "/api/settings")]:
          r = client.open(path, method=method, json={})
          assert r.status_code == 401 and r.mimetype == "application/json"
  def test_locks_get_stays_public(client):
      assert client.get("/api/analytics/locks").status_code == 200
  ```
- [ ] **Step 2:** `python -m pytest architect/tests/test_analytics_sso_email.py -q` → FAIL (no column/kwarg). The two 401/locks tests already pass; they pin today's contract.
- [ ] **Step 3:** `code-executor` implements the Interfaces block.
- [ ] **Step 4:** Rerun (PASS); full suite → only the 2 known failures.
- [ ] **Step 5: Commit** `git add architect/analytics.py architect/webapp.py architect/tests/test_analytics_sso_email.py`, message `Architect analytics: store signed-in email from X-Forwarded-Email`.

### Task 12: Landing and module pages: SSO 401 banner and locks-failure banner (spec 1.7) (AGENT)

**Files:** Modify `deploy-landing/flow-through.js:15-23`, `deploy-landing/index.html:134`. Create `deploy-landing/sso-client.test.js`.
**Interfaces (both files, ES5, no shared file because each module page loads only `/flow-through.js`; plan resolution):**
- `function authExpired(r){return r.status===401 && (r.headers.get('content-type')||'').indexOf('application/json')<0;}` (this exact expression text).
- `function showAuthBanner()`: no-op if `#llm-auth-banner` exists; else appends to `document.body` a `div#llm-auth-banner` containing the text `Your sign-in expired. Your progress is saved in this browser.` and `button#llm-auth-signin` labelled `Sign in again` whose click runs `location.reload()`. Style: `position:fixed;left:16px;right:16px;bottom:16px;z-index:100000;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:8px;background:#7f1d1d;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px`.
- flow-through.js: `trackEvent` chains `.then(function(r){if(authExpired(r))showAuthBanner();}).catch(function(){})`. The locks fetch: `authExpired` → `showAuthBanner()` and no locking; else `r.json()` and today's lock logic; `.catch(function(){})` unchanged.
- index.html (inline script; `var serverLocks={part5: true};` untouched): `function showLocksBanner()` (idempotent `div#llm-locks-banner`, text `Could not load module availability; Part 5 may show as locked.`, `button#llm-locks-retry` labelled `Retry` calling `loadLocks()`; same style with `background:#78350f`), `function hideLocksBanner()` (removes it), `function loadLocks()`: `r.ok` → `r.json()` → `serverLocks=locks; hideLocksBanner(); render();`; `authExpired(r)` → `showAuthBanner()`; any other status, JSON error or network error → `showLocksBanner()`. Line 134 becomes `loadLocks();`. `serverLocks` is not reset on failure.

- [ ] **Step 1: Write the failing tests** in `deploy-landing/sso-client.test.js` (vitest, node environment, `new JSDOM(...)` per test):
  ```js
  const FLOW = readFileSync(new URL('./flow-through.js', import.meta.url), 'utf8')
  const INDEX = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
  const res = (status, ct, body) => ({ ok: status >= 200 && status < 300, status,
    headers: { get: k => (k.toLowerCase() === 'content-type' ? ct : null) }, json: () => Promise.resolve(body) })
  const flush = () => new Promise(r => setTimeout(r, 20))
  // moduleWindow(fetchImpl): JSDOM('<!doctype html><body><div>1 / 10</div></body>', {url:'http://localhost/part1/', runScripts:'outside-only'}),
  //   window.__LLM_MODULE_ID__='part1', window.fetch=vi.fn(fetchImpl), window.eval(FLOW)
  // landingWindow(fetchImpl, progress): JSDOM(INDEX, {url:'http://localhost/', runScripts:'dangerously',
  //   beforeParse(w){ w.fetch=vi.fn(fetchImpl); if(progress) w.localStorage.setItem('llm_course_progress', JSON.stringify(progress)) }})
  // badge(w, n) = text of `.module-card:nth-child(n) .module-badge`; close every window in afterEach
  it('module: sso 401 shows exactly one auth banner and does not lock', ...)        // all fetches -> res(401,'text/html'); 1 #llm-auth-banner, text matches, #llm-auth-signin text 'Sign in again', #llm-flow-bar present, no 'Module Locked'
  it('module: json 401 does not show auth banner', ...)                            // res(401,'application/json',{error:'Unauthorized'}) -> 0 banners
  it('module: locks ok with current locked still locks the page', ...)              // locks -> res(200,'application/json',{part1:true}) -> body contains 'Module Locked'
  it('module: network error on locks leaves page usable and no banner', ...)        // fetch rejects -> #llm-flow-bar present, 0 banners
  it('landing: locks ok renders server locks and shows no banner', ...)              // {part5:false}, progress part1-4 -> badge(5)=='Start', no #llm-locks-banner/#llm-auth-banner
  it('landing: network failure keeps Part 5 Admin Locked and shows availability banner', ...) // badge(5)=='Admin Locked', banner text, #llm-locks-retry text 'Retry'
  it('landing: non-ok 500 shows availability banner', ...)
  it('landing: Retry re-fetches and clears the banner on success', ...)              // 1st reject, 2nd {part5:false}; click retry; fetch called 2x; banner gone; badge(5)=='Start'
  it('landing: sso 401 on locks shows auth banner, not availability banner', ...)    // badge(5)=='Admin Locked'
  it('landing: default lock literal unchanged', () => expect(INDEX).toContain('var serverLocks={part5: true};'))
  ```
- [ ] **Step 2:** `cd deploy-landing && npx vitest run sso-client.test.js` → FAIL on banner cases.
- [ ] **Step 3:** `code-executor` implements the Interfaces block. `MODULES`, `LABELS` and the gate code are not touched.
- [ ] **Step 4:** `npx vitest run` (all pass), then `npx playwright test` (existing landing e2e still passes; the availability banner showing under `python3 -m http.server`, where `/api/analytics/locks` is 404, is expected).
- [ ] **Step 5:** Global unlock-gate check → part1-part5 in order in all three.
- [ ] **Step 6: Commit** `git add deploy-landing/flow-through.js deploy-landing/index.html deploy-landing/sso-client.test.js`, message `Landing: SSO-expiry banner and visible locks-failure banner with Retry`.

### Task 13: Architect pages: fetch wrapper detects SSO expiry (spec 1.7) (AGENT)

**Files:** Modify `architect/templates/base.html:241-246`. Create `architect/tests/test_sso_client_parity.py`.
**Interfaces:** In the base.html script block, define `authExpired(r)` and `showAuthBanner()` with the exact expression, ids, copy and style from Task 12. The wrapper returns `_origFetch.call(this, url, opts).then(r => { if (authExpired(r)) showAuthBanner(); return r; })`, with the `PFX` rewrite unchanged. `admin.html` keeps its own JSON-401 redirect (`admin.html:126`).

- [ ] **Step 1: Write the failing tests** in `architect/tests/test_sso_client_parity.py`:
  ```python
  FILES = ["deploy-landing/flow-through.js", "deploy-landing/index.html", "architect/templates/base.html"]
  RULE = "r.status===401 && (r.headers.get('content-type')||'').indexOf('application/json')<0"
  def test_auth_rule_identical_everywhere():      # RULE in each file
  def test_banner_copy_identical_everywhere():    # 'llm-auth-banner', 'llm-auth-signin', 'Your sign-in expired. Your progress is saved in this browser.', 'Sign in again', 'location.reload()' in each file
  def test_base_fetch_wrapper_checks_auth_and_returns_response():
      t = read("architect/templates/base.html")
      assert "_origFetch.call(this, url, opts).then(" in t and "return r;" in t
  def test_build_page_includes_banner_code(client):   # GET /build -> 200 and b"llm-auth-banner" in data
  def test_part5_default_lock_literal():              # 'var serverLocks={part5: true};' in index.html
  def test_unlock_gate_modules_untouched():           # "var MODULES=['part1','part2','part3','part4','part5'];" in flow-through.js; re.findall(r"\{id:'(part\d)'", index) == ['part1',...,'part5']
  ```
- [ ] **Step 2:** `python -m pytest architect/tests/test_sso_client_parity.py -q` → FAIL only on the base.html cases (Task 12 is done).
- [ ] **Step 3:** `code-executor` edits base.html per the Interfaces block.
- [ ] **Step 4:** Rerun (PASS); full suite → only the 2 known failures.
- [ ] **Step 5: Commit** `git add architect/templates/base.html architect/tests/test_sso_client_parity.py`, message `Architect: base fetch wrapper shows SSO-expiry banner on non-JSON 401`.

### Task 14: nginx: shared locations include, 443 SSO server, ACME location (spec 1.3, 1.4) (AGENT)

**Files:** Create `deploy/nginx/llm-course-locations.inc` (box: `/etc/nginx/llm-course-locations.inc`), `deploy/nginx/llm-course-sso.conf` (box: `/etc/nginx/conf.d/llm-course-sso.conf`). Modify `deploy/nginx/llm-course.conf`, `deploy/nginx/flask-app.conf`, `architect/tests/test_deploy_configs.py`.
**Interfaces:**
- `llm-course-locations.inc`: the lines of `deploy/nginx/llm-course.conf` from `# Landing page` through the closing brace of the `location ~* \.(js|css|...)$` block, verbatim, plus `proxy_set_header X-Forwarded-Email $llm_email;` as the last line of each of the four `proxy_pass` locations (`/architect/`, `/decompose/`, `/api/`, `/socket.io/`).
- `llm-course.conf`: those lines are replaced by `    set $llm_email "";` and `    include /etc/nginx/llm-course-locations.inc;` (an empty value makes nginx send no header and drop any client copy). Everything else, including basic auth, is unchanged.
- `llm-course-sso.conf`, exactly (adjustments to spec 1.4, plan resolution: `listen 443 ssl;` without `http2`, so there is no nginx-version dependency and no WebSocket-over-h2 question; `location ^~ /oauth2/` so the static-asset regex location cannot capture `/oauth2/*` assets; gzip lines copied from :8080):
  ```
  map $uri $llm_is_api {
      default 0;
      ~^/(api|socket\.io)/ 1;
      ~^/architect/(api|build|deploy|socket\.io)/ 1;
  }
  server {
      listen 443 ssl;
      server_name llm-course.tools.fubotv.net;
      ssl_certificate /etc/letsencrypt/live/llm-course.tools.fubotv.net/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/llm-course.tools.fubotv.net/privkey.pem;
      root /var/www/llm-course;
      index index.html;
      gzip on;
      gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
      gzip_min_length 256;
      proxy_read_timeout 180s;
      proxy_send_timeout 180s;
      auth_request /oauth2/auth;
      auth_request_set $llm_email $upstream_http_x_auth_request_email;
      error_page 401 = @llm_signin;
      location ^~ /oauth2/ {
          auth_request off;
          proxy_pass http://127.0.0.1:4180;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-Proto https;
      }
      location = /oauth2/auth {
          auth_request off;
          proxy_pass http://127.0.0.1:4180;
          proxy_set_header Host $host;
          proxy_set_header X-Original-URI $request_uri;
          proxy_pass_request_body off;
          proxy_set_header Content-Length "";
      }
      location @llm_signin {
          if ($llm_is_api) { return 401; }
          return 302 /oauth2/start?rd=$request_uri;
      }
      include /etc/nginx/llm-course-locations.inc;
  }
  ```
- `flask-app.conf`: inside the `listen 80` server, before `# Employee Portal`, add `location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }` (formatted like the file, with the comment `# ACME HTTP-01 for llm-course.tools.fubotv.net`).

- [ ] **Step 1: Write the failing tests** (append to `architect/tests/test_deploy_configs.py`; helper `blocks(text) -> dict[str, str]` = `re.findall(r"location\s+([^{]+?)\s*\{([^}]*)\}", text)`; helper `api_patterns()` = `re.findall(r"~(\S+)\s+1;", sso)`):
  ```python
  API = ["/api/analytics/event", "/api/analytics/locks", "/socket.io/", "/architect/api/send", "/architect/build/start",
         "/architect/build/status", "/architect/deploy/render", "/architect/deploy/image-push", "/architect/socket.io/"]
  PAGES = ["/", "/part1/", "/part5/", "/flow-through.js", "/architect/", "/architect/build", "/architect/deploy",
           "/architect/admin", "/architect/intake", "/decompose/"]
  def test_map_classifies_fetch_paths_as_api():    # every API path matches some pattern via re.match
  def test_map_classifies_pages_as_redirect():     # no PAGES path matches any pattern
  def test_sso_server_core():                       # each directive line from the block above is present in llm-course-sso.conf
  def test_auth_request_off_only_in_oauth2_locations():  # sso.count("auth_request off;") == 2 and "auth_request" not in the include
  def test_timeouts_at_least_180():                 # every proxy_(read|send)_timeout value in sso conf, include, llm-course.conf is >= 180s
  def test_every_proxy_location_forwards_email():   # include: exactly 4 blocks contain proxy_pass; each contains "proxy_set_header X-Forwarded-Email $llm_email;"
  def test_ws_locations_have_upgrade_headers():     # blocks "/architect/" and "/socket.io/" contain proxy_http_version 1.1; Upgrade $http_upgrade; Connection "upgrade"
  def test_include_keeps_live_location_set():       # block keys == ["= /", "/part1/", ..., "/part7/", "/architect/", "/decompose/", "/api/", "/socket.io/", r"~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$"]
  def test_course_conf_uses_include_and_blank_email():   # 'set $llm_email "";', include line, "listen 8080;", basic auth lines, and no "location " in llm-course.conf
  def test_flask_app_conf_acme_location():          # "location ^~ /.well-known/acme-challenge/" and "root /var/www/acme;"; "/employee/" and "/manager/" blocks unchanged
  ```
- [ ] **Step 2:** `python -m pytest architect/tests/test_deploy_configs.py -q` → new tests FAIL.
- [ ] **Step 3:** `code-executor` writes the files per the Interfaces block.
- [ ] **Step 4:** Rerun (PASS).
- [ ] **Step 5: Local `nginx -t` and routing smoke in Docker (AGENT; the 443 server and include were checked this way while planning, on nginx 1.26.3, and every row below matched).** Image `nginx:<major.minor of BOX_NGINX_VERSION>-alpine` (`T`). Throwaway test cert outside the repo: `C=$(mktemp -d) && openssl req -x509 -newkey rsa:2048 -nodes -keyout $C/privkey.pem -out $C/fullchain.pem -days 1 -subj /CN=test 2>/dev/null`. Stub `$WORK/ngx/stub.conf` (scratch, never committed) stands in for oauth2-proxy and Flask:
  ```
  server { listen 127.0.0.1:4180;
    location = /oauth2/auth { add_header X-Auth-Request-Email "alice@fubo.tv" always; if ($cookie_ok = 1) { return 202; } return 401; }
    location / { return 200 "oauth2-proxy $uri\n"; } }
  server { listen 127.0.0.1:5001;
    location / { return 200 "flask uri=$uri email=[$http_x_forwarded_email]\n"; } }
  ```
  Run `docker run --rm -v "$PWD/deploy/nginx:/cfg:ro" -v "$PWD/$WORK/ngx:/w:ro" -v "$C:/etc/letsencrypt/live/llm-course.tools.fubotv.net:ro" nginx:$T-alpine sh -c '<script>'` where the script copies the include to `/etc/nginx/`, `llm-course.conf`, `llm-course-sso.conf`, `flask-app.conf` and `/w/stub.conf` to `/etc/nginx/conf.d/` (after deleting `default.conf`), writes `x:{PLAIN}y` to `/etc/nginx/llm-course.htpasswd`, creates `/var/www/llm-course/part1/index.html` and `/var/www/llm-course/flow-through.js`, runs `nginx -t && nginx`, then curls with `--resolve llm-course.tools.fubotv.net:443:127.0.0.1 -sk`. Expected:
  - `nginx -t`: `syntax is ok`, `test is successful`.
  - No cookie: `/part1/`, `/flow-through.js`, `/architect/`, `/architect/build`, `/architect/deploy` → `302` to `https://llm-course.tools.fubotv.net/oauth2/start?rd=<path>`; `/api/analytics/locks`, `/architect/api/send`, `/architect/build/status`, `/architect/deploy/render`, `/architect/socket.io/`, `/socket.io/`, and POST `/api/analytics/event` → `401` `text/html`; `/oauth2/start` → reaches the stub (`200`).
  - `-b ok=1 -H 'X-Forwarded-Email: spoof@example.com'` on `/api/analytics/event` → body `email=[alice@fubo.tv]`; `-b ok=1 -H 'Connection: Upgrade' -H 'Upgrade: websocket'` on `/architect/socket.io/?EIO=4` → reaches the stub with `email=[alice@fubo.tv]`.
  - `:8080` with `-u x:y -H 'X-Forwarded-Email: spoof@example.com'` on `/api/x` → `email=[]`; without `-u` → `401`.
  If the Docker daemon is unavailable, record SKIP; the box `nginx -t` in Tasks 17, 18 and 21 and the Task 22 checks remain the gates.
- [ ] **Step 6: Commit** `git add deploy/nginx/llm-course-locations.inc deploy/nginx/llm-course-sso.conf deploy/nginx/llm-course.conf deploy/nginx/flask-app.conf architect/tests/test_deploy_configs.py`, message `deploy/nginx: shared locations include, 443 SSO server, ACME webroot`.

### Task 15: oauth2-proxy and certbot-renew templates (spec 1.3, 1.5) (AGENT)

**Files:** Create `deploy/oauth2-proxy/oauth2-proxy.cfg.template`, `deploy/oauth2-proxy/oauth2-proxy.service`, `deploy/certbot/certbot-renew.service`, `deploy/certbot/certbot-renew.timer`. Modify `architect/tests/test_deploy_configs.py`.
**Interfaces:**
- `oauth2-proxy.cfg.template`: one `key = value` per line, in this order: `provider = "google"`, `http_address = "127.0.0.1:4180"`, `reverse_proxy = true`, `upstreams = ["static://202"]`, `email_domains = ["fubo.tv"]`, `redirect_url = "https://llm-course.tools.fubotv.net/oauth2/callback"`, `cookie_secure = true`, `cookie_samesite = "lax"`, `cookie_expire = "168h"`, `cookie_refresh = "1h"`, `set_xauthrequest = true`, `skip_provider_button = true`, `client_id = "__CLIENT_ID__"`, `client_secret = "__CLIENT_SECRET__"`, `cookie_secret = "__COOKIE_SECRET__"`. First line is the comment `# Installed as /etc/oauth2-proxy/oauth2-proxy.cfg (0600, oauth2-proxy). Placeholders are filled on the box only.` No `authenticated_emails_file` (D3).
- `oauth2-proxy.service`: `[Unit]` `Description=oauth2-proxy for llm-course (Google SSO)`, `After=network-online.target`, `Wants=network-online.target`; `[Service]` `User=oauth2-proxy`, `Group=oauth2-proxy`, `ExecStart=/usr/local/bin/oauth2-proxy --config=/etc/oauth2-proxy/oauth2-proxy.cfg`, `Restart=always`, `RestartSec=2`, `NoNewPrivileges=true`; `[Install]` `WantedBy=multi-user.target`.
- certbot renewal is a systemd timer instead of the spec's root cron (plan resolution: works whether or not cronie is installed). `certbot-renew.service`: `[Unit]` `Description=certbot renew (llm-course)`; `[Service]` `Type=oneshot`, `ExecStart=/opt/certbot/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"`. `certbot-renew.timer`: `[Unit]` `Description=Daily certbot renew`; `[Timer]` `OnCalendar=*-*-* 03:00:00`, `RandomizedDelaySec=1h`, `Persistent=true`; `[Install]` `WantedBy=timers.target`.

- [ ] **Step 1: Write the failing tests** (append):
  ```python
  def test_oauth2_cfg_values():        # each of the 15 key = value lines above is present verbatim; lines are in that order
  def test_oauth2_cfg_placeholders_only():  # client_id/client_secret/cookie_secret values are exactly "__CLIENT_ID__"/"__CLIENT_SECRET__"/"__COOKIE_SECRET__"
  def test_oauth2_service_unit():      # ExecStart/User/Restart=always lines present
  def test_certbot_timer_and_service(): # ExecStart line with --deploy-hook "systemctl reload nginx"; OnCalendar/Persistent present
  ```
  `test_no_secret_values_under_deploy` (Task 5) now also covers these files.
- [ ] **Step 2:** Run → FAIL. **Step 3:** `code-executor` writes the four files. **Step 4:** Run → PASS. T14 check: `git grep -nE 'client_secret|cookie_secret' -- deploy/` shows only `__CLIENT_SECRET__`/`__COOKIE_SECRET__` lines.
- [ ] **Step 5: Commit** `git add deploy/oauth2-proxy/oauth2-proxy.cfg.template deploy/oauth2-proxy/oauth2-proxy.service deploy/certbot/certbot-renew.service deploy/certbot/certbot-renew.timer architect/tests/test_deploy_configs.py`, message `deploy: oauth2-proxy and certbot-renew templates (no secrets)`.

### Task 16: Google OAuth client and DNS record (GROUP ADMIN + USER, HUMAN GATE; blocked on D6)

- [ ] **Step 1: HUMAN GATE (D6).** The user confirms who creates the OAuth client (tentatively the group admin) and records the name in `$EVID`. Until then Tasks 19-22 wait.
- [ ] **Step 2 (GROUP ADMIN): OAuth client** (spec 1.2). GCP project in fubo's org → OAuth consent screen user type **Internal**, scopes `openid email profile` → Credentials → OAuth client ID → **Web application**, authorized redirect URI exactly `https://llm-course.tools.fubotv.net/oauth2/callback`. The client ID and secret go to the user through the password manager only.
- [ ] **Step 3 (GROUP ADMIN): DNS** (spec 1.3). In the Route 53 hosted zone `tools.fubotv.net`: `CNAME llm-course.tools.fubotv.net → ec2-100-58-203-210.compute-1.amazonaws.com`, TTL 300. Record who owns the zone (still to be confirmed per D1).
- [ ] **Step 4: HUMAN GATE.** `dig +short llm-course.tools.fubotv.net` → `ec2-100-58-203-210.compute-1.amazonaws.com.` then `100.58.203.210`.

### Task 17: ACME webroot on :80, certificate, renewal timer (spec 1.3) (USER, HUMAN GATE)

**Consumes:** Task 14 (`flask-app.conf`), Task 15 (certbot units), Task 16 Step 4.

- [ ] **Step 1: HUMAN GATE (baseline).** `curl -s -o /dev/null -w '%{http_code}\n' http://$HOST/employee/` → record the code (it must not change).
- [ ] **Step 2: HUMAN GATE (webroot + :80 config).** `$SSH 'sudo install -d -m 0755 /var/www/acme/.well-known/acme-challenge && echo probe | sudo tee /var/www/acme/.well-known/acme-challenge/probe >/dev/null'`; `rsync -c -e "ssh -i ~/key.pem" deploy/nginx/flask-app.conf ec2-user@$HOST:/tmp/ && $SSH 'sudo cp -a /etc/nginx/conf.d/flask-app.conf /etc/nginx/backup/flask-app.conf.$(date +%Y%m%d%H%M) && sudo install -m 0644 -o root -g root /tmp/flask-app.conf /etc/nginx/conf.d/flask-app.conf && sudo nginx -t && sudo systemctl reload nginx'`. Expected: `test is successful`. Parity: `diff <(md5 -q deploy/nginx/flask-app.conf) <($SSH 'md5sum /etc/nginx/conf.d/flask-app.conf' | cut -d' ' -f1)` prints nothing. `curl -s http://llm-course.tools.fubotv.net/.well-known/acme-challenge/probe` → `probe`. Step 1's command → same code as before.
- [ ] **Step 3: HUMAN GATE (certbot).** `$SSH 'sudo <CERTBOT_PY> -m venv /opt/certbot && sudo /opt/certbot/bin/pip install -q certbot && /opt/certbot/bin/certbot --version'` → `certbot <version>`. Then `$SSH 'sudo /opt/certbot/bin/certbot certonly --webroot -w /var/www/acme -d llm-course.tools.fubotv.net --register-unsafely-without-email --agree-tos --non-interactive'` → `Successfully received certificate.` (no email, plan resolution: Let's Encrypt no longer sends expiry mail; the timer and the monthly dry run cover renewal).
- [ ] **Step 4: HUMAN GATE (renewal).** `rsync -c -e "ssh -i ~/key.pem" deploy/certbot/certbot-renew.service deploy/certbot/certbot-renew.timer ec2-user@$HOST:/tmp/ && $SSH 'sudo install -m 0644 /tmp/certbot-renew.service /tmp/certbot-renew.timer /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now certbot-renew.timer && systemctl list-timers certbot-renew.timer --no-pager | grep -c certbot-renew && sudo /opt/certbot/bin/certbot renew --dry-run 2>&1 | grep -c "all simulated renewals succeeded"'` → `1`, `1`.

### Task 18: Move :8080 to the shared include (no behavior change) (USER, HUMAN GATE)

- [ ] **Step 1: HUMAN GATE.** `rsync -c -e "ssh -i ~/key.pem" deploy/nginx/llm-course-locations.inc deploy/nginx/llm-course.conf ec2-user@$HOST:/tmp/ && $SSH 'sudo cp -a /etc/nginx/conf.d/llm-course.conf /etc/nginx/backup/llm-course.conf.$(date +%Y%m%d%H%M) && sudo install -m 0644 -o root -g root /tmp/llm-course-locations.inc /etc/nginx/llm-course-locations.inc && sudo install -m 0644 -o root -g root /tmp/llm-course.conf /etc/nginx/conf.d/llm-course.conf && sudo nginx -t && sudo systemctl reload nginx'` → `test is successful`. Parity for both files: `diff <(md5 -q deploy/nginx/llm-course-locations.inc; md5 -q deploy/nginx/llm-course.conf) <($SSH 'md5sum /etc/nginx/llm-course-locations.inc /etc/nginx/conf.d/llm-course.conf' | cut -d' ' -f1)` prints nothing.
- [ ] **Step 2: HUMAN GATE (unchanged :8080).** Without credentials, `/` → `401`. With `-u learner`: `/`, `/part1/`, `/architect/`, `/flow-through.js` → `200`; `curl -sI -u learner http://$HOST:8080/flow-through.js | grep -i '^cache-control'` → `Cache-Control: public, immutable`. Browser: one intake message on `/architect/intake` gets a reply.
- [ ] **Rollback:** reinstall the newest `llm-course.conf` backup, then `nginx -t` and reload (the stray include file is harmless).

### Task 19: Install oauth2-proxy (spec 1.5) (USER, HUMAN GATE)

**Consumes:** Task 15 templates, Task 16 client ID/secret.

- [ ] **Step 1: HUMAN GATE (binary, pinned v7.15.6, sha256-verified).** `$SSH 'cd /tmp && V=v7.15.6 && A=linux-amd64 && curl -sSLO https://github.com/oauth2-proxy/oauth2-proxy/releases/download/$V/oauth2-proxy-$V.$A.tar.gz && curl -sSLO https://github.com/oauth2-proxy/oauth2-proxy/releases/download/$V/oauth2-proxy-$V.$A.tar.gz-sha256sum.txt && sha256sum -c oauth2-proxy-$V.$A.tar.gz-sha256sum.txt && tar -xzf oauth2-proxy-$V.$A.tar.gz && sudo install -m 0755 oauth2-proxy-$V.$A/oauth2-proxy /usr/local/bin/oauth2-proxy && /usr/local/bin/oauth2-proxy --version'` (`A=linux-arm64` if `BOX_ARCH=aarch64`). Expected: `oauth2-proxy-v7.15.6.linux-amd64.tar.gz: OK`, then a version line containing `7.15.6`.
- [ ] **Step 2: HUMAN GATE (user + config).** `rsync -c -e "ssh -i ~/key.pem" deploy/oauth2-proxy/oauth2-proxy.cfg.template deploy/oauth2-proxy/oauth2-proxy.service ec2-user@$HOST:/tmp/`. In `ssh -t -i ~/key.pem ec2-user@$HOST`:
  ```
  sudo useradd --system --no-create-home --shell /sbin/nologin oauth2-proxy
  sudo install -d -m 0750 -o oauth2-proxy -g oauth2-proxy /etc/oauth2-proxy
  sudo install -m 0600 -o oauth2-proxy -g oauth2-proxy /tmp/oauth2-proxy.cfg.template /etc/oauth2-proxy/oauth2-proxy.cfg
  read -r -p 'Client ID: ' CID; read -rs -p 'Client secret: ' CS; echo
  CK=$(openssl rand -base64 32 | tr -- '+/' '-_' | tr -d '\n')
  sudo sed -i -e "s|__CLIENT_ID__|$CID|" -e "s|__CLIENT_SECRET__|$CS|" -e "s|__COOKIE_SECRET__|$CK|" /etc/oauth2-proxy/oauth2-proxy.cfg; unset CID CS CK
  sudo grep -c '__[A-Z_]*__' /etc/oauth2-proxy/oauth2-proxy.cfg; sudo stat -c '%a %U' /etc/oauth2-proxy/oauth2-proxy.cfg
  ```
  Expected: `0`, then `600 oauth2-proxy`.
- [ ] **Step 3: HUMAN GATE (service).** `$SSH 'sudo install -m 0644 /tmp/oauth2-proxy.service /etc/systemd/system/oauth2-proxy.service && sudo systemctl daemon-reload && sudo systemctl enable --now oauth2-proxy && sleep 2 && systemctl is-active oauth2-proxy && curl -s http://127.0.0.1:4180/ping; echo; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4180/oauth2/auth'`. Expected: `active`, `OK`, `401`. On failure: `journalctl -u oauth2-proxy -n 30` (it never prints the secrets).

### Task 20: Ship Phase 1 code; one gated Flask restart (USER, HUMAN GATE)

**Consumes:** Tasks 11-13. The drop-in already carries the https origin (Task 5).

- [ ] **Step 1:** `git status --short architect/ deploy-landing/` → empty.
- [ ] **Step 2: HUMAN GATE (DB backup before the `ALTER TABLE`).** `$SSH 'cd /var/www/llm-course/architect && sudo /opt/pytorch/bin/python3 -c "import sqlite3; s=sqlite3.connect(\"analytics.db\"); d=sqlite3.connect(\"/root/analytics.db.bak-$(date +%Y%m%d)\"); s.backup(d); d.close(); print(\"ok\")"'` → `ok`. (Rollback note: old code ignores the new nullable column.)
- [ ] **Step 3: HUMAN GATE (architect ship).** Dry run as in Task 6 Step 2 (expected `0`), then the Global ship command, then parity: `diff <(cd architect && md5 -r webapp.py analytics.py templates/base.html | awk '{print $1, $2}') <($SSH 'cd /var/www/llm-course/architect && md5sum webapp.py analytics.py templates/base.html' | awk '{print $1, $2}')` → no output.
- [ ] **Step 4: HUMAN GATE (idle check + restart).** Global idle check (no file, `0`), then `$SSH "sudo systemctl restart llm-architect.service && sleep 3 && systemctl is-active llm-architect.service && sqlite3 /var/www/llm-course/architect/analytics.db \"select count(*) from pragma_table_info('users') where name='email'\""` → `active`, `1`.
- [ ] **Step 5: HUMAN GATE (landing ship).** `$SSH 'cd /var/www/llm-course && sudo cp -a index.html /root/index.html.bak-$(date +%Y%m%d) && sudo cp -a flow-through.js /root/flow-through.js.bak-$(date +%Y%m%d)'`; `rsync -c -e "ssh -i ~/key.pem" deploy-landing/index.html deploy-landing/flow-through.js ec2-user@$HOST:/var/www/llm-course/`; parity `diff <(cd deploy-landing && md5 -r index.html flow-through.js | awk '{print $1, $2}') <($SSH 'cd /var/www/llm-course && md5sum index.html flow-through.js' | awk '{print $1, $2}')` → no output. Browser on `http://$HOST:8080/` (basic auth): landing renders, no banner, Part 5 state matches `/admin`.

### Task 21: Open 443 and enable the SSO server (USER, HUMAN GATE)

**Consumes:** Tasks 17-20.

- [ ] **Step 1: HUMAN GATE (install).** `rsync -c -e "ssh -i ~/key.pem" deploy/nginx/llm-course-sso.conf ec2-user@$HOST:/tmp/ && $SSH 'sudo install -m 0644 -o root -g root /tmp/llm-course-sso.conf /etc/nginx/conf.d/llm-course-sso.conf && sudo nginx -t && sudo systemctl reload nginx'` → `test is successful`. Parity: `diff <(md5 -q deploy/nginx/llm-course-sso.conf) <($SSH 'md5sum /etc/nginx/conf.d/llm-course-sso.conf' | cut -d' ' -f1)` prints nothing.
- [ ] **Step 2: HUMAN GATE (security group).** `aws ec2 authorize-security-group-ingress --group-id <SG_ID used in Task 7 Step 4> --ip-permissions 'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=llm-course-https}]'` → `"Return": true`.
- [ ] **Step 3: HUMAN GATE (smoke).** `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://llm-course.tools.fubotv.net/part1/` → `302 https://llm-course.tools.fubotv.net/oauth2/start?rd=/part1/`. The instructor opens `https://llm-course.tools.fubotv.net/` in a browser → Google sign-in → landing page.
- [ ] **Rollback (spec Phase 1):** `$SSH 'sudo rm /etc/nginx/conf.d/llm-course-sso.conf && sudo nginx -t && sudo systemctl reload nginx && sudo systemctl stop oauth2-proxy'`; revoke the 443 rule. :8080 is unaffected.

### Task 22: Phase 1 verification: spec test plan (USER + PILOTS + AGENT, HUMAN GATE)

Exit criteria (spec): T2-T8 and T11-T13 pass on `llm-course.tools.fubotv.net` for the instructor and at least 2 pilot learners; T14 passes. `C=llm-course.tools.fubotv.net`.

- [ ] **Step 1 (USER, T1):** the Task 7 Step 6 loop with `TARGET=$HOST`, then `nc -z -w5 $C 443 && echo "443 OPEN"`. Expected: Phase 0 shape plus `443 OPEN`.
- [ ] **Step 2 (USER, T2):** `for p in /architect/build/start /api/analytics/event /architect/api/send /architect/deploy/image-push; do printf "%s " $p; curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' https://$C$p; done` → `401` for all four. `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://$C/part1/` → `302` with `/oauth2/start` in the URL.
- [ ] **Step 3 (USER, T3, from the signed-in browser's DevTools console on `https://$C/`):** `fetch('/api/analytics/event',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-Email':'spoof@example.com'},body:JSON.stringify({user_id:'u_spooftest1',event_type:'spoof_test'})}).then(r=>r.status)` → `200`. Then `$SSH "sqlite3 /var/www/llm-course/architect/analytics.db \"select email from users where user_id='u_spooftest1'\""` → the instructor's @fubo.tv address, not `spoof@example.com` (plan resolution: browser console instead of a curl cookie file, so no session cookie is ever copied). Also, as a non-admin: `fetch('/api/analytics/dashboard').then(r=>[r.status,r.headers.get('content-type')])` → `[401, "application/json"]` and no `#llm-auth-banner` (nginx passes Flask's own 401 through).
- [ ] **Step 4 (PILOTS, T4):** fresh browser profile, non-admin @fubo.tv account: complete Part 1, then Part 2 shows "Start". In Architect: intake → spec → build → deploy render + image-build. Pass: the build completes; DevTools shows `/architect/socket.io/` `101` (or polling `200`s); no 401/502/504. Image-push is out of scope while the ECR token gap exists. Record each pilot's start time (ISO) and `llm_user_id` (DevTools → Application → Local Storage).
- [ ] **Step 5 (USER, T5):** In `/architect/admin` lock part5 → landing shows "Admin Locked" and `/part5/` shows "Module Locked"; unlock → "Start" (with Part 4 done). DevTools → Network → block `/api/analytics/locks`, reload → Part 5 "Admin Locked" **and** the availability banner with Retry; unblock, click Retry → banner gone.
- [ ] **Step 6 (USER, T6):** `$SSH "cd /var/www/llm-course/architect && sqlite3 analytics.db \"select count(*) from events where created_at > '<T4 start ISO>'\" && sqlite3 analytics.db \"select email from users where user_id='<T4 llm_user_id>'\""` → a count `> 0`, then the pilot's email.
- [ ] **Step 7 (USER, T7, timeout of at least 120s):** Start a 130 s slow responder and a temporary location:
  ```
  $SSH "nohup python3 -c 'import http.server as h,time;H=type(\"H\",(h.BaseHTTPRequestHandler,),{\"do_GET\":lambda s:(time.sleep(130),s.send_response(200),s.end_headers(),s.wfile.write(b\"ok\"))});h.HTTPServer((\"127.0.0.1\",5999),H).serve_forever()' </dev/null >/dev/null 2>&1 & echo \$! > /tmp/t7.pid"
  $SSH 'sudo sed -i "/include \/etc\/nginx\/llm-course-locations.inc;/i\    location = /__t { proxy_pass http://127.0.0.1:5999; }" /etc/nginx/conf.d/llm-course-sso.conf && sudo nginx -t && sudo systemctl reload nginx'
  ```
  In the signed-in browser open `https://$C/__t`: DevTools shows `200` with time `>= 130 s` (plan resolution: browser instead of `curl -b`, so no session cookie is copied). Cleanup: `$SSH 'kill $(cat /tmp/t7.pid); sudo install -m 0644 /tmp/llm-course-sso.conf /etc/nginx/conf.d/llm-course-sso.conf && sudo nginx -t && sudo systemctl reload nginx'`, then the Task 21 Step 1 parity command → no output.
- [ ] **Step 8 (USER, T8):** On `https://$C/part1/`, DevTools → delete cookie `_oauth2_proxy`, click "Complete & Continue" or wait for an event → `#llm-auth-banner` appears; "Sign in again" returns to the page; `llm_course_progress` in Local Storage is unchanged.
- [ ] **Step 9 (USER, Review Focus 4):** Start a build on `https://$C/architect/build`, note the run id from the status line, delete `_oauth2_proxy` mid-build → banner appears and the page does not error out. On the box `$SSH 'grep -c "\"complete\": true" /var/www/llm-course/architect/workspaces/<run id>/_status.json'` → `1` once the build finishes (the build was not interrupted).
- [ ] **Step 10 (USER, T11):** Task 10 Step 4 command → `400`, `200`, `200`.
- [ ] **Step 11 (AGENT, T12):** `cd deploy-landing && npx vitest run` → all pass. (The spec's `origin-handoff.test.js` arrives in Phase 2.)
- [ ] **Step 12 (AGENT, T13):** `python -m pytest architect/tests/test_settings_auth_env.py architect/tests/test_analytics_sso_email.py architect/tests/test_bind_and_origins.py architect/tests/test_sso_client_parity.py architect/tests/test_deploy_configs.py -q` → all pass; full suite → only the 2 known `test_analyzer` failures.
- [ ] **Step 13 (AGENT, T14 + secret scan):** `git grep -nE 'client_secret|cookie_secret' -- deploy/` → placeholders only; `grep -rcE '[0-9a-f]{32}' deploy/ docs/superpowers/evidence/2026-11-06-sso-lockdown-evidence.md | grep -v ':0$'` → no output.
- [ ] **Step 14 (AGENT):** Record T1-T8, T11-T14 in `$EVID §Verification`; commit `git add docs/superpowers/evidence/2026-11-06-sso-lockdown-evidence.md`, message `SSO lockdown: Phase 1 verification evidence`. Phase 1 is verified only when every step above passed for the instructor and both pilots.

---

## PHASE 2 and PHASE 3 (planned after Phase 1 verified)

Each item below becomes full tasks in a follow-up plan written only after Task 22 passes. Listed for scope only.

### Task 23: Phase 2: cutover and localStorage-origin migration (D4: option B, 4-week window) (planned after Phase 1 verified)

- AGENT: `deploy-landing/origin-handoff.js` (`window.llmOriginHandoff`: `buildPayload`, `encode`/`decode`, `importFromHash`) and `deploy-landing/origin-handoff.test.js` (vitest: round trip, each validation rejection, merge rules, bypass key not carried, invalid base64), per spec Phase 2.
- AGENT: `deploy-landing/origin-migrate.html` (redirects to `https://llm-course.tools.fubotv.net/#llm_migrate=...`); `deploy-landing/index.html` loads `/origin-handoff.js` and imports and strips the fragment first.
- AGENT: `deploy/nginx/llm-course.conf` becomes migration-only (`location = /origin-handoff.js {}`, `location / { try_files /origin-migrate.html =404; }`), basic auth kept.
- USER: ship, swap the :8080 config, announce twice, keep the window open 4 weeks; T9. No instance stop/start during the window.

### Task 24: Phase 3: close ports and update scripts (planned after Phase 1 verified)

- USER: SSM first (`aws ssm describe-instance-information` shows `Online`, session-manager-plugin, `~/.ssh/config` ProxyCommand per spec); gate `ssh <INSTANCE_ID> true` + rsync dry run. Dashboards move from ssh `-L` to SSM port forwarding.
- AGENT: `scripts/refresh-ec2-ecr-auth.sh:18` default `EC2_HOST="${EC2_HOST:-ec2-user@<INSTANCE_ID>}"`; `context-and-sessions/src/components/DecomposeWavePlan3D.jsx:6,14` → `PROD_HOST = 'llm-course.tools.fubotv.net'` with `https://`.
- USER: allocate and associate an Elastic IP; switch the DNS record to an A record (GROUP ADMIN).
- AGENT + USER: employee/manager portal locations (300s timeouts, `client_max_body_size 500M`) into the 443 server (D5); :80 keeps only ACME plus `return 301 https://llm-course.tools.fubotv.net$request_uri`.
- USER: delete the :8080 server and htpasswd; security group: remove 8080, 3000, 5001 now, 22 after one week of SSM-only use; 80 stays for HTTP-01. T1 final shape.

## Open questions

- Q1 (Review Focus 4): "Sign in again" runs `location.reload()` (spec 1.7), which drops the in-page `runId` of a running build, although the build itself continues. Should the Architect banner open sign-in in a new tab instead, so the build page keeps polling? Not implemented; the spec text stands.
- Q2: if Task 7 Step 3 finds a world rule in a security group shared with another instance, should the user create an instance-only security group, or edit the shared one?
- D6 (from the spec): who creates the Google OAuth client. Blocks Task 16 onward.
