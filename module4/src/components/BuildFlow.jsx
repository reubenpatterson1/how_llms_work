import { useState } from 'react';

const STAGES = [
  {
    id: 'parse',
    label: 'Parse',
    symbol: '◇',
    color: '#fbbf24',
    sub: 'Group by wave',
    sample: `# Read build-package YAML
package = parse_build_package('build-package-mvp.yaml')
package.spec_slug    # 'app' (no name in this package, so the fallback; deploys as app-bd56da)
package.language     # 'python'  (Tech Stack: Python 3.12, Flask)
package.waves        # [
                     #   [weather-data-model, weather-service, healthz-handler, api-config,
                     #    error-middleware, rate-limit-middleware, test-suite],
                     #   [weather-handler, root-page-handler]
                     # ]`
  },
  {
    id: 'wrap',
    label: 'Wrap Prompt',
    symbol: '◆',
    color: '#60a5fa',
    sub: 'Per-component LLM payload',
    sample: `You are generating one source file. Output the file CONTENTS ONLY — no markdown fences, no prose, no explanation, no comments outside the code.

Target file: src/weather-handler.py
Runtime: Python 3.12
Allowed packages (already installed): flask, requests

File shape (mimic this exactly):
  (a Flask Blueprint \`bp\`: one GET JSON route with 400/404/502/500
   handling, and an inline HTML page string for GET /)

Component purpose: weather-handler (handler)
Architecture constraints:
- Endpoint triggered by submitting a city name ('Get weather' button).
- Success response: JSON {"city": str, "temp_f": number, "description": str} with status 200.

Original component prompt: Build a handler component named \`WeatherHandler\`. …
  (the "Depends on (import, do not implement)" line is removed for Python)

Application spec (this file must implement all of it):
  Purpose, API, Error Handling, Data Model, Security, Performance lines

Rules for this file:
- The app shell loads this file on its own. Other generated files cannot be imported. …
- Read environment variables inside functions at request time, never at import time. Never log, return or render a secret.
- The app shell already serves GET /healthz. Do not define it.
- Never build HTML pages with f-strings. … JavaScript template literals like \${x} must not appear inside f-strings.
- Pages must show values from the API response exactly as returned: do not convert units or rescale numbers in browser JavaScript; if the field is named temp_f it is already degrees Fahrenheit.
  … (4 more rules)
  …

Produce src/weather-handler.py now.`
  },
  {
    id: 'dispatch',
    label: 'LLM × N',
    symbol: '◈',
    color: '#a78bfa',
    sub: 'Wave-parallel via ThreadPool',
    sample: `# Wave 0 (7 components, dispatched in parallel):
ThreadPoolExecutor(max_workers=7)         # max_parallelism from the package
  ├─ weather-data-model     → ollama  64267ms
  ├─ weather-service        → ollama  23474ms
  ├─ healthz-handler        → ollama  42888ms
  ├─ api-config             → ollama   2629ms
  ├─ error-middleware       → ollama  63130ms
  ├─ rate-limit-middleware  → ollama  14000ms
  └─ test-suite             → ollama  60601ms
   (wave time = slowest component, not the sum)

# Wave 1 starts only after all 7 have returned:
  ├─ weather-handler        → ollama  41561ms
  └─ root-page-handler      → ollama  18214ms

# Build complete in 105.8s (gemma4:e4b)`
  },
  {
    id: 'clean',
    label: 'Post-process',
    symbol: '◉',
    color: '#22d3ee',
    sub: 'Strip fences, validate',
    sample: `# Every model response goes through the same checks:
→ remove stray <unusedNN> tokens; if fenced, take the first fenced block
→ unfenced and starts like prose ("I cannot..."): reject
→ Python: the file must parse (no SyntaxError)
→ reject HTML in an f-string that uses a JavaScript template literal \${...}
→ reject TODO, placeholder or stub text
→ rejected: one more call, same prompt + "Your previous output was rejected: <reason>"
   (2 attempts at most; a second rejection fails the component:
    the page is coded to show a red banner and hide the Deploy link)
→ accepted: write src/<component>.py

# Run 5: all 9 accepted on the first attempt.`
  },
  {
    id: 'assemble',
    label: 'Assemble',
    symbol: '▲',
    color: '#22c55e',
    sub: 'Dockerfile + manifest + shim',
    sample: `# Assemble writes the project files around the 9 generated ones:
workspaces/bd56dacd8151/
├── Dockerfile          # python:3.12-slim, EXPOSE 3000, CMD python src/app.py
├── requirements.txt    # flask, requests, pytest (the plan has a test component)
├── .env.example        # OPENWEATHER_API_KEY=
├── _package.yaml       # input snapshot for /deploy
└── src/
    ├── app.py          # ★ shim if not generated: Flask app, GET /healthz,
    │                   #   registers every Blueprint in the sibling files
    ├── weather-handler.py
    ├── root-page-handler.py
    └── ... (9 generated files in all)`
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
