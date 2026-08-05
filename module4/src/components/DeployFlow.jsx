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
