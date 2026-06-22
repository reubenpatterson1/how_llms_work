import { useState } from 'react';

const STAGES = [
  {
    id: 'codebase',
    label: 'Local Codebase',
    symbol: '⬡',
    color: '#fbbf24',
    sub: 'App code + container + deploy config',
    sample: `your-app/
├── src/                # application source code
├── Dockerfile          # how to build the container image
├── helm/               # OR k8s-manifests/ OR fubo App CRD
│   ├── Chart.yaml
│   └── values.yaml     # image, replicas, resources, ingress
└── .github/
    └── workflows/
        └── deploy.yml  # CI/CD pipeline definition

# These three files are the core artifacts:
#   Dockerfile      → produces the Docker image
#   Helm/K8s YAML   → tells K8s how to run that image
#   deploy.yml      → automates the "build + apply" sequence`,
  },
  {
    id: 'docker',
    label: 'Docker Image',
    symbol: '◻',
    color: '#22c55e',
    sub: 'Immutable runtime artifact',
    sample: `# Dockerfile → image → running container

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/app-server.js"]

# docker build -t my-ecr.amazonaws.com/my-app:abc1234 .
# docker push  my-ecr.amazonaws.com/my-app:abc1234

# The image tag (git SHA / semver) is the handoff:
# the Helm chart references this exact tag.
# Old images stay in ECR for instant rollback.`,
  },
  {
    id: 'helm',
    label: 'Helm / K8s Manifest',
    symbol: '⧉',
    color: '#f97316',
    sub: 'Templated config → K8s objects',
    sample: `# helm/values.yaml
image:
  repository: my-ecr.amazonaws.com/my-app
  tag: abc1234          # ← set by CI/CD or manually

replicaCount: 2
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits:   { cpu: 500m, memory: 512Mi }

ingress:
  host: my-app.internal.fubo.tv

# Helm renders this into: Deployment + Service + Ingress
# fubo alternative: apiVersion app.smo.tools.fubotv.net/v1alpha1
#   (same concept — one file, operator translates to K8s objects)

# Apply: helm upgrade --install my-app ./helm \\
#          --set image.tag=$SHA`,
  },
  {
    id: 'branch',
    label: 'GitHub Branch',
    symbol: '⑂',
    color: '#60a5fa',
    sub: 'Unit of review before deploy',
    sample: `# All three files live in the repo:
git checkout -b feature/add-weather-endpoint

# ... write code, update Dockerfile if needed ...
git add src/ Dockerfile helm/values.yaml
git commit -m "Add /weather endpoint"
git push origin feature/add-weather-endpoint

# The branch is the unit of review.
# Nothing deploys yet — that waits for PR merge.

# Direct-deploy path: push to main directly
# (or manually build + apply without the PR step)`,
  },
  {
    id: 'pr',
    label: 'PR & Merge',
    symbol: '⊕',
    color: '#a78bfa',
    sub: 'Review gate before CI/CD fires',
    sample: `# Pull request opened on GitHub
# CI checks run automatically:
#   ✓ lint
#   ✓ unit tests
#   ✓ docker build (dry-run, no push yet)
#
# Reviewers approve → squash-merge into main
#
# The merge event is the trigger:
#   on:
#     push:
#       branches: [main]
#
# ▶ Merge fires the GH Actions deploy workflow
#
# If you have NO GitHub Actions yet → skip to
#   "Direct Path": run docker build/push + kubectl
#   apply yourself from your local machine.`,
  },
  {
    id: 'actions',
    label: 'GH Actions',
    symbol: '⚙',
    color: '#22d3ee',
    sub: 'Automated build → push → deploy',
    sample: `# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to ECR
        run: aws ecr get-login-password | docker login ...
      - name: Build & Push
        run: |
          docker build -t $ECR_REPO:\${{ github.sha }} .
          docker push  $ECR_REPO:\${{ github.sha }}
      - name: Deploy via Helm
        run: |
          helm upgrade --install my-app ./helm \\
            --set image.tag=\${{ github.sha }}
      # ↑ This renders the Helm template with the new image tag
      # and sends the updated Deployment manifest to the K8s
      # API server. The reconcile loop takes it from here.

# ── Direct Path (no CI/CD) ──────────────────
# Run these same commands yourself, locally:
#   aws ecr get-login-password | docker login ...
#   docker build -t $ECR_REPO:my-tag .  &&  docker push ...
#   kubectl apply -f k8s/deployment.yaml
#   (or: helm upgrade --install ...)`,
  },
  {
    id: 'k8s-reconcile',
    label: 'K8s Reconcile',
    symbol: '⟳',
    color: '#e879f9',
    sub: 'Controller loop applies the new image',
    sample: `# After kubectl apply / helm upgrade completes:
#
# 1. API Server stores the updated Deployment spec
#    (only the image tag changed: abc123 → def456)
#
# 2. Deployment controller diffs desired vs actual state
#    → desired: image tag def456, replicas: 2
#    → actual:  image tag abc123, replicas: 2
#    → creates a NEW ReplicaSet for def456
#
# 3. Kubelet on each node pulls the new image from ECR:
#    docker pull 650127479436.dkr.ecr.us-east-1.amazonaws.com/my-app:def456
#    container starts → liveness probe waits
#    readiness probe passes → pod status: Ready
#
# 4. Rolling update strategy (default):
#    maxSurge: 1      → spin 1 extra pod up first
#    maxUnavailable: 0 → never kill old pod until
#                        the replacement is Ready
#    Old ReplicaSet scales to 0 when done.
#
# 5. Service selector routes only to Ready pods
#    → zero-downtime swap during the rollover
#
# Watch it live:
#   kubectl rollout status deployment/my-app
#   Waiting for rollout to finish: 1 of 2 updated...
#   deployment "my-app" successfully rolled out ✓
#
# Rollback if something goes wrong:
#   kubectl rollout undo deployment/my-app
#   (or: helm rollback my-app 1)`,
  },
  {
    id: 'live',
    label: 'Live URL',
    symbol: '◉',
    color: '#f43f5e',
    sub: 'Ingress routes traffic → app serving',
    sample: `# kubectl / helm apply → controller reconciles
#
# Route 53 → ALB → Ingress → Service → Pod(s)
#
# Timeline (first deploy):
#   ~30s  pod starts, passes healthcheck /health
#   ~60s  ALB registers pod as healthy target
#   ~90s  Route 53 TTL propagates → HTTP 200 ✓
#
# Rolling update (subsequent deploys):
#   new pod healthy → old pod terminated
#   typically < 30s, zero downtime
#
# If deploy fails:
#   kubectl rollout undo deployment/my-app
#   (or: helm rollback my-app 1)`,
  },
];

export default function DeploymentStack() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [showDirect, setShowDirect] = useState(false);

  const next = () => setActiveIdx((i) => Math.min(STAGES.length - 1, i + 1));
  const reset = () => { setActiveIdx(0); setShowDirect(false); };

  const stageState = (i) => {
    if (showDirect && i === 3) return 'skipped';
    if (showDirect && i === 4) return 'skipped';
    if (i < activeIdx) return 'done';
    if (i === activeIdx) return 'active';
    return 'pending';
  };

  const popoverIdx = hoverIdx !== null ? hoverIdx : activeIdx;
  const popoverStage = STAGES[popoverIdx];
  const isLast = activeIdx === STAGES.length - 1;

  return (
    <div className="pipeline-flow">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Show direct-deploy path:</span>
        <button
          onClick={() => setShowDirect((v) => !v)}
          style={{
            padding: '2px 10px',
            borderRadius: '4px',
            border: '1px solid #334155',
            background: showDirect ? '#0f4' : '#1e293b',
            color: showDirect ? '#000' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          {showDirect ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="pipeline-row" style={{ flexWrap: 'wrap', rowGap: '0.5rem' }}>
        {STAGES.map((s, i) => {
          const state = stageState(i);
          const isSkipped = state === 'skipped';
          return (
            <div key={s.id} className="pipeline-cell">
              <div
                className={`pipeline-stage pipeline-${isSkipped ? 'pending' : state}`}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ opacity: isSkipped ? 0.3 : 1, position: 'relative' }}
              >
                {isSkipped && (
                  <div style={{
                    position: 'absolute', top: '2px', right: '4px',
                    fontSize: '0.6rem', color: '#64748b', fontStyle: 'italic'
                  }}>skip</div>
                )}
                <div className="pipeline-symbol" style={{ color: s.color }}>{s.symbol}</div>
                <div className="pipeline-label">{s.label}</div>
                <div className="pipeline-sub">{s.sub}</div>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`pipeline-arrow ${i < activeIdx ? 'pipeline-arrow-done' : ''} ${i === activeIdx ? 'pipeline-arrow-active' : ''}`}>
                  {showDirect && i === 2 ? (
                    <span title="direct path skips PR + GH Actions">⤵</span>
                  ) : (
                    <span>→</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
