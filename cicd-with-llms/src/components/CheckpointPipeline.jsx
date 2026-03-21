import { useState, useRef, useCallback } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B', grey: '#374151'
}

const STAGES = [
  {
    id: 'commit', label: 'Commit', runtime: '15s',
    logs: [
      '$ git push origin main',
      'Pipeline triggered: abc1234',
      'Checking out repository...',
      'Installing dependencies via npm ci...',
      'Running linter: eslint src/**/*.{js,jsx}',
    ]
  },
  {
    id: 'lint', label: 'Lint', runtime: '30s',
    logs: [
      'ESLint v9.25.0',
      'Scanning 14 files...',
      'src/fetchWeather.js — OK',
      'src/App.jsx — OK',
      'src/components/WeatherCard.jsx — OK',
      'No problems found. Lint passed.',
    ]
  },
  {
    id: 'tests', label: 'Tests', runtime: '2m',
    logs: [
      'Running test suite...',
      'PASS src/__tests__/fetchWeather.test.js',
      '  ✓ returns weather data for valid city (42ms)',
      '  ✓ throws on network error (8ms)',
      '  ✓ handles empty response gracefully (5ms)',
      'PASS src/__tests__/MockWeatherService.test.js',
      'Tests: 6 passed, 0 failed. Coverage: 84%',
    ]
  },
  {
    id: 'build', label: 'Build', runtime: '3m',
    logs: [
      'vite build --mode production',
      'Bundling 23 modules...',
      'src/index.css — 2.4KB',
      'src/App.jsx → dist/assets/App-8f3c2b.js — 48.2KB',
      'dist/index.html — 0.6KB',
      'Build complete. Total size: 287KB (under 500KB limit)',
    ]
  },
  {
    id: 'staging', label: 'Staging', runtime: '4m',
    logs: [
      'Deploying to staging environment...',
      'Docker image pushed: weather-app:abc1234',
      'Staging deploy complete: https://staging.weather-app.internal',
      'Running smoke tests against staging...',
      'GET /api/weather?city=Chicago — 200 OK (312ms)',
      'GET /api/weather?city=London — 200 OK (287ms)',
      'LLM API health check: Anthropic API — OK',
      'All smoke tests passed.',
    ]
  },
  {
    id: 'production', label: 'Production', runtime: '5m',
    logs: [
      'Manual approval received: rpatterson@fubo.tv',
      'Initiating canary deployment (5% traffic)...',
      'Monitoring error rate for 15 minutes...',
      'Error rate: 0.02% (baseline: 0.03%) — OK',
      'Promoting to 100% traffic...',
      'Production deploy complete: https://weather-app.fubo.tv',
      'Pipeline succeeded in 14m 45s.',
    ]
  }
]

const FAILURE_OPTIONS = [
  { value: 'none', label: 'No failure (success)' },
  { value: 'lint', label: 'Lint fails' },
  { value: 'tests', label: 'Tests fail' },
  { value: 'build', label: 'Build fails' },
  { value: 'staging', label: 'Staging smoke test fails' },
  { value: 'production', label: 'Production deploy fails' },
]

const FAILURE_LOGS = {
  lint: [
    'ESLint v9.25.0',
    'Scanning 14 files...',
    'src/fetchWeather.js — OK',
    'src/App.jsx:42:5 — error: no-unused-vars — \'apiKey\' is defined but never used',
    'src/App.jsx:87:12 — error: react-hooks/exhaustive-deps — missing dependency \'cityList\'',
    '2 errors found. LINT FAILED.',
  ],
  tests: [
    'Running test suite...',
    'PASS src/__tests__/fetchWeather.test.js',
    'FAIL src/__tests__/MockWeatherService.test.js',
    '  ✗ returns structured JSON for LLM prompt (timeout after 5000ms)',
    '  ✗ handles empty model response (expected Array, got null)',
    'Tests: 4 passed, 2 failed. TESTS FAILED.',
  ],
  build: [
    'vite build --mode production',
    'Bundling 23 modules...',
    'ERROR: Failed to resolve import "openai" from "src/llmSummary.js"',
    'Did you install the package? Run: npm install openai',
    'Build failed with 1 error. BUILD FAILED.',
  ],
  staging: [
    'Deploying to staging environment...',
    'Docker image pushed: weather-app:abc1234',
    'Staging deploy complete: https://staging.weather-app.internal',
    'Running smoke tests against staging...',
    'GET /api/weather?city=Chicago — 503 Service Unavailable',
    'GET /api/weather?city=London — 503 Service Unavailable',
    'api.weather.gov appears to be down. STAGING SMOKE TEST FAILED.',
  ],
  production: [
    'Manual approval received: rpatterson@fubo.tv',
    'Initiating canary deployment (5% traffic)...',
    'Monitoring error rate for 15 minutes...',
    'Error rate: 8.3% (threshold: 1.0%) — EXCEEDED',
    'Auto-rollback triggered. Reverting to previous version...',
    'Rollback complete. PRODUCTION DEPLOY FAILED.',
  ]
}

export default function CheckpointPipeline() {
  const [stageStatus, setStageStatus] = useState(() =>
    Object.fromEntries(STAGES.map(s => [s.id, 'idle']))
  )
  const [logs, setLogs] = useState([])
  const [running, setRunning] = useState(false)
  const [failAt, setFailAt] = useState('none')
  const [pipelineResult, setPipelineResult] = useState(null) // 'success' | 'failed' | null
  const timerRef = useRef(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStageStatus(Object.fromEntries(STAGES.map(s => [s.id, 'idle'])))
    setLogs([])
    setRunning(false)
    setPipelineResult(null)
  }, [])

  const runPipeline = useCallback(() => {
    reset()
    setRunning(true)

    let delay = 100
    const STEP = 600

    STAGES.forEach((stage, i) => {
      // Start stage
      timerRef.current = setTimeout(() => {
        setStageStatus(prev => ({ ...prev, [stage.id]: 'running' }))
      }, delay)
      delay += STEP

      const shouldFail = failAt === stage.id

      if (shouldFail) {
        // Show failure logs
        const failLogs = FAILURE_LOGS[stage.id] || []
        failLogs.forEach((line, li) => {
          timerRef.current = setTimeout(() => {
            setLogs(prev => [...prev, { level: li === failLogs.length - 1 ? 'error' : 'info', text: line }])
          }, delay + li * 150)
        })
        delay += failLogs.length * 150 + 200

        // Mark stage as failed, lock remaining
        timerRef.current = setTimeout(() => {
          setStageStatus(prev => {
            const next = { ...prev, [stage.id]: 'failed' }
            STAGES.slice(i + 1).forEach(s => { next[s.id] = 'locked' })
            return next
          })
          setRunning(false)
          setPipelineResult('failed')
        }, delay)
        return
      }

      // Normal stage logs
      stage.logs.forEach((line, li) => {
        timerRef.current = setTimeout(() => {
          setLogs(prev => [...prev, { level: 'info', text: line }])
        }, delay + li * 120)
      })
      delay += stage.logs.length * 120 + 200

      // Mark stage success
      timerRef.current = setTimeout(() => {
        setStageStatus(prev => ({ ...prev, [stage.id]: 'success' }))
        if (i === STAGES.length - 1) {
          setRunning(false)
          setPipelineResult('success')
        }
      }, delay)
      delay += 200
    })
  }, [failAt, reset])

  const getStageColor = (status) => {
    if (status === 'success') return C.green
    if (status === 'failed') return C.red
    if (status === 'running') return C.accent
    if (status === 'locked') return C.grey
    return C.border
  }

  const getStageTextColor = (status) => {
    if (status === 'idle' || status === 'locked') return C.muted
    return C.text
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: C.text }}>
        Pipeline Checkpoint Visualizer
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
        Watch how checkpoints gate progression. Inject a failure to see the pipeline stop and lock downstream stages.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={failAt}
          onChange={e => setFailAt(e.target.value)}
          disabled={running}
          style={{
            background: C.surface, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer'
          }}
        >
          {FAILURE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={runPipeline}
          disabled={running}
          style={{
            background: running ? C.grey : C.accent,
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer'
          }}
        >
          {running ? 'Running...' : 'Run Pipeline'}
        </button>

        <button
          onClick={reset}
          style={{
            background: C.surface, color: C.muted, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer'
          }}
        >
          Reset
        </button>

        {pipelineResult && (
          <span style={{
            padding: '6px 14px', borderRadius: 20,
            background: pipelineResult === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: pipelineResult === 'success' ? C.green : C.red,
            fontSize: 13, fontWeight: 600, border: `1px solid ${pipelineResult === 'success' ? C.green : C.red}`
          }}>
            {pipelineResult === 'success' ? 'Pipeline Succeeded' : 'Pipeline Failed'}
          </span>
        )}
      </div>

      {/* Pipeline visualization */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24,
        overflowX: 'auto', paddingBottom: 8
      }}>
        {STAGES.map((stage, i) => {
          const status = stageStatus[stage.id]
          const color = getStageColor(status)
          const textColor = getStageTextColor(status)
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                background: C.surface,
                border: `2px solid ${color}`,
                borderRadius: 10,
                padding: '14px 16px',
                minWidth: 110,
                textAlign: 'center',
                transition: 'border-color 0.3s, box-shadow 0.3s',
                boxShadow: status === 'running' ? `0 0 12px ${color}55` : 'none',
                position: 'relative'
              }}>
                {/* Status icon */}
                <div style={{ fontSize: 20, marginBottom: 6 }}>
                  {status === 'success' && '✓'}
                  {status === 'failed' && '✗'}
                  {status === 'running' && '⟳'}
                  {status === 'locked' && '🔒'}
                  {status === 'idle' && '○'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textColor, marginBottom: 4 }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{stage.runtime}</div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{
                  width: 32, height: 2,
                  background: stageStatus[STAGES[i + 1].id] === 'locked'
                    ? C.grey
                    : stageStatus[stage.id] === 'success'
                      ? C.green : C.border,
                  position: 'relative', flexShrink: 0, transition: 'background 0.3s'
                }}>
                  <div style={{
                    position: 'absolute', right: -6, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 0, height: 0,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderLeft: `6px solid ${
                      stageStatus[STAGES[i + 1].id] === 'locked'
                        ? C.grey
                        : stageStatus[stage.id] === 'success'
                          ? C.green : C.border
                    }`,
                    transition: 'border-left-color 0.3s'
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Log output panel */}
      <div style={{
        background: '#050A14', border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '16px', fontFamily: 'monospace', fontSize: 12,
        height: 200, overflowY: 'auto'
      }}>
        <div style={{ color: C.muted, marginBottom: 8, fontSize: 11, letterSpacing: '0.08em' }}>
          PIPELINE LOG OUTPUT
        </div>
        {logs.length === 0 ? (
          <div style={{ color: C.muted, fontStyle: 'italic' }}>
            Click &quot;Run Pipeline&quot; to start...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{
              color: log.level === 'error' ? C.red : log.level === 'warn' ? C.yellow : '#A8C4E0',
              marginBottom: 2, lineHeight: 1.5
            }}>
              <span style={{ color: C.muted, marginRight: 8, userSelect: 'none' }}>$</span>
              {log.text}
            </div>
          ))
        )}
      </div>

      {/* Stage legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {[
          { color: C.green, label: 'Passed' },
          { color: C.red, label: 'Failed' },
          { color: C.accent, label: 'Running' },
          { color: C.grey, label: 'Locked (downstream)' },
          { color: C.border, label: 'Pending' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}
