import { useState, useMemo } from 'react'
import { C, CHUNK_COLORS, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { computeBudget } from '../lib/budget-math.js'

const CHUNK_TYPES = [
  { type: 'system',     label: 'System prompt',  defaultTokens: 300 },
  { type: 'rag',        label: 'RAG doc',        defaultTokens: 1500 },
  { type: 'tool',       label: 'Tool output',    defaultTokens: 4000 },
  { type: 'history',    label: 'Prior turn',     defaultTokens: 600 },
  { type: 'attachment', label: 'Attachment',     defaultTokens: 3000 },
  { type: 'user',       label: 'User msg',       defaultTokens: 150, criticalDefault: 40 },
]

let nextId = 1
const makeChunk = (t) => ({
  id: `c${nextId++}`,
  type: t.type,
  label: t.label,
  tokens: t.defaultTokens,
  criticalTokens: t.criticalDefault ?? 0,
})

function initialChunks() {
  return [
    makeChunk(CHUNK_TYPES[0]),                    // system
    makeChunk(CHUNK_TYPES[5]),                    // user
  ]
}

export default function AttentionBudgetAllocator() {
  const [chunks, setChunks] = useState(initialChunks)

  const { shares, attentionPerCritical } = useMemo(() => computeBudget(chunks), [chunks])
  const totalTokens = chunks.reduce((a, c) => a + c.tokens, 0)

  const addChunk = (typeDef) => setChunks((prev) => [...prev, makeChunk(typeDef)])
  const removeChunk = (id) => setChunks((prev) => prev.filter((c) => c.id !== id))
  const updateTokens = (id, tokens) =>
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, tokens } : c))
  const updateCritical = (id, critical) =>
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, criticalTokens: critical } : c))

  const criticalPct = (attentionPerCritical * 100).toFixed(2)
  const criticalColor = attentionPerCritical >= 0.05 ? C.green
    : attentionPerCritical >= 0.02 ? C.yellow : C.red

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>Attention Budget Allocator</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
        Every chunk competes for the same 100% of attention. Try to keep attention-per-critical-token above 5%.
      </p>

      {/* Stacked bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', width: '100%', height: 48, borderRadius: 6, overflow: 'hidden',
          border: `1px solid ${C.border}`, background: C.surfaceDeep }} data-testid="budget-bar">
          {chunks.map((c) => {
            const pct = (shares[c.id] ?? 0) * 100
            return (
              <div key={c.id} data-testid={`bar-seg-${c.id}`} title={`${c.label} — ${pct.toFixed(1)}%`}
                style={{ width: `${pct}%`, background: CHUNK_COLORS[c.type], borderRight: `1px solid ${C.bg}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0B1120', fontSize: 11, fontFamily: FONT_MONO, fontWeight: 600 }}>
                {pct >= 4 ? `${pct.toFixed(0)}%` : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Critical-attention readout */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <span style={{ color: C.textDim, fontSize: 13 }}>Attention per critical token:</span>
        <span data-testid="critical-pct" style={{ color: criticalColor, fontFamily: FONT_MONO,
          fontSize: 22, fontWeight: 700 }}>{criticalPct}%</span>
        <span style={{ color: C.textFaint, fontSize: 12, marginLeft: 'auto' }}>
          Total tokens: <code>{totalTokens.toLocaleString()}</code>
        </span>
      </div>

      {/* Chunk controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {chunks.map((c) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '12px 140px 1fr 100px 32px',
            alignItems: 'center', gap: 12, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: CHUNK_COLORS[c.type] }} />
            <div style={{ color: C.text, fontSize: 14 }}>{c.label}</div>
            <input type="range" min="50" max="20000" value={c.tokens}
              onChange={(e) => updateTokens(c.id, +e.target.value)}
              data-testid={`tokens-${c.id}`} style={{ width: '100%' }} />
            <div style={{ color: C.textDim, fontSize: 12, fontFamily: FONT_MONO }}>
              {c.tokens.toLocaleString()} tok
              {c.type === 'user' && (
                <div style={{ fontSize: 11, color: C.accent }}>
                  {c.criticalTokens} critical
                </div>
              )}
            </div>
            <button onClick={() => removeChunk(c.id)} data-testid={`remove-${c.id}`}
              style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textDim,
                borderRadius: 4, cursor: 'pointer', padding: '4px 8px' }} aria-label={`Remove ${c.label}`}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CHUNK_TYPES.map((t) => (
          <button key={t.type} onClick={() => addChunk(t)} data-testid={`add-${t.type}`}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text,
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
              fontFamily: FONT_SANS, fontSize: 13 }}>
            + {t.label}
          </button>
        ))}
      </div>

      {/* User-chunk critical-count slider (only shown when a user chunk exists) */}
      {chunks.some((c) => c.type === 'user') && (
        <div style={{ marginTop: 24, padding: '12px 16px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <label style={{ color: C.textDim, fontSize: 13, display: 'block', marginBottom: 8 }}>
            Critical tokens inside the user chunk:
          </label>
          {chunks.filter((c) => c.type === 'user').map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="range" min="0" max={c.tokens} value={c.criticalTokens}
                onChange={(e) => updateCritical(c.id, Math.min(+e.target.value, c.tokens))}
                data-testid={`critical-${c.id}`} style={{ flex: 1 }} />
              <span style={{ color: C.accent, fontSize: 12, fontFamily: FONT_MONO, minWidth: 60 }}>
                {c.criticalTokens} / {c.tokens}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
