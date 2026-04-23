import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { PROMPT_LEVERS, CONTEXT_LEVERS, scoreLeverSet, BASE_SCORE } from '../lib/lever-scoring.js'

const TASK_DESCRIPTION = "Design an idempotent webhook handler that deduplicates retries within 24h, validates HMAC signatures with key rotation, and stores events in PostgreSQL with a unique (source, external_id) constraint."

const SAMPLE_OUTPUTS = {
  low:    "Here's a webhook handler. It uses Express and MongoDB. It logs events and handles retries.",
  medium: "Webhook handler with Express + Mongo. Validates basic HMAC. Handles retries by checking a seen-ids cache.",
  high:   "POST /webhooks/:source — verifies HMAC(SHA-256) against current+previous key, inserts into events(id, source, external_id UNIQUE) via pg transaction; duplicate retries fail the unique constraint and return 200. See <constraints> for the 24h retention.",
}

function sampleOutputFor(score) {
  if (score >= 80) return SAMPLE_OUTPUTS.high
  if (score >= 55) return SAMPLE_OUTPUTS.medium
  return SAMPLE_OUTPUTS.low
}

function Pane({ title, levers, active, toggle, score, testPrefix }) {
  const scoreColor = score >= 80 ? C.green : score >= 55 ? C.yellow : C.red
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ color: C.text, fontSize: 16, margin: 0 }}>{title}</h3>
        <span data-testid={`${testPrefix}-score`}
          style={{ color: scoreColor, fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700 }}>
          {score}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {levers.map((l) => {
          const on = active.has(l.key)
          return (
            <button key={l.key} onClick={() => toggle(l.key)}
              data-testid={`${testPrefix}-${l.key}`}
              style={{ padding: '6px 10px', fontSize: 12,
                background: on ? C.accentGlow : 'transparent',
                border: `1px solid ${on ? C.accent : C.border}`,
                color: on ? C.accent : C.textDim, borderRadius: 4, cursor: 'pointer' }}>
              {l.label}
            </button>
          )
        })}
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: scoreColor,
          transition: 'width 0.2s' }} />
      </div>
      <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`,
        borderRadius: 4, padding: 10, fontFamily: FONT_MONO, fontSize: 12,
        color: C.textDim, lineHeight: 1.5, minHeight: 80 }}>
        {sampleOutputFor(score)}
      </div>
    </div>
  )
}

export default function LeverComparisonTool() {
  const [promptActive, setPromptActive] = useState(new Set())
  const [contextActive, setContextActive] = useState(new Set())

  const promptScore = useMemo(() => scoreLeverSet(promptActive), [promptActive])
  const contextScore = useMemo(() => scoreLeverSet(contextActive), [contextActive])

  const toggle = (setter) => (key) => setter((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: C.text, fontSize: 20, margin: '0 0 4px 0' }}>Lever Comparison Tool</h2>
      <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 12px 0' }}>
        Same task. Two levers. Same attention mechanism.
      </p>
      <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
        <strong style={{ color: C.accent }}>Task:</strong> {TASK_DESCRIPTION}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Pane title="Prompt Engineering" levers={PROMPT_LEVERS}
          active={promptActive} toggle={toggle(setPromptActive)} score={promptScore}
          testPrefix="prompt" />
        <Pane title="Context Engineering" levers={CONTEXT_LEVERS}
          active={contextActive} toggle={toggle(setContextActive)} score={contextScore}
          testPrefix="context" />
      </div>
      <div style={{ marginTop: 16, padding: 12, background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, color: C.textDim }}>
        <strong style={{ color: C.text }}>Tip:</strong> Try maxing out one side. Neither alone reaches 100 —
        the ceiling is lower than the sum of both levers working together.
      </div>
    </div>
  )
}
