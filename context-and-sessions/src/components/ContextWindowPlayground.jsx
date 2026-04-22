import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { createRecallLookup } from '../lib/recall-lookup.js'
import tableData from '../data/window-playground-table.json'
import RecallLandscape3D from './RecallLandscape3D.jsx'

const lookup = createRecallLookup(tableData)

const MODELS = [
  { key: 'gpt-4-turbo',   label: 'GPT-4 Turbo (128k)' },
  { key: 'claude-sonnet', label: 'Claude Sonnet (200k)' },
  { key: 'gemini-1.5',    label: 'Gemini 1.5 Pro (1M effective ~200k)' },
  { key: 'generic-short', label: 'Generic short-context' },
]
const WINDOW_SIZES = [4000, 8000, 16000, 32000, 64000, 100000, 150000, 200000]

export default function ContextWindowPlayground() {
  const [modelKey, setModelKey] = useState('claude-sonnet')
  const [windowIdx, setWindowIdx] = useState(4)   // 64k
  const [noise, setNoise] = useState(0.25)
  const [needlePos, setNeedlePos] = useState(0.5)

  const windowSize = WINDOW_SIZES[windowIdx]

  const samples = useMemo(() => {
    const COLS = 41
    const row = Array.from({ length: COLS }, (_, i) => {
      const p = i / (COLS - 1)
      return lookup({ model: modelKey, window_size: windowSize, position: p, noise_level: noise })
    })
    // Two identical rows so the plane has some depth; depth axis represents the noise level implicitly.
    return [row, row]
  }, [modelKey, windowSize, noise])

  const needleRecall = useMemo(() =>
    lookup({ model: modelKey, window_size: windowSize, position: needlePos, noise_level: noise }),
    [modelKey, windowSize, noise, needlePos])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16,
      padding: '16px 20px', fontFamily: FONT_SANS, height: 'calc(100vh - 120px)' }}>
      <div style={{ background: C.surfaceDeep, borderRadius: 8, overflow: 'hidden' }}>
        <RecallLandscape3D samples={samples} needlePosition={needlePos} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ color: C.text, fontSize: 20, margin: 0 }}>Context Window Playground</h2>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>Model</label>
          <select value={modelKey} onChange={(e) => setModelKey(e.target.value)}
            data-testid="model-select"
            style={{ width: '100%', padding: 6, background: C.surface,
              color: C.text, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            {MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Window size: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {windowSize.toLocaleString()} tok
            </span>
          </label>
          <input type="range" min="0" max={WINDOW_SIZES.length - 1} value={windowIdx}
            onChange={(e) => setWindowIdx(+e.target.value)} data-testid="window-slider"
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Noise: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {(noise * 100).toFixed(0)}%
            </span>
          </label>
          <input type="range" min="0" max="1" step="0.01" value={noise}
            onChange={(e) => setNoise(+e.target.value)} data-testid="noise-slider"
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Needle position: <span style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {(needlePos * 100).toFixed(0)}%
            </span>
          </label>
          <input type="range" min="0" max="1" step="0.01" value={needlePos}
            onChange={(e) => setNeedlePos(+e.target.value)} data-testid="needle-slider"
            style={{ width: '100%' }} />
        </div>
        <div style={{ padding: 12, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6 }}>
          <div style={{ color: C.textDim, fontSize: 12 }}>Recall at needle:</div>
          <div data-testid="needle-recall"
            style={{ color: needleRecall > 0.7 ? C.green : needleRecall > 0.4 ? C.yellow : C.red,
              fontSize: 28, fontFamily: FONT_MONO, fontWeight: 700 }}>
            {(needleRecall * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
