import { useState } from 'react'
import { buildSequence, score, breakdownByPart, missedQuestions, isReady } from './lib/scoring'
import bank from './data/refresher-questions.json'

const C = {
  bg: '#0f172a', surface: '#1e293b', border: '#334155',
  text: '#E2E8F0', textDim: '#94A3B8', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444',
}

const S = {
  page: { background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  wrap: { maxWidth: 720, margin: '0 auto', padding: 16, boxSizing: 'border-box' },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: { minHeight: 44, background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', fontSize: 16, cursor: 'pointer' },
  dim: { color: C.textDim },
}

function optionStyle(i, q, selected, revealed) {
  let border = C.border
  if (revealed && i === q.answer) border = C.green
  else if (revealed && i === selected) border = C.red
  else if (!revealed && i === selected) border = C.accent
  return {
    display: 'block', width: '100%', minHeight: 44, textAlign: 'left', marginBottom: 8,
    background: C.bg, color: C.text, border: `2px solid ${border}`, borderRadius: 8,
    padding: '10px 14px', fontSize: 15, cursor: revealed ? 'default' : 'pointer',
  }
}

export default function App() {
  const [sequence, setSequence] = useState(() => buildSequence(bank.questions))
  const [phase, setPhase] = useState('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const total = sequence.length

  const choose = (i) => {
    setSelected(i)
    setAnswers((prev) => ({ ...prev, [sequence[index].id]: i }))
  }

  const next = () => {
    if (index + 1 < total) {
      setIndex(index + 1)
      setSelected(null)
      setRevealed(false)
    } else {
      setPhase('results')
    }
  }

  const retake = () => {
    setSequence(buildSequence(bank.questions))
    setAnswers({})
    setIndex(0)
    setSelected(null)
    setRevealed(false)
    setPhase('quiz')
  }

  let body
  if (phase === 'intro') {
    body = (
      <div style={S.card}>
        <h1 style={{ marginTop: 0 }}>Parts 1–3 Refresher</h1>
        <p style={S.dim}>
          {total} questions across Parts 1–3. Pick an answer, reveal the explanation, then move on.
          Your results show which slides to revisit before Parts 4 &amp; 5.
        </p>
        <button data-testid="start-btn" style={S.btn} onClick={() => setPhase('quiz')}>Start</button>
      </div>
    )
  } else if (phase === 'quiz') {
    const q = sequence[index]
    body = (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span data-testid="question-counter" style={S.dim}>Question {index + 1} of {total}</span>
          <span data-testid="part-label" style={{ color: C.accent }}>Part {q.part}</span>
        </div>
        <h2 data-testid="question-text" style={{ fontSize: 18, marginTop: 0 }}>{q.q}</h2>
        {q.options.map((opt, i) => (
          <button
            key={i}
            data-testid={`opt-${i}`}
            style={optionStyle(i, q, selected, revealed)}
            disabled={revealed}
            onClick={() => choose(i)}
          >{opt}</button>
        ))}
        {selected !== null && !revealed && (
          <button data-testid="reveal-btn" style={{ ...S.btn, marginTop: 8 }} onClick={() => setRevealed(true)}>Reveal answer</button>
        )}
        {revealed && (
          <>
            <div
              data-testid="explanation"
              style={{ marginTop: 8, padding: 12, borderRadius: 8, background: C.bg, borderLeft: `4px solid ${selected === q.answer ? C.green : C.red}` }}
            >{q.explanation}</div>
            <button data-testid="next-btn" style={{ ...S.btn, marginTop: 12 }} onClick={next}>
              {index + 1 < total ? 'Next' : 'See results'}
            </button>
          </>
        )}
      </div>
    )
  } else {
    const s = score(sequence, answers)
    const p = Math.round((s / total) * 100)
    const ready = isReady(s)
    const missed = missedQuestions(sequence, answers)
    body = (
      <>
        <div style={S.card}>
          <h2 style={{ marginTop: 0 }}>Results</h2>
          <div data-testid="score" style={{ fontSize: 24, fontWeight: 700 }}>Score: {s}/{total} ({p}%)</div>
          <div data-testid="verdict" style={{ marginTop: 8, color: ready ? C.green : C.red, fontWeight: 600 }}>
            {ready ? 'Ready for Parts 4 & 5' : 'Review recommended'}
          </div>
          <div style={{ marginTop: 16 }}>
            {breakdownByPart(sequence, answers).map((r) => (
              <div key={r.part} data-testid={`part-row-${r.part}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                <span>Part {r.part}</span>
                <span>{r.correct}/{r.total}</span>
                {r.flagged && (
                  <span style={{ background: C.red, color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>Review</span>
                )}
              </div>
            ))}
          </div>
          <button data-testid="retake-btn" style={{ ...S.btn, marginTop: 16 }} onClick={retake}>Retake</button>
        </div>
        {missed.length > 0 && (
          <div data-testid="missed-list">
            {missed.map((m) => (
              <div key={m.id} data-testid={`missed-item-${m.id}`} style={S.card}>
                <div style={{ fontWeight: 600 }}>{m.q}</div>
                <div style={{ color: C.green, marginTop: 6 }}>Correct answer: {m.correctAnswer}</div>
                <div style={{ ...S.dim, marginTop: 6 }}>Review: Part {m.part} — Slide {m.review.slideNumber}: {m.review.slideTitle}</div>
                <div style={{ marginTop: 6 }}>
                  <a href={m.href} style={{ color: C.accent }}>Open Part {m.part}</a>{' '}
                  <span style={S.dim}>(requires Part {m.part} unlocked)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>{body}</div>
    </div>
  )
}
