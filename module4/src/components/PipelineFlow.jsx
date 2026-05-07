import { useState } from 'react';

const STAGES = [
  {
    id: 'idea',
    label: 'Idea',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'A problem worth solving',
    sample: `"Ship a team task tracker for engineering teams.
 - sprint board, task assignment, comments
 - small startups, P95 page load < 800ms"`
  },
  {
    id: 'architect',
    label: 'Architect',
    symbol: '◆',
    color: '#60a5fa',
    sub: '10-channel structured intake',
    sample: `## Purpose (100% resolved)
- Objective: team task tracker
- Success: P95 < 800ms

## Data Model (100%)
- Entities: User, Team, Task, Comment
- Constraints: User.email unique
   …`
  },
  {
    id: 'decompose',
    label: 'Decompose',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'Wave-ordered build plan',
    sample: `# 15 components · 3 waves · 73% time saved

Wave 0  ▸ 4 entity models + 2 configs   (6× parallel)
Wave 1  ▸ CacheService, AuthService     (2× parallel)
Wave 2  ▸ AuthMiddleware + 6 handlers   (7× parallel)`
  },
  {
    id: 'build',
    label: 'Build',
    symbol: '◉',
    color: '#22d3ee',
    sub: 'Wave-parallel LLM codegen',
    sample: `// src/auth-service.js
import jwt from 'jsonwebtoken';
export async function authenticate(creds) {
  const user = await Users.findByEmail(creds.email);
  if (!user || !verify(user.hash, creds.password)) {
    throw new Error('invalid');
  }
  return jwt.sign({ uid: user.id }, KEY, { expiresIn: '15m' });
}`
  },
  {
    id: 'deploy',
    label: 'Deploy',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Image → ECR → cluster',
    sample: `apiVersion: app.smo.tools.fubotv.net/v1alpha1
kind: Application
metadata:
  name: hello-world-abc123
spec:
  image: 650127479436.dkr.ecr.us-east-1.amazonaws.com/...
  healthcheck:
    path: /healthz
  ingress:
    host: hello-world-abc123-training.tools.fubotv.net`
  },
  {
    id: 'test',
    label: 'Test',
    symbol: '✓',
    color: '#fb923c',
    sub: '→ Module 5',
    isMock: true
  },
];

export default function PipelineFlow() {
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
        {popoverStage.isMock ? <DeployedAppMock /> : (
          <pre className="pipeline-popover-code">{popoverStage.sample}</pre>
        )}
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

      <style>{`
        .pipeline-flow {
          padding: 1rem 0;
        }
        .pipeline-row {
          display: flex;
          align-items: stretch;
          justify-content: center;
          flex-wrap: wrap;
        }
        .pipeline-cell { display: flex; align-items: center; }
        .pipeline-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.85rem 0.6rem;
          min-width: 124px;
          border-radius: 12px;
          border: 2px solid transparent;
          transition: all 0.3s ease;
          opacity: 0.45;
          cursor: default;
        }
        .pipeline-stage:hover {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(30, 41, 59, 0.5);
          opacity: 1;
        }
        .pipeline-pending { opacity: 0.4; }
        .pipeline-pending .pipeline-symbol { color: #475569 !important; }
        .pipeline-pending .pipeline-label,
        .pipeline-pending .pipeline-sub { color: #475569; }
        .pipeline-active {
          opacity: 1;
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(30, 41, 59, 0.6);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .pipeline-active .pipeline-symbol {
          filter: drop-shadow(0 0 12px currentColor);
          transform: scale(1.12);
        }
        .pipeline-done { opacity: 0.85; }
        .pipeline-symbol {
          font-size: 2.5rem;
          line-height: 1;
          margin-bottom: 0.5rem;
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        .pipeline-label { font-size: 1rem; font-weight: 700; margin-bottom: 0.2rem; }
        .pipeline-sub { font-size: 0.7rem; color: #94a3b8; text-align: center; line-height: 1.3; max-width: 124px; }
        .pipeline-arrow {
          color: #334155;
          font-size: 1.4rem;
          padding: 0 0.3rem;
          transition: color 0.3s, transform 0.3s;
          align-self: center;
          margin-top: -1.5rem;
        }
        .pipeline-arrow-done { color: #94a3b8; }
        .pipeline-arrow-active {
          color: #60a5fa;
          transform: scale(1.3);
          animation: pulse 0.8s ease-in-out infinite alternate;
        }
        @keyframes pulse { from { opacity: 0.6; } to { opacity: 1; } }

        .pipeline-popover {
          margin-top: 1.5rem;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 1rem 1.25rem;
          min-height: 180px;
          max-width: 1100px;
          margin-left: auto;
          margin-right: auto;
        }
        .pipeline-popover-header {
          font-size: 0.85rem;
          font-weight: 600;
          font-family: 'IBM Plex Mono', monospace;
          margin-bottom: 0.6rem;
          letter-spacing: 0.02em;
        }
        .pipeline-popover-code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.78rem;
          line-height: 1.5;
          color: #cbd5e1;
          white-space: pre-wrap;
          margin: 0;
        }

        .pipeline-actions {
          margin-top: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }
        .pipeline-counter {
          font-family: 'IBM Plex Mono', monospace;
          color: #94a3b8;
          font-size: 0.8rem;
          min-width: 3rem;
          text-align: right;
        }
        .pipeline-btn {
          border: none;
          padding: 0.5rem 1.1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        .pipeline-btn-primary { background: #3b82f6; color: white; }
        .pipeline-btn-primary:hover { background: #2563eb; }
        .pipeline-btn-secondary { background: #334155; color: #e2e8f0; }
        .pipeline-btn-secondary:hover { background: #475569; }

        /* Deployed-app mock */
        .deployed-mock {
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          max-width: 480px;
          margin: 0 auto;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .deployed-mock-bar {
          background: #e5e7eb;
          padding: 0.5rem 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          color: #4b5563;
        }
        .deployed-mock-dot {
          width: 0.6rem;
          height: 0.6rem;
          border-radius: 50%;
          display: inline-block;
        }
        .deployed-mock-url {
          flex: 1;
          background: #fff;
          border-radius: 4px;
          padding: 0.15rem 0.5rem;
          margin-left: 0.5rem;
          font-size: 0.65rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .deployed-mock-body {
          padding: 1.5rem 1rem;
          text-align: center;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .deployed-mock-h1 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.6rem;
          color: #0f172a;
        }
        .deployed-mock-clock {
          font-size: 0.95rem;
          color: #475569;
          margin-bottom: 0.4rem;
          font-family: 'IBM Plex Mono', monospace;
        }
        .deployed-mock-weather {
          font-size: 0.85rem;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}

function DeployedAppMock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  // Tick once a second
  if (typeof window !== 'undefined') {
    setTimeout(() => setTime(new Date().toLocaleTimeString()), 1000);
  }
  return (
    <div className="deployed-mock">
      <div className="deployed-mock-bar">
        <span className="deployed-mock-dot" style={{ background: '#ef4444' }}></span>
        <span className="deployed-mock-dot" style={{ background: '#f59e0b' }}></span>
        <span className="deployed-mock-dot" style={{ background: '#10b981' }}></span>
        <span className="deployed-mock-url">https://hello-world-abc123-training.tools.fubotv.net/</span>
      </div>
      <div className="deployed-mock-body">
        <div className="deployed-mock-h1">Hello, World!</div>
        <div className="deployed-mock-clock">{time}</div>
        <div className="deployed-mock-weather">few clouds 70°F in NY</div>
      </div>
    </div>
  );
}
