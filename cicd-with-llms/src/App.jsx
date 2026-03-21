import { useState, useEffect, useCallback } from 'react'
import CheckpointPipeline from './components/CheckpointPipeline.jsx'
import LoggingAlertingViz from './components/LoggingAlertingViz.jsx'
import SpeedSafetyLitmus from './components/SpeedSafetyLitmus.jsx'
import OwnershipModel from './components/OwnershipModel.jsx'
import CICDQuiz from './components/CICDQuiz.jsx'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const SLIDES = [
  {
    id: 'title', type: 'text',
    title: 'CI/CD Workflows for LLM Systems',
    subtitle: 'Part 6 of 6: Automating the Path from Code to Production',
    body: 'CI/CD closes the loop. Every commit triggers a pipeline: test, build, scan, deploy. For LLM-backed systems, the pipeline needs new checkpoints — for prompts, model configs, and AI-specific failure modes.',
    bullets: [{ label: 'What we\'ll cover', desc: 'Pipeline checkpoints, structured logging and alerting, the speed vs safety tradeoff, and the make-vs-buy decision for LLM infrastructure' }]
  },
  {
    id: 'bridge', type: 'text',
    title: 'Completing the Methodology',
    subtitle: 'Modules 3-5 built the foundation — Module 6 automates it',
    body: 'We\'ve built with LLMs (Module 3), tested with LLMs (Module 4), and deployed with LLMs (Module 5). CI/CD is the mechanism that runs all of that automatically on every commit.',
    bullets: [
      { label: 'Without CI/CD', desc: 'Every deployment is a manual, error-prone ceremony. Humans forget steps. Staging drifts from production. Rollbacks are scary.' },
      { label: 'With CI/CD', desc: 'A push to main triggers the entire pipeline automatically. Tests run. Builds happen. Deployment happens. Rollback is a button click.' },
      { label: 'LLM additions', desc: 'LLM-backed apps add three new pipeline concerns: prompt eval checkpoints, model API health checks, and AI-specific observability.' }
    ]
  },
  {
    id: 'hello-world-recap', type: 'text',
    title: 'Our Running Example',
    subtitle: 'The Hello World Weather App — now fully deployed',
    body: 'We\'ve built, tested, and deployed the app. Now we\'re automating the path from any future code change to a live update in production.',
    bullets: [
      { label: 'Current state', desc: 'App is live on port 5177. Manual deploy process. No automated tests on commit. No structured logging.' },
      { label: 'Target state', desc: 'Push to main → pipeline runs → tests pass → deploy → monitoring active → alerts configured.' },
      { label: 'New complexity from LLMs', desc: 'If we add LLM features (smart city recommendations, AI weather summaries), the pipeline needs to eval prompt output quality before deploying.' }
    ]
  },
  {
    id: 'cicd-overview', type: 'text',
    title: 'The CI/CD Pipeline Architecture',
    subtitle: 'Six stages, two philosophies, one pipeline',
    body: 'A well-structured CI/CD pipeline has clear stages with explicit pass/fail gates at each checkpoint.',
    bullets: [
      { label: 'Stage 1: Commit', desc: 'Push triggers pipeline. Lint, type-check, and basic syntax validation. Fail fast on obvious errors.' },
      { label: 'Stage 2: Test', desc: 'Unit tests, integration tests, E2E tests. Coverage thresholds. LLM eval suite for prompt-dependent features.' },
      { label: 'Stage 3: Build', desc: 'Create deployment artifact (Docker image, static bundle). Version tag applied. Provenance recorded.' },
      { label: 'Stage 4: Security scan', desc: 'SAST, dependency audit, secret scanning. No hardcoded API keys. No known-vulnerable dependencies.' },
      { label: 'Stage 5: Deploy to staging', desc: 'Automated deploy to staging. Smoke tests run against staging. LLM API health check.' },
      { label: 'Stage 6: Deploy to prod', desc: 'Manual approval gate (or automated if staging passes all checks). Canary or blue-green rollout.' }
    ]
  },
  {
    id: 'checkpoints-intro', type: 'text',
    title: 'Pipeline Checkpoints',
    subtitle: 'Checkpoints are the gates that stop bad code from reaching production',
    body: 'A checkpoint is a step in the pipeline that can block progression. Hard checkpoints fail the pipeline; soft checkpoints add warnings.',
    bullets: [
      { label: 'Hard checkpoints', desc: 'Tests must pass. Security scan must pass. Build must succeed. These are binary — no exceptions.' },
      { label: 'Soft checkpoints', desc: 'Code coverage at 72% (target 80%). Bundle size +5KB. LLM response latency P95 slightly above baseline. These warn, not block.' },
      { label: 'LLM-specific checkpoints', desc: 'Prompt eval suite: \'does the model still return structured JSON?\' Regression: \'does the new model version produce equivalent quality?\' These are evals, not unit tests.' },
      { label: 'Checkpoint fatigue', desc: 'Too many hard checkpoints slow teams to a halt. The goal is to stop real failures, not to create process theater. Start with 3-4 hard gates.' }
    ]
  },
  {
    id: 'checkpoints-detail', type: 'text',
    title: 'Checkpoints for the Hello World App',
    subtitle: 'Concrete gates for our weather app pipeline',
    body: 'Let\'s define the specific checkpoints our app needs.',
    bullets: [
      { label: 'Checkpoint 1: Lint + Type Check', desc: 'ESLint must pass with zero errors. JSDoc types must be consistent. Fails fast in <30s.' },
      { label: 'Checkpoint 2: Unit + Integration Tests', desc: 'All fetchWeather unit tests pass. MockWeatherService integration test passes. Runtime: ~2min.' },
      { label: 'Checkpoint 3: Bundle Size Gate', desc: 'Vite build output must be under 500KB. LLM feature additions can silently inflate bundle size.' },
      { label: 'Checkpoint 4: API Health Check', desc: 'Ping api.weather.gov /points endpoint. Verify User-Agent auth returns 200. Fail deployment if the upstream API is down.' },
      { label: 'Checkpoint 5 (future LLM tier)', desc: 'Run 20 sample prompts against the new model config. Score must match or exceed baseline by ≥95%.' }
    ]
  },
  {
    id: 'checkpoint-viz', type: 'component',
    componentKey: 'CheckpointPipeline',
    title: 'Pipeline Checkpoint Visualizer'
  },
  {
    id: 'logging-intro', type: 'text',
    title: 'Logging and Alerting',
    subtitle: 'You can\'t fix what you can\'t see',
    body: 'Logging is the foundation of observability. For LLM-backed apps, structured logs need to capture not just HTTP requests but token counts, prompt IDs, model responses, and latency breakdowns.',
    bullets: [
      { label: 'Structured logging', desc: 'Log as JSON, not strings. Include: timestamp, request ID, user action, API endpoint, response time, HTTP status, token count (for LLM calls).' },
      { label: 'Log levels', desc: 'DEBUG (verbose, dev only), INFO (key events), WARN (degraded but not broken), ERROR (requires attention), FATAL (system down).' },
      { label: 'LLM-specific fields', desc: 'prompt_version, model_id, input_tokens, output_tokens, latency_ms, finish_reason. These enable cost dashboards and regression detection.' },
      { label: 'Centralized logging', desc: 'Logs must go somewhere searchable: Datadog, CloudWatch, Loki. Application logs + pipeline logs + model logs in one place.' }
    ]
  },
  {
    id: 'logging-detail', type: 'text',
    title: 'Alerting Strategy',
    subtitle: 'Alerts that wake you up should require human action',
    body: 'Alerting is the layer on top of logging that converts \'something happened\' into \'someone needs to know right now\'.',
    bullets: [
      { label: 'Alert fatigue', desc: 'If every alert is treated as critical, no alert is treated as critical. Ruthlessly prioritize. P0: system down. P1: data loss risk. P2: degraded. P3: informational.' },
      { label: 'LLM cost alerts', desc: 'Set a daily token budget. Alert at 80% consumed. Alert again at 95%. Block new requests at 100% (or switch to a cheaper model tier).' },
      { label: 'Quality degradation alerts', desc: 'If LLM eval score drops below threshold after a deploy, alert immediately. This is harder to detect than 500 errors but equally damaging.' },
      { label: 'Our Weather App alerts', desc: 'api.weather.gov error rate > 5% (upstream issue). Bundle size > 500KB (accidental dependency). All 5 city fetches fail simultaneously (API key expired).' }
    ]
  },
  {
    id: 'logging-viz', type: 'component',
    componentKey: 'LoggingAlertingViz',
    title: 'Logging and Alerting Dashboard'
  },
  {
    id: 'speed-safety-intro', type: 'text',
    title: 'Speed vs Safety Tradeoff',
    subtitle: 'Every pipeline decision is a point on the speed-safety curve',
    body: 'There is no perfect pipeline — only tradeoffs. The question is not \'how do we make it perfectly safe?\' but \'how much risk is acceptable for how much speed?\'.',
    bullets: [
      { label: 'Speed extreme', desc: 'No tests. Direct push to prod. Deploy in 30 seconds. Breaks constantly. Tech debt accumulates. OK for a one-day hackathon, catastrophic for production.' },
      { label: 'Safety extreme', desc: 'Every change needs 3 approvals, full regression suite, 48-hour staging soak, manual QA sign-off. Deploying once a month. Slow death by process.' },
      { label: 'The balance', desc: 'Fast tests (linting, unit tests) are blocking. Slow tests (E2E, load tests) run async and alert on failure. Manual gates only at prod boundary.' },
      { label: 'LLM consideration', desc: 'LLM eval suites take longer to run than unit tests. Running them on every commit may be too slow. Solution: run evals on main branch merges, not every PR.' }
    ]
  },
  {
    id: 'speed-safety-detail', type: 'text',
    title: 'Pipeline Design Patterns',
    subtitle: 'Patterns that preserve both speed and safety',
    body: 'These patterns are how high-performing teams ship quickly without breaking things.',
    bullets: [
      { label: 'Trunk-based development', desc: 'Short-lived feature branches (< 1 day). Merge to main frequently. Feature flags for work in progress. ZenML: teams using trunk-based dev deploy 208x more frequently.' },
      { label: 'Canary deployments', desc: 'Route 5% of traffic to new version. Watch error rates and latency for 15 minutes. Auto-promote or auto-rollback based on metrics.' },
      { label: 'Blue-green deployments', desc: 'Run old and new version simultaneously. Switch traffic in one operation. Instant rollback by switching back. More expensive but safer.' },
      { label: 'Async LLM evals', desc: 'Run full LLM eval suite in parallel with deployment. Don\'t block deployment on eval completion — but auto-rollback if eval fails post-deploy.' }
    ]
  },
  {
    id: 'speed-safety-viz', type: 'component',
    componentKey: 'SpeedSafetyLitmus',
    title: 'Speed vs Safety Decision Matrix'
  },
  {
    id: 'ownership-intro', type: 'text',
    title: 'Handing Off vs Self-Owning',
    subtitle: 'The build vs buy decision for LLM infrastructure',
    body: 'At some point, every team faces this question: do we manage our own LLM infrastructure, or do we pay someone else to do it?',
    bullets: [
      { label: 'Managed LLM APIs (LLMaaS)', desc: 'Anthropic API, OpenAI API. You call an endpoint, you get a response. You pay per token. No infrastructure management. Easy to start.' },
      { label: 'Self-hosted inference', desc: 'Run your own models on your own GPUs (or rented GPUs). Requires MLOps expertise. Higher fixed cost, lower marginal cost at scale.' },
      { label: 'Break-even', desc: 'Self-hosting breaks even at approximately 2M tokens/day (arXiv cost analysis). Below that, managed APIs are almost always cheaper when you factor in engineering costs.' },
      { label: 'Our Weather App', desc: 'We should use the Anthropic API. Our token volume is nowhere near 2M/day. The operational overhead of self-hosted inference would consume more engineering time than the token cost.' }
    ]
  },
  {
    id: 'ownership-detail', type: 'text',
    title: 'The RACI Model for LLM Operations',
    subtitle: 'Who is Responsible, Accountable, Consulted, and Informed for each activity',
    body: 'As LLM systems become critical infrastructure, clear ownership prevents \'everyone\'s job is no one\'s job\'.',
    bullets: [
      { label: 'Model selection', desc: 'R: ML Engineer. A: Tech Lead. C: Product. I: Everyone. Wrong: \'whoever wants to\' changes the model version.' },
      { label: 'Prompt management', desc: 'R: Developer who owns the feature. A: Tech Lead. C: ML Engineer (quality). I: Product.' },
      { label: 'Cost monitoring', desc: 'R: Platform/DevOps. A: Engineering Manager. C: All engineers who call LLM APIs. I: Finance.' },
      { label: 'Incident response', desc: 'R: On-call engineer. A: Engineering Manager. C: ML Engineer (if LLM-specific). I: Product, leadership.' },
      { label: 'Eval suite maintenance', desc: 'R: ML Engineer. A: Tech Lead. C: Developers writing prompt-dependent features. I: QA.' }
    ]
  },
  {
    id: 'ownership-viz', type: 'component',
    componentKey: 'OwnershipModel',
    title: 'RACI Ownership Model'
  },
  {
    id: 'takeaways', type: 'text',
    title: 'Key CI/CD Takeaways',
    subtitle: 'Five principles for automated, reliable LLM pipelines',
    body: 'These principles distill the most important lessons from building production CI/CD for LLM-backed systems.',
    bullets: [
      { label: '1. Checkpoints over ceremonies', desc: 'Automated gates catch more bugs than manual review processes. Start with 3-4 hard checkpoints and earn the right to add more.' },
      { label: '2. Structure your logs', desc: 'JSON logs with LLM-specific fields (token count, prompt version, model ID) are the foundation of every other observability capability.' },
      { label: '3. Balance speed and safety', desc: 'Fast gates block deployment. Slow gates run async. Manual approval only at the production boundary. LLM evals run on main merges, not every commit.' },
      { label: '4. Match ownership to your scale', desc: 'Managed APIs until 2M tokens/day. Self-hosted only with dedicated MLOps. Ambiguous ownership is a production incident waiting to happen.' },
      { label: '5. The pipeline IS the product', desc: 'For software teams, the CI/CD pipeline is as much a product as the app itself. Invest in it. Maintain it. Treat pipeline failures as production incidents.' }
    ]
  },
  {
    id: 'series-summary', type: 'text',
    title: 'The Complete Methodology',
    subtitle: 'Modules 1-6: A full-stack LLM engineering approach',
    body: 'You\'ve now completed a start-to-finish methodology for building, testing, deploying, and automating LLM-backed software systems.',
    bullets: [
      { label: 'Module 1: How LLMs Work', desc: 'Attention, hallucination, confidence landscapes, context limits' },
      { label: 'Module 2: Working with LLMs', desc: 'Density principle, 10-channel architecture, prompt patterns' },
      { label: 'Module 3: Building with LLMs', desc: 'Decomposition, parallelism, orchestration, cost optimization' },
      { label: 'Module 4: Testing with LLMs', desc: 'Functional, unit, E2E, happy path fallacy, load testing' },
      { label: 'Module 5: Deploying with LLMs', desc: 'Pull/push, versioning, environment secrets, auto-scaling' },
      { label: 'Module 6: CI/CD with LLMs', desc: 'Checkpoints, logging, speed/safety, ownership models' }
    ]
  },
  {
    id: 'quiz-intro', type: 'text',
    title: 'Module 6 Quiz',
    subtitle: 'Test your CI/CD knowledge',
    body: '12 questions across 4 sections. You need 9/12 (75%) to earn your certificate.',
    bullets: [
      { label: 'Section 1', desc: 'Pipeline Checkpoints' },
      { label: 'Section 2', desc: 'Logging and Alerting' },
      { label: 'Section 3', desc: 'Speed vs Safety Tradeoffs' },
      { label: 'Section 4', desc: 'Ownership and Infrastructure Decisions' }
    ]
  },
  {
    id: 'quiz', type: 'component',
    componentKey: 'CICDQuiz',
    title: 'Module 6 Quiz'
  },
  {
    id: 'series-complete', type: 'text',
    title: 'Series Complete!',
    subtitle: 'You\'ve mastered the full LLM engineering methodology',
    body: 'Congratulations — you\'ve completed all 6 modules. You now have a framework for thinking about every stage of LLM-backed software development, from model internals to production CI/CD.',
    bullets: [
      { label: 'What you\'ve earned', desc: '6 certificates, a complete mental model of LLM engineering, and a practical methodology you can apply to real projects.' },
      { label: 'Apply it', desc: 'The Hello World Weather App is your template. Pick a real project, decompose it with Module 3\'s framework, test it with Module 4\'s patterns, deploy it with Module 5\'s practices, and automate it with Module 6\'s pipelines.' },
      { label: 'Keep learning', desc: 'LLM capabilities are advancing rapidly. The methodology is stable; the models and tools will keep changing. Stay curious, stay rigorous.' }
    ]
    // NOTE: NO nextModuleUrl on this final slide
  }
]

const COMPONENT_MAP = {
  CheckpointPipeline,
  LoggingAlertingViz,
  SpeedSafetyLitmus,
  OwnershipModel,
  CICDQuiz,
}

function TextSlide({ slide, onNext, onPrev, current, total, nextModuleUrl }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, padding: '48px 64px', overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Module 6 · Slide {current} of {total}
        </span>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, color: C.text,
        lineHeight: 1.15, marginBottom: 12, letterSpacing: '-0.02em'
      }}>
        {slide.title}
      </h1>

      {/* Subtitle */}
      {slide.subtitle && (
        <p style={{ fontSize: 18, color: C.accent, marginBottom: 24, fontWeight: 500 }}>
          {slide.subtitle}
        </p>
      )}

      {/* Body */}
      {slide.body && (
        <p style={{
          fontSize: 16, color: C.muted, lineHeight: 1.75, marginBottom: 32,
          maxWidth: 760, borderLeft: `3px solid ${C.border}`, paddingLeft: 20
        }}>
          {slide.body}
        </p>
      )}

      {/* Bullets */}
      {slide.bullets && slide.bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800, flex: 1 }}>
          {slide.bullets.map((b, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '16px 20px',
              borderLeft: `3px solid ${C.accent}`
            }}>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 4, fontSize: 14 }}>
                {b.label}
              </div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}`
      }}>
        <button
          onClick={onPrev}
          disabled={current === 1}
          style={{
            background: current === 1 ? C.border : C.surface,
            color: current === 1 ? C.muted : C.text,
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '10px 24px', cursor: current === 1 ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 500
          }}
        >
          ← Prev
        </button>

        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 300, justifyContent: 'center' }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i + 1 === current ? C.accent : C.border,
              transition: 'background 0.2s'
            }} />
          ))}
        </div>

        {current === total ? (
          nextModuleUrl ? (
            <a
              href={nextModuleUrl}
              style={{
                background: C.green, color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '10px 24px', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8
              }}
            >
              Next Module →
            </a>
          ) : (
            <div style={{
              background: C.accentGlow, border: `1px solid ${C.accent}`,
              borderRadius: 8, padding: '10px 24px',
              fontSize: 14, fontWeight: 600, color: C.accent
            }}>
              Series Complete
            </div>
          )
        ) : (
          <button
            onClick={onNext}
            style={{
              background: C.accent, color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '10px 24px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600
            }}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}

function ComponentSlide({ slide, onNext, onPrev, current, total }) {
  const Comp = COMPONENT_MAP[slide.componentKey]
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 32px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: C.surface, flexShrink: 0
      }}>
        <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Module 6 · Slide {current} of {total} · {slide.title}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i + 1 === current ? C.accent : C.border
            }} />
          ))}
        </div>
      </div>

      {/* Component content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {Comp ? <Comp /> : <div style={{ color: C.muted }}>Component not found: {slide.componentKey}</div>}
      </div>

      {/* Bottom nav */}
      <div style={{
        padding: '12px 32px', borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: C.surface, flexShrink: 0
      }}>
        <button
          onClick={onPrev}
          style={{
            background: C.bg, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13
          }}
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          disabled={current === total}
          style={{
            background: current === total ? C.border : C.accent,
            color: current === total ? C.muted : '#fff',
            border: 'none', borderRadius: 8, padding: '8px 20px',
            cursor: current === total ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [idx, setIdx] = useState(0)

  const goNext = useCallback(() => setIdx(i => Math.min(i + 1, SLIDES.length - 1)), [])
  const goPrev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const slide = SLIDES[idx]
  const current = idx + 1
  const total = SLIDES.length

  if (slide.type === 'component') {
    return (
      <ComponentSlide
        slide={slide}
        onNext={goNext}
        onPrev={goPrev}
        current={current}
        total={total}
      />
    )
  }

  return (
    <TextSlide
      slide={slide}
      onNext={goNext}
      onPrev={goPrev}
      current={current}
      total={total}
      nextModuleUrl={slide.nextModuleUrl}
    />
  )
}
