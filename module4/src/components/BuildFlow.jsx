import { useState } from 'react';

const STAGES = [
  {
    id: 'parse',
    label: 'Parse',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'Group by wave',
    sample: `# Read build-package YAML
package = parse_build_package('uploaded.yaml')
package.spec_slug    # 'team-task-tracker'
package.language     # 'javascript'
package.waves        # [
                     #   [4 entity models + 2 configs],
                     #   [CacheService, AuthService],
                     #   [AuthMiddleware + 6 handlers]
                     # ]`
  },
  {
    id: 'wrap',
    label: 'Wrap Prompt',
    symbol: '◆',
    color: '#60a5fa',
    sub: 'Per-component LLM payload',
    sample: `You are generating one source file. Output the file CONTENTS ONLY...

Target file: src/auth-service.js
Runtime: Node 20
Allowed packages (already installed): express, jsonwebtoken

File shape (mimic this exactly):
  import express from 'express';
  export async function authenticate(creds) { ... }

Component purpose: AuthService (service)
Architecture constraints:
- JWT with RS256 signing
- RBAC roles owner/admin/member
- 15m access tokens, 30d refresh

Produce src/auth-service.js now.`
  },
  {
    id: 'dispatch',
    label: 'LLM × N',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'Wave-parallel via ThreadPool',
    sample: `# Wave 0 (6 components, dispatched in parallel):
ThreadPoolExecutor(max_workers=6)
  ├─ user-model      → ollama  ━━━━━━╸
  ├─ team-model      → ollama  ━━━━━━╸
  ├─ task-model      → ollama  ━━━━━━╸
  ├─ comment-model   → ollama  ━━━━━━╸
  ├─ database-config → ollama  ━━━━━━╸
  └─ deployment-cfg  → ollama  ━━━━━━╸
   (max wave-0 time = single component time, not sum)`
  },
  {
    id: 'clean',
    label: 'Post-process',
    symbol: '◉',
    color: '#22d3ee',
    sub: 'Strip fences, validate',
    sample: `# Raw mistral:7b output:
\`\`\`javascript
import jwt from 'jsonwebtoken';
export async function authenticate(creds) { ... }
\`\`\`

→ post_process_output() strips fence markers
→ write to workspace/src/auth-service.js
→ if response is prose ("I cannot..."), raise PostProcessError`
  },
  {
    id: 'assemble',
    label: 'Assemble',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Dockerfile + manifest + shim',
    sample: `workspaces/<run>/
├── Dockerfile          # node:20-alpine, EXPOSE 3000
├── package.json        # express, node-fetch, dotenv
├── .env.example        # OPENWEATHER_API_KEY=
├── _package.yaml       # input snapshot for /deploy
└── src/
    ├── app-server.js   # ★ auto-shim if not generated
    ├── auth-service.js
    ├── auth-middleware.js
    └── ...`
  },
];

export default function BuildFlow() {
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
