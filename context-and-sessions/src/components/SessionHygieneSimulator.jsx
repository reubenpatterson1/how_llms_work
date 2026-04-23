import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import session from '../data/simulator-session.json'
import { INTERVENTIONS, applyInterventions, recallOfCritical, DEFAULT_SESSION_STATE } from '../lib/simulator-rules.js'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const EXTERNAL_MEMORY_SUB_TOGGLES = [
  { key: 'em_pii',    label: 'PII/confidential guardrail' },
  { key: 'em_api',    label: 'Org API spec index' },
  { key: 'em_policy', label: 'Policy/compliance index' },
]

// Presets: a preset pre-selects some interventions and hides others.
// Used by the assessment's diagnostic scenarios.
// eslint-disable-next-line react-refresh/only-export-components
export const SIMULATOR_PRESETS = {
  D1: { locked: new Set(), suggestedFix: ['pin_invariants', 'front_tail_load'] },
  D2: { locked: new Set(), suggestedFix: ['prune_tool_outputs', 'scope_session'] },
  D3: { locked: new Set(), suggestedFix: ['external_memory'] },
  D4: { locked: new Set(), suggestedFix: ['scope_session', 'nuclear_restart'] },
}

// eslint-disable-next-line no-unused-vars -- preset is a public API consumed by the assessment (Task 24); MVP ignores it.
export default function SessionHygieneSimulator({ preset = null }) {
  const [active, setActive] = useState(new Set())
  const [emExpanded, setEmExpanded] = useState(false)
  const [emSub, setEmSub] = useState(new Set())

  const toggle = (key) => setActive((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const toggleEmSub = (key) => setEmSub((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const state = useMemo(() =>
    applyInterventions(session, active, DEFAULT_SESSION_STATE), [active])
  const recall = useMemo(() => recallOfCritical(state), [state])

  const surfaceSamples = useMemo(() => {
    // A 2D landscape: rows = turns in session, cols = hypothetical needle positions.
    const ROWS = 8
    const COLS = 33
    return Array.from({ length: ROWS }, (_, r) => {
      const windowFrac = 0.3 + (r / (ROWS - 1)) * 0.7
      return Array.from({ length: COLS }, (_, c) => {
        const pos = c / (COLS - 1)
        // At high intervention count, flatten less severely
        const base = Math.exp(-Math.pow((pos - 0.5) / 0.3, 2)) * (1 - recall)
        return Math.max(0, Math.min(1, 1 - base * windowFrac))
      })
    })
  }, [recall])

  const recallColor = recall >= 0.9 ? C.green : recall >= 0.6 ? C.yellow : C.red

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS, height: 'calc(100vh - 120px)',
      display: 'grid', gridTemplateRows: '30% 50% 20%', gap: 12 }}>
      {/* Transcript */}
      <div style={{ overflow: 'auto', background: C.surfaceDeep,
        border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
        {state.turns.map((t) => (
          <div key={t.idx} style={{ marginBottom: 6, fontSize: 12,
            color: t.critical ? C.accent : t.isRawTool ? C.orange : C.textDim,
            fontFamily: t.role === 'tool' ? FONT_MONO : FONT_SANS }}>
            <strong>[{t.idx}] {t.role}</strong> ({t.tokens} tok):{' '}
            {t.text.length > 160 ? t.text.slice(0, 160) + '…' : t.text}
          </div>
        ))}
      </div>

      {/* 3D landscape */}
      <div style={{ background: C.surfaceDeep, borderRadius: 6, overflow: 'hidden' }}>
        <RecallLandscape3D samples={surfaceSamples} width={5} depth={3} height={1.2} />
      </div>

      {/* Intervention panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignContent: 'start' }}>
          {INTERVENTIONS.filter((i) => i.key !== 'external_memory' && i.key !== 'nuclear_restart').map((i) => (
            <ToggleButton key={i.key} label={i.label} on={active.has(i.key)}
              testId={`iv-${i.key}`} onClick={() => toggle(i.key)} />
          ))}
          <div>
            <ToggleButton label="External memory"
              on={active.has('external_memory')} testId="iv-external_memory"
              onClick={() => { toggle('external_memory'); setEmExpanded(true) }} />
            {emExpanded && active.has('external_memory') && (
              <div style={{ marginTop: 4, padding: 4, background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 4 }}>
                {EXTERNAL_MEMORY_SUB_TOGGLES.map((s) => (
                  <label key={s.key} style={{ display: 'flex', gap: 6, fontSize: 11,
                    color: C.textDim, padding: 2, cursor: 'pointer' }}>
                    <input type="checkbox" checked={emSub.has(s.key)}
                      onChange={() => toggleEmSub(s.key)} data-testid={`em-${s.key}`} />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <ToggleButton label="🔴 Nuclear restart"
            on={active.has('nuclear_restart')} testId="iv-nuclear_restart"
            danger onClick={() => toggle('nuclear_restart')} />
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ color: C.textDim, fontSize: 12 }}>Recall on critical (turn 2):</div>
          <div data-testid="recall-readout" style={{ color: recallColor,
            fontSize: 36, fontFamily: FONT_MONO, fontWeight: 700 }}>
            {(recall * 100).toFixed(0)}%
          </div>
          <div style={{ color: C.textFaint, fontSize: 11 }}>
            Total: {state.totalTokens.toLocaleString()} tok
          </div>
          <div style={{ color: C.textFaint, fontSize: 11 }}>
            Target: ≥ 90%
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleButton({ label, on, onClick, testId, danger = false }) {
  const bg = on ? (danger ? C.redGlow : C.accentGlow) : 'transparent'
  const bd = on ? (danger ? C.red : C.accent) : C.border
  const fg = on ? (danger ? C.red : C.accent) : C.textDim
  return (
    <button onClick={onClick} data-testid={testId}
      style={{ background: bg, border: `1px solid ${bd}`, color: fg,
        padding: '6px 10px', borderRadius: 4, fontSize: 11,
        textAlign: 'left', cursor: 'pointer', height: 40 }}>
      {label}
    </button>
  )
}
