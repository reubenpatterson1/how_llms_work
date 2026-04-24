import { C, FONT_SANS } from '../lib/theme.js'

export default function MonolithicVsDecomposed() {
  return (
    <div style={{ padding: '60px 40px', maxWidth: 800, margin: '0 auto',
      fontFamily: FONT_SANS, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 12 }}>
        Vibe vs Engineered
      </h2>
      <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
        Side-by-side comparison coming in the next build. It will contrast a 200k-token
        vibe session (constraints buried, hallucination vectors flagged) with N
        engineered agents at 16k each (100% constraint recall, zero confabulations).
      </p>
      <p style={{ color: C.textFaint, fontSize: 13 }}>
        The next slide (slide 20) already visualizes the raw stack contrast.
      </p>
    </div>
  )
}
