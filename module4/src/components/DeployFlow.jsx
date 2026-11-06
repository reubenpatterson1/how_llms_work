import { useState } from 'react';

const STAGES = [
  {
    id: 'render',
    label: 'Render',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'Fill auto-derived fields',
    sample: `# Read template (built-in fubo Application template)
template = open('deploy_template.yaml').read()

# Auto-derived from workspace + config (run bd56dacd8151):
fields = {
  'name':              'app-bd56da',                     # spec_slug-run_short (no name in the package, so spec_slug fell back to 'app')
  'namespace':         'training',
  'image':             '650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:bd56da',
  'port':              3000,                             # default (port auto-detect is Node-only)
  'host':              'app-bd56da-training.tools.fubotv.net',
  'healthcheck_path':  '/healthz',                        # scanned from generated sources
}

rendered = render_yaml_text(template, **fields)
# → loaded into Monaco editor, user can edit before apply

# The template also points the key at the app's own Secret.
# Only the Secret's name is rendered, never a key value:
#   env:
#     - name: OPENWEATHER_API_KEY
#       valueFrom:
#         secretKeyRef:
#           name: app-bd56da-openweather
#           key: OPENWEATHER_API_KEY
#           optional: true

# Note: the ECR repo ("architect-builds/app") is SHARED across every
# build; only the image tag (bd56da) is unique to the run.`
  },
  {
    id: 'docker_build',
    label: 'Docker Build',
    symbol: '◆',
    color: '#60a5fa',
    sub: '--platform=linux/amd64',
    sample: `> docker build --platform linux/amd64 -t 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:bd56da <workspace>
(image built)

# That is the whole transcript the Deploy page shows for this step.
# <workspace> is the build folder for run bd56dacd8151.`
  },
  {
    id: 'push',
    label: 'Push to ECR',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'One shared repo, per-run tag',
    sample: `# Pre-flight: create the shared repo if it doesn't exist yet
# (one-time; every build reuses it, whatever the app is called)
ensure_ecr_repository(image_tag, region, registry)

> docker push 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app:bd56da
ERROR: ECR auth missing or expired. Run: aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 650127479436.dkr.ecr.us-east-1.amazonaws.com

Original error: denied: Your authorization token has expired. Reauthenticate and try again.

# The first push failed because the agent host's ECR login had expired.
# The operator refreshed it, then clicked "2. Push to ECR (retry)":

The push refers to repository [650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/app]
… (8 layers Preparing, 3 Waiting)
340931a1d986: Layer already exists
ec164f3644b9: Layer already exists
674e26dfab46: Layer already exists
504cadfc0bb6: Layer already exists
96a69f98ae07: Layer already exists
3dc3efdf0110: Layer already exists
dd57f90311a2: Layer already exists
59b3c932b8fb: Pushed
bd56da: digest: sha256:7ddac14e4727… size: 1992`
  },
  {
    id: 'apply',
    label: 'kubectl apply',
    symbol: '◉',
    color: '#22d3ee',
    sub: 'fubo Application CRD',
    sample: `> kubectl apply -f <rendered.yaml>
kubectl not available on the agent host — apply from a machine with cluster auth.

# So the Deploy page shows a "Manual apply needed" panel.
# On your laptop, in order, in ONE shell:

# 1. Enter the key (hidden) and check its length: expect len=32
stty -echo; printf "OpenWeather key: "; read -r OPENWEATHER_API_KEY; stty echo; echo; export OPENWEATHER_API_KEY; echo "len=\${#OPENWEATHER_API_KEY}"

# 2. Create the app's own Secret
AWS_PROFILE=fubo-tools kubectl --context vat-dev -n training create secret generic app-bd56da-openweather --from-literal=OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY"

# 3. Apply the rendered YAML (it sets namespace: training)
cat <<'EOF' | AWS_PROFILE=fubo-tools kubectl --context vat-dev apply -f -
[rendered.yaml content]
EOF

# Recorded for this run: the Secret holds 32 bytes, and so does the
# OPENWEATHER_API_KEY env var inside the pod.`
  },
  {
    id: 'poll',
    label: 'Poll Ingress',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Wait for HTTP 200',
    sample: `# When the agent host can apply, it polls https://<host>/healthz
# every 5s for up to 120s and stops at the first 200 or 302.
# Here the apply ran on a laptop, so the panel gives the check instead
# (HTTPS only: http:// returns a 404 from the shared load balancer):
> curl -sS https://app-bd56da-training.tools.fubotv.net/healthz
# recorded for this run: 200

# A 200 only proves the pod is up. The real check compares the app
# with OpenWeather itself:
GET /api/weather?city=Chicago       → 38.3 °F, "broken clouds"
OpenWeather (units=imperial)        → 38.08 °F, "scattered clouds"
# Δ 0.22 °F. The descriptions differ because OpenWeather updated
# between the two calls, which were not made at the same moment.
GET /api/weather?city=<unknown>     → 404
GET /api/weather (no city)          → 400`
  },
];

export default function DeployFlow() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);

  const next = () => setActiveIdx((i) => Math.min(STAGES.length - 1, i + 1));
  const reset = () => setActiveIdx(0);

  const stageState = (i) => {
    if (i < activeIdx) return 'done';
    if (i === activeIdx) return 'active';
    return 'pending';
  };

  const popoverIdx = hoverIdx !== null ? hoverIdx : activeIdx;
  const popoverStage = STAGES[popoverIdx];
  const isLast = activeIdx === STAGES.length - 1;

  return (
    <div className="pipeline-flow">
      <div className="pipeline-row">
        {STAGES.map((s, i) => (
          <div key={s.id} className="pipeline-cell">
            <div
              className={`pipeline-stage pipeline-${stageState(i)}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div className="pipeline-symbol" style={{ color: s.color }}>{s.symbol}</div>
              <div className="pipeline-label">{s.label}</div>
              <div className="pipeline-sub">{s.sub}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`pipeline-arrow ${i < activeIdx ? 'pipeline-arrow-done' : ''} ${i === activeIdx ? 'pipeline-arrow-active' : ''}`}>
                <span>→</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pipeline-popover">
        <div className="pipeline-popover-header" style={{ color: popoverStage.color }}>
          {popoverStage.label} — {popoverStage.sub}
        </div>
        <pre className="pipeline-popover-code">{popoverStage.sample}</pre>
      </div>

      <div className="pipeline-actions">
        <span className="pipeline-counter">{activeIdx + 1} / {STAGES.length}</span>
        {isLast ? (
          <button onClick={reset} className="pipeline-btn pipeline-btn-secondary">Restart</button>
        ) : (
          <button onClick={next} className="pipeline-btn pipeline-btn-primary">
            Next: {STAGES[activeIdx + 1].label} →
          </button>
        )}
      </div>
    </div>
  );
}
