import { useState } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const ENV_DATA = {
  Development: [
    { key: 'VITE_WEATHER_USER_AGENT', value: 'weather-app-dev/1.0 (dev@example.com)', secret: false },
    { key: 'VITE_API_BASE_URL', value: 'https://api.weather.gov', secret: false },
    { key: 'VITE_LLM_MODEL', value: 'claude-haiku-3-20240307', secret: false },
    { key: 'VITE_LLM_API_KEY', value: 'sk-ant-dev-abc123xyz789', secret: true },
    { key: 'VITE_LOG_LEVEL', value: 'debug', secret: false },
    { key: 'VITE_MAX_REQUESTS_PER_MIN', value: '30', secret: false },
  ],
  Staging: [
    { key: 'VITE_WEATHER_USER_AGENT', value: 'weather-app-staging/1.0 (staging@example.com)', secret: false },
    { key: 'VITE_API_BASE_URL', value: 'https://api.weather.gov', secret: false },
    { key: 'VITE_LLM_MODEL', value: 'claude-sonnet-4-20250514', secret: false },
    { key: 'VITE_LLM_API_KEY', value: 'sk-ant-staging-def456uvw012', secret: true },
    { key: 'VITE_LOG_LEVEL', value: 'info', secret: false },
    { key: 'VITE_MAX_REQUESTS_PER_MIN', value: '80', secret: false },
  ],
  Production: [
    { key: 'VITE_WEATHER_USER_AGENT', value: 'weather-app-prod/2.0 (ops@example.com)', secret: false },
    { key: 'VITE_API_BASE_URL', value: 'https://api.weather.gov', secret: false },
    { key: 'VITE_LLM_MODEL', value: 'claude-sonnet-4-20250514', secret: false },
    { key: 'VITE_LLM_API_KEY', value: 'sk-ant-prod-ghi789rst345', secret: true },
    { key: 'VITE_LOG_LEVEL', value: 'warn', secret: false },
    { key: 'VITE_MAX_REQUESTS_PER_MIN', value: '150', secret: false },
  ]
}

const REQUIRED_VARS = ['VITE_WEATHER_USER_AGENT', 'VITE_API_BASE_URL', 'VITE_LLM_MODEL', 'VITE_LLM_API_KEY']

const BAD_CODE = `// src/components/WeatherService.jsx
const API_KEY = "sk-ant-prod-ghi789rst345";  // BAD!
const response = await fetch(url, {
  headers: { 'Authorization': \`Bearer \${API_KEY}\` }
});`

const GOOD_CODE = `// src/components/WeatherService.jsx
const API_KEY = import.meta.env.VITE_LLM_API_KEY;
const response = await fetch(url, {
  headers: { 'Authorization': \`Bearer \${API_KEY}\` }
});`

const ENV_EXAMPLE = `# .env.example — COMMIT THIS FILE
# Copy to .env.local and fill in real values. Never commit .env.local

VITE_WEATHER_USER_AGENT=your-app-name/1.0 (your@email.com)
VITE_API_BASE_URL=https://api.weather.gov
VITE_LLM_MODEL=claude-sonnet-4-20250514
VITE_LLM_API_KEY=your-anthropic-api-key-here
VITE_LOG_LEVEL=info
VITE_MAX_REQUESTS_PER_MIN=100`

const TABS = ['Development', 'Staging', 'Production']

export default function EnvVarManager() {
  const [activeTab, setActiveTab] = useState('Development')
  const [revealed, setRevealed] = useState({})
  const [showFixed, setShowFixed] = useState(false)
  const [validated, setValidated] = useState(null)

  const vars = ENV_DATA[activeTab]

  const toggleReveal = (key) => {
    setRevealed(r => ({ ...r, [`${activeTab}-${key}`]: !r[`${activeTab}-${key}`] }))
  }

  const validate = () => {
    const result = {}
    REQUIRED_VARS.forEach(k => {
      const v = vars.find(x => x.key === k)
      result[k] = v && v.value ? 'ok' : 'missing'
    })
    setValidated(result)
  }

  const tabColor = { Development: C.green, Staging: C.yellow, Production: C.red }[activeTab]

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: C.bg, borderRadius: '8px', padding: '4px', border: `1px solid ${C.border}` }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setValidated(null) }}
            style={{
              flex: 1, padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: activeTab === tab ? { Development: `${C.green}22`, Staging: `${C.yellow}22`, Production: `${C.red}22` }[tab] : 'transparent',
              color: activeTab === tab ? { Development: C.green, Staging: C.yellow, Production: C.red }[tab] : C.muted,
              fontSize: '14px', fontWeight: activeTab === tab ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Env vars table */}
      <div style={{ background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tabColor }} />
          <span style={{ color: tabColor, fontSize: '13px', fontWeight: 700 }}>{activeTab} Environment</span>
        </div>
        {vars.map((v, i) => {
          const revealKey = `${activeTab}-${v.key}`
          const isRevealed = revealed[revealKey]
          const isRequired = REQUIRED_VARS.includes(v.key)
          return (
            <div key={v.key} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 16px',
              borderBottom: i < vars.length - 1 ? `1px solid ${C.border}` : 'none',
              background: i % 2 === 0 ? 'transparent' : '#0a0f1a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '280px' }}>
                {isRequired && <span style={{ color: C.yellow, fontSize: '10px' }}>★</span>}
                <span style={{ color: C.accent, fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{v.key}</span>
              </div>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px', color: v.secret && !isRevealed ? C.muted : C.green }}>
                {v.secret && !isRevealed ? '•'.repeat(16) : v.value}
              </div>
              {v.secret && (
                <button
                  onClick={() => toggleReveal(v.key)}
                  style={{
                    padding: '3px 10px', borderRadius: '4px', border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.muted, fontSize: '11px', cursor: 'pointer'
                  }}
                >
                  {isRevealed ? 'Hide' : 'Reveal'}
                </button>
              )}
              {v.secret && (
                <span style={{ padding: '2px 8px', borderRadius: '9999px', background: `${C.red}22`, color: C.red, fontSize: '10px', fontWeight: 700 }}>
                  SECRET
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Validate + result */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <button
          onClick={validate}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: C.accent, color: '#fff',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          Validate Config
        </button>
        {validated && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(validated).map(([k, status]) => (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '6px',
                background: status === 'ok' ? `${C.green}18` : `${C.red}18`,
                border: `1px solid ${status === 'ok' ? C.green : C.red}`
              }}>
                <span style={{ color: status === 'ok' ? C.green : C.red, fontSize: '12px' }}>
                  {status === 'ok' ? '✓' : '✗'}
                </span>
                <span style={{ color: C.muted, fontSize: '11px', fontFamily: 'monospace' }}>{k}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bad code / Fix it */}
      <div style={{ background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: showFixed ? C.green : C.red, fontSize: '13px', fontWeight: 700 }}>
            {showFixed ? 'Fixed: Using Environment Variable' : 'Bad Example: Hardcoded API Key'}
          </span>
          <button
            onClick={() => setShowFixed(f => !f)}
            style={{
              padding: '5px 14px', borderRadius: '6px', border: 'none',
              background: showFixed ? `${C.red}22` : C.green,
              color: showFixed ? C.red : '#000',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {showFixed ? 'Show Bad Example' : 'Fix It'}
          </button>
        </div>
        <pre style={{
          padding: '16px', margin: 0,
          background: showFixed ? `${C.green}08` : `${C.red}08`,
          color: C.text, fontSize: '12px', fontFamily: 'monospace',
          lineHeight: 1.6, overflowX: 'auto',
          border: `2px solid ${showFixed ? C.green : C.red}`,
          borderTop: 'none'
        }}>
          {showFixed ? GOOD_CODE : BAD_CODE}
        </pre>
      </div>

      {/* .env.example */}
      <div style={{ background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.muted, fontSize: '13px', fontWeight: 700 }}>
            .env.example — What to commit to the repo
          </span>
        </div>
        <pre style={{
          padding: '16px', margin: 0, background: 'transparent',
          color: C.green, fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.6, overflowX: 'auto'
        }}>
          {ENV_EXAMPLE}
        </pre>
      </div>
    </div>
  )
}
