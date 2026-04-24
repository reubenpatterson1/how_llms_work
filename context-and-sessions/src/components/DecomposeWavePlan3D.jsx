import { C, FONT_SANS } from '../lib/theme.js'

export default function DecomposeWavePlan3D() {
  return (
    <div style={{ padding: '60px 40px', maxWidth: 800, margin: '0 auto',
      fontFamily: FONT_SANS, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
      <h2 style={{ color: C.text, fontSize: 24, marginBottom: 12 }}>
        Decompose Tool — Wave Plan
      </h2>
      <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
        Interactive DAG coming in the next build. It will take Module 1&rsquo;s dense prompt,
        run it through the decomposition tool, and show how the codebase splits into
        parallel agent waves with explicit dependencies.
      </p>
      <p style={{ color: C.textFaint, fontSize: 13 }}>
        For now, see the live decomposer at <code>/decompose/</code>.
      </p>
    </div>
  )
}
