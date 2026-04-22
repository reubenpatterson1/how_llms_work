import { useState, useEffect, useCallback } from 'react'
import { SLIDES } from './slides.jsx'

const C = {
  bg: '#0B1120',
  surface: '#131B2E',
  border: '#1E293B',
  text: '#E2E8F0',
  textDim: '#94A3B8',
  accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)',
}

// Components register themselves here as they come online (Tasks 11-26).
// Unknown component keys render a visible placeholder so future slides are obvious.
const COMPONENT_MAP = {}

function registerComponent(key, Component) {
  COMPONENT_MAP[key] = Component
}
export { registerComponent }

function TextSlide({ slide }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px' }}>
      <h1 style={{ fontSize: 42, fontWeight: 700, color: C.text, marginBottom: 12 }}>
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p style={{ fontSize: 20, color: C.accent, marginBottom: 24 }}>{slide.subtitle}</p>
      )}
      {slide.body && (
        <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textDim, marginBottom: 24 }}>
          {slide.body}
        </p>
      )}
      {slide.bullets && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
          {slide.bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'baseline' }}>
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 16, minWidth: 220 }}>
                {b.label}
              </span>
              <span style={{ color: C.textDim, fontSize: 16, lineHeight: 1.5 }}>{b.desc}</span>
            </li>
          ))}
        </ul>
      )}
      {slide.keyTakeaway && (
        <div style={{ background: C.accentGlow, border: `1px solid ${C.accent}33`,
          borderRadius: 8, padding: '16px 20px', marginTop: 16 }}>
          <p style={{ fontSize: 14, color: C.accent, margin: 0, lineHeight: 1.6 }}>
            <strong>Key Takeaway:</strong> {slide.keyTakeaway}
          </p>
        </div>
      )}
    </div>
  )
}

function ComponentSlide({ slide }) {
  const Comp = COMPONENT_MAP[slide.component]
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {slide.instructions && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 20, background: `${C.surface}ee`,
          borderBottom: `1px solid ${C.border}`, padding: '8px 20px',
          backdropFilter: 'blur(8px)',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>{slide.instructions}</p>
        </div>
      )}
      {Comp ? <Comp /> : (
        <div style={{ padding: 40, color: C.textDim }}>
          Component <code style={{ color: C.accent }}>{slide.component}</code> not yet registered.
        </div>
      )}
    </div>
  )
}

function AssessmentSlide({ slide }) {
  const Assessment = COMPONENT_MAP.ContextSessionsAssessment
  return Assessment
    ? <Assessment />
    : <div style={{ padding: 40, color: C.textDim }}>Assessment not yet registered.</div>
}

function markPartComplete() {
  try {
    const raw = localStorage.getItem('llm_course_progress')
    const progress = raw ? JSON.parse(raw) : {}
    progress.__v = 2
    progress.part3 = true
    localStorage.setItem('llm_course_progress', JSON.stringify(progress))
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export default function App() {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]

  const go = useCallback((dir) => {
    setIdx((i) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, i + dir))
      if (next === SLIDES.length - 1 && i !== next) markPartComplete()
      return next
    })
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text,
      display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 56 }}>
        {slide.type === 'text' ? <TextSlide slide={slide} />
         : slide.type === 'assessment' ? <AssessmentSlide slide={slide} />
         : <ComponentSlide slide={slide} />}
      </div>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        background: 'rgba(19,27,46,0.95)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => go(-1)} disabled={idx === 0}
          style={{ background: 'none', border: `1px solid ${C.border}`,
            color: idx === 0 ? C.textDim : C.text, padding: '6px 16px',
            borderRadius: 6, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13 }}>
          Previous
        </button>
        <div style={{ display: 'flex', gap: 6 }} data-testid="slide-dots">
          {SLIDES.map((s, i) => (
            <div key={s.id} onClick={() => setIdx(i)}
              data-testid={`dot-${s.id}`}
              style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                background: i === idx ? C.accent
                 : (s.type === 'component' || s.type === 'assessment') ? C.accent + '66' : C.border }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === SLIDES.length - 1}
          style={{ background: 'none', border: `1px solid ${C.border}`,
            color: idx === SLIDES.length - 1 ? C.textDim : C.text, padding: '6px 16px',
            borderRadius: 6, cursor: idx === SLIDES.length - 1 ? 'default' : 'pointer', fontSize: 13 }}>
          Next
        </button>
        <span style={{ fontSize: 12, color: C.textDim, marginLeft: 8 }}>
          {idx + 1} / {SLIDES.length}
        </span>
      </nav>
    </div>
  )
}
