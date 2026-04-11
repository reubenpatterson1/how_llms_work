import { useState, useMemo } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const SECTIONS = [
  'Pull vs Push Deployment',
  'Code and Prompt Versioning',
  'Environment Variables and Secrets',
  'Auto-Scaling and LLM Infrastructure'
]

const QUESTIONS = [
  // Section 1: Pull vs Push Deployment
  {
    id: 1, section: 0,
    question: 'In a push deployment model, who is the active actor that deploys the new version?',
    options: [
      'An in-cluster operator that watches the registry',
      'The CI/CD system, which builds and pushes the artifact after tests pass',
      'The developer, who manually runs a deployment script',
      'A cron job that checks for new Docker images'
    ],
    correct: 1,
    explanation: 'In push deployment, the CI/CD pipeline is the actor — it actively builds, tests, and pushes the artifact to the target environment after all checks pass.'
  },
  {
    id: 2, section: 0,
    question: 'What is the primary security advantage of pull-based (GitOps) deployment over push deployment?',
    options: [
      'Pull deployments are always faster than push deployments',
      'Pull requires no authentication at all',
      'Credentials stay in-cluster; a compromised CI system cannot directly reach production',
      'Pull deployments skip automated testing for speed'
    ],
    correct: 2,
    explanation: 'In pull deployments, the operator runs inside the cluster and reaches out to the registry — the CI system never needs credentials to access production, reducing blast radius if CI is compromised.'
  },
  {
    id: 3, section: 0,
    question: 'Which term describes the approach where the target environment continuously reconciles its actual state against a desired state stored in a Git repository?',
    options: [
      'Blue-green deployment',
      'GitOps',
      'Canary release',
      'Feature flagging'
    ],
    correct: 1,
    explanation: 'GitOps is the practice of using Git as the single source of truth for desired system state, with operators (like ArgoCD or Flux) continuously reconciling actual vs desired.'
  },

  // Section 2: Versioning
  {
    id: 4, section: 1,
    question: 'According to semantic versioning, when should you increment the MAJOR version number?',
    options: [
      'When you add a new feature that does not break existing API consumers',
      'When you fix a bug without adding new functionality',
      'When you make a breaking change that requires consumers to update',
      'Every time you deploy to production, regardless of changes'
    ],
    correct: 2,
    explanation: 'MAJOR version bumps signal breaking changes. MINOR is for new backward-compatible features. PATCH is for backward-compatible bug fixes.'
  },
  {
    id: 5, section: 1,
    question: 'Why is it important to version-control LLM prompts alongside application code?',
    options: [
      'Prompts are too large to store in environment variables',
      'A change to a system prompt can silently break LLM outputs, and version history enables rollback',
      'Anthropic requires all prompts to be stored in Git',
      'Prompts contain secrets that need to be audited'
    ],
    correct: 1,
    explanation: 'Prompts are code — changing a system prompt can drastically alter LLM behavior with no compile-time error. Versioning them alongside code makes regressions traceable and rollback possible.'
  },
  {
    id: 6, section: 1,
    question: 'Why should you pin to a specific model version (e.g., "claude-sonnet-4-20250514") rather than a floating alias (e.g., "claude-sonnet-4")?',
    options: [
      'Specific versions are cheaper to call',
      'Floating aliases may resolve to a newer model that behaves differently, breaking your app silently',
      'Anthropic no longer supports floating aliases',
      'Specific versions have higher rate limits'
    ],
    correct: 1,
    explanation: 'Floating aliases can silently resolve to a newer model version after a provider update. Pinning ensures reproducible behavior and lets you control when you upgrade.'
  },

  // Section 3: Environment Variables and Secrets
  {
    id: 7, section: 2,
    question: 'An API key is hardcoded directly into a JavaScript source file and committed to a public GitHub repository. What is the most immediate risk?',
    options: [
      'The app will fail to compile',
      'The key is now public and can be scraped by bots within minutes, potentially running up large charges',
      'The key will be automatically rotated by the cloud provider',
      'The ESLint rules will flag it as a syntax error'
    ],
    correct: 1,
    explanation: 'Hardcoded credentials in public repos are scraped by automated bots within minutes. Even in private repos, the credential appears in git history permanently unless the history is rewritten.'
  },
  {
    id: 8, section: 2,
    question: 'What is the purpose of a .env.example file?',
    options: [
      'It stores the actual production credentials encrypted',
      'It documents required environment variables with placeholder values, safe to commit, so developers know what to configure',
      'It is automatically loaded by Vite as the default configuration',
      'It is used by Docker to inject secrets at container startup'
    ],
    correct: 1,
    explanation: '.env.example documents the shape of required config with placeholder values. It\'s committed to the repo so new developers know what variables to set. The actual .env.local (with real values) stays gitignored.'
  },
  {
    id: 9, section: 2,
    question: 'What advantage do secrets managers (AWS Secrets Manager, HashiCorp Vault) provide over plain environment variables?',
    options: [
      'Secrets managers are free and have no usage costs',
      'Secrets are fetched at runtime, never stored statically, and can be rotated without redeployment',
      'Secrets managers automatically generate stronger passwords',
      'Environment variables cannot store values longer than 256 characters'
    ],
    correct: 1,
    explanation: 'Secrets managers fetch credentials at runtime, support zero-downtime rotation, provide audit logs of access, and never require a redeployment to update a rotated credential.'
  },

  // Section 4: Auto-Scaling and LLM Infrastructure
  {
    id: 10, section: 3,
    question: 'For an LLM inference service, which metric is a better auto-scaling trigger than CPU utilization?',
    options: [
      'Disk I/O rate',
      'Number of open TCP connections',
      'Request queue depth or time-to-first-token (TTFT)',
      'Memory swap usage'
    ],
    correct: 2,
    explanation: 'LLM inference is compute-heavy and bursty. Queue depth reflects actual user wait time more accurately than CPU, which may be pegged even when serving slowly. TTFT directly measures user experience.'
  },
  {
    id: 11, section: 3,
    question: 'Why is stateless application design a prerequisite for effective horizontal auto-scaling?',
    options: [
      'Stateless apps use less memory per instance',
      'If state is held in memory on one instance, scaling to multiple instances creates inconsistency — each new pod won\'t have the same state',
      'Cloud providers only support autoscaling for stateless apps',
      'Stateless apps can be deployed without containers'
    ],
    correct: 1,
    explanation: 'Horizontal scaling adds identical instances. If user state (like selected city) lives in memory on one pod, requests routed to a different pod will see different state. Stateless design — where state comes from the request or a shared store — is required.'
  },
  {
    id: 12, section: 3,
    question: 'Your LLM-backed app has reached its maximum pod count and is still receiving requests above capacity. What is the correct graceful degradation behavior?',
    options: [
      'Return HTTP 500 errors so the load balancer retries elsewhere',
      'Crash the pod and let Kubernetes restart it',
      'Return cached or degraded responses (e.g., last known data) rather than failing completely',
      'Increase the max pod count automatically without any budget check'
    ],
    correct: 2,
    explanation: 'Graceful degradation means serving a reduced but functional response rather than failing outright. For a weather app, returning cached weather data is far better than a 500 error. Users should never see a blank screen at scale ceiling.'
  }
]

const PASS_THRESHOLD = 9
const CERT_PREFIX = 'DLLM-'

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 5)
}

async function downloadCertPDF({ title, subtitle, name, body, fields, watermark = "LLM ENGINEERING COURSE" }) {
  if (!window.jspdf) { await new Promise((resolve, reject) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); }); }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); const W = 297, H = 210;
  doc.setFillColor(15,23,42); doc.rect(0,0,W,H,"F");
  doc.setTextColor(30,41,59); doc.setFontSize(28); doc.setFont("helvetica","bold");
  for (let y = -50; y < H+50; y += 40) for (let x = -100; x < W+100; x += 160) doc.text(watermark, x, y, { angle: 30 });
  doc.setDrawColor(232,168,56); doc.setLineWidth(0.5); doc.rect(12,12,W-24,H-24); doc.rect(15,15,W-30,H-30);
  [[18,18,1,1],[W-18,18,-1,1],[18,H-18,1,-1],[W-18,H-18,-1,-1]].forEach(([x,y,dx,dy])=>{doc.line(x,y,x+8*dx,y);doc.line(x,y,x,y+8*dy);});
  doc.setTextColor(232,168,56); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(title.toUpperCase(), W/2, 38, { align: "center" });
  doc.setTextColor(138,150,167); doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.text(subtitle.toUpperCase(), W/2, 45, { align: "center" });
  doc.setTextColor(138,150,167); doc.setFontSize(10); doc.text("This certifies that", W/2, 60, { align: "center" });
  doc.setTextColor(226,232,240); doc.setFontSize(28); doc.setFont("helvetica","bold"); doc.text(name, W/2, 75, { align: "center" });
  doc.setDrawColor(232,168,56); doc.setLineWidth(0.3); doc.line(W/2-20,82,W/2+20,82);
  doc.setTextColor(138,150,167); doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.text(doc.splitTextToSize(body,180), W/2, 92, { align: "center", lineHeightFactor: 1.6 });
  const fY=135, fS=W/(fields.length+1); fields.forEach((f,i)=>{const x=fS*(i+1); doc.setTextColor(74,85,104); doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.text(f.label.toUpperCase(),x,fY,{align:"center"}); doc.setTextColor(226,232,240); doc.setFontSize(11); doc.text(f.value,x,fY+7,{align:"center"});});
  doc.setTextColor(50,60,80); doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.text("This certificate was generated as part of the LLM Engineering Course", W/2, H-20, { align: "center" });
  doc.save(`${name.replace(/\s+/g,"_")}_Certificate.pdf`);
}

export default function DeployingQuiz() {
  const [phase, setPhase] = useState('quiz') // quiz | results | certificate
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)

  // Shuffle option order once per mount
  const shuffledQuestions = useMemo(() => QUESTIONS.map(q => {
    const indices = q.options.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return { ...q, options: indices.map(i => q.options[i]), correct: indices.indexOf(q.correct) };
  }), []);

  const question = shuffledQuestions[current]
  const total = QUESTIONS.length
  const answered = answers[question.id]

  const score = shuffledQuestions.filter(q => answers[q.id] === q.correct).length

  const getTier = (s) => {
    if (s >= 11) return 'Distinction'
    if (s >= PASS_THRESHOLD) return 'Pass'
    return 'Below Threshold'
  }

  const handleAnswer = (optIdx) => {
    if (answered !== undefined) return
    setAnswers(a => ({ ...a, [question.id]: optIdx }))
    setShowExplanation(true)
  }

  const handleNext = () => {
    setShowExplanation(false)
    if (current < total - 1) {
      setCurrent(c => c + 1)
    } else {
      setPhase('results')
    }
  }

  const certId = CERT_PREFIX + hashCode(`deploying-with-llms-${score}-${Date.now()}`)
  const tier = getTier(score)
  const passed = score >= PASS_THRESHOLD

  if (phase === 'certificate') {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: C.surface, borderRadius: '16px',
          border: `2px solid ${C.green}`,
          padding: '40px', maxWidth: '520px', width: '100%',
          textAlign: 'center',
          boxShadow: `0 0 40px ${C.green}22`
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎓</div>
          <h2 style={{ color: C.green, fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            Certificate of Completion
          </h2>
          <p style={{ color: C.muted, fontSize: '14px', marginBottom: '24px' }}>
            How to Deploy with LLMs — Module 5 of 6
          </p>
          <div style={{
            padding: '20px', background: C.bg, borderRadius: '12px',
            border: `1px solid ${C.border}`, marginBottom: '24px'
          }}>
            <p style={{ color: C.text, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Score: {score}/{total}
            </p>
            <p style={{ color: C.green, fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              {tier}
            </p>
            <p style={{ color: C.muted, fontSize: '12px', fontFamily: 'monospace' }}>
              Certificate ID: {certId}
            </p>
            <p style={{ color: C.muted, fontSize: '12px', marginTop: '4px' }}>
              Issued: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => {
              const n = prompt("Enter your name for the certificate:");
              if (n) downloadCertPDF({ title: "Certificate of Completion", subtitle: "Deploying with LLMs \u2014 Module 5", name: n, body: "has demonstrated comprehension of deployment strategies, environment management, versioning, pull/push deploy patterns, and auto-scaling for LLM-generated applications.", fields: [{ label: "Score", value: `${score}/${total}` }, { label: "Result", value: tier }, { label: "Date", value: new Date().toLocaleDateString() }, { label: "Certificate ID", value: certId }] });
            }}
            style={{
              padding: '12px 28px', borderRadius: '8px', border: 'none',
              background: C.accent, color: '#fff',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%',
              marginBottom: '10px'
            }}
          >
            Download PDF Certificate
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const sectionScores = SECTIONS.map((_, si) => {
      const sectionQs = shuffledQuestions.filter(q => q.section === si)
      const correct = sectionQs.filter(q => answers[q.id] === q.correct).length
      return { name: SECTIONS[si], correct, total: sectionQs.length }
    })

    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '52px', marginBottom: '8px' }}>
              {passed ? '✅' : '📚'}
            </div>
            <h2 style={{ color: passed ? C.green : C.yellow, fontSize: '24px', fontWeight: 700 }}>
              {passed ? `${tier}!` : 'Keep Studying'}
            </h2>
            <p style={{ color: C.muted, marginTop: '6px' }}>
              You scored {score}/{total} — {passed ? 'threshold met' : `need ${PASS_THRESHOLD} to pass`}
            </p>
          </div>

          {/* Section breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {sectionScores.map((ss, i) => (
              <div key={i} style={{
                background: C.surface, borderRadius: '10px',
                border: `1px solid ${C.border}`, padding: '14px 18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: C.text, fontSize: '14px', fontWeight: 600 }}>{ss.name}</span>
                  <span style={{ color: ss.correct === ss.total ? C.green : C.yellow, fontWeight: 700 }}>
                    {ss.correct}/{ss.total}
                  </span>
                </div>
                <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(ss.correct / ss.total) * 100}%`,
                    background: ss.correct === ss.total ? C.green : C.accent,
                    borderRadius: '2px'
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Per-question review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {shuffledQuestions.map(q => {
              const userAns = answers[q.id]
              const correct = userAns === q.correct
              return (
                <div key={q.id} style={{
                  padding: '12px 16px', borderRadius: '8px',
                  background: correct ? `${C.green}10` : `${C.red}10`,
                  border: `1px solid ${correct ? C.green : C.red}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: correct ? C.green : C.red, fontSize: '16px', flexShrink: 0 }}>
                      {correct ? '✓' : '✗'}
                    </span>
                    <div>
                      <p style={{ color: C.text, fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{q.question}</p>
                      {!correct && (
                        <p style={{ color: C.muted, fontSize: '12px' }}>
                          Correct: <span style={{ color: C.green }}>{q.options[q.correct]}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => { setAnswers({}); setCurrent(0); setPhase('quiz'); setShowExplanation(false) }}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px',
                border: `1px solid ${C.border}`, background: C.surface,
                color: C.text, fontSize: '14px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Retake Quiz
            </button>
            {passed && (
              <button
                onClick={() => setPhase('certificate')}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: 'none', background: C.green,
                  color: '#000', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Get Certificate
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Quiz phase
  const sectionName = SECTIONS[question.section]
  const progressInSection = QUESTIONS.filter((q, i) => q.section === question.section && i <= current).length
  const sectionTotal = QUESTIONS.filter(q => q.section === question.section).length

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: C.muted, fontSize: '13px' }}>Question {current + 1} of {total}</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{
              padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
              background: `${C.accent}22`, color: C.accent, border: `1px solid ${C.accent}`
            }}>{sectionName} · {progressInSection}/{sectionTotal}</span>
          </div>
          <span style={{ color: C.muted, fontSize: '13px' }}>
            {Object.keys(answers).length} answered
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: '4px', background: C.border, borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${((current + (answered !== undefined ? 1 : 0)) / total) * 100}%`,
            background: C.accent, transition: 'width 0.3s'
          }} />
        </div>

        {/* Question */}
        <div style={{
          background: C.surface, borderRadius: '12px',
          border: `1px solid ${C.border}`, padding: '24px', marginBottom: '16px'
        }}>
          <p style={{ color: C.text, fontSize: '16px', lineHeight: 1.6, fontWeight: 600 }}>
            {question.question}
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {question.options.map((opt, i) => {
            const isSelected = answered === i
            const isCorrect = i === question.correct
            let borderColor = C.border
            let bg = C.surface
            let textColor = C.text
            if (answered !== undefined) {
              if (isCorrect) { borderColor = C.green; bg = `${C.green}15`; textColor = C.green }
              else if (isSelected && !isCorrect) { borderColor = C.red; bg = `${C.red}15`; textColor = C.red }
            } else if (isSelected) {
              borderColor = C.accent; bg = C.accentGlow
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered !== undefined}
                style={{
                  padding: '14px 18px', borderRadius: '10px',
                  border: `2px solid ${borderColor}`,
                  background: bg, color: textColor,
                  fontSize: '14px', textAlign: 'left', cursor: answered !== undefined ? 'default' : 'pointer',
                  transition: 'all 0.2s', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '10px'
                }}
              >
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '12px', fontWeight: 700, marginTop: '1px'
                }}>
                  {answered !== undefined && isCorrect ? '✓' : answered !== undefined && isSelected ? '✗' : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div style={{
            background: answered === question.correct ? `${C.green}12` : `${C.yellow}12`,
            borderRadius: '10px',
            border: `1px solid ${answered === question.correct ? C.green : C.yellow}`,
            padding: '14px 18px', marginBottom: '16px'
          }}>
            <p style={{ color: answered === question.correct ? C.green : C.yellow, fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
              {answered === question.correct ? 'Correct!' : 'Not quite.'}
            </p>
            <p style={{ color: C.muted, fontSize: '13px', lineHeight: 1.6 }}>{question.explanation}</p>
          </div>
        )}

        {/* Navigation */}
        {answered !== undefined && (
          <button
            onClick={handleNext}
            style={{
              width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
              background: C.accent, color: '#fff',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {current < total - 1 ? 'Next Question →' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  )
}
