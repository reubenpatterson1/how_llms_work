import { useState, useCallback } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const STAGES = [
  { id: 'lint', label: 'Linting', time: 0.5, criticalWeight: 2, desc: 'ESLint + type check' },
  { id: 'unit', label: 'Unit Tests', time: 2, criticalWeight: 5, desc: 'jest / vitest' },
  { id: 'integration', label: 'Integration Tests', time: 5, criticalWeight: 4, desc: 'API + DB integration' },
  { id: 'e2e', label: 'E2E Tests', time: 15, criticalWeight: 3, desc: 'Playwright / Cypress' },
  { id: 'llm_eval', label: 'LLM Eval Suite', time: 20, criticalWeight: 4, desc: 'Prompt quality scoring' },
  { id: 'bundle', label: 'Bundle Size Check', time: 1, criticalWeight: 2, desc: 'Vite build size gate' },
  { id: 'security', label: 'Security Scan', time: 3, criticalWeight: 5, desc: 'SAST + dep audit' },
  { id: 'manual', label: 'Manual Approval', time: 0, criticalWeight: 3, desc: 'Human sign-off' },
]

const COLUMNS = ['blocking', 'async', 'skip']
const COLUMN_LABELS = {
  blocking: 'Blocking',
  async: 'Async (Non-blocking)',
  skip: 'Skip'
}
const COLUMN_COLORS = {
  blocking: C.red,
  async: C.yellow,
  skip: C.muted
}

const PRESETS = {
  speed: {
    label: 'Maximum Speed',
    color: C.red,
    assignments: {
      lint: 'async', unit: 'async', integration: 'skip', e2e: 'skip',
      llm_eval: 'skip', bundle: 'skip', security: 'async', manual: 'skip'
    }
  },
  safety: {
    label: 'Maximum Safety',
    color: C.green,
    assignments: {
      lint: 'blocking', unit: 'blocking', integration: 'blocking', e2e: 'blocking',
      llm_eval: 'blocking', bundle: 'blocking', security: 'blocking', manual: 'blocking'
    }
  },
  balanced: {
    label: 'Balanced (Recommended)',
    color: C.accent,
    assignments: {
      lint: 'blocking', unit: 'blocking', integration: 'async', e2e: 'async',
      llm_eval: 'async', bundle: 'blocking', security: 'blocking', manual: 'blocking'
    }
  }
}

function calcMetrics(assignments) {
  let blockingTime = 0
  let safetyScore = 0
  let maxSafety = 0
  let skippedCritical = 0

  STAGES.forEach(s => {
    const col = assignments[s.id]
    maxSafety += s.criticalWeight * 2
    if (col === 'blocking') {
      blockingTime += s.time
      safetyScore += s.criticalWeight * 2
    } else if (col === 'async') {
      safetyScore += s.criticalWeight
    } else if (col === 'skip') {
      if (s.criticalWeight >= 4) skippedCritical++
    }
  })

  const safetyPct = Math.round((safetyScore / maxSafety) * 100)
  let risk = 'Low'
  if (skippedCritical >= 3) risk = 'Critical'
  else if (skippedCritical >= 2) risk = 'High'
  else if (skippedCritical >= 1) risk = 'Medium'

  const timeLabel = blockingTime < 1
    ? `${Math.round(blockingTime * 60)}s`
    : blockingTime < 60
      ? `${blockingTime}m`
      : `${Math.floor(blockingTime / 60)}h ${blockingTime % 60}m`

  return { blockingTime, timeLabel, safetyPct, risk, skippedCritical }
}

const RISK_COLORS = {
  Low: C.green, Medium: C.yellow, High: C.red, Critical: '#FF4444'
}

export default function SpeedSafetyLitmus() {
  const [assignments, setAssignments] = useState(PRESETS.balanced.assignments)

  const cycleColumn = useCallback((stageId) => {
    setAssignments(prev => {
      const cur = prev[stageId]
      const next = cur === 'blocking' ? 'async' : cur === 'async' ? 'skip' : 'blocking'
      return { ...prev, [stageId]: next }
    })
  }, [])

  const applyPreset = (preset) => {
    setAssignments(PRESETS[preset].assignments)
  }

  const metrics = calcMetrics(assignments)

  const stagesByColumn = (col) => STAGES.filter(s => assignments[s.id] === col)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
        Speed vs Safety Decision Matrix
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
        Click any stage card to cycle it between Blocking → Async → Skip. Watch how your choices affect pipeline time, safety score, and risk level.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            style={{
              background: `${preset.color}22`,
              color: preset.color,
              border: `1px solid ${preset.color}`,
              borderRadius: 6, padding: '7px 16px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Three column matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {COLUMNS.map(col => (
          <div key={col} style={{
            background: C.surface,
            border: `1px solid ${COLUMN_COLORS[col]}44`,
            borderRadius: 10, padding: '14px 14px',
            borderTop: `3px solid ${COLUMN_COLORS[col]}`
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: COLUMN_COLORS[col],
              marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>
              {COLUMN_LABELS[col]}
            </div>

            {stagesByColumn(col).length === 0 && (
              <div style={{
                border: `2px dashed ${C.border}`, borderRadius: 8,
                padding: '20px 12px', textAlign: 'center',
                color: C.muted, fontSize: 12
              }}>
                No stages here
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stagesByColumn(col).map(stage => (
                <div
                  key={stage.id}
                  onClick={() => cycleColumn(stage.id)}
                  style={{
                    background: C.bg,
                    border: `1px solid ${COLUMN_COLORS[col]}55`,
                    borderRadius: 8, padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, transform 0.1s',
                    userSelect: 'none'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = COLUMN_COLORS[col]}
                  onMouseOut={e => e.currentTarget.style.borderColor = `${COLUMN_COLORS[col]}55`}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 2 }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{stage.desc}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {stage.time > 0 && (
                      <span style={{
                        fontSize: 10, color: C.muted,
                        background: C.surface, borderRadius: 4, padding: '1px 6px',
                        border: `1px solid ${C.border}`
                      }}>
                        ~{stage.time < 1 ? `${stage.time * 60}s` : `${stage.time}m`}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, color: C.muted,
                      background: C.surface, borderRadius: 4, padding: '1px 6px',
                      border: `1px solid ${C.border}`
                    }}>
                      weight: {stage.criticalWeight}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Computed metrics */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '16px 20px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Pipeline Time (blocking only)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
            {metrics.timeLabel}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Safety Score
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: metrics.safetyPct >= 70 ? C.green : metrics.safetyPct >= 40 ? C.yellow : C.red }}>
            {metrics.safetyPct}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Risk Level
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: RISK_COLORS[metrics.risk] }}>
            {metrics.risk}
          </div>
          {metrics.skippedCritical > 0 && (
            <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>
              {metrics.skippedCritical} high-weight stage{metrics.skippedCritical > 1 ? 's' : ''} skipped
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
        Click any stage card to cycle: Blocking → Async → Skip → Blocking
      </div>
    </div>
  )
}
