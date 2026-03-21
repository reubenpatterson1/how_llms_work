import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend, Label } from 'recharts'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const SCALE_THRESHOLD = 100
const MAX_PODS = 5
const COST_PER_POD = 0.12 // $ per hour per pod

const generateInitialData = () =>
  Array.from({ length: 30 }, (_, i) => ({
    t: i, requests: Math.floor(20 + Math.random() * 30), pods: 1, queue: 0
  }))

export default function AutoScalingViz() {
  const [chartData, setChartData] = useState(generateInitialData())
  const [pods, setPods] = useState(1)
  const [requests, setRequests] = useState(35)
  const [queue, setQueue] = useState(0)
  const [cost, setCost] = useState(0)
  const [simulating, setSimulating] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | spike | cooldown
  const timerRef = useRef(null)
  const tickRef = useRef(0)
  const podQueueRef = useRef([]) // [{readyAt, count}] — provisioning lag buffer

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const resetSim = () => {
    clearTimeout(timerRef.current)
    setSimulating(false)
    setPhase('idle')
    setPods(1)
    setRequests(35)
    setQueue(0)
    setCost(0)
    tickRef.current = 0
    podQueueRef.current = []
    setChartData(generateInitialData())
  }

  const runSim = () => {
    if (simulating) return
    setSimulating(true)
    setPhase('spike')

    let tick = 0
    let orderedPods = 1   // what the auto-scaler has requested
    let activePods = 1    // pods actually serving traffic (2-tick provisioning lag)
    let currentCost = 0
    let displayQueue = 0  // decays slowly so card stays readable
    podQueueRef.current = []

    const step = () => {
      tick++
      tickRef.current = tick

      // Apply pods that have finished provisioning this tick
      const pq = podQueueRef.current
      const ready = pq.filter(p => p.readyAt <= tick)
      if (ready.length > 0) {
        activePods = ready[ready.length - 1].count
        podQueueRef.current = pq.filter(p => p.readyAt > tick)
      }

      // Determine request volume
      let req
      if (tick <= 8) {
        req = Math.min(50 + tick * 22, 230)
      } else if (tick <= 16) {
        req = 220 + Math.floor(Math.random() * 20 - 10)
      } else {
        req = Math.max(30, 220 - (tick - 16) * 25)
        if (tick === 17) setPhase('cooldown')
      }

      // Queue depth = backlog against ACTIVE pods (before newly ordered pods arrive)
      const rawQ = tick > 16 ? 0 : Math.max(0, Math.floor((req - activePods * SCALE_THRESHOLD) / 4))
      // Decay slowly so the card stays readable across ticks (not a single-frame flash)
      displayQueue = Math.max(rawQ, Math.floor(displayQueue * 0.55))
      const q = displayQueue

      // Auto-scaler decision: order more/fewer pods (they become active 2 ticks later)
      const targetPods = Math.max(1, Math.min(MAX_PODS, Math.ceil(req / SCALE_THRESHOLD)))
      if (targetPods !== orderedPods) {
        orderedPods = targetPods
        podQueueRef.current.push({ readyAt: tick + 2, count: orderedPods })
      }

      currentCost += (activePods * COST_PER_POD) / 60

      setRequests(req)
      setQueue(q)
      setPods(activePods)
      setCost(currentCost)

      setChartData(prev => {
        const next = [...prev.slice(1), { t: prev[prev.length - 1].t + 1, requests: req, pods: activePods * 40, queue: q }]
        return next
      })

      if (tick < 25) {
        timerRef.current = setTimeout(step, 400)
      } else {
        setSimulating(false)
        setPhase('idle')
      }
    }

    timerRef.current = setTimeout(step, 200)
  }

  const podColor = (i) => {
    if (i < pods) return C.green
    return C.border
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
      {/* Top metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Requests/min', value: requests, color: C.accent },
          { label: 'Active Pods', value: pods, color: C.green },
          { label: 'LLM Queue Depth', value: queue, color: queue > 5 ? C.red : C.yellow },
          { label: 'Cost This Sim ($)', value: cost.toFixed(4), color: C.muted },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: C.surface, borderRadius: '10px',
            border: `1px solid ${C.border}`, padding: '14px',
            display: 'flex', flexDirection: 'column', gap: '4px'
          }}>
            <span style={{ color: C.muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
            <span style={{ color, fontSize: '24px', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Pod grid */}
      <div style={{ background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>Pod Instances</h3>
          <span style={{ color: C.muted, fontSize: '12px' }}>Max: {MAX_PODS}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {Array.from({ length: MAX_PODS }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: '64px', borderRadius: '8px',
                background: i < pods ? `${C.green}22` : `${C.border}22`,
                border: `2px solid ${podColor(i)}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s ease',
                opacity: i < pods ? 1 : 0.3
              }}
            >
              <span style={{ fontSize: '20px' }}>{i < pods ? '🟢' : '⬜'}</span>
              <span style={{ color: i < pods ? C.green : C.muted, fontSize: '10px', marginTop: '2px' }}>
                pod-{i + 1}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', height: '6px', borderRadius: '3px', background: C.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            width: `${(requests / (pods * SCALE_THRESHOLD)) * 100}%`,
            background: requests > pods * SCALE_THRESHOLD * 0.8 ? C.red : C.green,
            transition: 'width 0.4s, background 0.4s',
            maxWidth: '100%'
          }} />
        </div>
        <p style={{ color: C.muted, fontSize: '11px', marginTop: '4px' }}>
          Load: {Math.min(Math.round((requests / (pods * SCALE_THRESHOLD)) * 100), 100)}% capacity
          {requests > pods * SCALE_THRESHOLD && ' — Scale-out triggered!'}
        </p>
      </div>

      {/* Chart */}
      <div style={{ background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '16px' }}>
        <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
          Real-time Metrics
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 55, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="t" tick={{ fill: C.muted, fontSize: 10 }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: C.muted, fontSize: 10 }}
              label={{ value: 'req / pods×40', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 10, dx: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: C.yellow, fontSize: 10 }}
              tickCount={5}
              label={{ value: 'Queue depth', angle: 90, position: 'insideRight', fill: C.yellow, fontSize: 10, dx: 10 }}
            />
            <Tooltip
              contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}
              labelStyle={{ color: C.muted }}
            />
            <Legend wrapperStyle={{ color: C.muted, fontSize: '12px' }} />
            <ReferenceLine yAxisId="left" y={SCALE_THRESHOLD} stroke={C.red} strokeDasharray="4 4" label={{ value: 'Scale threshold', fill: C.red, fontSize: 10 }} />
            <Line yAxisId="left" type="monotone" dataKey="requests" stroke={C.accent} strokeWidth={2} dot={false} name="Requests/min" />
            <Line yAxisId="left" type="monotone" dataKey="pods" stroke={C.green} strokeWidth={2} dot={false} name="Pods ×40" />
            <Line yAxisId="right" type="monotone" dataKey="queue" stroke={C.yellow} strokeWidth={2} dot={false} strokeDasharray="4 2" name="LLM Queue depth" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={runSim}
          disabled={simulating}
          style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: simulating ? C.border : C.accent,
            color: simulating ? C.muted : '#fff',
            fontSize: '14px', fontWeight: 700, cursor: simulating ? 'default' : 'pointer'
          }}
        >
          {simulating ? `Simulating (${phase})...` : 'Simulate Traffic Spike'}
        </button>
        <button
          onClick={resetSim}
          style={{
            padding: '10px 24px', borderRadius: '8px',
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Reset
        </button>
        {phase === 'spike' && (
          <span style={{ color: C.red, fontSize: '13px', fontWeight: 700 }}>
            Traffic spike detected — scaling out...
          </span>
        )}
        {phase === 'cooldown' && (
          <span style={{ color: C.green, fontSize: '13px', fontWeight: 700 }}>
            Traffic cooling — scaling back down...
          </span>
        )}
      </div>
    </div>
  )
}
