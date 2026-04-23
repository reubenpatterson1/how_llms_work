import { useState, useMemo } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import questionBank from '../data/assessment-questions.json'
import scenariosData from '../data/diagnostic-scenarios.json'
import SessionHygieneSimulator, { SIMULATOR_PRESETS } from './SessionHygieneSimulator.jsx'
import {
  gradeMCQ, gradeDiagnostic, overallResult, PASS_RULES,
} from '../lib/assessment.js'

const MCQ_KEY = Object.fromEntries(questionBank.questions.map((q) => [q.id, q.answer]))

export default function ContextSessionsAssessment() {
  const [phase, setPhase] = useState('mcq')  // mcq | diagnostic | results
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [mcqIndex, setMcqIndex] = useState(0)
  const [diagIndex, setDiagIndex] = useState(0)
  const [diagSubmissions, setDiagSubmissions] = useState({})

  const q = questionBank.questions[mcqIndex]
  const scenario = scenariosData.scenarios[diagIndex]

  function selectMCQ(choice) {
    setMcqAnswers((prev) => ({ ...prev, [q.id]: choice }))
  }
  function nextMCQ() {
    if (mcqIndex + 1 < questionBank.questions.length) setMcqIndex(mcqIndex + 1)
    else setPhase('diagnostic')
  }
  function nextDiag(submission) {
    setDiagSubmissions((prev) => ({ ...prev, [scenario.id]: submission }))
    if (diagIndex + 1 < scenariosData.scenarios.length) setDiagIndex(diagIndex + 1)
    else setPhase('results')
  }

  if (phase === 'mcq') return <MCQPhase q={q} index={mcqIndex} total={questionBank.questions.length}
    selected={mcqAnswers[q.id]} onSelect={selectMCQ} onNext={nextMCQ} />
  if (phase === 'diagnostic') return <DiagnosticPhase scenario={scenario} index={diagIndex}
    total={scenariosData.scenarios.length} onSubmit={nextDiag} />
  return <ResultsPhase mcqAnswers={mcqAnswers} diagSubmissions={diagSubmissions} />
}

function MCQPhase({ q, index, total, selected, onSelect, onNext }) {
  const answered = selected !== undefined
  const [revealed, setRevealed] = useState(false)
  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto', fontFamily: FONT_SANS }}>
      <div style={{ color: C.textDim, fontSize: 13, marginBottom: 8 }}>
        Question {index + 1} of {total} — Section {q.section}
      </div>
      <h3 style={{ color: C.text, fontSize: 18, marginBottom: 20, lineHeight: 1.5 }}>{q.q}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.options.map((opt, i) => {
          const isSel = selected === i
          const isCorrect = revealed && i === q.answer
          const isWrong = revealed && isSel && i !== q.answer
          const bd = isCorrect ? C.green : isWrong ? C.red : isSel ? C.accent : C.border
          return (
            <button key={i} onClick={() => !revealed && onSelect(i)}
              data-testid={`mcq-${q.id}-opt-${i}`}
              disabled={revealed}
              style={{ textAlign: 'left', padding: '10px 14px',
                background: isSel ? C.accentGlow : C.surface,
                border: `1px solid ${bd}`, color: C.text, borderRadius: 6,
                cursor: revealed ? 'default' : 'pointer', fontSize: 14 }}>
              <span style={{ color: C.accent, fontFamily: FONT_MONO, marginRight: 8 }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {revealed && (
        <div style={{ padding: '10px 14px', background: C.accentGlow,
          border: `1px solid ${C.accent}33`, borderRadius: 6, marginBottom: 16,
          fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          <strong style={{ color: C.accent }}>Rationale:</strong> {q.rationale}
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
            See slide {q.slideRef}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {!revealed ? (
          <button onClick={() => setRevealed(true)} disabled={!answered}
            data-testid="reveal-btn"
            style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
              border: 'none', borderRadius: 6, cursor: answered ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 600 }}>
            Reveal
          </button>
        ) : (
          <button onClick={() => { setRevealed(false); onNext() }}
            data-testid="next-btn"
            style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 14, fontWeight: 600 }}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}

function DiagnosticPhase({ scenario, index, total, onSubmit }) {
  const [diagnosisChoice, setDiagnosisChoice] = useState(null)
  const [fixChoice, setFixChoice] = useState(null)
  const [rationale, setRationale] = useState('')
  const [recallAchieved, setRecallAchieved] = useState(0)

  const diagnoses = scenariosData.diagnoses
  const fixes = scenariosData.fixes
  const correctDiagIdx = diagnoses.findIndex((d) => d.key === scenario.correctDiagnosis)
  const correctFixIdx = fixes.findIndex((f) => f.key === scenario.correctFix)

  function submit() {
    onSubmit({
      diagnosisChoice,
      fixChoice,
      recallAchieved,
      rationale,
      key: {
        diagnosis: correctDiagIdx,
        fix: correctFixIdx,
        recallTarget: scenario.recallTarget,
      },
    })
    setDiagnosisChoice(null)
    setFixChoice(null)
    setRationale('')
    setRecallAchieved(0)
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1000, margin: '0 auto', fontFamily: FONT_SANS }}>
      <div style={{ color: C.textDim, fontSize: 13, marginBottom: 4 }}>
        Diagnostic {index + 1} of {total}
      </div>
      <h3 style={{ color: C.text, fontSize: 18, margin: '0 0 12px 0' }}>{scenario.title}</h3>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
        {scenario.transcript}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Diagnose the failure:</div>
          {diagnoses.map((d, i) => (
            <label key={d.key} style={{ display: 'block', padding: 6, fontSize: 13,
              color: C.text, cursor: 'pointer' }}>
              <input type="radio" name="diag" value={i}
                checked={diagnosisChoice === i}
                onChange={() => setDiagnosisChoice(i)}
                data-testid={`diag-${scenario.id}-${i}`}
                style={{ marginRight: 8 }} />
              {d.label}
            </label>
          ))}
        </div>
        <div>
          <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Pick the fix:</div>
          {fixes.map((f, i) => (
            <label key={f.key} style={{ display: 'block', padding: 6, fontSize: 13,
              color: C.text, cursor: 'pointer' }}>
              <input type="radio" name="fix" value={i}
                checked={fixChoice === i}
                onChange={() => setFixChoice(i)}
                data-testid={`fix-${scenario.id}-${i}`}
                style={{ marginRight: 8 }} />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>
          Apply the fix in the simulator (target recall ≥ {(scenario.recallTarget * 100).toFixed(0)}%):
        </div>
        <div style={{ height: 380, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <SessionHygieneSimulator preset={scenario.preset} />
        </div>
        <label style={{ color: C.textDim, fontSize: 12, display: 'block', marginTop: 8 }}>
          Recall achieved (drag to record your simulator result):
        </label>
        <input type="range" min="0" max="1" step="0.01" value={recallAchieved}
          onChange={(e) => setRecallAchieved(+e.target.value)}
          data-testid={`recall-${scenario.id}`} style={{ width: '100%' }} />
        <span style={{ color: C.accent, fontFamily: FONT_MONO, fontSize: 12 }}>
          {(recallAchieved * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 6 }}>Explain (2-3 sentences):</div>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)}
          data-testid={`rationale-${scenario.id}`}
          style={{ width: '100%', minHeight: 60, background: C.surface,
            color: C.text, border: `1px solid ${C.border}`, borderRadius: 4,
            padding: 8, fontFamily: FONT_SANS, fontSize: 13 }} />
      </div>
      <button onClick={submit}
        disabled={diagnosisChoice === null || fixChoice === null}
        data-testid={`submit-${scenario.id}`}
        style={{ padding: '8px 20px', background: C.accent, color: '#0B1120',
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontSize: 14, fontWeight: 600, float: 'right' }}>
        Submit
      </button>
    </div>
  )
}

function ResultsPhase({ mcqAnswers, diagSubmissions }) {
  const mcqResult = useMemo(() => gradeMCQ(mcqAnswers, MCQ_KEY), [mcqAnswers])
  const diagResults = useMemo(() =>
    scenariosData.scenarios.map((s) => {
      const sub = diagSubmissions[s.id] ?? {}
      const key = sub.key ?? {
        diagnosis: scenariosData.diagnoses.findIndex((d) => d.key === s.correctDiagnosis),
        fix: scenariosData.fixes.findIndex((f) => f.key === s.correctFix),
        recallTarget: s.recallTarget,
      }
      return { id: s.id, ...gradeDiagnostic(sub, key) }
    }), [diagSubmissions])
  const diagAvg = diagResults.reduce((a, r) => a + r.total, 0) / diagResults.length
  const overall = overallResult({ mcqPercent: mcqResult.percent, diagnosticAvg: diagAvg })

  // Persist completion
  if (overall.passed) {
    try {
      const raw = localStorage.getItem('llm_course_progress')
      const progress = raw ? JSON.parse(raw) : {}
      progress.__v = 2
      progress.part3 = true
      localStorage.setItem('llm_course_progress', JSON.stringify(progress))
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto', fontFamily: FONT_SANS }}>
      <h2 style={{ color: C.text, fontSize: 26, marginBottom: 16 }}>Assessment Results</h2>
      <div style={{ padding: 20, background: overall.passed ? C.greenGlow : C.redGlow,
        border: `1px solid ${overall.passed ? C.green : C.red}`, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ color: overall.passed ? C.green : C.red, fontSize: 22, fontWeight: 700 }}
          data-testid="pass-banner">
          {overall.passed ? 'PASSED' : 'NOT YET PASSED'}
        </div>
        <div style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>
          Overall: {overall.overallPercent.toFixed(1)}% (need ≥ {PASS_RULES.overall}%)
          — Diagnostics: {diagAvg.toFixed(1)}% (need ≥ {PASS_RULES.diagnostic}%)
        </div>
      </div>
      <h3 style={{ color: C.text, fontSize: 18, marginBottom: 10 }}>Breakdown</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li style={{ color: C.textDim, fontSize: 14, marginBottom: 4 }}>
          MCQ: {mcqResult.correct}/{mcqResult.total} ({mcqResult.percent}%)
        </li>
        {diagResults.map((r) => (
          <li key={r.id} style={{ color: C.textDim, fontSize: 14, marginBottom: 4 }}>
            Diagnostic {r.id}: {r.total}/100 (D {r.breakdown.diagnosis}, F {r.breakdown.fix},
            R {r.breakdown.recall}, W {r.breakdown.rationale})
          </li>
        ))}
      </ul>
    </div>
  )
}
