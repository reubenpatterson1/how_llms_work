import { useState, useEffect, useCallback } from "react";
import DensityMethodology from "./components/DensityMethodology";
import AgentWalkthrough from "./components/AgentWalkthrough";
import ComparativeResults from "./components/ComparativeResults";
import HallucinationComparison from "./components/HallucinationComparison";
import ConsistencyVisualization from "./components/ConsistencyVisualization";
import AgenticSystems from "./components/AgenticSystems";
import WorkingWithQuiz from "./components/WorkingWithQuiz";

// Agent screenshots
import screenshotDashboard from "./assets/screenshots/dashboard.png";
import screenshotIntake from "./assets/screenshots/intake_analysis.png";
import screenshotComparison from "./assets/screenshots/comparison_results.png";
import screenshotSettings from "./assets/screenshots/settings_page.png";

const SLIDES = [
  {
    id: "title",
    type: "text",
    title: "How to Actually Work WITH LLMs",
    subtitle: "From Theory to Systematic Engineering",
    body: "Part 1 showed how attention, density, and activation landscapes determine output quality. This presentation turns that theory into a repeatable engineering methodology — with real comparative data proving it works.",
  },
  {
    id: "bridge",
    type: "text",
    title: "From Understanding to Application",
    subtitle: "Bridging the gap between how LLMs work and how to work with them",
    body: "You now know that vague prompts create flat activation landscapes, dilute attention across noise tokens, and force the model to fill unresolved dimensions from training defaults. The question becomes: can we systematically eliminate unresolved dimensions before the model ever sees the prompt?",
    keyTakeaway: "Every unresolved architectural dimension is a hallucination vector. The model WILL fill it — the question is whether it fills it from your spec or from its training data.",
  },
  {
    id: "core-insight",
    type: "text",
    title: "The Density Principle",
    subtitle: "Constraint-oriented tokens maximize execution, minimize invention",
    body: "Context density isn't just about writing shorter prompts. It's about resolving every dimension the model needs to make decisions. When a prompt specifies 'PostgreSQL 15 with compound index on (team_id, status)', the model executes. When it says 'some kind of database', the model invents. The Architecture Agent systematizes this principle into 10 channels with 45+ sub-dimensions.",
    keyTakeaway: "Density = resolved dimensions / total dimensions. Maximize this ratio and the model shifts from generating to executing.",
  },
  {
    id: "methodology-intro",
    type: "text",
    title: "10-Channel Architecture",
    subtitle: "Purpose · Data Model · API · Tech Stack · Auth · Deployment · Error Handling · Performance · Security · Testing",
    body: "Each channel represents an architectural dimension with 4-5 sub-dimensions. Purpose has objective, users, success criteria, scope. Data Model has entities, relationships, cardinality, constraints, indexes. Every sub-dimension that remains at 0% resolution is a slot the model will fill from training defaults — Express, MongoDB, no auth, port 3000.",
    keyTakeaway: "The 10 channels aren't arbitrary categories. They map to the decision surface the LLM must traverse when generating code. Unresolved channels = ungrounded decisions = confabulated output.",
    image: screenshotDashboard,
    imageCaption: "Architecture Agent dashboard showing 10 channel resolution meters and density score",
  },
  {
    id: "methodology-demo",
    type: "component",
    component: "DensityMethodology",
    instructions: "Explore the 10 architectural channels and their sub-dimensions. Click 'Simulate Intake' to watch resolution progress as structured responses fill each channel.",
  },
  {
    id: "agent-intro",
    type: "text",
    title: "The Architecture Agent",
    subtitle: "Structured intake that fills channels with constraint-oriented tokens",
    body: "The Architecture Agent performs structured Q&A intake. It identifies the lowest-resolution channel, asks targeted questions, analyzes responses for technical terms and ambiguities, updates channel resolution, and repeats until all channels exceed 80%. The output is a Dense Architecture Specification — one line per constraint, no prose, maximum density.",
    keyTakeaway: "The agent doesn't generate code. It generates the specification that makes code generation deterministic.",
    image: screenshotIntake,
    imageCaption: "Live intake session: 8 constraints extracted from a single response, channel bars filling in real-time",
  },
  {
    id: "agent-demo",
    type: "component",
    component: "AgentWalkthrough",
    instructions: "Step through a real Architecture Agent session building a Task Management API. Watch how each response resolves multiple channels simultaneously and how ambiguities are flagged.",
  },
  {
    id: "comparison-intro",
    type: "text",
    title: "Vague vs Dense: The Experiment",
    subtitle: "Same app, same model, radically different results",
    body: "We gave the same task to Claude Sonnet: once with 'Build me a task management API with real-time updates' (vague), and once with the Dense Architecture Specification produced by the agent (dense). We measured hallucination surface, output consistency, dimension resolution, and code quality.",
    keyTakeaway: "This isn't theoretical. The comparative data you're about to see was generated live by the Architecture Agent running against a real LLM.",
    image: screenshotComparison,
    imageCaption: "Live comparison results: 85.7% hallucination reduction and 75% resolution improvement with dense spec",
  },
  {
    id: "comparison-demo",
    type: "component",
    component: "ComparativeResults",
    instructions: "Compare the four quality metrics between vague and dense prompts. Click each metric card for detailed breakdown.",
  },
  {
    id: "hallucination-intro",
    type: "text",
    title: "Token-Level Hallucination Analysis",
    subtitle: "Where exactly does the model execute vs invent?",
    body: "Every token in the generated output falls into one of four categories: grounded (directly from spec), inferred (reasonable deduction from spec), defaulted (common pattern, not specified), or confabulated (invented from training data with no spec basis). The vague prompt produces code where 37.5% of tokens are confabulated. The dense spec: 0%.",
    keyTakeaway: "Confabulation isn't random — it's the model filling unresolved dimensions from its training data defaults. Resolve the dimensions and confabulation disappears.",
  },
  {
    id: "hallucination-demo",
    type: "component",
    component: "HallucinationComparison",
    instructions: "Compare token-by-token grounding between vague (top) and dense (bottom) outputs. Hover tokens to see their grounding classification. Red = confabulated, orange = defaulted, yellow = inferred, green = grounded.",
  },
  {
    id: "consistency-intro",
    type: "text",
    title: "Run-to-Run Consistency",
    subtitle: "The same prompt, 5 times — how stable are the outputs?",
    body: "Vague prompts produce different architectures every run: Express then FastAPI then Hono, MongoDB then PostgreSQL then SQLite, JWT then no auth. Dense specs produce identical output every run because there are no dimensions left for the model to fill stochastically. We measure this with Jaccard similarity — for each pair of runs, we compute (shared decisions) / (total unique decisions). A pair that both chose Express+PostgreSQL+JWT scores 1.0; a pair where one chose Express and the other FastAPI scores near 0. The average across all pairs gives the consistency score. Low Jaccard means unresolved dimensions are being filled differently each run — each varying decision is a confabulation vector the model resolves stochastically from training defaults rather than deterministically from your spec.",
    keyTakeaway: "Jaccard similarity directly measures confabulation surface: every dimension where runs disagree is a dimension the model is inventing rather than executing. Low consistency = high confabulation.",
  },
  {
    id: "consistency-demo",
    type: "component",
    component: "ConsistencyVisualization",
    instructions: "Compare architectural decisions across 5 runs. Vague outputs (top): each run makes different choices. Dense outputs (bottom): every run is identical.",
  },
  {
    id: "agentic-intro",
    type: "text",
    title: "Building Stable Agentic Systems",
    subtitle: "Three pillars: Monitoring · Configurability · Predictability",
    body: "The density principle extends beyond single prompts. Agentic systems — where LLMs make sequential decisions — amplify both the benefits of density and the costs of vagueness. Each agent step that defaults or confabulates introduces drift that compounds through the pipeline. Stable agentic systems require monitoring (know what the model decided), configurability (change its behavior without retraining), and predictability (same input → same output).",
    keyTakeaway: "An agentic system is only as stable as its least-specified prompt. One vague step infects every downstream decision.",
    image: screenshotSettings,
    imageCaption: "Multi-provider settings: swap between Ollama, OpenAI, Anthropic, or regex fallback without code changes",
  },
  {
    id: "agentic-demo",
    type: "component",
    component: "AgenticSystems",
    instructions: "Explore the three pillars of stable agentic systems. Each pillar includes principles, anti-patterns, and real examples.",
  },
  {
    id: "synthesis",
    type: "text",
    title: "Key Takeaways",
    bullets: [
      { label: "Density = Control", desc: "Every resolved dimension is a confabulation vector eliminated" },
      { label: "Systematic > Ad Hoc", desc: "10 channels with 45+ sub-dimensions catch what intuition misses" },
      { label: "Data Proves It", desc: "37.5% hallucination (vague) vs 0% (dense) — measurable, repeatable" },
      { label: "Consistency Matters", desc: "Same spec → same output, every time — the foundation of engineering" },
      { label: "Agents Amplify Everything", desc: "Vagueness compounds through pipelines; density compounds through pipelines too" },
      { label: "Spec Before Code", desc: "The Architecture Agent doesn't write code — it writes the spec that makes code writing deterministic" },
    ],
  },
  {
    id: "quiz-intro",
    type: "text",
    title: "Engineering Professional Assessment",
    subtitle: "18 Questions · 6 Sections · Certificate on Completion",
    body: "Each question requires applying the density methodology and agentic systems principles to novel engineering scenarios. This is not a recall test — it tests whether you can identify hallucination vectors, diagnose density failures, and design stable systems.",
    keyTakeaway: "Pass threshold: 13 / 18 (72%). A personalised certificate is generated on completion regardless of outcome.",
  },
  {
    id: "quiz",
    type: "component",
    component: "WorkingWithQuiz",
    instructions: "Answer all 18 questions across 6 sections. Select an answer, then click Reveal to see the explanation before advancing.",
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
  DensityMethodology,
  AgentWalkthrough,
  ComparativeResults,
  HallucinationComparison,
  ConsistencyVisualization,
  AgenticSystems,
  WorkingWithQuiz,
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
