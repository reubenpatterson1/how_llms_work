import { useState } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const COMMITS = [
  {
    id: 'v1.0.0', version: 'v1.0.0', type: 'major',
    message: 'feat: initial release of Hello World Weather App',
    files: ['src/App.jsx', 'src/components/AnimationEngine.jsx', 'src/components/WeatherService.jsx', 'src/components/CitySelector.jsx', 'prompts/v1/system.txt'],
    semverReason: 'First public release. Major version 1 establishes the public API.',
    promptChange: 'Created prompts/v1/system.txt: "You are a weather narrator. Format the city weather data as a friendly one-sentence summary."',
    tag: { label: 'v1.0.0', color: C.green }
  },
  {
    id: 'v1.1.0', version: 'v1.1.0', type: 'minor',
    message: 'feat: add reset button and reset behavior prompt',
    files: ['src/components/ResetController.jsx', 'prompts/v1/reset-behavior.txt', 'src/App.jsx'],
    semverReason: 'New feature (reset button) added without breaking existing functionality. Minor bump.',
    promptChange: 'Added prompts/v1/reset-behavior.txt: "When the user resets, acknowledge the action and invite them to pick a new city."',
    tag: { label: 'v1.1.0', color: C.accent }
  },
  {
    id: 'v1.1.1', version: 'v1.1.1', type: 'patch',
    message: 'fix: resolve CORS preflight failure on api.weather.gov requests',
    files: ['src/components/WeatherService.jsx', 'vite.config.js'],
    semverReason: 'Bug fix only. No new features, no API changes. Patch bump.',
    promptChange: 'No prompt changes in this release.',
    tag: null
  },
  {
    id: 'v1.2.0', version: 'v1.2.0', type: 'minor',
    message: 'feat: upgrade LLM model from Haiku to Sonnet for city name parsing',
    files: ['config/llm.json', 'src/components/WeatherService.jsx'],
    semverReason: 'New capability (better city parsing) without breaking the external API. Minor bump.',
    promptChange: 'config/llm.json model changed: "claude-haiku-3" → "claude-sonnet-4-20250514". Pinned to exact version.',
    tag: { label: 'v1.2.0', color: C.accent }
  },
  {
    id: 'v1.2.1', version: 'v1.2.1', type: 'patch',
    message: 'fix: add exponential backoff for LLM rate limit errors (429)',
    files: ['src/components/WeatherService.jsx', 'src/utils/retry.js'],
    semverReason: 'Bug fix for rate limit handling. Patch bump.',
    promptChange: 'No prompt changes. Retry logic is code-only.',
    tag: null
  },
  {
    id: 'v2.0.0', version: 'v2.0.0', type: 'breaking',
    message: 'feat!: BREAKING — WeatherService response schema change (observations → periods)',
    files: ['src/components/WeatherService.jsx', 'src/components/AnimationEngine.jsx', 'src/App.jsx', 'prompts/v2/system.txt', 'MIGRATION.md'],
    semverReason: 'BREAKING CHANGE: api.weather.gov changed their response schema. All consumers of WeatherService must update. Major bump required.',
    promptChange: 'New prompts/v2/system.txt: "You are a weather narrator. The data format has changed — use the periods[0].shortForecast field for the summary."',
    tag: { label: 'BREAKING', color: C.red }
  }
]

const CHAOS_MESSAGES = [
  { message: 'fix stuff', files: ['src/App.jsx'], semverReason: '???', promptChange: 'Unknown — no prompt log.' },
  { message: 'update', files: ['config/llm.json', 'src/components/WeatherService.jsx'], semverReason: 'Was this a breaking change? Hard to tell.', promptChange: 'config changed but no commit notes.' },
  { message: 'wip', files: ['src/App.jsx', 'prompts/something.txt'], semverReason: 'Work in progress committed to main. Version unclear.', promptChange: 'prompts/something.txt modified but no context.' },
  { message: 'temp fix', files: ['src/components/WeatherService.jsx'], semverReason: 'Temporary fix? Is it still in prod?', promptChange: 'No prompt log.' },
  { message: 'prod deploy', files: [], semverReason: 'Empty files list. What was actually deployed?', promptChange: 'Cannot determine.' },
  { message: 'asdf', files: ['src/App.jsx', 'src/components/AnimationEngine.jsx', 'src/components/WeatherService.jsx'], semverReason: 'No semver bump. No version tag. Running in prod right now?', promptChange: 'Unknown.' },
]

export default function VersioningTimeline() {
  const [selected, setSelected] = useState(null)
  const [chaosMode, setChaosMode] = useState(false)

  const displayCommits = chaosMode
    ? CHAOS_MESSAGES.map((c, i) => ({ ...c, id: `chaos-${i}`, version: '???', type: 'chaos', tag: null }))
    : COMMITS

  const svgWidth = 560
  const nodeSpacing = svgWidth / (displayCommits.length + 1)

  const getNodeColor = (commit) => {
    if (commit.type === 'breaking') return C.red
    if (commit.type === 'major') return C.green
    if (commit.type === 'minor') return C.accent
    if (commit.type === 'chaos') return C.yellow
    return C.muted
  }

  const selectedCommit = selected !== null ? displayCommits[selected] : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', padding: '4px 0' }}>
      {/* Timeline SVG */}
      <div style={{
        background: C.surface, borderRadius: '12px',
        border: `1px solid ${C.border}`, padding: '20px', overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700 }}>
            {chaosMode ? 'Chaos Mode — Poor Commit Hygiene' : 'Hello World Weather App — Git Timeline'}
          </h3>
          <button
            onClick={() => { setChaosMode(m => !m); setSelected(null) }}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: `1px solid ${C.border}`,
              background: chaosMode ? C.yellow : C.surface,
              color: chaosMode ? '#000' : C.muted,
              fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {chaosMode ? 'Exit Chaos Mode' : 'Show LLM Chaos Mode'}
          </button>
        </div>

        <svg width="100%" viewBox={`0 0 ${svgWidth} 120`} style={{ minWidth: '400px' }}>
          {/* Timeline line */}
          <line x1={nodeSpacing * 0.5} y1={60} x2={nodeSpacing * (displayCommits.length + 0.5)} y2={60}
            stroke={C.border} strokeWidth={2} />

          {displayCommits.map((commit, i) => {
            const cx = nodeSpacing * (i + 1)
            const isSelected = selected === i
            const nodeColor = getNodeColor(commit)

            return (
              <g key={commit.id} onClick={() => setSelected(isSelected ? null : i)} style={{ cursor: 'pointer' }}>
                {/* Node circle */}
                <circle
                  cx={cx} cy={60} r={isSelected ? 16 : 12}
                  fill={isSelected ? nodeColor : `${nodeColor}33`}
                  stroke={nodeColor}
                  strokeWidth={isSelected ? 3 : 2}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* Version label */}
                <text x={cx} y={95} fill={nodeColor} fontSize="10" fontWeight="700" textAnchor="middle">
                  {commit.version}
                </text>
                {/* Tag badge */}
                {commit.tag && (
                  <g>
                    <rect x={cx - 28} y={20} width={56} height={16} rx={8}
                      fill={`${commit.tag.color}22`} stroke={commit.tag.color} strokeWidth={1} />
                    <text x={cx} y={32} fill={commit.tag.color} fontSize="9" fontWeight="700" textAnchor="middle">
                      {commit.tag.label}
                    </text>
                  </g>
                )}
                {/* Dot indicator */}
                {!isSelected && (
                  <circle cx={cx} cy={60} r={4} fill={nodeColor} />
                )}
              </g>
            )
          })}
        </svg>
        <p style={{ color: C.muted, fontSize: '12px', marginTop: '4px' }}>
          Click a commit node to inspect it
        </p>
      </div>

      {/* Selected commit detail panel */}
      {selectedCommit && (
        <div style={{
          background: C.surface, borderRadius: '12px',
          border: `1px solid ${selected !== null && displayCommits[selected].type === 'breaking' ? C.red : C.border}`,
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{
              padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
              background: `${getNodeColor(selectedCommit)}22`,
              color: getNodeColor(selectedCommit),
              border: `1px solid ${getNodeColor(selectedCommit)}`
            }}>
              {selectedCommit.version}
            </span>
            <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 600 }}>
              {selectedCommit.message}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h4 style={{ color: C.muted, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Changed Files
              </h4>
              {selectedCommit.files && selectedCommit.files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedCommit.files.map((f, i) => (
                    <div key={i} style={{
                      padding: '4px 10px', borderRadius: '4px',
                      background: '#0B1120', color: C.accent,
                      fontSize: '12px', fontFamily: 'monospace'
                    }}>{f}</div>
                  ))}
                </div>
              ) : (
                <span style={{ color: C.red, fontSize: '13px' }}>No files recorded!</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h4 style={{ color: C.muted, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Semver Reasoning
                </h4>
                <p style={{ color: C.text, fontSize: '13px', lineHeight: 1.5 }}>{selectedCommit.semverReason}</p>
              </div>
              <div>
                <h4 style={{ color: C.muted, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                  What changed in prompts?
                </h4>
                <p style={{
                  color: selectedCommit.promptChange && selectedCommit.promptChange.includes('No prompt') ? C.muted : C.yellow,
                  fontSize: '13px', lineHeight: 1.5
                }}>
                  {selectedCommit.promptChange}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {chaosMode && (
        <div style={{
          background: `${C.yellow}11`, borderRadius: '10px',
          border: `1px solid ${C.yellow}`, padding: '14px 18px'
        }}>
          <p style={{ color: C.yellow, fontSize: '14px', fontWeight: 600 }}>
            Chaos Mode Active: This is what bad commit hygiene looks like in production.
          </p>
          <p style={{ color: C.muted, fontSize: '13px', marginTop: '6px' }}>
            No version tags. No semantic meaning. Prompt changes aren&apos;t tracked. If something broke in prod, you cannot identify when or why.
          </p>
        </div>
      )}
    </div>
  )
}
