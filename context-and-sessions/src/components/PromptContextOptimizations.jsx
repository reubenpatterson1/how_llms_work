import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'

const PROMPT_TECHNIQUES = [
  { key: 'role',          glyph: '◉', label: 'Role Priming',         tagline: '"You are a senior backend engineer …"',                   weight: 6,
    example: 'You are a senior backend engineer with 10y on payment systems.' },
  { key: 'cot',           glyph: '↳', label: 'Chain-of-Thought',     tagline: 'Step-by-step reasoning made explicit',                   weight: 8,
    example: 'Think step by step. Show your reasoning before the final answer.' },
  { key: 'tot',           glyph: '⌅', label: 'Tree-of-Thought',      tagline: 'Explore branches, prune, converge on the best',           weight: 9,
    example: 'Generate 3 candidate approaches, evaluate each, pick the strongest.' },
  { key: 'cod',           glyph: '⊟', label: 'Chain-of-Density',     tagline: 'Iteratively densify the answer',                          weight: 7,
    example: 'Produce 5 increasingly dense rewrites; output only the densest.' },
  { key: 'format',        glyph: '⊡', label: 'Output Format',         tagline: 'Strict schema (JSON, table, fields)',                     weight: 7,
    example: 'Return JSON: { decision: string, reason: string, confidence: 0..1 }' },
  { key: 'style_length',  glyph: '◊', label: 'Style / Length',        tagline: 'Tone, vocabulary, max tokens',                            weight: 5,
    example: 'Plain prose, no marketing voice. Max 200 words.' },
  { key: 'few_shot',      glyph: '⊞', label: 'Few-Shot Examples',     tagline: 'Concrete input→output pairs',                             weight: 6,
    example: 'Example 1: input X → output Y. Example 2: input X′ → output Y′.' },
  { key: 'must_lists',    glyph: '◈', label: 'MUST / MUST NOT',       tagline: 'Hard rules as enumerated bullets',                        weight: 8,
    example: 'MUST: idempotent on (source, external_id).\nMUST NOT: use console.log.' },
]

const CONTEXT_TECHNIQUES = [
  { key: 'compact',       glyph: '✂', label: '/compact w/ instructions', tagline: 'Summarize on demand with explicit preserve/drop directives', weight: 9,
    example: '/compact preserve: api decisions, retention rule. drop: chat banter, retries.' },
  { key: 'memory_file',   glyph: '◐', label: 'MEMORY.md',                tagline: 'Sticky decisions across sessions',                          weight: 8,
    example: '[MEMORY.md]\n- Postgres 15. RS256 JWT.\n- HARD: 90-day retention.' },
  { key: 'file_refs',     glyph: '◰', label: 'Local file refs (@file)',  tagline: 'Pull only the files the agent needs',                       weight: 7,
    example: '@specs/data-model.md @src/types/api.ts @policies/auth.md' },
  { key: 'rag',           glyph: '⬢', label: 'RAG retrieval',            tagline: 'Fetch canonical specs/policies on demand',                  weight: 8,
    example: 'rag.search("retention policy"). Returns { tokens, source: policies/data.md §7 }' },
  { key: 'prune_tools',   glyph: '✄', label: 'Tool-output pruning',      tagline: 'Drop raw dumps, keep referenced excerpts',                  weight: 7,
    example: 'Replace 8k-tok file dump with the 200-tok excerpt actually used.' },
  { key: 'pin_invariants',glyph: '⌖', label: 'Pin Invariants',           tagline: 'Re-state constraints in the recency window',                 weight: 7,
    example: '[REMINDER] HARD: 90-day retention. RS256 JWT. Server-authoritative totals.' },
  { key: 'scope',         glyph: '⧉', label: 'Scope Declaration',        tagline: 'Boundary stated at session start',                          weight: 6,
    example: 'SCOPE: payment webhook only. Out of scope: cart, billing UI.' },
  { key: 'clear',         glyph: '↺', label: 'Clear Context',            tagline: 'Fresh session after a scoped task completes',                weight: 6,
    example: 'Save decisions to MEMORY.md → /new chat → load MEMORY.md.' },
]

const SYNERGIES = [
  { keys: ['must_lists', 'format'],            bonus: 4, label: 'MUST list × format spec → structural enforcement' },
  { keys: ['pin_invariants', 'scope'],          bonus: 3, label: 'Pin × scope → constraints stay in recency window' },
  { keys: ['rag', 'memory_file'],               bonus: 3, label: 'RAG × MEMORY → fresh canonicals + sticky decisions' },
  { keys: ['compact', 'prune_tools'],           bonus: 3, label: '/compact × pruning → noise floor stays low' },
  { keys: ['cot', 'format'],                    bonus: 2, label: 'CoT × format → reasoning is structured AND parseable' },
]

const BASE_ATTENDED = 18 // % of context attended with NO techniques active — mostly noise/diluted

function computeAttended(active) {
  let pct = BASE_ATTENDED
  for (const t of [...PROMPT_TECHNIQUES, ...CONTEXT_TECHNIQUES]) {
    if (active.has(t.key)) pct += t.weight
  }
  for (const s of SYNERGIES) {
    if (s.keys.every((k) => active.has(k))) pct += s.bonus
  }
  return Math.min(95, pct)
}

function activeSynergies(active) {
  return SYNERGIES.filter((s) => s.keys.every((k) => active.has(k)))
}

export default function PromptContextOptimizations() {
  const [active, setActive] = useState(new Set())

  const toggle = (key) => setActive((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const attended = useMemo(() => computeAttended(active), [active])
  const unattended = 100 - attended
  const diluted = Math.round(unattended * 0.4)
  const lost = Math.round(unattended * 0.6)
  const synergies = useMemo(() => activeSynergies(active), [active])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 28px 40px', fontFamily: FONT_SANS, color: C.text }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0' }}>Optimization Techniques</h2>
      <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.55, marginBottom: 14, maxWidth: 920 }}>
        Toggle techniques on either side. The bar at the bottom shows how much of your context the
        model actually attends to (green), what gets diluted by noise (yellow), and what falls below
        the recall threshold (red). Watch for synergies between the two columns.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <Pane title="Prompt Optimizations" subtitle="Shape what the current turn says" accent={C.yellow}
          techniques={PROMPT_TECHNIQUES} active={active} onToggle={toggle} testPrefix="prompt" />
        <Pane title="Context Optimizations" subtitle="Shape what the model can see" accent={C.accent}
          techniques={CONTEXT_TECHNIQUES} active={active} onToggle={toggle} testPrefix="context" />
      </div>

      {/* Attention bar */}
      <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontFamily: FONT_MONO, color: C.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Context attention map
          </span>
          <span data-testid="attended-readout" style={{ fontSize: 18, fontFamily: FONT_MONO, fontWeight: 700, color: C.green }}>
            {attended}% attended
          </span>
        </div>
        <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <div style={{ width: `${attended}%`, background: C.green, transition: 'width 0.25s' }} title={`Attended: ${attended}%`} />
          <div style={{ width: `${diluted}%`, background: C.yellow, transition: 'width 0.25s' }} title={`Diluted: ${diluted}%`} />
          <div style={{ width: `${lost}%`,    background: C.red,    transition: 'width 0.25s' }} title={`Lost: ${lost}%`} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, fontFamily: FONT_MONO, color: C.textDim }}>
          <span><span style={{ color: C.green }}>■</span> Attended {attended}%</span>
          <span><span style={{ color: C.yellow }}>■</span> Diluted {diluted}%</span>
          <span><span style={{ color: C.red }}>■</span> Lost {lost}%</span>
        </div>
      </div>

      {/* Synergies */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', minHeight: 60 }}>
        <div style={{ fontSize: 12, fontFamily: FONT_MONO, color: C.textDim, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' }}>
          Active synergies
        </div>
        {synergies.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textFaint }}>
            None yet. Synergies appear when complementary techniques across the two sides are both on.
          </div>
        ) : (
          <ul data-testid="synergy-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {synergies.map((s) => (
              <li key={s.label} style={{ fontSize: 13, color: C.green }}>
                <span style={{ marginRight: 6 }}>✓</span>{s.label}{' '}
                <span style={{ color: C.textFaint, fontSize: 11 }}>(+{s.bonus}% attended)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Pane({ title, subtitle, accent, techniques, active, onToggle, testPrefix }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>
          <span style={{ color: accent, marginRight: 6 }}>●</span>{title}
        </h3>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {techniques.map((t) => {
          const on = active.has(t.key)
          return (
            <button key={t.key}
              data-testid={`${testPrefix}-tech-${t.key}`}
              onClick={() => onToggle(t.key)}
              title={t.example}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                alignItems: 'center', gap: 10,
                textAlign: 'left',
                padding: '8px 10px',
                background: on ? `${accent}18` : 'transparent',
                border: `1px solid ${on ? accent : C.border}`,
                color: on ? C.text : C.textDim,
                borderRadius: 6, cursor: 'pointer',
              }}>
              <span style={{ fontSize: 18, color: accent, lineHeight: 1, textAlign: 'center' }}>{t.glyph}</span>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: on ? C.text : C.textDim }}>{t.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: C.textFaint, marginTop: 1 }}>{t.tagline}</span>
              </span>
              <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: on ? accent : C.textFaint, padding: '2px 6px', border: `1px solid ${on ? accent : C.border}`, borderRadius: 10 }}>
                +{t.weight}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
