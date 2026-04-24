import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'

// Resolve the live tool URL:
// - In production (same-origin under /architect/), use a relative path
// - In local dev (Vite 5175), fall back to the EC2 host where the tool is live
const PROD_HOST = 'ec2-52-91-187-71.compute-1.amazonaws.com:8080'
function resolveToolUrl() {
  if (typeof window === 'undefined') return '/architect/decompose'
  const { origin } = window.location
  // If we're already on the same host that serves the tool, use relative.
  if (origin.includes(PROD_HOST.split(':')[0]) || origin.endsWith(PROD_HOST)) {
    return '/architect/decompose'
  }
  return `http://${PROD_HOST}/architect/decompose`
}

const PRINCIPLES = [
  {
    glyph: '◈',
    title: 'Decompose First',
    body: 'Each component is a confabulation firewall. Single-function boundaries.',
    accent: C.accent,
  },
  {
    glyph: '⬡',
    title: 'Parallelize Smartly',
    body: 'Interfaces defined in Wave 0. Independent components built in parallel. 30–40% wall-clock savings.',
    accent: C.green,
  },
  {
    glyph: '⊗',
    title: 'Orchestrate for Quality',
    body: 'Multi-step generation = 80× better results vs single-shot.',
    accent: C.purple,
  },
]

export default function DecomposeWavePlan3D() {
  const toolUrl = resolveToolUrl()
  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 28px 40px',
      fontFamily: FONT_SANS, color: C.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          <span style={{ color: C.purple, marginRight: 8 }}>⬡</span>
          Decomposition Agent
        </h2>
        <a
          href={toolUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12, fontFamily: FONT_MONO, color: C.accent,
            textDecoration: 'none', border: `1px solid ${C.accent}55`,
            borderRadius: 6, padding: '6px 12px',
          }}
        >
          Open in new tab ↗
        </a>
      </div>
      <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.55, marginBottom: 18, maxWidth: 920 }}>
        Splits the dense spec into dependency-ordered waves for parallel LLM build.
        Interfaces first, then independent components in parallel.
      </p>

      {/* First Principles cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        {PRINCIPLES.map((p) => (
          <div key={p.title} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 22, color: p.accent, lineHeight: 1, marginBottom: 6 }}>
              {p.glyph}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
              {p.body}
            </div>
          </div>
        ))}
      </div>

      {/* Flow strip */}
      <div style={{
        textAlign: 'center', marginBottom: 16,
        padding: '10px 14px', background: C.surfaceDeep,
        border: `1px solid ${C.border}`, borderRadius: 8,
      }}>
        <div style={{ fontSize: 13, fontFamily: FONT_MONO, color: C.accent, marginBottom: 2 }}>
          Spec → Decompose → Build
        </div>
        <div style={{ fontSize: 11, color: C.textFaint }}>
          Dense spec eliminates prompt hallucination. This wave plan eliminates architecture hallucination.
        </div>
      </div>

      {/* Live tool iframe */}
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden',
        background: C.surfaceDeep, height: 640,
      }}>
        <iframe
          src={toolUrl}
          title="Decompose tool"
          data-testid="decompose-iframe"
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
        />
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: C.textFaint }}>
        Tip: run an intake session first, then <span style={{ color: C.accent }}>Run Decompose</span> to see the live wave plan.
      </div>
    </div>
  )
}
