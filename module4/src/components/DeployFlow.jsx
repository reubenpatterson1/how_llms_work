import { useState } from 'react';

const STAGES = [
  {
    id: 'render',
    label: 'Render',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'Fill auto-derived fields',
    sample: `# Read template (default or user-uploaded)
template = open('deploy_template.yaml').read()

# Auto-derive from workspace + config:
fields = {
  'name':              'hello-world-735bac',         # spec_slug-run_short
  'namespace':         'training',
  'image':             '650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:735bac',
  'port':              3000,                          # from generated app.listen()
  'host':              'hello-world-735bac-training.tools.fubotv.net',
  'healthcheck_path':  '/healthz',                    # scanned from generated handler
}

rendered = render_yaml_text(template, **fields)
# → loaded into Monaco editor, user can edit before apply`
  },
  {
    id: 'docker_build',
    label: 'Docker Build',
    symbol: '◆',
    color: '#60a5fa',
    sub: '--platform=linux/amd64',
    sample: `> docker build --platform linux/amd64 -t \\
  650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:735bac \\
  /var/www/llm-course/architect/workspaces/735bacc940ad/

[+] Building 17.4s (10/10) FINISHED
 => [internal] load build definition from Dockerfile
 => [1/5] FROM docker.io/library/node:20-alpine
 => [2/5] WORKDIR /app
 => [3/5] COPY package.json ./
 => [4/5] RUN npm install --omit=dev
 => [5/5] COPY src ./src
 => exporting to image  sha256:01c51f43...`
  },
  {
    id: 'push',
    label: 'Push to ECR',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'Auto-create repo if missing',
    sample: `# Pre-flight: create repo if it doesn't exist
ensure_ecr_repository(image_tag, region, registry)

> docker push 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:735bac

The push refers to repository [.../architect-builds/hello-world]
257f790ce9bf: Pushed
e10358715ead: Layer already exists
4983b93ee796: Layer already exists
735bac: digest: sha256:cbaf8a4c... size: 1990

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

application.app.smo.tools.fubotv.net/hello-world-735bac created

# Operator reconciles into:
#   Deployment    hello-world-735bac
#   Service       hello-world-735bac
#   Ingress       hello-world-735bac (ALB target group)
#   Route 53      hello-world-735bac-training.tools.fubotv.net

# (If kubectl is missing on the agent host:
#  return YAML + copy-paste command for client-side apply.)`
  },
  {
    id: 'poll',
    label: 'Poll Ingress',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Wait for HTTP 200',
    sample: `# Poll up to 120s (Route53 + ALB target registration ~90s)
while elapsed < 120s:
  resp = GET https://hello-world-735bac-training.tools.fubotv.net/healthz
  if resp.status_code in (200, 302):
    print("✓ Live at", url)
    return
  sleep 5s

# UI flips:  "Will deploy to" → "Deploying to" → "✓ Live at"`
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
