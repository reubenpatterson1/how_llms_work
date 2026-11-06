import { useState } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const ROLES = ['ML Engineer', 'Developer', 'Tech Lead', 'Platform', 'Product']
const ROLE_SHORT = ['ML Eng', 'Dev', 'Tech Lead', 'Platform', 'Product']

const ACTIVITIES = [
  { id: 'model_select', label: 'Model Selection', hoursPerAssignment: { R: 3, A: 1.5, C: 0.5, I: 0.1 } },
  { id: 'prompt_mgmt', label: 'Prompt Management', hoursPerAssignment: { R: 4, A: 2, C: 0.5, I: 0.1 } },
  { id: 'cost_monitor', label: 'Cost Monitoring', hoursPerAssignment: { R: 3, A: 1.5, C: 0.5, I: 0.1 } },
  { id: 'incident', label: 'Incident Response', hoursPerAssignment: { R: 5, A: 2.5, C: 1, I: 0.2 } },
  { id: 'eval_suite', label: 'Eval Suite', hoursPerAssignment: { R: 6, A: 3, C: 1, I: 0.1 } },
  { id: 'security', label: 'Security Patches', hoursPerAssignment: { R: 4, A: 2, C: 0.5, I: 0.1 } },
  { id: 'deployment', label: 'Deployment', hoursPerAssignment: { R: 5, A: 2.5, C: 1, I: 0.2 } },
  { id: 'oncall', label: 'On-call Rotation', hoursPerAssignment: { R: 8, A: 4, C: 1, I: 0.2 } },
]

const RACI_OPTIONS = ['R', 'A', 'C', 'I', '']

const RACI_COLORS = {
  R: { bg: 'rgba(59,130,246,0.2)', text: '#3B82F6', border: '#3B82F6' },
  A: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', border: '#10B981' },
  C: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', border: '#F59E0B' },
  I: { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', border: '#94A3B8' },
  '': { bg: 'transparent', text: C.border, border: 'transparent' }
}

const SCENARIOS = {
  startup: {
    label: 'Small Startup (3-person team)',
    matrix: {
      model_select:  { 'ML Engineer': 'R', 'Developer': 'A', 'Tech Lead': 'C', 'Platform': '', 'Product': 'I' },
      prompt_mgmt:   { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': '', 'Product': 'I' },
      cost_monitor:  { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': '', 'Product': 'I' },
      incident:      { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': '', 'Product': 'I' },
      eval_suite:    { 'ML Engineer': 'R', 'Developer': 'C', 'Tech Lead': 'A', 'Platform': '', 'Product': 'I' },
      security:      { 'ML Engineer': '', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': 'C', 'Product': '' },
      deployment:    { 'ML Engineer': '', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': 'C', 'Product': 'I' },
      oncall:        { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': '', 'Product': '' },
    }
  },
  midsize: {
    label: 'Mid-size Team (6-10 engineers)',
    matrix: {
      model_select:  { 'ML Engineer': 'R', 'Developer': 'I', 'Tech Lead': 'A', 'Platform': 'C', 'Product': 'C' },
      prompt_mgmt:   { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': '', 'Product': 'C' },
      cost_monitor:  { 'ML Engineer': 'C', 'Developer': 'I', 'Tech Lead': 'C', 'Platform': 'R', 'Product': 'I' },
      incident:      { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': 'C', 'Product': 'I' },
      eval_suite:    { 'ML Engineer': 'R', 'Developer': 'C', 'Tech Lead': 'A', 'Platform': '', 'Product': 'I' },
      security:      { 'ML Engineer': 'I', 'Developer': 'C', 'Tech Lead': 'A', 'Platform': 'R', 'Product': '' },
      deployment:    { 'ML Engineer': 'I', 'Developer': 'C', 'Tech Lead': 'A', 'Platform': 'R', 'Product': 'I' },
      oncall:        { 'ML Engineer': 'C', 'Developer': 'R', 'Tech Lead': 'A', 'Platform': 'R', 'Product': '' },
    }
  },
  enterprise: {
    label: 'Enterprise (dedicated MLOps)',
    matrix: {
      model_select:  { 'ML Engineer': 'R', 'Developer': 'I', 'Tech Lead': 'A', 'Platform': 'C', 'Product': 'C' },
      prompt_mgmt:   { 'ML Engineer': 'A', 'Developer': 'R', 'Tech Lead': 'C', 'Platform': 'I', 'Product': 'C' },
      cost_monitor:  { 'ML Engineer': 'I', 'Developer': 'I', 'Tech Lead': 'C', 'Platform': 'R', 'Product': 'I' },
      incident:      { 'ML Engineer': 'C', 'Developer': 'I', 'Tech Lead': 'A', 'Platform': 'R', 'Product': 'I' },
      eval_suite:    { 'ML Engineer': 'R', 'Developer': 'C', 'Tech Lead': 'A', 'Platform': 'C', 'Product': 'I' },
      security:      { 'ML Engineer': 'I', 'Developer': 'I', 'Tech Lead': 'C', 'Platform': 'R', 'Product': '' },
      deployment:    { 'ML Engineer': 'I', 'Developer': 'I', 'Tech Lead': 'A', 'Platform': 'R', 'Product': 'I' },
      oncall:        { 'ML Engineer': 'C', 'Developer': 'I', 'Tech Lead': 'A', 'Platform': 'R', 'Product': '' },
    }
  }
}

const DEFAULT_MATRIX = SCENARIOS.midsize.matrix

function flattenMatrix(matrixByActivity) {
  // Transform from { activity: { role: value } } to { activity_role: value }
  const flat = {}
  ACTIVITIES.forEach(act => {
    ROLES.forEach(role => {
      flat[`${act.id}_${role}`] = (matrixByActivity[act.id] && matrixByActivity[act.id][role]) || ''
    })
  })
  return flat
}

export default function OwnershipModel() {
  const [matrix, setMatrix] = useState(() => flattenMatrix(DEFAULT_MATRIX))
  const [scenario, setScenario] = useState('midsize')

  const cycleCell = (actId, role) => {
    const key = `${actId}_${role}`
    const cur = matrix[key]
    const idx = RACI_OPTIONS.indexOf(cur)
    const next = RACI_OPTIONS[(idx + 1) % RACI_OPTIONS.length]
    setMatrix(prev => ({ ...prev, [key]: next }))
  }

  const applyScenario = (s) => {
    setScenario(s)
    setMatrix(flattenMatrix(SCENARIOS[s].matrix))
  }

  // Calculate hours per role
  const roleHours = ROLES.map(role => {
    let hours = 0
    ACTIVITIES.forEach(act => {
      const val = matrix[`${act.id}_${role}`]
      if (val && act.hoursPerAssignment[val]) {
        hours += act.hoursPerAssignment[val]
      }
    })
    return { role, hours: Math.round(hours * 10) / 10 }
  })

  // Find overloaded (R count > 3) and no-owner activities
  const roleRCount = ROLES.map(role => {
    const count = ACTIVITIES.filter(act => matrix[`${act.id}_${role}`] === 'R').length
    return { role, count }
  })
  const overloaded = roleRCount.filter(r => r.count > 3).length
  const noOwner = ACTIVITIES.filter(act =>
    !ROLES.some(role => matrix[`${act.id}_${role}`] === 'R')
  ).length

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>RACI Ownership Model</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
        Click any cell to cycle R → A → C → I → empty. Load a scenario to see common team structures.
      </p>

      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.muted }}>Scenario:</span>
        {Object.entries(SCENARIOS).map(([key, s]) => (
          <button
            key={key}
            onClick={() => applyScenario(key)}
            style={{
              background: scenario === key ? `${C.accent}22` : C.surface,
              color: scenario === key ? C.accent : C.muted,
              border: `1px solid ${scenario === key ? C.accent : C.border}`,
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
              fontWeight: scenario === key ? 700 : 400
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* RACI matrix table */}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
          <thead>
            <tr>
              <th style={{
                textAlign: 'left', padding: '8px 12px', fontSize: 11,
                color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
                borderBottom: `1px solid ${C.border}`, fontWeight: 600
              }}>
                Activity
              </th>
              {ROLES.map((role, i) => (
                <th key={role} style={{
                  textAlign: 'center', padding: '8px 8px', fontSize: 11,
                  color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: `1px solid ${C.border}`, fontWeight: 600, minWidth: 80
                }}>
                  {ROLE_SHORT[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIVITIES.map((act, ai) => (
              <tr key={act.id} style={{
                background: ai % 2 === 0 ? 'transparent' : `${C.surface}88`
              }}>
                <td style={{
                  padding: '8px 12px', fontSize: 13, color: C.text,
                  borderBottom: `1px solid ${C.border}22`, whiteSpace: 'nowrap'
                }}>
                  {act.label}
                </td>
                {ROLES.map(role => {
                  const val = matrix[`${act.id}_${role}`]
                  const style = RACI_COLORS[val] || RACI_COLORS['']
                  return (
                    <td key={role} style={{ textAlign: 'center', padding: '6px 8px', borderBottom: `1px solid ${C.border}22` }}>
                      <div
                        onClick={() => cycleCell(act.id, role)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 32, height: 32, borderRadius: 6,
                          background: style.bg,
                          border: `1px solid ${val ? style.border : C.border}`,
                          color: style.text, fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', transition: 'all 0.15s',
                          userSelect: 'none'
                        }}
                        title={`${act.label} / ${role}: ${val || 'empty'} — click to cycle`}
                      >
                        {val || '·'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['R', 'Responsible (does the work)'], ['A', 'Accountable (owns outcome)'], ['C', 'Consulted (input needed)'], ['I', 'Informed (kept in loop)']].map(([v, label]) => {
          const s = RACI_COLORS[v]
          return (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
              <div style={{
                width: 22, height: 22, borderRadius: 4,
                background: s.bg, border: `1px solid ${s.border}`,
                color: s.text, fontWeight: 700, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {v}
              </div>
              {label}
            </div>
          )
        })}
      </div>

      {/* Cost calculator and summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Hours per role */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '14px 16px'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Estimated Hours/Week per Role
          </div>
          {roleHours.map(({ role, hours }) => (
            <div key={role} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{role}</span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: hours > 15 ? C.red : hours > 10 ? C.yellow : C.green
              }}>
                {hours}h
              </span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '14px 16px'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ownership Health Check
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            padding: '10px 12px', borderRadius: 8,
            background: overloaded > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${overloaded > 0 ? C.red : C.green}`
          }}>
            <span style={{ fontSize: 18 }}>{overloaded > 0 ? '⚠' : '✓'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: overloaded > 0 ? C.red : C.green }}>
                {overloaded > 0 ? `${overloaded} role${overloaded > 1 ? 's' : ''} overloaded` : 'No roles overloaded'}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {overloaded > 0 ? 'Roles with more than 3 R assignments' : 'All roles have manageable R counts'}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            background: noOwner > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${noOwner > 0 ? C.red : C.green}`
          }}>
            <span style={{ fontSize: 18 }}>{noOwner > 0 ? '⚠' : '✓'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: noOwner > 0 ? C.red : C.green }}>
                {noOwner > 0 ? `${noOwner} activit${noOwner > 1 ? 'ies' : 'y'} with no owner` : 'All activities have an owner'}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {noOwner > 0 ? 'Activities without any R assignment are at risk' : 'Every activity has an assigned owner (R)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
