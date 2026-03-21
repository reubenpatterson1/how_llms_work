import { useState, lazy, Suspense } from 'react'

const C = {
  bg: '#0B1120', surface: '#111827', border: '#1E293B',
  text: '#E2E8F0', muted: '#94A3B8', accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.15)', green: '#10B981', red: '#EF4444', yellow: '#F59E0B'
}

const PullPushDeploy = lazy(() => import('./components/PullPushDeploy.jsx'))
const VersioningTimeline = lazy(() => import('./components/VersioningTimeline.jsx'))
const EnvVarManager = lazy(() => import('./components/EnvVarManager.jsx'))
const AutoScalingViz = lazy(() => import('./components/AutoScalingViz.jsx'))
const DeployingQuiz = lazy(() => import('./components/DeployingQuiz.jsx'))

const COMPONENT_MAP = {
  PullPushDeploy,
  VersioningTimeline,
  EnvVarManager,
  AutoScalingViz,
  DeployingQuiz,
}

const SLIDES = [
  {
    id: "title", type: "text",
    title: "How to Deploy with LLMs",
    subtitle: "Part 5 of 6: From Laptop to Live System",
    body: "You've built it. You've tested it. Now it needs to run somewhere real — reliably, securely, and at scale.",
    bullets: [{ label: "What we'll cover", desc: "Pull vs push deployment strategies, semantic versioning, environment variable management, and auto-scaling patterns for LLM-backed services" }]
  },
  {
    id: "bridge", type: "text",
    title: "Where We Left Off",
    subtitle: "Module 4 gave us a tested Hello World Weather App",
    body: "We have a fully-tested, functional app. FunctionalTestViz proved spec coverage. UnitTestExplorer verified fetchWeather. E2ETestRunner confirmed the full flow. LoadTestDashboard showed us the scaling ceiling.",
    bullets: [
      { label: "The gap", desc: "A tested app on your machine is not the same as a reliable production service. Deployment is where 'it works on my laptop' meets reality." },
      { label: "LLM deployment adds complexity", desc: "Prompt versioning, model endpoint management, API key secrets, and token-rate auto-scaling are new concerns that traditional ops didn't have." }
    ]
  },
  {
    id: "hello-world-recap", type: "text",
    title: "Our Hello World Weather App",
    subtitle: "The app we're deploying — animated, interactive, and API-driven",
    body: "The app fetches live weather data from api.weather.gov for 15 US cities, displays it with a typewriter animation, and resets on demand. It's simple enough to understand but complex enough to illustrate real deployment challenges.",
    bullets: [
      { label: "Components to deploy", desc: "AnimationEngine, WeatherService, CitySelector, ResetController, LayoutShell — 5 independently testable units" },
      { label: "External dependency", desc: "api.weather.gov — a real HTTP API we don't control. Its reliability, rate limits, and schema changes are deployment risks." },
      { label: "State", desc: "No database needed for this app — but API key secrets (User-Agent header) still need secure environment management" }
    ]
  },
  {
    id: "deploy-overview", type: "text",
    title: "The Deployment Lifecycle",
    subtitle: "Four questions every deployment must answer",
    body: "Deployment is not a one-time event — it's an ongoing process of releasing, configuring, monitoring, and scaling.",
    bullets: [
      { label: "1. How does code get there?", desc: "Pull (GitOps, operator watches repo) or Push (CI system actively deploys after tests pass)" },
      { label: "2. What version is running?", desc: "Semantic versioning for the app, prompt versioning for LLM interactions, rollback capability" },
      { label: "3. Where do secrets live?", desc: "API keys, model endpoints, and credentials must never be hardcoded — environment variables and secrets managers" },
      { label: "4. How does it scale?", desc: "Auto-scaling based on traffic, request queuing, LLM rate limit handling, and cost budgets" }
    ]
  },
  {
    id: "pull-push-intro", type: "text",
    title: "Pull vs Push Deployment",
    subtitle: "Two fundamentally different answers to 'how does new code get there?'",
    body: "In a push model, the CI/CD system is the actor — it builds, tests, and pushes the new version to the target environment. In a pull model, an operator running in the target environment watches a desired-state store and reconciles actual vs desired.",
    bullets: [
      { label: "Push", desc: "Simple, direct, fast. CI builds → tests pass → system pushes artifact. Familiar from traditional web deployments." },
      { label: "Pull (GitOps)", desc: "The cluster polls a Git repo or registry. ArgoCD, Flux. More audit-friendly, self-healing, but adds operator complexity." },
      { label: "LLM relevance", desc: "Model endpoint changes often use pull patterns — the serving infra polls a model registry for updated weights or config." }
    ]
  },
  {
    id: "pull-push-detail", type: "text",
    title: "Choosing the Right Strategy",
    subtitle: "Context determines which model fits better",
    body: "The answer is almost always 'it depends' — but the decision factors are concrete.",
    bullets: [
      { label: "Team size", desc: "Small teams with fast iteration benefit from push — it's less overhead. Large orgs with many clusters benefit from pull's audit trail and self-healing." },
      { label: "Security posture", desc: "Pull reduces blast radius — compromised CI can't directly reach prod. Credentials stay in-cluster." },
      { label: "LLM inference clusters", desc: "66% of production LLM deployments use a pull-based reconciliation loop for model config (arXiv 2024). This avoids the footgun of pushing untested model configs directly." },
      { label: "Our Hello World", desc: "Push is appropriate. Small app, single environment, fast feedback loop. A Dockerfile + GitHub Actions workflow is 80% of what we need." }
    ]
  },
  {
    id: "pull-push-viz", type: "component",
    componentKey: "PullPushDeploy",
    title: "Pull vs Push Flow Visualizer"
  },
  {
    id: "versioning-intro", type: "text",
    title: "Code and Prompt Versioning",
    subtitle: "Versioning is your time machine — and LLMs add a new dimension",
    body: "Traditional semantic versioning (semver) applies to code. But LLM-backed apps have a second versioning dimension: the prompts themselves.",
    bullets: [
      { label: "Semver for code", desc: "MAJOR.MINOR.PATCH — breaking API change / new feature / bug fix. Every deployment should tag a version." },
      { label: "Prompt versioning", desc: "Prompts are code. A change to your system prompt can break outputs silently. Version control prompts alongside code in the same repo." },
      { label: "Model versioning", desc: "'claude-sonnet-4' is not a stable identifier forever. Pin to specific model versions (e.g. 'claude-sonnet-4-20250514') in config." },
      { label: "Rollback", desc: "The ability to rollback is only valuable if you can identify which version caused the regression. Structured commit messages + tags make this tractable." }
    ]
  },
  {
    id: "versioning-detail", type: "text",
    title: "Versioning the Hello World App",
    subtitle: "What to tag, when to tag it, and why it matters",
    body: "Let's apply versioning principles to our weather app concretely.",
    bullets: [
      { label: "v1.0.0", desc: "Initial release. AnimationEngine + WeatherService + city dropdown. Prompts in prompts/v1/" },
      { label: "v1.1.0", desc: "Add reset button. Minor feature, no API break. New prompt: prompts/v1/reset-behavior.txt" },
      { label: "v1.2.0", desc: "Switch from Haiku to Sonnet for city name parsing. New model version in config. No code change required — just config bump." },
      { label: "v2.0.0", desc: "API response schema change. WeatherService breaking change. Consumers need to update. Major bump." }
    ]
  },
  {
    id: "versioning-viz", type: "component",
    componentKey: "VersioningTimeline",
    title: "Versioning Timeline Explorer"
  },
  {
    id: "envvar-intro", type: "text",
    title: "Environment Variables and Secrets",
    subtitle: "The #1 source of production security incidents: hardcoded credentials",
    body: "Environment variables are the standard mechanism for injecting configuration that varies by environment (dev/staging/prod) or that is sensitive (API keys, database URLs, model endpoints).",
    bullets: [
      { label: "Never hardcode", desc: "API keys in source code will be leaked — in git history, in build artifacts, in error messages. Treat every hardcoded credential as already compromised." },
      { label: "Env vars", desc: "Simple key-value pairs injected at runtime. Available in process.env (Node) or import.meta.env (Vite). Fine for non-secret config." },
      { label: "Secrets managers", desc: "For real production use: AWS Secrets Manager, HashiCorp Vault, Doppler. Secrets are fetched at runtime, never stored in env, rotatable without redeployment." },
      { label: "Our Weather App", desc: "VITE_WEATHER_USER_AGENT and any future LLM API keys must live in .env.local (never committed) and in the CI/CD secrets store." }
    ]
  },
  {
    id: "envvar-detail", type: "text",
    title: "Environment Variable Best Practices",
    subtitle: "A checklist for every LLM-backed app",
    body: "Following these practices prevents the most common deployment security failures.",
    bullets: [
      { label: "Use .env.example", desc: "Commit a .env.example with placeholder values. Never commit .env or .env.local. Add them to .gitignore immediately." },
      { label: "Separate by environment", desc: ".env.development, .env.staging, .env.production. Different API rate limits, different endpoints, different log levels." },
      { label: "Validate on startup", desc: "Your app should fail fast if required env vars are missing. A missing WEATHER_USER_AGENT should error at boot, not silently fail on first API call." },
      { label: "Rotate secrets regularly", desc: "LLM API keys should be rotated monthly. Secrets managers enable zero-downtime rotation. Hardcoded keys require a code deploy to rotate — which is slow and risky." }
    ]
  },
  {
    id: "envvar-viz", type: "component",
    componentKey: "EnvVarManager",
    title: "Environment Variable Manager"
  },
  {
    id: "autoscaling-intro", type: "text",
    title: "Auto-Scaling for LLM Services",
    subtitle: "LLMs have different scaling characteristics than traditional web apps",
    body: "Traditional auto-scaling responds to CPU or memory. LLM services need to scale on different signals: request queue depth, time-to-first-token (TTFT), and token throughput.",
    bullets: [
      { label: "Token throughput", desc: "LLM inference is compute-heavy. A single request can hold a GPU for seconds. Queue depth is a better scaling signal than CPU." },
      { label: "Rate limits", desc: "Cloud LLM APIs (Anthropic, OpenAI) have token-per-minute limits. Your app needs to queue and retry, not just spin up more instances." },
      { label: "Cost awareness", desc: "More instances = more costs. Auto-scaling needs a cost ceiling, not just a performance floor. Budget alerts should trigger before scale-out depletes the budget." },
      { label: "Stateless design", desc: "Horizontal scaling only works if your app is stateless. WeatherService should not hold city preference in memory — it should come from the request." }
    ]
  },
  {
    id: "autoscaling-detail", type: "text",
    title: "Scaling Patterns for Our Weather App",
    subtitle: "Practical scaling decisions for a real app",
    body: "Our Hello World app is simple enough to scale straightforwardly — but the decisions we make now set the pattern for larger LLM apps.",
    bullets: [
      { label: "Start with 1 replica", desc: "Our weather app is stateless. 1 pod handles our initial load. Set a min of 1, max of 5 for auto-scaling." },
      { label: "Scale on request rate", desc: "Scale out when requests/minute exceeds 100 per pod. This maps to api.weather.gov's rate limits." },
      { label: "LLM tier (future state)", desc: "If we add LLM-powered city recommendations, scale on queue depth. A queue of 10+ pending LLM requests should trigger scale-out." },
      { label: "Graceful degradation", desc: "At max replicas, the app should return cached weather data rather than error. Design for degradation before you hit the ceiling." }
    ]
  },
  {
    id: "autoscaling-viz", type: "component",
    componentKey: "AutoScalingViz",
    title: "Auto-Scaling Visualizer"
  },
  {
    id: "takeaways", type: "text",
    title: "Key Deployment Takeaways",
    subtitle: "Five principles to carry into every deployment",
    body: "Deployment is where your app meets reality. These principles reduce the gap between 'it works' and 'it runs reliably'.",
    bullets: [
      { label: "1. Choose your strategy deliberately", desc: "Push for fast-moving small teams. Pull for multi-cluster, audit-heavy environments. LLM config benefits from pull's self-healing." },
      { label: "2. Version everything", desc: "Code, prompts, model versions. If you can't answer 'what version is running in prod?', you can't debug production." },
      { label: "3. Never hardcode secrets", desc: "Not even 'just for now'. The cost of a leaked API key — in credits burned, in incident response — far exceeds the cost of proper secret management." },
      { label: "4. Design for degradation", desc: "Auto-scaling has a ceiling. Rate limits will be hit. Your app should degrade gracefully, not 500." },
      { label: "5. LLMs are infrastructure", desc: "Your model endpoint, prompt config, and token budget are as much infrastructure as your database. Operate them with the same discipline." }
    ]
  },
  {
    id: "quiz-intro", type: "text",
    title: "Module 5 Quiz",
    subtitle: "Test your deployment knowledge",
    body: "12 questions across 4 sections. You need 9/12 (75%) to earn your certificate.",
    bullets: [
      { label: "Section 1", desc: "Pull vs Push Deployment Strategies" },
      { label: "Section 2", desc: "Code and Prompt Versioning" },
      { label: "Section 3", desc: "Environment Variables and Secrets" },
      { label: "Section 4", desc: "Auto-Scaling and LLM Infrastructure" }
    ]
  },
  {
    id: "quiz", type: "component",
    componentKey: "DeployingQuiz",
    title: "Module 5 Quiz"
  },
  {
    id: "next-module", type: "text",
    title: "Ready for Module 6",
    subtitle: "CI/CD Workflows for LLM-Supported Systems",
    body: "You now understand how to get your app into production reliably. Module 6 completes the picture: how to automate the whole pipeline — from commit to deploy — with checkpoints, logging, and clear ownership.",
    bullets: [
      { label: "What's next", desc: "CI/CD checkpoints, structured logging and alerting, the speed vs safety tradeoff, and handing off vs self-owning your LLM infrastructure" }
    ],
    nextModuleUrl: "http://localhost:5178"
  }
]

function TextSlide({ slide, onNext, onPrev, isFirst, isLast }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '48px 64px', overflowY: 'auto'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'inline-block', padding: '4px 12px', borderRadius: '9999px',
          background: C.accentGlow, border: `1px solid ${C.accent}`,
          color: C.accent, fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px'
        }}>
          Module 5 · Deploying with LLMs
        </div>
        <h1 style={{ fontSize: '42px', fontWeight: 700, color: C.text, lineHeight: 1.2, marginBottom: '12px' }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p style={{ fontSize: '20px', color: C.accent, fontWeight: 500, marginBottom: '24px' }}>
            {slide.subtitle}
          </p>
        )}
        <p style={{ fontSize: '17px', color: C.muted, lineHeight: 1.7, marginBottom: '32px', maxWidth: '760px' }}>
          {slide.body}
        </p>
        {slide.bullets && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
            {slide.bullets.map((b, i) => (
              <div key={i} style={{
                padding: '16px 20px', borderRadius: '10px',
                background: C.surface, border: `1px solid ${C.border}`
              }}>
                <span style={{ fontWeight: 700, color: C.accent, marginRight: '8px' }}>{b.label}:</span>
                <span style={{ color: C.muted, fontSize: '15px', lineHeight: 1.6 }}>{b.desc}</span>
              </div>
            ))}
          </div>
        )}
        {slide.nextModuleUrl && (
          <div style={{ marginTop: '32px' }}>
            <button
              onClick={() => window.open(slide.nextModuleUrl, '_blank')}
              style={{
                padding: '14px 28px', borderRadius: '8px',
                background: C.green, border: 'none', color: '#fff',
                fontSize: '16px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Launch Module 6 →
            </button>
          </div>
        )}
      </div>
      <NavBar onNext={onNext} onPrev={onPrev} isFirst={isFirst} isLast={isLast} />
    </div>
  )
}

function ComponentSlide({ slide, onNext, onPrev, isFirst, isLast }) {
  const Comp = COMPONENT_MAP[slide.componentKey]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 32px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'
      }}>
        <div style={{
          display: 'inline-block', padding: '4px 12px', borderRadius: '9999px',
          background: C.accentGlow, border: `1px solid ${C.accent}`,
          color: C.accent, fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase'
        }}>
          Module 5 · Interactive
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{slide.title}</h2>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
            Loading component...
          </div>
        }>
          <Comp />
        </Suspense>
      </div>
      <NavBar onNext={onNext} onPrev={onPrev} isFirst={isFirst} isLast={isLast} />
    </div>
  )
}

function NavBar({ onNext, onPrev, isFirst, isLast }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: '20px', marginTop: '8px', borderTop: `1px solid ${C.border}`
    }}>
      <button
        onClick={onPrev}
        disabled={isFirst}
        style={{
          padding: '10px 24px', borderRadius: '8px', border: `1px solid ${C.border}`,
          background: isFirst ? 'transparent' : C.surface, color: isFirst ? C.border : C.text,
          fontSize: '14px', fontWeight: 600, cursor: isFirst ? 'default' : 'pointer'
        }}
      >
        ← Previous
      </button>
      {!isLast && (
        <button
          onClick={onNext}
          style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: C.accent, color: '#fff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Next →
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]

  const onNext = () => setIdx(i => Math.min(i + 1, SLIDES.length - 1))
  const onPrev = () => setIdx(i => Math.max(i - 1, 0))

  const progress = ((idx + 1) / SLIDES.length) * 100

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Progress bar */}
      <div style={{ height: '3px', background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: C.accent, transition: 'width 0.3s ease' }} />
      </div>

      {/* Slide counter */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        padding: '8px 32px', flexShrink: 0
      }}>
        <span style={{ color: C.muted, fontSize: '13px' }}>{idx + 1} / {SLIDES.length}</span>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {slide.type === 'text' ? (
          <TextSlide
            slide={slide}
            onNext={onNext}
            onPrev={onPrev}
            isFirst={idx === 0}
            isLast={idx === SLIDES.length - 1}
          />
        ) : (
          <ComponentSlide
            slide={slide}
            onNext={onNext}
            onPrev={onPrev}
            isFirst={idx === 0}
            isLast={idx === SLIDES.length - 1}
          />
        )}
      </div>
    </div>
  )
}
