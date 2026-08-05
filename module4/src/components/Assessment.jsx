import { useState, useEffect } from 'react'
import questionBank from '../data/assessment-questions.json'

const C = {
  bg: '#0B1120', surface: '#131B2E', border: '#1E293B',
  text: '#E2E8F0', textDim: '#94A3B8', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
}

const SECTIONS = [
  { name: 'Decompose & Wave Planning', icon: '⊞' },
  { name: 'The Build Agent', icon: '◆' },
  { name: 'Deploy Agent & K8s Reconcile', icon: '◉' },
]

const SECTION_KEY_TO_INDEX = { A: 0, B: 1, C: 2 }

const QUESTIONS = questionBank.questions.map((q) => ({
  section: SECTION_KEY_TO_INDEX[q.section],
  q: q.q,
  options: q.options,
  answer: q.answer,
  explanation: q.explanation,
}))

const PASS_THRESHOLD = 11

function buildSequence() {
  const seq = []
  for (let s = 0; s < SECTIONS.length; s++) {
    seq.push({ type: 'section', section: s })
    QUESTIONS.filter((q) => q.section === s).forEach((q) => {
      const indices = q.options.map((_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      seq.push({
        type: 'question',
        question: { ...q, options: indices.map((i) => q.options[i]), answer: indices.indexOf(q.answer) },
        globalIdx: QUESTIONS.indexOf(q),
      })
    })
  }
  return seq
}

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function IntroScreen({ onStart, name, setName }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
      <h2 style={{ color: C.text, fontSize: 28, marginBottom: 8 }}>Build &amp; Deploy Assessment</h2>
      <p style={{ color: C.accent, fontSize: 16, marginBottom: 24 }}>Decompose, Build, Deploy</p>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        15 questions across 3 sections testing your grasp of wave-parallel decomposition,
        the Build Agent's per-component code generation, and containerised deployment
        with health-gated K8s rollout.
        Pass threshold: {PASS_THRESHOLD}/{QUESTIONS.length} ({Math.round((PASS_THRESHOLD / QUESTIONS.length) * 100)}%).
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Your name (for certificate)"
        data-testid="name-input"
        style={{ width: '100%', maxWidth: 300, padding: '10px 14px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14,
          marginBottom: 16, outline: 'none', textAlign: 'center' }}
      />
      <br />
      <button onClick={onStart} disabled={!name.trim()}
        data-testid="begin-btn"
        style={{ background: C.accent, color: '#fff', border: 'none', padding: '12px 32px',
          borderRadius: 6, fontSize: 15, cursor: name.trim() ? 'pointer' : 'default',
          opacity: name.trim() ? 1 : 0.5 }}>
        Begin Assessment
      </button>
    </div>
  )
}

function SectionHeader({ section, questionCount }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{section.icon}</div>
      <h2 style={{ color: C.text, fontSize: 24 }}>Section: {section.name}</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginTop: 8 }}>{questionCount} questions</p>
    </div>
  )
}

function QuestionScreen({ q, qNum, total, selected, setSelected, revealed, onReveal, onNext }) {
  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '20px 30px' }}>
      <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>
        Question {qNum} of {total}
      </div>
      <p style={{ color: C.text, fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}>{q.q}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {q.options.map((opt, i) => {
          let bg = C.surface
          let borderColor = C.border
          if (revealed) {
            if (i === q.answer) { bg = `${C.green}15`; borderColor = C.green }
            else if (i === selected && i !== q.answer) { bg = `${C.red}15`; borderColor = C.red }
          } else if (i === selected) {
            bg = `${C.accent}15`; borderColor = C.accent
          }

          return (
            <div key={i} onClick={() => !revealed && setSelected(i)}
              data-testid={`opt-${i}`}
              style={{
                background: bg, border: `1px solid ${borderColor}`, borderRadius: 6,
                padding: '12px 16px', cursor: revealed ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}>
              <span style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{opt}</span>
            </div>
          )
        })}
      </div>

      {!revealed && selected !== null && (
        <button onClick={onReveal}
          data-testid="reveal-btn"
          style={{ background: C.accent, color: '#fff', border: 'none', padding: '10px 24px',
            borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          Reveal Answer
        </button>
      )}

      {revealed && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: selected === q.answer ? `${C.green}10` : `${C.red}10`,
            border: `1px solid ${selected === q.answer ? C.green : C.red}33`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 16,
          }}>
            <p style={{ color: selected === q.answer ? C.green : C.red, fontSize: 13, margin: '0 0 4px',
              fontWeight: 600 }}>
              {selected === q.answer ? 'Correct!' : 'Incorrect'}
            </p>
            <p style={{ color: C.textDim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {q.explanation}
            </p>
          </div>
          <button onClick={onNext}
            data-testid="next-btn"
            style={{ background: C.accent, color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

async function downloadCertPDF({ title, subtitle, name, body, fields }) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, H = 210
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, H, 'F')

  // Vector watermark: tiled diagonal-line pattern, drawn before the border.
  // Intentional deviation from Module 3 (which tiles a base64 PNG logo) — see
  // design doc's "Intentional deviation: no watermark image" section. Do not
  // port that blob here.
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.08 }))
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.25)
  for (let gx = 0; gx < W + H; gx += 25) {
    doc.line(gx, 0, gx - H, H)
  }
  doc.restoreGraphicsState()

  doc.setDrawColor(232, 168, 56); doc.setLineWidth(0.5); doc.rect(12, 12, W - 24, H - 24); doc.rect(15, 15, W - 30, H - 30)
  const cLen = 8
  ;[[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]].forEach(([x, y, dx, dy]) => {
    doc.line(x, y, x + cLen * dx, y); doc.line(x, y, x, y + cLen * dy)
  })
  doc.setTextColor(232, 168, 56); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), W / 2, 38, { align: 'center' })
  doc.setTextColor(138, 150, 167); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(subtitle.toUpperCase(), W / 2, 45, { align: 'center' })
  doc.setTextColor(138, 150, 167); doc.setFontSize(10); doc.text('This certifies that', W / 2, 60, { align: 'center' })
  doc.setTextColor(226, 232, 240); doc.setFontSize(28); doc.setFont('helvetica', 'bold')
  doc.text(name, W / 2, 75, { align: 'center' })
  doc.setDrawColor(232, 168, 56); doc.setLineWidth(0.3); doc.line(W / 2 - 20, 82, W / 2 + 20, 82)
  doc.setTextColor(138, 150, 167); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(doc.splitTextToSize(body, 180), W / 2, 92, { align: 'center', lineHeightFactor: 1.6 })
  const fieldY = 135, fieldSpacing = W / (fields.length + 1)
  fields.forEach((f, i) => {
    const x = fieldSpacing * (i + 1)
    doc.setTextColor(74, 85, 104); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text(f.label.toUpperCase(), x, fieldY, { align: 'center' })
    doc.setTextColor(226, 232, 240); doc.setFontSize(11); doc.text(f.value, x, fieldY + 7, { align: 'center' })
  })
  doc.setTextColor(50, 60, 80); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.text('This certificate was generated as part of the LLM Engineering Course', W / 2, H - 20, { align: 'center' })
  doc.save(`${name.replace(/\s+/g, '_')}_Certificate.pdf`)
}

function Certificate({ name, score, total, sectionScores }) {
  const pct = Math.round((score / total) * 100)
  const passed = score >= PASS_THRESHOLD
  const tier = pct >= 93 ? 'Distinction' : pct >= 73 ? 'Pass' : 'Below Threshold'
  // Stable per mount: capture impure Date.now() in a lazy useState init so
  // re-renders don't regenerate the ID mid-view.
  const [id] = useState(() => `ARCH-${hashCode(name + score)}-${Date.now().toString(36).toUpperCase()}`)

  // Persist completion once per mount, not during render. Same read/merge/write
  // shape as markPartComplete() in App.jsx — must not diverge.
  useEffect(() => {
    if (!passed) return
    try {
      const raw = localStorage.getItem('llm_course_progress')
      const progress = raw ? JSON.parse(raw) : {}
      progress.__v = 2
      progress.part4 = true
      localStorage.setItem('llm_course_progress', JSON.stringify(progress))
    } catch { /* ignore */ }
  }, [passed])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 30px' }}>
      <div style={{
        background: C.surface, border: `2px solid ${passed ? C.green : C.red}`,
        borderRadius: 12, padding: '40px 32px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{passed ? '◈' : '△'}</div>
        <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>
          {passed ? 'Certificate of Comprehension' : 'Assessment Result'}
        </h2>
        <p style={{ color: C.accent, fontSize: 14, marginBottom: 24 }}>
          Build &amp; Deploy — Decompose, Build, Deploy
        </p>

        <p style={{ color: C.text, fontSize: 20, fontWeight: 600, marginBottom: 4 }}
          data-testid="cert-name">{name}</p>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}
          data-testid="cert-score">
          Score: {score}/{total} ({pct}%) — {tier}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 12px', color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Section</th>
              <th style={{ textAlign: 'right', padding: '6px 12px', color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((sec, i) => {
              const sectionTotal = QUESTIONS.filter((q) => q.section === i).length
              return (
                <tr key={i}>
                  <td style={{ padding: '6px 12px', color: C.text, fontSize: 13,
                    borderBottom: `1px solid ${C.border}` }}>
                    {sec.icon} {sec.name}
                  </td>
                  <td style={{ padding: '6px 12px', color: C.text, fontSize: 13, textAlign: 'right',
                    borderBottom: `1px solid ${C.border}` }}>
                    {sectionScores[i]}/{sectionTotal}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p style={{ color: C.textDim, fontSize: 11 }}>Certificate ID: {id}</p>
        <p style={{ color: C.textDim, fontSize: 11 }}>
          Build &amp; Deploy — {new Date().toLocaleDateString()}
        </p>
      </div>

      {passed && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => downloadCertPDF({
              title: 'Certificate of Comprehension',
              subtitle: 'Build & Deploy — Decompose, Build, Deploy',
              name,
              body: 'has demonstrated engineering-level comprehension of spec decomposition into dependency-ordered build waves, per-component LLM code generation and project assembly, and containerised deployment to Kubernetes with health-gated rollout.',
              fields: [
                { label: 'Score', value: `${score} / ${total}` },
                { label: 'Percentage', value: `${pct}%` },
                { label: 'Result', value: tier },
                { label: 'Date', value: new Date().toLocaleDateString() },
                { label: 'Certificate ID', value: id },
              ],
            })}
            data-testid="download-pdf"
            style={{ background: 'none', color: C.textDim, border: `1px solid ${C.border}`,
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Download PDF
          </button>
        </div>
      )}
    </div>
  )
}

export default function Assessment() {
  const [phase, setPhase] = useState('intro')
  const [name, setName] = useState('')
  const [seqIdx, setSeqIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  // Sequence is computed once per mount. Math.random is impure, so build it in
  // a lazy useState init rather than useMemo (which the purity lint flags).
  const [sequence] = useState(() => buildSequence())

  const current = sequence[seqIdx]

  const handleNext = () => {
    if (current?.type === 'question' && selected !== null) {
      setAnswers((prev) => ({ ...prev, [current.globalIdx]: selected }))
    }
    setSelected(null)
    setRevealed(false)
    if (seqIdx < sequence.length - 1) {
      setSeqIdx(seqIdx + 1)
    } else {
      setPhase('done')
    }
  }

  if (phase === 'intro') {
    return <IntroScreen onStart={() => setPhase('sequence')} name={name} setName={setName} />
  }

  if (phase === 'done') {
    const questionSteps = sequence.filter((s) => s.type === 'question')
    const score = questionSteps.reduce((s, step) => s + (answers[step.globalIdx] === step.question.answer ? 1 : 0), 0)
    const sectionScores = SECTIONS.map((_, si) =>
      questionSteps.filter((step) => step.question.section === si)
        .reduce((s, step) => s + (answers[step.globalIdx] === step.question.answer ? 1 : 0), 0)
    )
    return <Certificate name={name} score={score} total={QUESTIONS.length} sectionScores={sectionScores} />
  }

  if (current.type === 'section') {
    const sectionQCount = QUESTIONS.filter((q) => q.section === current.section).length
    return (
      <div>
        <SectionHeader section={SECTIONS[current.section]} questionCount={sectionQCount} />
        <div style={{ textAlign: 'center' }}>
          <button onClick={handleNext}
            data-testid="start-section-btn"
            style={{ background: C.accent, color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Start Section
          </button>
        </div>
      </div>
    )
  }

  const qNum = Object.keys(answers).length + 1

  return (
    <QuestionScreen
      q={current.question}
      qNum={qNum}
      total={QUESTIONS.length}
      selected={selected}
      setSelected={setSelected}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      onNext={handleNext}
    />
  )
}
