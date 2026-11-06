# SSO and Port Lockdown: LLM Course Site and Architect (EC2) Design

Date: 2026-11-06. Status: draft, not committed. Requested by rpatterson@fubo.tv.
Source facts: `.claude/weather-refresh-work/artifacts/sso-investigation.md` (cited as INV), `nginx-T.txt` in the same dir,
`docs/superpowers/evidence/2026-10-26-weather-refresh-evidence.md` (EVID). No key or password values appear in this doc.
Placeholders: `<COURSE_HOST>` (new public hostname, D1), `<INSTANCE_ID>`, `<SG_ID>`, `<AWS_PROFILE_443>` (laptop profile for account 443514608959).
Current host: `HOST=ec2-100-58-203-210.compute-1.amazonaws.com` (us-east-1, account 443514608959).

## 1. Summary and the decision it needs

The course (landing, /part1-7) and the Architect app (/architect/) are served over plain HTTP on :8080 with no auth, and Flask
listens on 0.0.0.0:5001. Anyone on the internet can run `docker build/push` on the host and use the shared GPU Ollama.
Plan: Phase 0 removes the worst exposure today with no IdP work. Phases 1-3 put every path behind Google sign-in on one HTTPS
hostname, move learners' browser progress to that hostname, and then close every other port. Default design: oauth2-proxy +
nginx `auth_request` on the box. **Decisions needed: the public hostname/cert (D1) and your AWS rights in 443514608959 (D2).**

## 2. Goals, non-goals, anti-goals

Goals (success criteria are in section 6)
- G1 No unauthenticated internet caller can reach Flask, the Docker build/push routes, Ollama, or the course pages.
- G2 A signed-in @fubo.tv user can complete the full course and an intake->build->deploy run, including Socket.IO, with no new 504s.
- G3 The only ports open to the world are 443, plus 80 only if D1 picks ACME HTTP-01 (then 80 serves only ACME and a redirect).
- G4 Analytics records the signed-in email next to the existing random `user_id`.

Non-goals: per-module authorization (beyond the existing Part 5 admin lock); replacing SETTINGS_PASSWORD with SSO admin roles;
moving the app into EKS (option (c) is dropped, see Phase 1.1); fixing the cross-account ECR credential gap (separate blocker);
fixing `/build/start`, which copies any host path given in `package` (webapp.py:198). That is flagged here, and SSO limits it to
signed-in users. Fix it in a separate change.

Anti-goals (must not happen)
- A1 Lock the instructor out of /admin or the box. Every phase has a break-glass path (section 5.4).
- A2 Break learners mid-course. Each phase is a separate change with its own rollback; old :8080 keeps working until Phase 3.
- A3 Silently reset progress. Progress loss is either migrated (D4 default) or explicitly accepted and announced.
- A4 Restart `llm-architect.service` while a pipeline is running. Every restart is gated by the idle check (0.1).
- A5 Silently change the Part 5 lock: `serverLocks={part5:true}` default (index.html:88) and `/api/analytics/locks` semantics are kept.
- A6 Break the unlock gate. `MODULES` arrays in flow-through.js:2, index.html (~line 65) and each module's
  `__LLM_MODULE_ID__` stay untouched. `/flow-through.js` stays served from the origin root of the course host.

## 3. Current state

### 3.1 Exposure (INV probes; nginx-T.txt)
| Port | State | Serves | Auth today | Target |
|---|---|---|---|---|
| 22 | open | sshd: rsync ship, systemctl, refresh-ec2-ecr-auth.sh | key | Phase 0: instructor /32; Phase 3: closed (SSM) |
| 80 | open | flask-app.conf: /employee/ (:8050), /manager/ (:8051), `/` 302 /employee/ | app-level, unknown | Phase 3: behind Google on 443 (D5) |
| 443 | closed | commented-out TLS block only | - | single authenticated entry |
| 3000 | open | Express, 404 at /, `Access-Control-Allow-Origin: *`, not in nginx | none known | Phase 0: closed (D5) |
| 5001 | open | Flask directly (0.0.0.0, `__main__.py` default host) | none | Phase 0: loopback only |
| 8080 | open | llm-course.conf: /, /part1-7, /architect/, /decompose/, /api/, /socket.io/; `server_name _` | none | Phase 0: interim gate (D7); Phase 2: migration page; Phase 3: closed |
| 8781 | not probed | claude usage dashboard (managed by its install script) | basic auth | Phase 0: closed; SSM port-forward (D5) |
| 8099 | not probed | incident dashboard, static + /data/ | none | Phase 0: closed; SSM port-forward (D5) |
| 11434 | closed | Ollama (reachable via /architect/api/send, /api/settings/test, /build/start) | none | stays closed |

**Most urgent:** (1) Flask on 0.0.0.0:5001 exposes every route, bypassing nginx. (2) These routes have no auth:
`/build/start`, `/build/status`, `/deploy/render`, `/deploy/image-build`, `/deploy/image-push`, `/deploy/apply` (webapp.py:175-422).
Through them, anyone can run docker build/push on the host.

### 3.2 Existing auth (architect/webapp.py)
- Admin gate: `session["settings_auth"]`, set by POST /settings/login against env `SETTINGS_PASSWORD`, which falls back to a literal
  in git (:432-438). It gates POST /api/settings (:905), /admin (:1082), GET /api/analytics/dashboard (:1106),
  POST /api/analytics/locks (:1119). The Flask session is used for nothing else.
- `app.secret_key` = env `FLASK_SECRET`, with a literal fallback in git (:56). If the fallback is live, anyone can forge `settings_auth`.
  Whether the box sets either variable is **unknown** (EVID:21-26 shows only `URL_PREFIX=/architect`).
- Unauthenticated: the build/deploy routes above, /api/send, GET /api/settings (key masked), POST /api/analytics/event,
  GET /api/analytics/locks (public by design, :1111).
- Socket.IO `cors_allowed_origins="*"` (:57). Only `architect/static/build.js:1` uses it; builds fall back to polling /build/status.
- Part 5 lock is client-side only. index.html:88 defaults to `{part5:true}`; :134 fetches /api/analytics/locks with `.catch(function(){})`,
  so any failure leaves Part 5 "Admin Locked" silently. flow-through.js:21-23 locks a module page only on a successful fetch.
  Live today: all parts unlocked.
- State: analytics SQLite `architect/analytics.db`. Progress, `llm_user_id`, `llm_quiz_name_<part>` and `llm_bypass_gate` live in
  per-origin localStorage (flow-through.js:8-13,39,45,48).
- nginx: the live `/etc/nginx/conf.d/llm-course.conf` is not in git. Server-scope `proxy_read_timeout 180s`. The app-level Ollama
  timeout of 120s falls back silently to regex (memory: architect-nginx-location-and-timeout-stack).
- Hard-coded dead host `ec2-52-91-187-71...`: `context-and-sessions/src/components/DecomposeWavePlan3D.jsx:6,14` and
  `scripts/refresh-ec2-ecr-auth.sh:18`. The box's public IP has changed once already (EVID:15-20). There is no Elastic IP, so a
  stop/start changes the origin and resets everyone's progress.

## 4. Phased plan

Rule for every phase: nginx changes use `sudo nginx -t && sudo systemctl reload nginx` (graceful; in-flight requests finish).
Flask changes are shipped with the existing rsync ship command (EVID:52) and restarted only after check 0.1 passes.

### Phase 0: immediate hardening (no IdP needed; do first)

**0.1 Idle check before any `llm-architect.service` restart.**
`ssh -i ~/key.pem ec2-user@$HOST 'cd /var/www/llm-course/architect/workspaces && find . -name _status.json -mmin -30 | xargs -r grep -L "\"complete\": true"; sudo ss -Htn state established "( sport = :5001 )" | wc -l'`
Proceed only if no file is listed and the count is `0`. Otherwise wait 10 minutes and repeat. Batch all Phase 0 Flask changes into one restart.

**0.2 Secrets present?** Print names only, never values:
`ssh ... 'systemctl show -p Environment --value llm-architect.service | tr " " "\n" | cut -d= -f1; systemctl show -p EnvironmentFiles llm-architect.service'`
(authoritative, running process: `sudo tr "\0" "\n" < /proc/$(systemctl show -p MainPID --value llm-architect.service)/environ | cut -d= -f1 | grep -xE "SETTINGS_PASSWORD|FLASK_SECRET"`).
If either name is missing, treat the git fallback as compromised: create `/etc/llm-architect/env` (root:root, 0600) with
`SETTINGS_PASSWORD=<new, from password manager>` and `FLASK_SECRET=<openssl rand -base64 48>`. Then check for tampering:
`sqlite3 /var/www/llm-course/architect/analytics.db "select module,locked from module_locks"`. The instructor confirms the lock state
and the provider type/model/base_url in /admin -> settings (never print the key).

Effect of rotation: the instructor's /admin session ends and they log in again. Learners are unaffected.

**0.3 Bind Flask to loopback.** `sudo systemctl edit llm-architect.service` creates this drop-in:
```
[Service]
ExecStart=
ExecStart=/opt/pytorch/bin/python3 -m architect --host 127.0.0.1 --port 5001 --no-debug
EnvironmentFile=-/etc/llm-architect/env
Environment=SOCKETIO_CORS_ORIGINS=http://ec2-100-58-203-210.compute-1.amazonaws.com:8080
```
Repo: `architect/__main__.py` `--host` default becomes `"127.0.0.1"`. `webapp.run(host="127.0.0.1", ...)` default (:1129) changes the same way.
nginx already proxies to `127.0.0.1:5001` (nginx-T.txt:1195), so nothing changes there. Then `sudo systemctl daemon-reload`,
run 0.1, then `sudo systemctl restart llm-architect.service`.
Verify: on box `sudo ss -ltn | grep ':5001'` shows only `127.0.0.1:5001`. From the laptop, `nc -z -w5 $HOST 5001` fails and
`curl -s -o /dev/null -w '%{http_code}' http://$HOST:8080/architect/` returns `200`.
Rollback: `sudo systemctl revert llm-architect.service`, then run 0.1 and restart.

**0.4 Remove the literal fallbacks (code; ship only after 0.2 shows both names set).**
- webapp.py:56: if `FLASK_SECRET` is unset, use `os.urandom(32)` and print `[Security] FLASK_SECRET unset; sessions reset on restart`.
- webapp.py:435: if `SETTINGS_PASSWORD` is unset, every login fails and the login template shows
  "Admin disabled: SETTINGS_PASSWORD not set". Delete both literals.
- Socket.IO (:57): `origins=[o.strip() for o in os.environ.get("SOCKETIO_CORS_ORIGINS","").split(",") if o.strip()]`;
  `SocketIO(app, cors_allowed_origins=origins or None)` (None means the library's same-origin check, used in local dev).
- New test `architect/tests/test_settings_auth_env.py`: env unset -> any password leaves GET /admin on the login page; env set ->
  the right password reaches admin.html; `FLASK_SECRET` unset -> `app.secret_key` is 32 random bytes.
- Verify the Socket.IO change: `curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.example' "http://$HOST:8080/architect/socket.io/?EIO=4&transport=polling"`
  returns `400`. The same request with the allowed Origin returns `200`.

**0.5 Security group (account 443514608959; needs D2 rights).**
- 22: limit to the instructor's current egress /32.
- Remove world rules on 3000, 5001, 8781, 8099, 11434 (D5 defaults).
- Leave 80 and 8080 open. Learner VPN status is unknown, so a CIDR limit could cut off learners (A2).
Rollback: re-add the removed rule (record each rule with `aws ec2 describe-security-groups --group-ids <SG_ID>` before editing).

**0.6 Interim gate on :8080 (D7, default yes).** Add `auth_basic "LLM course"; auth_basic_user_file /etc/nginx/llm-course.htpasswd;` at
server scope in llm-course.conf, with one shared credential. The instructor posts it in the course channel. The origin does not
change, so progress is untouched. Browsers resend the cached credential on same-origin fetch and WebSocket requests. Trade-off:
the credential travels over HTTP, so it is interim only and is removed in Phase 3. Rollback: delete the two lines and reload nginx.

**0.7 VPN fact-finding (non-blocking).** From a phone hotspot with VPN off:
`dig +short llm-wx-rpatterson-fubotv-training.tools.fubotv.net; curl -sk -m10 -o /dev/null -w '%{http_code}' https://llm-wx-rpatterson-fubotv-training.tools.fubotv.net/`.
If there is no answer, a private IP, or `000`, the training apps are VPN-only. That affects Module 4's "Live at" links, not this
design. Nothing below depends on VPN.

### Phase 1: identity layer at `https://<COURSE_HOST>`, running alongside :8080

**1.1 Option choice** (option (c) EKS internal is dropped: it gives no per-user identity and needs VPN; (d) CloudFront is dropped
because of its ~30s origin default and custom auth code).
| Criterion (INV:31-36) | (a) ALB + authenticate-oidc (Google) | (b) oauth2-proxy + nginx auth_request (DEFAULT) |
|---|---|---|
| AWS rights needed in 443514608959 | elbv2, acm, ec2 SG; 2 subnets in 2 AZs | ec2 SG + Elastic IP only |
| Certificate | ACM in 443514608959, DNS-validated (one CNAME) | Let's Encrypt on box (HTTP-01 on :80, or DNS-01 if zone API access) |
| Box ports after Phase 3 | none public (SG allows only the ALB SG to 8080) | 443 (+80 for ACME if HTTP-01) |
| Timeouts | ALB idle 60s default; must set `idle_timeout.timeout_seconds=240` | unchanged nginx 180s |
| Identity to Flask | `x-amzn-oidc-data` JWT; Flask must verify ES256 + `signer` ARN (adds PyJWT, cryptography) | `X-Forwarded-Email` set by nginx from `X-Auth-Request-Email` |
| Domain restriction | Google consent screen "Internal" only; no group support | Internal consent + `email_domains`, optional emails file |
| Self-maintained parts | none on box | oauth2-proxy binary, certbot renew, client secret on box |

Recommendation: **(b)**. It needs the fewest AWS rights, and past IAM gaps (memory: ec2-cross-account-aws-blocker) make broad rights
unlikely. Switch to **(a)** if D2 confirms elbv2+acm+SG rights in 443514608959 and you would rather pay for an ALB than maintain
oauth2-proxy and certbot. If (a): its listener rules use `on-unauthenticated-request=deny` (401) for the API path patterns in 1.4 and
`authenticate` (302) for the rest; the :80 listener redirects to :443. This is a directly created internet-facing ALB, not a K8s Ingress.
If it is ever expressed as an Ingress it is external, so it needs `alb.ingress.kubernetes.io/ssl-redirect: '443'`. Internal ingresses
never get ssl-redirect, force-ssl or TLS annotations.

**1.2 Google OAuth client (whoever holds GCP OAuth admin in fubo's Google Cloud org: Workspace/GCP admin).**
- In a GCP project: OAuth consent screen user type **Internal** (only fubo Workspace accounts can sign in); scopes `openid email profile`.
- Credentials -> OAuth client ID -> **Web application**; redirect URI `https://<COURSE_HOST>/oauth2/callback` (b) or
  `https://<COURSE_HOST>/oauth2/idpresponse` (a). Client ID and secret are handed over via a password manager.
- (a) endpoints: issuer `https://accounts.google.com`, authorization `https://accounts.google.com/o/oauth2/v2/auth`,
  token `https://oauth2.googleapis.com/token`, userinfo `https://openidconnect.googleapis.com/v1/userinfo`.

**1.3 DNS and TLS ((b)).**
- `<COURSE_HOST>`: public CNAME to `$HOST` for now. In Phase 3 it becomes an A record to an Elastic IP; the origin stays the same.
- certbot in its own venv (`python3 -m venv /opt/certbot && /opt/certbot/bin/pip install certbot`); webroot HTTP-01 via a new
  `location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }` in the :80 server; root cron
  `0 3 * * * /opt/certbot/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"`.

**1.4 nginx ((b)).** Check the live config into the repo first, at `deploy/nginx/llm-course.conf`.
- Move all `location` blocks from llm-course.conf into `deploy/nginx/llm-course-locations.inc`, installed at
  `/etc/nginx/llm-course-locations.inc`. Both servers `include` it.
- Every `proxy_pass` location in the include adds `proxy_set_header X-Forwarded-Email $llm_email;`. On :8080 the value is empty,
  so nginx does not send the header and also drops any copy the client sent.
- Add `/etc/nginx/conf.d/llm-course-sso.conf` (repo: `deploy/nginx/llm-course-sso.conf`):
```
map $uri $llm_is_api { default 0; ~^/(api|socket\.io)/ 1; ~^/architect/(api|build|deploy|socket\.io)/ 1; }
server {
  listen 443 ssl; http2 on; server_name <COURSE_HOST>;
  ssl_certificate /etc/letsencrypt/live/<COURSE_HOST>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<COURSE_HOST>/privkey.pem;
  root /var/www/llm-course; index index.html; gzip on;
  proxy_read_timeout 180s; proxy_send_timeout 180s;
  auth_request /oauth2/auth;
  auth_request_set $llm_email $upstream_http_x_auth_request_email;
  error_page 401 = @llm_signin;
  location /oauth2/ { auth_request off; proxy_pass http://127.0.0.1:4180; proxy_set_header Host $host;
                      proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-Proto https; }
  location = /oauth2/auth { auth_request off; proxy_pass http://127.0.0.1:4180; proxy_set_header Host $host;
                      proxy_set_header X-Original-URI $request_uri; proxy_pass_request_body off; proxy_set_header Content-Length ""; }
  location @llm_signin { if ($llm_is_api) { return 401; } return 302 /oauth2/start?rd=$request_uri; }
  include /etc/nginx/llm-course-locations.inc;
}
```
- Protected: every path on `<COURSE_HOST>`, including /, /part1-7, /flow-through.js, static assets, /architect/*
  (pages, /architect/api/*, /architect/build/*, /architect/deploy/*, /architect/socket.io/*), /decompose/*, /api/*, /socket.io/*.
- Public: only `/oauth2/*` (the sign-in flow).
- API paths (the `map`) get a bare `401` (text/html). Pages get a `302` to sign-in. The `rd` value drops query parameters after the
  first `&`; only `/architect/build?package=...` deep links are affected.
- The existing `Upgrade`/`Connection "upgrade"`/`proxy_http_version 1.1` headers move with the include, so WebSockets work.
  `auth_request` runs once on the upgrade request.

**1.5 oauth2-proxy ((b)).**
- Use the latest v7.x release binary at implementation time. Pin it by version and verify it against the release's published sha256.
- Install at `/usr/local/bin/oauth2-proxy`. Run as `oauth2-proxy.service` under user `oauth2-proxy`, with `Restart=always`.
- Config `/etc/oauth2-proxy/oauth2-proxy.cfg` (0600, owner oauth2-proxy): `provider="google"`, `http_address="127.0.0.1:4180"`,
  `reverse_proxy=true`, `upstreams=["static://202"]`, `email_domains=["fubo.tv"]`, `redirect_url="https://<COURSE_HOST>/oauth2/callback"`,
  `cookie_secure=true`, `cookie_samesite="lax"`, `cookie_expire="168h"`, `cookie_refresh="1h"`, `set_xauthrequest=true`,
  `skip_provider_button=true`. `client_id`, `client_secret`, `cookie_secret` exist only in this file. Restarting it is safe (not llm-architect).

**1.6 Flask identity and Socket.IO origin (one restart, gated by 0.1).**
- Append `https://<COURSE_HOST>` to `SOCKETIO_CORS_ORIGINS`.
- analytics.py `init_db`: if the column is missing, `ALTER TABLE users ADD COLUMN email TEXT` (idempotent check via `PRAGMA table_info`).
- `record_event(..., email=None)`: the upsert sets `email=COALESCE(?, email)`.
- webapp.py:1087 passes `email=request.headers.get("X-Forwarded-Email") or None`. This is trusted only because Flask is
  loopback-bound (0.3). Under (a), it comes instead from the verified `x-amzn-oidc-data` `email` claim, and the request is rejected
  (403) unless the email ends with `@fubo.tv`.
- `get_dashboard_data` quiz rows add `"email": u.email`.
- Test `architect/tests/test_analytics_sso_email.py`: covers migration on an old-schema DB, email stored from the header, the
  email kept when a later event has no header, and email present in the dashboard rows.

**1.7 Client handling of session expiry (an SSO 401 is told apart from Flask's own 401, which is always JSON).**
Rule: `authExpired(r) = r.status===401 && (r.headers.get('content-type')||'').indexOf('application/json')<0`.
On expiry, show one fixed banner (id `llm-auth-banner`): "Your sign-in expired. Your progress is saved in this browser."
The banner has a "Sign in again" button that runs `location.reload()`. The reload navigates to a page, which gets the 302 to sign-in.
- `deploy-landing/flow-through.js`: `trackEvent` adds `.then(function(r){if(authExpired(r))showAuthBanner();})`. The locks fetch
  checks `authExpired` first (banner, no locking, same as today's catch path), otherwise `r.json()` as today.
- `deploy-landing/index.html`: keep `var serverLocks={part5: true};`. Replace :134: ok -> as today; `authExpired` -> auth banner;
  any other failure (non-ok or network) -> banner "Could not load module availability; Part 5 may show as locked." with a
  "Retry" button that re-runs the fetch. serverLocks stays `{part5:true}` on failure: behavior preserved, no longer silent.
- `architect/templates/base.html` fetch wrapper (:241-246): return `_origFetch(...).then(r => { if (authExpired(r)) showAuthBanner(); return r; })`.
  This covers build.js and deploy.js, because build.html and deploy.html extend base.html. admin.html:126 keeps its own 401 redirect.

Phase 1 rollback: delete `llm-course-sso.conf`, reload nginx, stop oauth2-proxy. :8080 is unaffected throughout.
Exit criteria: T2-T8 and T11-T13 pass on `<COURSE_HOST>` for the instructor plus at least 2 pilot learners.

### Phase 2: cutover and localStorage-origin migration
Moving from `http://$HOST:8080` to `https://<COURSE_HOST>` changes the origin. Without migration, every learner loses
`llm_course_progress`, `llm_user_id` and quiz names (A3). Options:
| Option | Work | Result |
|---|---|---|
| A Accept loss | announce only | learners re-complete modules; analytics history orphaned under old user_ids |
| **B Fragment handoff (DEFAULT)** | 1 static page + 1 JS file + landing hook | progress and user_id carried; only learners who visit the old URL during the window |
| C Server-side progress keyed by email | new table, API, client sync | cross-device progress; still needs B to import old data; out of scope now |

Option B spec:
- New `deploy-landing/origin-handoff.js` (classic script; exposes `window.llmOriginHandoff`):
  - `buildPayload(storage)` -> `{v:1, progress, user_id, quiz_names:{partN:...}}`, never `llm_bypass_gate`; `encode`/`decode` = base64url JSON.
  - `importFromHash(hash, storage)` accepts only `#llm_migrate=...`. Valid: progress keys `part1`-`part7` with numeric values (or
    `__v`, copied only if absent); `user_id` matches `^u_[a-z0-9]+$`; quiz names are strings of 200 chars or fewer.
  - Merge: progress key absent on new origin -> take it; in both -> keep the smaller timestamp; `llm_user_id` and quiz names set
    only if absent. Sets `llm_origin_migrated=Date.now()`, returns true. Invalid input changes nothing.
- New `deploy-landing/origin-migrate.html`: loads `/origin-handoff.js`, then
  `location.replace('https://<COURSE_HOST>/#llm_migrate=' + encode(buildPayload(localStorage)))`.
  Every old URL lands on `/` of the new host. Deep links are not preserved.
- `deploy-landing/index.html`: load `/origin-handoff.js` before the inline script. First statement: if `location.hash` starts with
  `#llm_migrate=`, call `importFromHash`, then `history.replaceState(null,'',location.pathname+location.search)`. The fragment never
  reaches a server or logs. Imported data is self-asserted, like today's progress (`?nogate` exists).
- Test `deploy-landing/origin-handoff.test.js` (vitest) covers: round-trip, each validation rejection, merge rules, bypass key not
  carried, invalid base64.
- nginx :8080 server becomes migration-only (keep 0.6 basic auth if enabled):
  `location = /origin-handoff.js {}` and `location / { try_files /origin-migrate.html =404; }`.
- Announce, and keep the window open 4 weeks (D4). Learners outside the window, or who used another browser, re-complete.
Rollback: restore the Phase 1 :8080 config (the include). Learners already moved keep working on the new host.
Do not stop/start the instance before the window closes: that changes `$HOST` and kills the old origin.

### Phase 3: close ports and update scripts
1. **SSM first.** `aws ssm describe-instance-information --filters Key=InstanceIds,Values=<INSTANCE_ID>` shows `Online`; laptop has
   session-manager-plugin; `~/.ssh/config`: `Host i-*` / `User ec2-user` / `IdentityFile ~/key.pem` /
   `ProxyCommand sh -c "AWS_PROFILE=<AWS_PROFILE_443> aws ssm start-session --region us-east-1 --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"`.
   Gate: `ssh <INSTANCE_ID> true` and the rsync ship dry-run (EVID:45) both succeed.
2. `scripts/refresh-ec2-ecr-auth.sh:18` default -> `EC2_HOST="${EC2_HOST:-ec2-user@<INSTANCE_ID>}"` (ECR auth keeps the caller's
   AWS_PROFILE for 650127479436; the ProxyCommand sets its own). Ship commands use `SSH_TARGET=ec2-user@<INSTANCE_ID>`.
3. `DecomposeWavePlan3D.jsx:6` becomes `const PROD_HOST = '<COURSE_HOST>'`; :14 uses `https://${PROD_HOST}/architect/decompose`.
4. (b) only: allocate an Elastic IP, associate it, and change `<COURSE_HOST>` to an A record. The origin is unchanged; no progress impact.
5. Employee portal (D5 default): add the `/employee/` and `/manager/` locations from flask-app.conf, with their 300s timeouts and
   `client_max_body_size 500M`, to the 443 server. The :80 server keeps only the ACME location plus
   `location / { return 301 https://<COURSE_HOST>$request_uri; }`.
6. Delete the :8080 server block and htpasswd. SG: remove 8080, 3000, 5001 now; remove 22 after one week of SSM-only use.
   80 stays world-open only for HTTP-01; with (a) or DNS-01, remove 80 too.
Rollback per item: re-add the SG rule or restore the file from `deploy/nginx/`.

## 5. Identity and authorization model
5.1 Who: every account in the fubo.tv Google Workspace (Internal consent screen + `email_domains`). For a subset, (b) adds
`authenticated_emails_file=/etc/oauth2-proxy/allowed-emails.txt`, maintained by the instructor. Non-fubo learners cannot sign in (D3).
5.2 Identity flow: Google -> oauth2-proxy cookie -> nginx `$llm_email` -> `X-Forwarded-Email` -> `users.email` in analytics.db.
Under (a): ALB -> `x-amzn-oidc-data` -> verified in Flask. The client `user_id` stays a random ID for history continuity.
5.3 Admin vs learner: both must pass SSO. Admin additionally needs SETTINGS_PASSWORD (unchanged). Part 5 lock semantics are unchanged.
5.4 Break-glass (no SSO needed): ssh (later SSM) to the box; `curl -c j -d password=... http://127.0.0.1:5001/settings/login`, then
`curl -b j -H 'Content-Type: application/json' -d '{"module":"part5","locked":true}' http://127.0.0.1:5001/api/analytics/locks`.
`sudo systemctl stop oauth2-proxy` locks everyone out of :443 (emergency lever).

## 6. Test plan (all must pass; run from the laptop unless noted)
- T1 Ports: `for p in 22 3000 5001 8080 8099 8781 11434; do nc -z -w5 $TARGET $p && echo "$p OPEN" || echo "$p closed"; done`.
  `TARGET=$HOST` (and `<COURSE_HOST>` once it exists). After Phase 0: 5001, 3000, 8099, 8781 closed. After Phase 3: all closed; 443 open; 80 per D1.
- T2 Unauthenticated: `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://<COURSE_HOST>/architect/build/start`
  returns `401`. Same for `/api/analytics/event`, `/architect/api/send`, `/architect/deploy/image-push`.
  `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' https://<COURSE_HOST>/part1/` returns `302`, with Location containing `/oauth2/start` or `accounts.google.com`.
- T3 Header spoof: signed in, POST an event with `-H 'X-Forwarded-Email: spoof@example.com'`. The DB row shows the real email.
- T4 Learner E2E: fresh browser profile, non-admin @fubo.tv account. Complete Part 1, then Part 2 unlocks. In Architect, run
  intake -> spec -> build -> deploy render + image-build. Pass: build completes; DevTools shows `/architect/socket.io/` 101 (or polling
  200s); no 401/502/504. Image-push is out of scope while the ECR token gap exists.
- T5 Part 5 lock: admin locks part5 -> landing "Admin Locked" and `/part5/` "Module Locked"; unlock -> "Start" (Part 4 done);
  DevTools blocks `/api/analytics/locks` -> Part 5 "Admin Locked" **and** the availability banner with Retry is visible.
- T6 Analytics (on box): `sqlite3 analytics.db "select count(*) from events where created_at > '<T4 start ISO>'"` > 0, and
  `select email from users where user_id='<T4 llm_user_id>'` = the T4 email.
- T7 Timeout ≥120s: on box, a temporary slow responder on 127.0.0.1:5999 (stdlib `http.server` handler that sleeps 130s, returns 200)
  behind a temporary `location = /__t` in the 443 server. Signed-in `curl -b <cookie file> -w '%{http_code} %{time_total}'` gives
  `200` and ≥130. Remove both afterwards. Under (a), first `idle_timeout.timeout_seconds` = 240.
- T8 Expiry: in DevTools delete the `_oauth2_proxy` cookie ((a): `AWSELBAuthSessionCookie-*`), then click a module action and
  start a build. Pass: the banner appears; "Sign in again" returns to the page; `llm_course_progress` is unchanged.
- T9 Migration: complete Parts 1-2 on the old origin, then open `http://$HOST:8080/part3/`. You land on `https://<COURSE_HOST>/`
  with identical progress and `llm_user_id`, and the URL has no fragment.
- T10 Loopback: on box `sudo ss -ltn | grep 5001` shows `127.0.0.1:5001` only.
- T11 Socket.IO origin check (0.4) returns 400 for a foreign Origin on both hosts.
- T12 `cd deploy-landing && npx vitest run` passes (existing + origin-handoff).
- T13 `python -m pytest architect/tests/test_settings_auth_env.py architect/tests/test_analytics_sso_email.py -q` passes,
  and the full suite shows no new failures (2 known test_analyzer failures, EVID).
- T14 No secrets in the repo: `git grep -nE 'client_secret|cookie_secret' -- deploy/` shows placeholders only.

## 7. Risks and rollbacks
| Risk | Mitigation / rollback |
|---|---|
| Instructor locked out of /admin by 0.4 | Ship only after 0.2 confirms env; break-glass 5.4; revert commit + restart (gated) |
| Restart mid-pipeline kills a learner run | 0.1 gate; batch restarts (one in Phase 0, one in Phase 1) |
| Instance stop/start changes `$HOST` before Phase 2 ends: progress lost | Do not stop/start; Phase 3 Elastic IP |
| Basic auth over HTTP (0.6) leaks shared credential | Interim, non-personal, removed in Phase 3; rotate if posted publicly |
| Let's Encrypt renewal fails (port 80 closed by mistake) | cert expiry alert: `certbot renew --dry-run` monthly; keep 80 for ACME (or DNS-01) |
| ALB 60s idle default (option a) brings back 504s | T7 required before cutover |
| oauth2-proxy down = full outage on 443 | `Restart=always`; rollback: :8080 still works until Phase 3 |
| Learners not migrated in window | Announce twice; instructor can tell learners `?nogate` (flow-through.js:48) |
| Employee portal users lack fubo Google accounts | D5 confirmation before Phase 3 step 5 |

## 8. Decisions needed from the user (ordered by plan impact)
Already answered: IdP = Google Workspace. Learner VPN = unknown, so nothing depends on VPN and 0.7 runs as a check. You own every app on
the host (80, 3000, 8781, 8099).
- **D1 Public hostname + certificate.** Default: `llm-course.tools.fubotv.net` (suggested; the zone owner is unknown), public DNS,
  Let's Encrypt HTTP-01. If the zone owner can give DNS API access, use DNS-01 and close 80 entirely. If no public name can be
  created, SSO cannot be done (Google needs an HTTPS redirect URI on a stable host). Who controls the tools.fubotv.net zone?
- **D2 Your AWS rights in 443514608959** (SG edit, Elastic IP, elbv2/acm, `ssm:StartSession`). With SG+EIP+SSM only: option (b).
  With elbv2+acm too: (a) is available. Without SG rights: Phase 0.5, all of Phase 3, and the EIP go to the platform team.
  Without SSM: port 22 stays open at the instructor /32.
- **D3 Who may sign in.** Default: all fubo.tv Workspace accounts. Group/subset: an allowlist file under (b); not supported by
  (a) without app code. External (non-fubo) learners: the consent screen must be External plus an allowlist, which needs more
  review; this is the largest change.
- **D4 Progress migration.** Default B (fragment handoff, 4-week window). A = accept and announce the loss (skips Phase 2 code).
  C = server-side progress (adds about 2 days; still needs B for import).
- **D5 Confirm per-port defaults.** 80 employee/manager: behind Google on 443 (every portal user then needs a fubo Google login;
  the :80 URL breaks). 3000 Express: close (anything calling it breaks). 8781 claude usage: close, SSM port-forward (its managed
  config is untouched). 8099 incident dashboard: close, SSM port-forward (behind Google later needs a rebuild with a base path).
- **D6 Who creates the Google OAuth client** (needs GCP OAuth admin in fubo's Google Cloud org). Blocks Phase 1.
- **D7 Interim basic auth on :8080 (0.6).** Default yes. No: Docker build/push stays internet-open until Phase 2 cutover.
- **D8 SETTINGS_PASSWORD/FLASK_SECRET status.** Not a choice; run 0.2. If either is missing, rotation (0.2) is mandatory before 0.4.

## 9. Effort and ownership
| Phase | Effort | Who must act |
|---|---|---|
| 0 | ~0.5 day | User (SSH, systemd drop-in, env file, SG if D2 allows; else platform team); code-executor for 0.3/0.4 code + tests; instructor confirms locks/provider and posts the interim credential |
| 1 | 1.5-2 days (b) / 2-3 days (a) | GCP/Workspace admin (OAuth client); DNS zone owner (record); user (certbot, oauth2-proxy, nginx; ALB+ACM if (a)); code-executor (1.6, 1.7); 2 pilot learners |
| 2 | ~1 day + 4-week window | code-executor (handoff files, tests); user (nginx swap, deploy landing); instructor (announcements, support) |
| 3 | ~0.5 day | user (SSM, SG, EIP); platform team if D2 lacks rights; code-executor (script + jsx edits) |
