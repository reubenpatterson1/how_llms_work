import { useState, useEffect, useRef, useCallback } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B',
  debug: '#6B7280', info: '#3B82F6', warn: '#F59E0B', error: '#EF4444'
}

const INITIAL_LOGS = [
  { level: 'INFO', time: '10:42:01.012', text: 'fetchWeather called {"city":"Chicago","requestId":"r-001"}' },
  { level: 'DEBUG', time: '10:42:01.034', text: 'Resolved lat/lon {"lat":41.85,"lon":-87.65}' },
  { level: 'INFO', time: '10:42:01.344', text: 'api.weather.gov /gridpoints response 200 {"latency_ms":310}' },
  { level: 'INFO', time: '10:42:01.345', text: 'fetchWeather returned {"city":"Chicago","temp":62,"condition":"Partly Cloudy"}' },
  { level: 'DEBUG', time: '10:42:02.100', text: 'LLM call {"model":"claude-sonnet-4","input_tokens":412,"prompt_version":"v2.1"}' },
  { level: 'INFO', time: '10:42:02.987', text: 'LLM response {"output_tokens":87,"latency_ms":887,"finish_reason":"end_turn"}' },
  { level: 'WARN', time: '10:42:05.200', text: 'Daily token budget at 74% {"used":37000,"budget":50000}' },
  { level: 'INFO', time: '10:42:08.411', text: 'fetchWeather called {"city":"London","requestId":"r-002"}' },
  { level: 'INFO', time: '10:42:08.733', text: 'api.weather.gov /gridpoints response 200 {"latency_ms":322}' },
  { level: 'ERROR', time: '10:42:11.001', text: 'fetchWeather failed {"city":"Miami","error":"503 Service Unavailable","retries":3}' },
]

const STREAM_LOGS = [
  { level: 'INFO', text: 'fetchWeather called {"city":"Seattle","requestId":"r-003"}' },
  { level: 'DEBUG', text: 'Resolved lat/lon {"lat":47.60,"lon":-122.33}' },
  { level: 'INFO', text: 'api.weather.gov /gridpoints response 200 {"latency_ms":298}' },
  { level: 'WARN', text: 'Response latency P95 above baseline {"p95_ms":1240,"baseline_ms":900}' },
  { level: 'INFO', text: 'LLM call {"model":"claude-sonnet-4","input_tokens":389,"prompt_version":"v2.1"}' },
  { level: 'INFO', text: 'LLM response {"output_tokens":92,"latency_ms":934,"finish_reason":"end_turn"}' },
  { level: 'DEBUG', text: 'Cache miss for city="Seattle" — fetching fresh data' },
  { level: 'INFO', text: 'fetchWeather called {"city":"Dallas","requestId":"r-004"}' },
  { level: 'ERROR', text: 'LLM API rate limit hit {"retry_after_ms":2000,"prompt_version":"v2.1"}' },
  { level: 'WARN', text: 'Daily token budget at 82% {"used":41000,"budget":50000}' },
  { level: 'INFO', text: 'fetchWeather called {"city":"Boston","requestId":"r-005"}' },
  { level: 'INFO', text: 'api.weather.gov /gridpoints response 200 {"latency_ms":311}' },
]

const DEPLOYMENTS = [
  {
    id: 'd-003', version: 'v1.3.0', time: '2026-03-18 10:14 UTC',
    status: 'success', statusLabel: 'Deployed',
    changes: [
      { type: 'file', desc: 'src/fetchWeather.js — added retry logic (3 attempts)' },
      { type: 'prompt', desc: 'prompt_version bumped v2.0 → v2.1 (improved JSON schema)' },
      { type: 'dep', desc: 'recharts@3.8.0 added for analytics dashboard' },
    ]
  },
  {
    id: 'd-002', version: 'v1.2.1', time: '2026-03-17 15:30 UTC',
    status: 'rollback', statusLabel: 'Rolled Back',
    changes: [
      { type: 'model', desc: 'model_id updated claude-3-5-haiku → claude-sonnet-4' },
      { type: 'file', desc: 'src/App.jsx — added LLM weather summary feature' },
      { type: 'alert', desc: 'Post-deploy eval score dropped to 87% (threshold 95%) — auto-rollback triggered' },
    ]
  },
  {
    id: 'd-001', version: 'v1.2.0', time: '2026-03-16 09:05 UTC',
    status: 'success', statusLabel: 'Deployed',
    changes: [
      { type: 'file', desc: 'src/components/WeatherCard.jsx — redesigned card layout' },
      { type: 'file', desc: 'src/index.css — responsive breakpoints added' },
      { type: 'dep', desc: 'vite@8.0.0 upgraded from 7.x' },
    ]
  }
]

const INITIAL_ALERTS = [
  {
    id: 'a1', priority: 'WARN',
    name: 'Daily Token Budget Warning',
    condition: 'token_usage > 80% of daily budget',
    current: '82% consumed (41,000 / 50,000 tokens)',
    lastFired: '2 minutes ago',
    acked: false
  },
  {
    id: 'a2', priority: 'ERROR',
    name: 'api.weather.gov Error Rate Elevated',
    condition: 'error_rate(5m) > 5%',
    current: '7.3% error rate in last 5 minutes',
    lastFired: '8 minutes ago',
    acked: false
  },
  {
    id: 'a3', priority: 'P0',
    name: 'Bundle Size Threshold Exceeded',
    condition: 'dist bundle size > 500KB',
    current: '523KB (limit: 500KB) — possible unintended dependency',
    lastFired: '1 hour ago',
    acked: false
  }
]

const CHANGE_TYPE_COLORS = {
  file: C.accent,
  prompt: C.green,
  model: '#A78BFA',
  dep: C.yellow,
  alert: C.red
}

const CHANGE_TYPE_LABELS = {
  file: 'FILE',
  prompt: 'PROMPT',
  model: 'MODEL',
  dep: 'DEP',
  alert: 'ALERT'
}

const LEVEL_COLORS = {
  DEBUG: C.debug, INFO: C.info, WARN: C.warn, ERROR: C.error
}

const PRIORITY_COLORS = {
  WARN: { bg: 'rgba(245,158,11,0.1)', border: C.yellow, text: C.yellow },
  ERROR: { bg: 'rgba(239,68,68,0.1)', border: C.red, text: C.red },
  P0: { bg: 'rgba(239,68,68,0.2)', border: C.red, text: '#FF8080' }
}

function getTime() {
  const now = new Date()
  return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0')
}

export default function LoggingAlertingViz() {
  const [tab, setTab] = useState('logs')
  const [logs, setLogs] = useState(INITIAL_LOGS)
  const [streaming, setStreaming] = useState(false)
  const [alerts, setAlerts] = useState(INITIAL_ALERTS)
  const streamIdx = useRef(0)
  const intervalRef = useRef(null)
  const logsEndRef = useRef(null)

  const toggleStream = useCallback(() => {
    if (streaming) {
      clearInterval(intervalRef.current)
      setStreaming(false)
    } else {
      setStreaming(true)
      intervalRef.current = setInterval(() => {
        const entry = STREAM_LOGS[streamIdx.current % STREAM_LOGS.length]
        streamIdx.current++
        setLogs(prev => [...prev.slice(-50), { ...entry, time: getTime() }])
      }, 800)
    }
  }, [streaming])

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const ackAlert = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acked: true } : a))
  }

  const tabs = ['Logs', 'Changes', 'Alerts']

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
        Logging and Alerting Dashboard
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
        Three views: real-time structured logs, deployment change history, and active alert management.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t.toLowerCase())}
            style={{
              background: tab === t.toLowerCase() ? C.surface : 'transparent',
              color: tab === t.toLowerCase() ? C.text : C.muted,
              border: 'none',
              borderBottom: tab === t.toLowerCase() ? `2px solid ${C.accent}` : '2px solid transparent',
              padding: '8px 20px', cursor: 'pointer', fontSize: 14,
              fontWeight: tab === t.toLowerCase() ? 600 : 400,
              marginBottom: -1
            }}
          >
            {t}
            {t === 'Alerts' && alerts.filter(a => !a.acked).length > 0 && (
              <span style={{
                marginLeft: 8, background: C.red, color: '#fff',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700
              }}>
                {alerts.filter(a => !a.acked).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Logs tab */}
      {tab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button
              onClick={toggleStream}
              style={{
                background: streaming ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                color: streaming ? C.red : C.green,
                border: `1px solid ${streaming ? C.red : C.green}`,
                borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600
              }}
            >
              {streaming ? '⏸ Stop Streaming' : '▶ Stream Logs'}
            </button>
            <button
              onClick={() => { setLogs(INITIAL_LOGS); streamIdx.current = 0 }}
              style={{
                background: C.surface, color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12
              }}
            >
              Clear
            </button>
            {streaming && (
              <span style={{
                fontSize: 12, color: C.green,
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: C.green,
                  display: 'inline-block',
                  animation: 'none'
                }} />
                Live
              </span>
            )}
          </div>

          <div style={{
            background: '#050A14', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12,
            height: 320, overflowY: 'auto'
          }}>
            <div style={{ color: C.muted, marginBottom: 8, fontSize: 11, letterSpacing: '0.08em' }}>
              APPLICATION LOG STREAM — weather-app-prod
            </div>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 3, display: 'flex', gap: 10, lineHeight: 1.5 }}>
                <span style={{ color: C.muted, flexShrink: 0, fontSize: 10 }}>{log.time}</span>
                <span style={{
                  color: LEVEL_COLORS[log.level] || C.text,
                  fontWeight: 600, flexShrink: 0, minWidth: 40, fontSize: 10
                }}>
                  {log.level}
                </span>
                <span style={{ color: log.level === 'ERROR' ? C.error : log.level === 'WARN' ? C.warn : '#A8C4E0' }}>
                  {log.text}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(LEVEL_COLORS).map(([level, color]) => (
              <span key={level} style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{level}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Changes tab */}
      {tab === 'changes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DEPLOYMENTS.map(dep => (
            <div key={dep.id} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '16px 20px',
              borderLeft: `3px solid ${dep.status === 'success' ? C.green : C.red}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{dep.version}</span>
                  <span style={{ color: C.muted, fontSize: 12, marginLeft: 12 }}>{dep.time}</span>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>#{dep.id}</span>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 12,
                  background: dep.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: dep.status === 'success' ? C.green : C.red,
                  border: `1px solid ${dep.status === 'success' ? C.green : C.red}`,
                  fontSize: 11, fontWeight: 700
                }}>
                  {dep.statusLabel}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dep.changes.map((ch, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 4, background: `${CHANGE_TYPE_COLORS[ch.type]}22`,
                      color: CHANGE_TYPE_COLORS[ch.type], flexShrink: 0, marginTop: 2,
                      letterSpacing: '0.06em', fontFamily: 'monospace'
                    }}>
                      {CHANGE_TYPE_LABELS[ch.type]}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{ch.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts tab */}
      {tab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(alert => {
            const pc = PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.WARN
            return (
              <div key={alert.id} style={{
                background: alert.acked ? C.surface : pc.bg,
                border: `1px solid ${alert.acked ? C.border : pc.border}`,
                borderRadius: 10, padding: '16px 20px',
                opacity: alert.acked ? 0.6 : 1,
                transition: 'opacity 0.3s, border-color 0.3s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12,
                      background: `${pc.border}22`,
                      color: pc.text, border: `1px solid ${pc.border}`,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em'
                    }}>
                      {alert.priority}
                    </span>
                    <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{alert.name}</span>
                  </div>
                  {!alert.acked && (
                    <button
                      onClick={() => ackAlert(alert.id)}
                      style={{
                        background: 'rgba(59,130,246,0.1)', color: C.accent,
                        border: `1px solid ${C.accent}`,
                        borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                        flexShrink: 0, marginLeft: 12
                      }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.acked && (
                    <span style={{ color: C.muted, fontSize: 12, fontStyle: 'italic' }}>Acknowledged</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Condition: </span>{alert.condition}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Current value: </span>
                  <span style={{ color: pc.text }}>{alert.current}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  Last fired: {alert.lastFired}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
