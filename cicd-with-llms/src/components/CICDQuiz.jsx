import { useState } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const SECTIONS = [
  'Pipeline Checkpoints',
  'Logging and Alerting',
  'Speed vs Safety Tradeoffs',
  'Ownership and Infrastructure',
]

const QUESTIONS = [
  // Section 1: Pipeline Checkpoints
  {
    id: 1, section: 0,
    question: 'What is the key difference between a hard checkpoint and a soft checkpoint in a CI/CD pipeline?',
    options: [
      'Hard checkpoints run on dedicated servers; soft checkpoints run in containers',
      'Hard checkpoints block pipeline progression on failure; soft checkpoints add warnings but allow continuation',
      'Hard checkpoints are for security; soft checkpoints are for performance',
      'Hard checkpoints require manual approval; soft checkpoints are fully automated'
    ],
    correct: 1,
    explanation: 'Hard checkpoints are binary gates — failure stops the pipeline. Soft checkpoints generate warnings or metrics but do not block progression. Examples: a failing unit test is a hard checkpoint; code coverage at 72% (target 80%) is a soft checkpoint.'
  },
  {
    id: 2, section: 0,
    question: 'Why is an LLM eval suite checkpoint considered different from a traditional unit test checkpoint?',
    options: [
      'LLM eval suites are faster than unit tests and should always be blocking',
      'LLM evals are deterministic and can replace all unit tests',
      'LLM evals assess quality of model outputs (e.g., structured JSON, response equivalence), not pass/fail correctness',
      'LLM evals only run in production, not in CI pipelines'
    ],
    correct: 2,
    explanation: 'LLM evals are not unit tests. They ask questions like "does the new model version produce equivalent quality?" or "does the model still return structured JSON?" — these are quality assessments, not binary pass/fail tests. A score of 94% vs 95% is meaningful; a unit test either passes or fails.'
  },
  {
    id: 3, section: 0,
    question: 'What is "checkpoint fatigue" and how should teams address it?',
    options: [
      'Engineers getting tired after running long pipelines; addressed by parallelizing stages',
      'Too many hard checkpoints slowing teams down; addressed by starting with 3-4 hard gates and earning the right to add more',
      'Checkpoints timing out due to slow servers; addressed by upgrading CI infrastructure',
      'Overlapping checkpoints catching the same bugs; addressed by deduplicating test cases'
    ],
    correct: 1,
    explanation: 'Checkpoint fatigue occurs when too many hard checkpoints slow a team to a halt. The solution is to start with a small number of high-value hard gates (lint, unit tests, security scan, build) and only add new hard checkpoints when a specific failure has escaped to production and proven its cost.'
  },

  // Section 2: Logging and Alerting
  {
    id: 4, section: 1,
    question: 'What is the primary benefit of structured logging (JSON) over unstructured string logs?',
    options: [
      'JSON logs are smaller in file size than string logs',
      'JSON logs are human-readable in terminals without tooling',
      'JSON logs are machine-parseable, enabling dashboards, cost tracking, and anomaly detection across large volumes',
      'JSON logs automatically encrypt sensitive data'
    ],
    correct: 2,
    explanation: 'Structured JSON logs are machine-parseable. When every log entry is a JSON object with consistent fields (timestamp, requestId, latency_ms, etc.), you can run queries, build dashboards, set up alerts, and detect regressions across millions of log entries. Unstructured strings require fragile regex parsing.'
  },
  {
    id: 5, section: 1,
    question: 'Which of the following is an LLM-specific field that should be included in structured logs but is not typically found in traditional web app logs?',
    options: [
      'response_time_ms and http_status',
      'user_id and session_token',
      'prompt_version, model_id, input_tokens, output_tokens, and finish_reason',
      'deployment_id and container_name'
    ],
    correct: 2,
    explanation: 'LLM-backed systems need additional log fields: prompt_version (to track which prompt template was used), model_id (which model version responded), input_tokens and output_tokens (for cost tracking), and finish_reason (to detect truncation or content filtering). These enable cost dashboards, quality regression detection, and prompt A/B testing.'
  },
  {
    id: 6, section: 1,
    question: 'What is the most effective approach to preventing alert fatigue in a production system?',
    options: [
      'Disable all alerts and rely on user-reported issues',
      'Send every log WARNING to the on-call engineer immediately',
      'Route all alerts to a Slack channel so the team can decide together',
      'Ruthlessly tier alerts by severity (P0/P1/P2/P3) and ensure P0 alerts require immediate human action while P3 is informational'
    ],
    correct: 3,
    explanation: 'Alert fatigue happens when everything is treated as critical, so nothing is. The solution is a strict severity tier system: P0 (system down, page immediately), P1 (data loss risk, page in 15 min), P2 (degraded, notify during business hours), P3 (informational, send to dashboard). If P0 pages don\'t require immediate human action, reduce their severity.'
  },

  // Section 3: Speed vs Safety Tradeoffs
  {
    id: 7, section: 2,
    question: 'According to research, teams using trunk-based development (short-lived branches, frequent merges to main) deploy how much more frequently than teams using long-lived feature branches?',
    options: [
      '2x more frequently',
      '10x more frequently',
      '208x more frequently',
      '5x more frequently'
    ],
    correct: 2,
    explanation: 'Teams using trunk-based development deploy approximately 208x more frequently (ZenML research data). Short-lived branches (under 1 day), frequent merges to main, and feature flags for work in progress eliminate the merge conflict and integration overhead that slows long-lived feature branches.'
  },
  {
    id: 8, section: 2,
    question: 'In a canary deployment, what percentage of traffic is initially routed to the new version?',
    options: [
      '50% — equal split between old and new',
      '100% — the new version replaces the old immediately',
      '5% — a small fraction while the majority stays on the stable version',
      '25% — a quarter of users get the new version'
    ],
    correct: 2,
    explanation: 'A canary deployment routes a small percentage of traffic (typically 1-10%, commonly 5%) to the new version while the majority stays on the stable version. The new version is monitored for error rate and latency. If metrics look good, traffic is gradually increased to 100%. If metrics degrade, the canary is automatically rolled back.'
  },
  {
    id: 9, section: 2,
    question: 'What is the recommended best practice for running LLM eval suites in CI/CD pipelines?',
    options: [
      'Run LLM evals on every pull request commit to catch regressions early',
      'Never run LLM evals in CI/CD — only run them manually before quarterly releases',
      'Run LLM evals on main branch merges, not every PR commit, due to their longer runtime',
      'Run LLM evals only in production via shadow deployment'
    ],
    correct: 2,
    explanation: 'LLM eval suites take significantly longer than unit tests (potentially 10-30 minutes vs seconds). Running them on every PR commit would severely slow developer velocity. The recommended approach is to run evals when code merges to main — this catches regressions before they reach production while not blocking every individual commit.'
  },

  // Section 4: Ownership and Infrastructure
  {
    id: 10, section: 3,
    question: 'At approximately what daily token volume does self-hosting LLM inference typically break even with managed API pricing?',
    options: [
      '100,000 tokens/day',
      '500,000 tokens/day',
      '2 million tokens/day',
      '50 million tokens/day'
    ],
    correct: 2,
    explanation: 'According to arXiv cost analysis, self-hosted LLM inference typically breaks even with managed APIs at approximately 2 million tokens per day, when engineering and operational overhead is factored in. Below that threshold, the cost of MLOps expertise, GPU management, and reliability engineering typically exceeds the per-token savings.'
  },
  {
    id: 11, section: 3,
    question: 'In a RACI matrix, what is the critical distinction between R (Responsible) and A (Accountable)?',
    options: [
      'R means the person wrote the code; A means the person reviewed it',
      'R means the person does the work; A means the person owns the outcome and is the single decision authority',
      'R means the role is required for the task; A means the role is optional',
      'R is for senior engineers; A is for junior engineers'
    ],
    correct: 1,
    explanation: 'R (Responsible) is the person or people who do the actual work — they can be multiple people. A (Accountable) is the single person who owns the outcome and is the ultimate decision authority. There should be exactly one A per activity. Multiple Rs can share work, but only one A makes the final call.'
  },
  {
    id: 12, section: 3,
    question: 'What does "the pipeline IS the product" mean in the context of CI/CD for software teams?',
    options: [
      'The CI/CD pipeline should be sold as a commercial product to generate revenue',
      'The pipeline automatically generates product requirements from code changes',
      'The CI/CD pipeline is as critical as the application itself and deserves the same investment, maintenance, and incident response',
      'Only the pipeline output (the build artifact) has value, not the pipeline itself'
    ],
    correct: 2,
    explanation: '"The pipeline IS the product" means treating your CI/CD infrastructure with the same rigor as your application. Pipeline failures should be treated as production incidents. Pipeline performance (how fast it gives feedback) affects developer velocity. A slow, flaky pipeline is technical debt that compounds over time — just like a slow, buggy application.'
  }
]

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 5)
}

export default function CICDQuiz() {
  const [phase, setPhase] = useState('quiz') // 'quiz' | 'results' | 'certificate'
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)

  const q = QUESTIONS[currentQ]
  const selectedAnswer = answers[q.id]
  const isAnswered = selectedAnswer !== undefined
  const isCorrect = selectedAnswer === q.correct

  const score = QUESTIONS.filter(q => answers[q.id] === q.correct).length
  const passed = score >= 9
  const tier = score >= 11 ? 'Distinction' : score >= 9 ? 'Pass' : 'Below Threshold'

  const certId = 'CICD-' + hashCode(`cicd-module6-${score}-${Date.now()}`)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const selectAnswer = (optIdx) => {
    if (isAnswered) return
    setAnswers(prev => ({ ...prev, [q.id]: optIdx }))
    setShowExplanation(true)
  }

  const nextQuestion = () => {
    setShowExplanation(false)
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(i => i + 1)
    } else {
      setPhase('results')
    }
  }

  const restart = () => {
    setAnswers({})
    setCurrentQ(0)
    setPhase('quiz')
    setShowExplanation(false)
  }

  const sectionProgress = SECTIONS.map((name, si) => {
    const sectionQs = QUESTIONS.filter(q => q.section === si)
    const answered = sectionQs.filter(q => answers[q.id] !== undefined).length
    const correct = sectionQs.filter(q => answers[q.id] === q.correct).length
    return { name, total: sectionQs.length, answered, correct }
  })

  if (phase === 'certificate') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 400, padding: 24
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          border: `2px solid ${C.accent}`,
          borderRadius: 16, padding: '40px 48px', maxWidth: 560, width: '100%',
          textAlign: 'center',
          boxShadow: `0 0 40px ${C.accent}33`
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <div style={{
            fontSize: 11, color: C.accent, letterSpacing: '0.2em',
            textTransform: 'uppercase', marginBottom: 16, fontWeight: 600
          }}>
            Certificate of Completion — Full Series
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Module 6: CI/CD Workflows for LLM Systems
          </h2>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Congratulations! You have completed all 6 modules of the{' '}
            <span style={{ color: C.accent, fontWeight: 600 }}>How LLMs Work</span> series.
            You now hold a complete, practitioner-level understanding of LLM engineering —
            from model internals to production CI/CD pipelines.
          </p>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 28,
            padding: '16px 24px', background: 'rgba(59,130,246,0.08)',
            borderRadius: 10, border: `1px solid ${C.border}`
          }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{score}/12</div>
              <div style={{ fontSize: 11, color: C.muted }}>Score</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: tier === 'Distinction' ? C.yellow : C.green }}>
                {tier}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>Tier</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>{certId}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Certificate ID</div>
            </div>
          </div>

          <div style={{ color: C.muted, fontSize: 12, marginBottom: 24 }}>Issued: {today}</div>

          <button
            onClick={restart}
            style={{
              background: C.surface, color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 13
            }}
          >
            Retake Quiz
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div style={{ padding: 8, maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Quiz Results</h2>

        <div style={{
          background: passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `2px solid ${passed ? C.green : C.red}`,
          borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center'
        }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: passed ? C.green : C.red, marginBottom: 4 }}>
            {score} / 12
          </div>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 600 }}>
            {tier} — {passed ? 'Passed!' : 'Not yet passed (need 9/12)'}
          </div>
        </div>

        {/* Section breakdown */}
        <div style={{ marginBottom: 20 }}>
          {sectionProgress.map((s, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {s.correct}/{s.total} correct
                </div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: `2px solid ${s.correct === s.total ? C.green : s.correct >= 2 ? C.yellow : C.red}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                color: s.correct === s.total ? C.green : s.correct >= 2 ? C.yellow : C.red
              }}>
                {s.correct}/{s.total}
              </div>
            </div>
          ))}
        </div>

        {/* Per-question review */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Question Review
          </div>
          {QUESTIONS.map(q => {
            const userAnswer = answers[q.id]
            const correct = userAnswer === q.correct
            return (
              <div key={q.id} style={{
                background: C.surface, border: `1px solid ${correct ? C.green : C.red}22`,
                borderLeft: `3px solid ${correct ? C.green : C.red}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>Q{q.id} — {SECTIONS[q.section]}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: correct ? C.green : C.red }}>
                    {correct ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>{q.question}</div>
                {!correct && (
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                    <span style={{ color: C.green, fontWeight: 600 }}>Correct: </span>
                    {q.options[q.correct]}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {passed && (
            <button
              onClick={() => setPhase('certificate')}
              style={{
                background: C.green, color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
                fontSize: 14, fontWeight: 700
              }}
            >
              View Certificate
            </button>
          )}
          <button
            onClick={restart}
            style={{
              background: C.surface, color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 13
            }}
          >
            {passed ? 'Retake Quiz' : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  // Quiz phase
  const currentSection = SECTIONS[q.section]
  const qInSection = QUESTIONS.filter(qq => qq.section === q.section).indexOf(q) + 1
  const totalInSection = QUESTIONS.filter(qq => qq.section === q.section).length
  const progress = ((currentQ) / QUESTIONS.length) * 100

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 8 }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            Question {currentQ + 1} of {QUESTIONS.length}
          </span>
          <span style={{ fontSize: 12, color: C.muted }}>
            {Object.keys(answers).length} answered
          </span>
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
          <div style={{
            height: '100%', background: C.accent, borderRadius: 2,
            width: `${progress}%`, transition: 'width 0.3s'
          }} />
        </div>
      </div>

      {/* Section label */}
      <div style={{
        fontSize: 11, color: C.accent, textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600
      }}>
        Section {q.section + 1}: {currentSection} — Q{qInSection}/{totalInSection}
      </div>

      {/* Question */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '20px 24px', marginBottom: 16
      }}>
        <p style={{ fontSize: 15, color: C.text, lineHeight: 1.65, fontWeight: 500 }}>
          {q.question}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.options.map((opt, i) => {
          let borderColor = C.border
          let bgColor = C.surface
          let textColor = C.text

          if (isAnswered) {
            if (i === q.correct) {
              borderColor = C.green
              bgColor = 'rgba(16,185,129,0.08)'
              textColor = C.green
            } else if (i === selectedAnswer) {
              borderColor = C.red
              bgColor = 'rgba(239,68,68,0.08)'
              textColor = C.red
            } else {
              textColor = C.muted
            }
          }

          return (
            <div
              key={i}
              onClick={() => selectAnswer(i)}
              style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 8, padding: '12px 16px',
                cursor: isAnswered ? 'default' : 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                transition: 'all 0.15s'
              }}
              onMouseOver={e => {
                if (!isAnswered) e.currentTarget.style.borderColor = C.accent
              }}
              onMouseOut={e => {
                if (!isAnswered) e.currentTarget.style.borderColor = C.border
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `1px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: textColor, flexShrink: 0
              }}>
                {isAnswered && i === q.correct ? '✓' : isAnswered && i === selectedAnswer ? '✗' : String.fromCharCode(65 + i)}
              </div>
              <span style={{ fontSize: 14, color: textColor, lineHeight: 1.5 }}>{opt}</span>
            </div>
          )
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div style={{
          background: isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${isCorrect ? C.green : C.red}`,
          borderRadius: 10, padding: '14px 18px', marginBottom: 16
        }}>
          <div style={{
            fontWeight: 700, color: isCorrect ? C.green : C.red,
            marginBottom: 6, fontSize: 13
          }}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
            {q.explanation}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {QUESTIONS.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === currentQ ? C.accent
                : answers[QUESTIONS[i].id] === QUESTIONS[i].correct ? C.green
                : answers[QUESTIONS[i].id] !== undefined ? C.red
                : C.border
            }} />
          ))}
        </div>
        {isAnswered && (
          <button
            onClick={nextQuestion}
            style={{
              background: C.accent, color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600
            }}
          >
            {currentQ < QUESTIONS.length - 1 ? 'Next Question →' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  )
}
