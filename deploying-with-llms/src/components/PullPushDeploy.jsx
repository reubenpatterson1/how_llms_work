import { useState, useEffect, useRef } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const PUSH_STEPS = [
  { id: 'dev', label: 'Developer', x: 60, y: 80 },
  { id: 'git', label: 'Git Push', x: 200, y: 80 },
  { id: 'ci', label: 'CI Build', x: 340, y: 80 },
  { id: 'test', label: 'Tests Pass', x: 480, y: 80 },
  { id: 'deploy', label: 'Deploy', x: 340, y: 200 },
  { id: 'target', label: 'Target Env', x: 200, y: 200 },
]

const PUSH_ARROWS = [
  { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
  { from: 3, to: 4 }, { from: 4, to: 5 },
]

const PULL_STEPS = [
  { id: 'dev', label: 'Developer', x: 60, y: 80 },
  { id: 'git', label: 'Git Push', x: 200, y: 80 },
  { id: 'registry', label: 'Registry / Repo', x: 360, y: 80 },
  { id: 'operator', label: 'Operator Watches', x: 360, y: 200 },
  { id: 'reconcile', label: 'Reconcile', x: 220, y: 200 },
  { id: 'target', label: 'Target Env', x: 80, y: 200 },
]

const PULL_ARROWS = [
  { from: 0, to: 1 }, { from: 1, to: 2 },
  { from: 2, to: 3, label: 'polls' }, { from: 3, to: 4 }, { from: 4, to: 5 },
]

function FlowDiagram({ steps, arrows, color, activeStep, label }) {
  return (
    <svg width="560" height="300" style={{ display: 'block' }}>
      {/* Draw arrows */}
      {arrows.map((arrow, i) => {
        const from = steps[arrow.from]
        const to = steps[arrow.to]
        const isActive = activeStep > arrow.from
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2

        // Determine direction
        const dx = to.x - from.x
        const dy = to.y - from.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / len
        const ny = dy / len
        const startX = from.x + nx * 44
        const startY = from.y + ny * 18
        const endX = to.x - nx * 44
        const endY = to.y - ny * 18

        return (
          <g key={i}>
            <defs>
              <marker id={`arrow-${color.replace('#', '')}-${i}`} markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={isActive ? color : C.border} />
              </marker>
            </defs>
            <line
              x1={startX} y1={startY} x2={endX} y2={endY}
              stroke={isActive ? color : C.border}
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeDasharray={arrow.label ? '6,3' : 'none'}
              markerEnd={`url(#arrow-${color.replace('#', '')}-${i})`}
              style={{ transition: 'stroke 0.4s' }}
            />
            {arrow.label && (
              <text x={midX} y={midY - 6} fill={C.muted} fontSize="11" textAnchor="middle">{arrow.label}</text>
            )}
          </g>
        )
      })}

      {/* Draw nodes */}
      {steps.map((step, i) => {
        const isActive = activeStep > i
        const isCurrent = activeStep === i + 1
        return (
          <g key={step.id}>
            <rect
              x={step.x - 44} y={step.y - 18}
              width={88} height={36}
              rx={8}
              fill={isActive ? (isCurrent ? color : `${color}33`) : C.surface}
              stroke={isActive ? color : C.border}
              strokeWidth={isCurrent ? 2.5 : 1.5}
              style={{ transition: 'all 0.4s' }}
            />
            <text
              x={step.x} y={step.y + 5}
              fill={isActive ? C.text : C.muted}
              fontSize="11" fontWeight={isCurrent ? '700' : '400'}
              textAnchor="middle"
              style={{ transition: 'fill 0.4s' }}
            >
              {step.label}
            </text>
          </g>
        )
      })}

      {/* Active step label */}
      {label && (
        <text x={280} y={270} fill={color} fontSize="13" fontWeight="600" textAnchor="middle">
          {label}
        </text>
      )}
    </svg>
  )
}

const COMPARISON = [
  { metric: 'Speed', push: 'Fast ⚡', pull: 'Slower (reconcile lag)' },
  { metric: 'Security', push: 'CI needs prod access', pull: 'Credentials stay in-cluster' },
  { metric: 'Complexity', push: 'Low', pull: 'Higher (operator required)' },
]

export default function PullPushDeploy() {
  const [pushStep, setPushStep] = useState(0)
  const [pullStep, setPullStep] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef(null)

  const animate = () => {
    if (animating) return
    setAnimating(true)
    setPushStep(0)
    setPullStep(0)

    const totalSteps = 6
    let step = 0

    const tick = () => {
      step++
      setPushStep(step)
      setPullStep(step)
      if (step < totalSteps) {
        timerRef.current = setTimeout(tick, 700)
      } else {
        setAnimating(false)
      }
    }
    timerRef.current = setTimeout(tick, 400)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const getLabel = (steps, activeStep) => {
    if (activeStep === 0) return ''
    const step = steps[activeStep - 1]
    return step ? `→ ${step.label}` : ''
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        {/* Push panel */}
        <div style={{
          flex: 1, background: C.surface, borderRadius: '12px',
          border: `1px solid ${C.border}`, padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.green }} />
            <h3 style={{ color: C.text, fontSize: '16px', fontWeight: 700 }}>Push Deployment</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <FlowDiagram
              steps={PUSH_STEPS}
              arrows={PUSH_ARROWS}
              color={C.green}
              activeStep={pushStep}
              label={getLabel(PUSH_STEPS, pushStep)}
            />
          </div>
          <p style={{ color: C.muted, fontSize: '13px', marginTop: '8px' }}>
            CI system actively pushes the artifact to the target environment after tests pass.
          </p>
        </div>

        {/* Pull panel */}
        <div style={{
          flex: 1, background: C.surface, borderRadius: '12px',
          border: `1px solid ${C.border}`, padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.accent }} />
            <h3 style={{ color: C.text, fontSize: '16px', fontWeight: 700 }}>Pull Deployment (GitOps)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <FlowDiagram
              steps={PULL_STEPS}
              arrows={PULL_ARROWS}
              color={C.accent}
              activeStep={pullStep}
              label={getLabel(PULL_STEPS, pullStep)}
            />
          </div>
          <p style={{ color: C.muted, fontSize: '13px', marginTop: '8px' }}>
            An in-cluster operator watches the registry and reconciles desired vs actual state.
          </p>
        </div>
      </div>

      {/* Animate button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <button
          onClick={animate}
          disabled={animating}
          style={{
            padding: '10px 28px', borderRadius: '8px', border: 'none',
            background: animating ? C.border : C.accent,
            color: animating ? C.muted : '#fff',
            fontSize: '14px', fontWeight: 700,
            cursor: animating ? 'default' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {animating ? 'Animating...' : 'Animate Both Flows'}
        </button>
      </div>

      {/* Comparison table */}
      <div style={{
        background: C.surface, borderRadius: '12px',
        border: `1px solid ${C.border}`, overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0B1120' }}>
              <th style={{ padding: '12px 20px', textAlign: 'left', color: C.muted, fontSize: '13px', fontWeight: 600 }}>Metric</th>
              <th style={{ padding: '12px 20px', textAlign: 'left', color: C.green, fontSize: '13px', fontWeight: 600 }}>Push</th>
              <th style={{ padding: '12px 20px', textAlign: 'left', color: C.accent, fontSize: '13px', fontWeight: 600 }}>Pull (GitOps)</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 20px', color: C.text, fontSize: '14px', fontWeight: 600 }}>{row.metric}</td>
                <td style={{ padding: '12px 20px', color: C.muted, fontSize: '14px' }}>{row.push}</td>
                <td style={{ padding: '12px 20px', color: C.muted, fontSize: '14px' }}>{row.pull}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
