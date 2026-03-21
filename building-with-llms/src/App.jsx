import { useState, useEffect, useCallback } from "react";
import HelloWorldPreview from "./components/HelloWorldPreview";
import DecompositionViz from "./components/DecompositionViz";
import ParallelismGraph from "./components/ParallelismGraph";
import OrchestrationComparison from "./components/OrchestrationComparison";
import CostingDashboard from "./components/CostingDashboard";
import BuildingQuiz from "./components/BuildingQuiz";

const SLIDES = [
  {
    id: "title",
    type: "text",
    title: "How to Build with LLMs",
    subtitle: "From Dense Specifications to Production Components",
    body: "Part 2 showed how the density principle and 10-channel architecture eliminate hallucination by resolving every dimension before the model sees the prompt. This module turns those specifications into real, working software — using a Hello World Weather App as our running example.",
  },
  {
    id: "bridge",
    type: "text",
    title: "From Specification to Implementation",
    subtitle: "The gap between a perfect spec and production code",
    body: "You now know that unresolved dimensions create confabulation vectors. But even with a 100% dense spec, implementation strategy matters. Do you generate the entire app in one prompt? Break it into parts? Build them in parallel? The answers determine cost, quality, and reliability. This module covers four engineering principles: decomposition, parallelism, orchestration, and cost monitoring.",
    keyTakeaway: "A dense spec eliminates hallucination at the prompt level. Decomposition, parallelism, and orchestration eliminate it at the architecture level.",
  },
  {
    id: "hello-world-intro",
    type: "text",
    title: "The Running Example: Hello World Weather App",
    subtitle: "A real app we'll build, test, deploy, and automate across Parts 3-6",
    body: "Our example is simple enough to understand in minutes but complex enough to demonstrate real engineering tradeoffs. It has three features: animated 'Hello, World!' text with a typewriter effect, a reset button that replays the animation, and a weather integration that fetches current conditions from api.weather.gov for 15 major US cities. The next slide shows the finished product — a real, working app rendered live.",
    keyTakeaway: "Simple ≠ trivial. This app touches animation (timing, state), HTTP (API auth, error handling), UI (dropdowns, layout), and integration (composing independent features). That's 4+ architectural dimensions — enough for meaningful decomposition.",
  },
  {
    id: "hello-world-preview",
    type: "component",
    component: "HelloWorldPreview",
    instructions: "This is the finished Hello World Weather App running live. Try it: watch the typewriter animation, click Reset, select a city from the dropdown to fetch real weather data from api.weather.gov.",
  },
  {
    id: "decomp-intro",
    type: "text",
    title: "3a: Eating the Elephant",
    subtitle: "First principles decomposition for LLM code generation",
    body: "The single biggest mistake in LLM-assisted development is asking for too much at once. A prompt that says 'build me a weather app with animation and a reset button' forces the model to resolve animation timing, state management, HTTP authentication, UI layout, and component integration simultaneously. Each unresolved interaction between concerns is a confabulation vector. The fix: decompose into single-function parts, each small enough for one focused prompt.",
    keyTakeaway: "Decomposition isn't just good software design — it's hallucination prevention. Each component boundary is a confabulation firewall.",
  },
  {
    id: "decomp-principles",
    type: "text",
    title: "Decomposition Principles for LLM Generation",
    subtitle: "Single Responsibility · Clear Interfaces · Testable in Isolation · LLM-Friendly Size",
    bullets: [
      { label: "Single Responsibility", desc: "Each component does exactly one thing. One prompt, one concern, one function." },
      { label: "Clear Interfaces", desc: "Define inputs and outputs before generating. Shared types are constraints, not afterthoughts." },
      { label: "Testable in Isolation", desc: "If you can't test it alone, it's too coupled. Each component should be verifiable without the others." },
      { label: "LLM-Friendly Size", desc: "A component that fits in a single prompt context window with room for examples and constraints. Typically 50-200 lines of output." },
    ],
    keyTakeaway: "These aren't new principles — they're SOLID principles reframed for LLM generation. The difference: in traditional dev, coupling causes maintenance cost. In LLM generation, coupling causes confabulation.",
  },
  {
    id: "decomp-demo",
    type: "component",
    component: "DecompositionViz",
    instructions: "Click each component node to see its function signature, LLM prompt, estimated token cost, and complexity rating. Notice how each component has a single, well-defined purpose.",
  },
  {
    id: "parallel-intro",
    type: "text",
    title: "3b: Parallelism & Dependency Isolation",
    subtitle: "Build independent components simultaneously, not sequentially",
    body: "Once you've decomposed into atomic parts, the next question is: which can be built at the same time? Components with no shared dependencies can be generated in parallel — separate LLM calls running simultaneously. This cuts wall-clock time dramatically. But you must understand the dependency graph: if Component B needs Component A's interface, B must wait for A. The key insight: define shared interfaces FIRST, then generate implementations in parallel.",
    keyTakeaway: "Parallelism in LLM generation isn't about threading — it's about dependency isolation. Independent prompts produce independent outputs. Dependent prompts need shared constraints.",
  },
  {
    id: "parallel-waves",
    type: "text",
    title: "Build Waves: A Concrete Example",
    subtitle: "How to determine the minimum number of sequential waves",
    body: "A build wave is a group of components that can be generated simultaneously because none depend on each other. The minimum number of waves equals the longest dependency chain in your graph. Here's how to compute it for our Hello World app:",
    bullets: [
      { label: "Step 1: Map deps", desc: "AnimationEngine → none. WeatherService → none. CitySelector → none. ResetController → depends on AnimationEngine (needs its API to reset). LayoutShell → depends on ALL four (composes them)." },
      { label: "Step 2: Find roots", desc: "Components with zero dependencies go in Wave 1. That's AnimationEngine, WeatherService, and CitySelector — all three build in parallel." },
      { label: "Step 3: Next level", desc: "After Wave 1 completes, which components have ALL their dependencies satisfied? ResetController (depends only on AnimationEngine, which is done). That's Wave 2." },
      { label: "Step 4: Repeat", desc: "After Wave 2, LayoutShell has all 4 dependencies satisfied. That's Wave 3. No more components remain — we need exactly 3 sequential waves." },
    ],
    keyTakeaway: "The formula: minimum waves = longest dependency chain. AnimationEngine → ResetController → LayoutShell is 3 links. Even though we have 5 components, the minimum sequential waves is 3 because 3 components run in parallel in Wave 1.",
  },
  {
    id: "parallel-principles",
    type: "text",
    title: "Dependency DAG (Directed Acyclic Graph) Principles",
    subtitle: "A DAG maps which components must finish before others can start — 'directed' means dependencies flow one way, 'acyclic' means no circular dependencies",
    body: "The recommended output format for your dependency document is YAML. Feed this block directly into every subsequent LLM prompt as a constraint — the model will honour the wave assignments and dependency contracts without further instruction.",
    codeLabel: "hello-world-dag.yaml",
    code: `dag:
  shared_interfaces:
    - IAnimationEngine   # start(), reset(), onComplete(cb)
    - IWeatherService    # fetchForecast(cityId): Promise<Forecast>
    - ICitySelector      # value: string, onChange(city)

  components:
    AnimationEngine:
      depends_on: []
      wave: 1
      implements: IAnimationEngine
      purpose: Manages typewriter animation lifecycle and state

    WeatherService:
      depends_on: []
      wave: 1
      implements: IWeatherService
      purpose: Two-step api.weather.gov fetch (points → forecast)

    CitySelector:
      depends_on: []
      wave: 1
      implements: ICitySelector
      purpose: Dropdown of 15 US cities, controlled component

    ResetController:
      depends_on: [AnimationEngine]   # needs IAnimationEngine.reset()
      wave: 2
      purpose: Button that calls AnimationEngine.reset() on click

    LayoutShell:
      depends_on: [AnimationEngine, WeatherService, CitySelector, ResetController]
      wave: 3
      purpose: Composes all components, owns top-level state`,
    bullets: [
      { label: "LLM-Native Format", desc: "LLMs are trained on massive corpora of YAML — GitHub Actions, Kubernetes manifests, Docker Compose, Helm charts. They parse and generate it reliably without special prompting. Feed a YAML DAG into a prompt and the model treats it as a first-class constraint, not free text." },
      { label: "Structure > Prose", desc: "Prose like 'ResetController depends on AnimationEngine' is ambiguous to a model (how? which method?). YAML makes the relationship machine-verifiable: depends_on: [AnimationEngine] plus implements: IAnimationEngine is unambiguous. The format eliminates the interpretation gap." },
      { label: "Critical Path", desc: "The longest dependency chain (AnimationEngine → ResetController → LayoutShell = 3 waves) determines minimum build time. Shorter chains finish early and wait." },
      { label: "Wave Validation", desc: "After each wave completes, validate outputs against the shared interfaces before starting the next wave. Catch mismatches before they compound." },
    ],
    keyTakeaway: "A YAML DAG is your single source of truth for build order, interfaces, and LLM prompts. Every component prompt should include the full DAG — the model uses it to stay grounded in what already exists.",
  },
  {
    id: "parallel-demo",
    type: "component",
    component: "ParallelismGraph",
    instructions: "Click 'Run Build' to watch the three build waves execute. Wave 1 builds AnimationEngine (30s), WeatherService (45s), and CitySelector (20s) in parallel — the wave takes 45s (the slowest). Wave 2 builds ResetController (15s). Wave 3 builds LayoutShell (25s). Total: 85s vs 135s serial.",
  },
  {
    id: "orchestration-intro",
    type: "text",
    title: "3c: Orchestration vs Lone Wolf",
    subtitle: "When multi-step generation outperforms a single prompt",
    body: "You can build the Hello World app two ways: one big prompt ('lone wolf') or multiple coordinated prompts ('orchestrated'). The lone wolf is faster and cheaper per-run. The orchestrated approach produces higher-quality, more grounded output. The tradeoff isn't always obvious — for a trivial script, lone wolf wins. For anything with multiple concerns, orchestration eliminates the cross-concern confabulation that single prompts can't avoid.",
    keyTakeaway: "Orchestration costs more tokens but produces fewer bugs. The real cost of a single prompt isn't $0.012 — it's $0.012 + (debugging hours × hourly rate).",
  },
  {
    id: "orchestration-quality",
    type: "text",
    title: "Quality Tradeoffs: Highest vs Good Enough",
    subtitle: "Matching strategy to stakes",
    bullets: [
      { label: "Lone Wolf Wins When", desc: "The app has one concern, output is disposable, speed matters more than correctness, or you're prototyping." },
      { label: "Orchestration Wins When", desc: "Multiple concerns interact, the output goes to production, you need consistent results across runs, or debugging time is expensive." },
      { label: "The 80x Factor", desc: "Research shows orchestrated multi-agent approaches produce 80x more specific and 140x more correct solutions for complex tasks (arXiv:2511.15755)." },
      { label: "The Cost Illusion", desc: "A $0.012 vague prompt that needs 30 min of debugging costs $25.01. A $0.047 orchestrated prompt that works first try costs $0.047." },
    ],
    keyTakeaway: "Choose lone wolf for throwaway code. Choose orchestration for anything someone will maintain.",
  },
  {
    id: "orchestration-demo",
    type: "component",
    component: "OrchestrationComparison",
    instructions: "Compare the Lone Wolf (single prompt) vs Orchestrated (5-step) approaches. Click each orchestrated step to see its dense prompt. Notice the grounding difference: 35% vs 94% grounded tokens.",
  },
  {
    id: "costing-intro",
    type: "text",
    title: "3d: Costing & Performance Monitoring",
    subtitle: "Know what you're spending and why",
    body: "LLM API costs are deceptively variable. The same app can cost $0.01 or $0.10 depending on prompt density, output constraints, retry rate, and model selection. Without monitoring, teams discover cost problems at the invoice — when it's too late. Effective costing requires per-component tracking, input vs output token analysis, retry rate monitoring, and model-specific pricing awareness.",
    keyTakeaway: "The most expensive token is the one you generate twice. Dense prompts reduce retries, which is the single biggest cost optimization.",
  },
  {
    id: "costing-metrics",
    type: "text",
    title: "What to Measure and Why",
    subtitle: "Token costs · Latency budgets · Retry rates · Prompt optimization ROI",
    bullets: [
      { label: "Input vs Output Tokens", desc: "Output tokens cost 3-6x more than input tokens. Dense prompts increase input but dramatically reduce output — net savings." },
      { label: "Retry Rate", desc: "If >10% of prompts need retries, the prompt strategy is the problem, not the model. Each retry costs the full token price again." },
      { label: "Cost per Component", desc: "Track which components are expensive. A $0.04 WeatherService prompt might indicate under-specification, not inherent complexity." },
      { label: "Model Selection ROI", desc: "A $0.002 Haiku 4.5 call that needs 3 retries costs $0.006. A $0.01 Sonnet 4 call that succeeds first try costs $0.01. Similar cost — but Sonnet gives consistent quality. Opus 4 costs 5x more but eliminates retries entirely on complex prompts." },
    ],
    keyTakeaway: "Monitor, measure, optimize. Teams that track LLM costs per-component achieve 30-50% cost reduction through prompt optimization alone (Helicone, 2025).",
  },
  {
    id: "costing-demo",
    type: "component",
    component: "CostingDashboard",
    instructions: "Switch between Claude Haiku, Sonnet, and Opus to see cost differences. Toggle 'Optimize Prompts' to compare vague vs dense prompt costs. Notice how dense prompts cost more in input tokens but save dramatically on output tokens and retries.",
  },
  {
    id: "synthesis",
    type: "text",
    title: "Key Takeaways",
    bullets: [
      { label: "Decompose First", desc: "Break apps into single-function components. Each component boundary is a confabulation firewall." },
      { label: "Parallelize Smartly", desc: "Define interfaces first, then build independent components in parallel. Save 30-40% of wall-clock time." },
      { label: "Orchestrate for Quality", desc: "Multi-step generation produces 80x better results for multi-concern apps. The cost difference is negligible vs debugging time." },
      { label: "Monitor Everything", desc: "Track cost per component, retry rates, and input/output ratios. Dense prompts are the cheapest optimization." },
      { label: "Spec → Decompose → Build", desc: "Part 2's dense spec eliminates prompt-level hallucination. This module's decomposition eliminates architecture-level hallucination." },
    ],
  },
  {
    id: "quiz-intro",
    type: "text",
    title: "Engineering Professional Assessment",
    subtitle: "12 Questions · 4 Sections · Certificate on Completion",
    body: "Each question tests your ability to apply decomposition, parallelism, orchestration, and cost analysis principles to the Hello World Weather App and similar scenarios. These are application questions, not recall — you need to diagnose problems and choose strategies.",
    keyTakeaway: "Pass threshold: 9 / 12 (75%). A personalised certificate is generated on completion regardless of outcome.",
  },
  {
    id: "quiz",
    type: "component",
    component: "BuildingQuiz",
    instructions: "Answer all 12 questions across 4 sections. Select an answer, then click Reveal to see the explanation before advancing.",
  },
  {
    id: "part4-link",
    type: "text",
    title: "Continue to Part 4",
    subtitle: "How to Test with LLMs",
    body: "Part 3 covered building: decomposing the Hello World Weather App into atomic components, building them in parallel, orchestrating multi-step generation for quality, and monitoring costs. Part 4 takes the same app and tests it at every level — functional, unit, E2E, edge cases, and load. Because code that works in a demo isn't code that works in production.",
    keyTakeaway: "Part 4 runs on port 5176. Start it with: cd testing-with-llms && npm run dev",
    nextModuleUrl: "http://localhost:5176",
  },
];

const C = {
  bg: "#0B1120",
  surface: "#131B2E",
  border: "#1E293B",
  text: "#E2E8F0",
  textDim: "#94A3B8",
  accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22C55E",
  greenGlow: "rgba(34,197,94,0.15)",
};

function TextSlide({ slide }) {
  const hasImage = !!slide.image;
  return (
    <div style={{
      maxWidth: hasImage ? 1200 : 900, margin: "0 auto", padding: "48px 40px",
      display: hasImage ? "grid" : "block",
      gridTemplateColumns: hasImage ? "1fr 1fr" : undefined,
      gap: hasImage ? 40 : undefined,
      alignItems: "start",
    }}>
      <div>
        <h1 style={{ fontSize: hasImage ? 34 : 42, fontWeight: 700, color: C.text, marginBottom: 12,
          fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p style={{ fontSize: hasImage ? 17 : 20, color: C.accent, marginBottom: 24,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {slide.subtitle}
          </p>
        )}
        {slide.body && (
          <p style={{ fontSize: hasImage ? 15 : 18, lineHeight: 1.7, color: C.textDim, marginBottom: 24,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {slide.body}
          </p>
        )}
        {slide.code && (
          <div style={{ margin: "0 0 24px 0", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {slide.codeLabel && (
              <div style={{ background: C.border, padding: "6px 14px", fontSize: 11, fontWeight: 600,
                color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
                {slide.codeLabel}
              </div>
            )}
            <pre style={{ margin: 0, padding: "16px 20px", background: "#0D1117", overflowX: "auto",
              fontSize: 13, lineHeight: 1.65, color: "#E2E8F0", fontFamily: "'IBM Plex Mono', monospace" }}>
              {slide.code}
            </pre>
          </div>
        )}
        {slide.bullets && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0" }}>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "baseline" }}>
                <span style={{ color: C.accent, fontWeight: 700, fontSize: 16, minWidth: 180,
                  fontFamily: "'IBM Plex Mono', monospace" }}>
                  {b.label}
                </span>
                <span style={{ color: C.textDim, fontSize: 16, lineHeight: 1.5,
                  fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {b.desc}
                </span>
              </li>
            ))}
          </ul>
        )}
        {slide.keyTakeaway && (
          <div style={{ background: C.accentGlow, border: `1px solid ${C.accent}33`,
            borderRadius: 8, padding: "16px 20px", marginTop: 16 }}>
            <p style={{ fontSize: 14, color: C.accent, margin: 0, lineHeight: 1.6,
              fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <strong>Key Takeaway:</strong> {slide.keyTakeaway}
            </p>
          </div>
        )}
        {slide.nextModuleUrl && (
          <button onClick={() => window.open(slide.nextModuleUrl, '_blank')}
            style={{
              marginTop: 24, padding: "14px 32px", borderRadius: 8,
              border: `2px solid ${C.accent}`, background: C.accentGlow,
              color: C.accent, fontSize: 16, fontWeight: 600,
              cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
            }}>
            Launch Next Module →
          </button>
        )}
      </div>
      {hasImage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${C.border}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <img src={slide.image} alt={slide.imageCaption || ""}
              style={{ width: "100%", display: "block" }} />
          </div>
          {slide.imageCaption && (
            <p style={{ fontSize: 12, color: C.textDim, textAlign: "center", margin: 0,
              fontFamily: "'IBM Plex Sans', sans-serif", fontStyle: "italic" }}>
              {slide.imageCaption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const COMPONENT_MAP = {
  HelloWorldPreview,
  DecompositionViz,
  ParallelismGraph,
  OrchestrationComparison,
  CostingDashboard,
  BuildingQuiz,
};

function ComponentSlide({ slide }) {
  const Comp = COMPONENT_MAP[slide.component];
  if (!Comp) return <div style={{ color: "red" }}>Component not found: {slide.component}</div>;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {slide.instructions && (
        <div style={{
          position: "sticky", top: 0, zIndex: 20, background: `${C.surface}ee`,
          borderBottom: `1px solid ${C.border}`, padding: "8px 20px",
          backdropFilter: "blur(8px)",
        }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textDim,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {slide.instructions}
          </p>
        </div>
      )}
      <Comp />
    </div>
  );
}

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const go = useCallback((dir) => {
    setIdx((i) => Math.max(0, Math.min(SLIDES.length - 1, i + dir)));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex",
      flexDirection: "column", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ flex: 1, overflow: "auto" }}>
        {slide.type === "text" ? <TextSlide slide={slide} /> : <ComponentSlide slide={slide} />}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
        padding: "12px 20px", borderTop: `1px solid ${C.border}`, background: C.surface,
      }}>
        <button onClick={() => go(-1)} disabled={idx === 0}
          style={{
            background: "none", border: `1px solid ${C.border}`, color: idx === 0 ? C.textDim : C.text,
            padding: "6px 16px", borderRadius: 6, cursor: idx === 0 ? "default" : "pointer",
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
          }}>
          Previous
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {SLIDES.map((s, i) => (
            <div key={s.id} onClick={() => setIdx(i)}
              style={{
                width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                background: i === idx ? C.accent : s.type === "component" ? C.accent + "66" : C.border,
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === SLIDES.length - 1}
          style={{
            background: "none", border: `1px solid ${C.border}`,
            color: idx === SLIDES.length - 1 ? C.textDim : C.text,
            padding: "6px 16px", borderRadius: 6,
            cursor: idx === SLIDES.length - 1 ? "default" : "pointer",
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
          }}>
          Next
        </button>
        <span style={{ fontSize: 12, color: C.textDim, marginLeft: 8 }}>
          {idx + 1} / {SLIDES.length}
        </span>
      </div>
    </div>
  );
}
