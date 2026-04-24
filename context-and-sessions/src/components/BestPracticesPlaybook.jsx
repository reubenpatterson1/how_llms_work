import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import data from '../data/best-practices.json'

const CATEGORY_COLORS = {
  Tools: C.cyan,
  RAG: C.green,
  Memory: C.purple,
  Context: C.accent,
  Prompt: C.yellow,
  Governance: C.orange,
}

export default function BestPracticesPlaybook() {
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null) // practice id or null

  const visible = useMemo(() => {
    if (filter === 'All') return data.practices
    return data.practices.filter((p) => p.category === filter)
  }, [filter])

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '20px 28px 40px',
        fontFamily: FONT_SANS,
        color: C.text,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0' }}>The Playbook</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 16, lineHeight: 1.55 }}>
        Ten practices that keep constraints sharp, confabulation quiet, and quality high. Click a
        card to see a concrete before/after.
      </p>

      {/* Filter strip */}
      <div
        data-testid="filter-strip"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}
      >
        {['All', ...data.categories].map((cat) => {
          const active = cat === filter
          const color = cat === 'All' ? C.textDim : CATEGORY_COLORS[cat] || C.textDim
          return (
            <button
              key={cat}
              data-testid={`filter-btn-${cat}`}
              onClick={() => setFilter(cat)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontFamily: FONT_MONO,
                background: active ? `${color}22` : 'transparent',
                border: `1px solid ${active ? color : C.border}`,
                color: active ? color : C.textDim,
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {visible.map((p) => {
          const accent = CATEGORY_COLORS[p.category] || C.accent
          const isExpanded = expanded === p.id
          return (
            <div
              key={p.id}
              data-testid={`card-${p.id}`}
              onClick={() => setExpanded(isExpanded ? null : p.id)}
              style={{
                background: C.surface,
                border: `1px solid ${isExpanded ? accent : C.border}`,
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                gridColumn: isExpanded ? '1 / -1' : 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22, color: accent, lineHeight: 1 }}>{p.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: FONT_MONO,
                    padding: '2px 8px',
                    color: accent,
                    border: `1px solid ${accent}55`,
                    borderRadius: 10,
                  }}
                >
                  {p.category}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{p.tagline}</div>
              {isExpanded && (
                <div
                  style={{
                    marginTop: 16,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: FONT_MONO,
                        color: C.red,
                        marginBottom: 4,
                      }}
                    >
                      BEFORE
                    </div>
                    <pre
                      style={{
                        background: C.surfaceDeep,
                        border: `1px solid ${C.red}33`,
                        borderRadius: 6,
                        padding: 10,
                        fontSize: 11,
                        fontFamily: FONT_MONO,
                        color: C.textDim,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {p.beforeExample}
                    </pre>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: FONT_MONO,
                        color: C.green,
                        marginBottom: 4,
                      }}
                    >
                      AFTER
                    </div>
                    <pre
                      style={{
                        background: C.surfaceDeep,
                        border: `1px solid ${C.green}33`,
                        borderRadius: 6,
                        padding: 10,
                        fontSize: 11,
                        fontFamily: FONT_MONO,
                        color: C.text,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {p.afterExample}
                    </pre>
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <ImpactCell label="Reinforces" body={p.reinforces} color={C.accent} />
                    <ImpactCell
                      label="Restricts confabulation"
                      body={p.restricts}
                      color={C.red}
                    />
                    <ImpactCell label="Quality" body={p.quality} color={C.green} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ImpactCell({ label, body, color }) {
  return (
    <div
      style={{
        background: `${color}11`,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: FONT_MONO,
          color,
          marginBottom: 3,
          letterSpacing: 0.4,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}
