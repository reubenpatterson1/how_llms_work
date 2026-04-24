import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceDot, ResponsiveContainer, CartesianGrid } from 'recharts'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { createRecallLookup } from '../lib/recall-lookup.js'
import { tokenAnalog } from '../lib/token-analogs.js'
import { humanSerialPosition } from '../lib/human-memory.js'
import tableData from '../data/window-playground-table.json'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const lookup = createRecallLookup(tableData)
const WINDOW_SIZES = [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]
const NOISE_Z_DRIFT_MAX = 0.35

export default function LostInTheMiddleCurve() {
  const [windowIdx, setWindowIdx] = useState(5)   // 100k
  const [noise, setNoise] = useState(0.2)
  const [needlePos, setNeedlePos] = useState(0.5)
  const [showHuman, setShowHuman] = useState(false)

  const windowSize = WINDOW_SIZES[windowIdx]

  const curve = useMemo(() => {
    const COLS = 41
    return Array.from({ length: COLS }, (_, i) => {
      const p = i / (COLS - 1)
      return {
        position: p,
        recall: lookup({ model: 'claude-sonnet', window_size: windowSize, position: p, noise_level: noise }),
        human: humanSerialPosition(p, windowSize, noise),
      }
    })
  }, [windowSize, noise])

  const surfaceSamples = useMemo(() => {
    const COLS = 41
    return WINDOW_SIZES.map((w) =>
      Array.from({ length: COLS }, (_, i) => {
        const p = i / (COLS - 1)
        return lookup({ model: 'claude-sonnet', window_size: w, position: p, noise_level: noise })
      })
    )
  }, [noise])

  const needleRecall = useMemo(() =>
    lookup({ model: 'claude-sonnet', window_size: windowSize, position: needlePos, noise_level: noise }),
    [windowSize, noise, needlePos])

  // zAnchor = where the needle *should* be (based on window-size selection).
  // Larger window → needle sits on the back row of the surface (camera-far) where the well is deepest.
  // zDrift  = noise pushes the needle forward toward the "position" axis label (camera-near = z near 0).
  // z       = actual render position, clamped to [0,1].
  const zAnchor = 1 - windowIdx / (WINDOW_SIZES.length - 1)
  const zDrifted = Math.max(0, Math.min(1, zAnchor - noise * NOISE_Z_DRIFT_MAX))

  const needleCoords = useMemo(() => ({
    x: needlePos,
    z: zDrifted,
    y: needleRecall,
  }), [needlePos, zDrifted, needleRecall])

  return (
    <div style={{ padding: '16px 20px', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 20, margin: '0 0 12px 0' }}>Lost-in-the-Middle Recall Curve</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.surfaceDeep, borderRadius: 8, padding: 12, height: 340 }}>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>
            Recall by position (Claude Sonnet, window = {windowSize.toLocaleString()} tok)
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={curve} margin={{ top: 5, right: 20, left: 5, bottom: 20 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="position" type="number" domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke={C.textDim} fontSize={11} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke={C.textDim} fontSize={11} />
              <Tooltip
                formatter={(v) => `${(v * 100).toFixed(1)}%`}
                labelFormatter={(v) => `Position ${(v * 100).toFixed(0)}%`}
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="recall" stroke={C.accent} strokeWidth={2} dot={false} />
              {showHuman && <Line type="monotone" dataKey="human" stroke={C.purple} strokeDasharray="4 4" dot={false} />}
              <ReferenceDot x={needlePos} y={needleRecall} r={5} fill={C.green} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: C.surfaceDeep, borderRadius: 8, height: 340, overflow: 'hidden',
          display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px 0 12px' }}>
            <div style={{ color: C.textDim, fontSize: 12 }}>
              Recall surface across window sizes × position
            </div>
            <div data-testid="needle-3d-readout"
              style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
              At window = {windowSize.toLocaleString()} tok ({tokenAnalog(windowSize)}), position = {(needlePos * 100).toFixed(0)}%:
              <span style={{ color: C.accent, fontFamily: FONT_MONO, marginLeft: 6 }}>
                {(needleRecall * 100).toFixed(1)}% recall
              </span>
            </div>
            {noise > 0.02 && (
              <div style={{ color: C.textFaint, fontSize: 11, marginTop: 2 }}>
                Noise has displaced the needle forward by{' '}
                <span style={{ color: C.yellow }}>
                  {Math.round(noise * NOISE_Z_DRIFT_MAX * 100)}%
                </span>{' '}
                of the Z range — watch the grey ring behind it marks the true spot.
              </div>
            )}
            <div style={{ color: C.textFaint, fontSize: 11, marginTop: 2 }}>
              Green disk = 100% recall ceiling. Gold rod = how far noise pushed recall below the peak.
              Grey ring on the floor = the needle&apos;s true spot; noise blows it forward.
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <RecallLandscape3D samples={surfaceSamples} needlePosition={needleCoords}
              anchorZ={zAnchor}
              depth={3} height={1.0} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Slider label={`Window: ${windowSize.toLocaleString()} tok ≈ ${tokenAnalog(windowSize)}`}
          min="0" max={WINDOW_SIZES.length - 1} value={windowIdx}
          onChange={(e) => setWindowIdx(+e.target.value)} testId="window-slider" />
        <Slider label={`Noise: ${(noise * 100).toFixed(0)}% ≈ ${tokenAnalog(Math.round(noise * windowSize))} of distractors`}
          min="0" max="1" step="0.01" value={noise}
          onChange={(e) => setNoise(+e.target.value)} testId="noise-slider" />
        <Slider label={`Needle: ${(needlePos * 100).toFixed(0)}%`}
          min="0" max="1" step="0.01" value={needlePos}
          onChange={(e) => setNeedlePos(+e.target.value)} testId="needle-slider" />
        <label style={{ color: C.textDim, fontSize: 12, display: 'flex',
          alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showHuman}
            onChange={(e) => setShowHuman(e.target.checked)} data-testid="human-toggle" />
          Overlay human memory curve (what YOU&apos;d recall)
        </label>
      </div>
      <div style={{ marginTop: 12, color: C.textDim, fontSize: 13 }}>
        Needle recall: <span data-testid="needle-recall"
          style={{ color: needleRecall > 0.7 ? C.green : needleRecall > 0.4 ? C.yellow : C.red,
            fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700 }}>
          {(needleRecall * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function Slider({ label, testId, ...props }) {
  return (
    <div>
      <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="range" {...props} data-testid={testId} style={{ width: '100%' }} />
    </div>
  )
}
