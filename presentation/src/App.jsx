import { useState, useEffect, useCallback } from "react";
import AttentionAnimation from "./components/AttentionAnimation";
import WeightOrigins from "./components/WeightOrigins";
import AttentionDilution from "./components/AttentionDilution";
import ContextDensity from "./components/ContextDensity";
import DissociatingViz from "./components/DissociatingViz";
import FeatureGrid3D from "./components/FeatureGrid3D";
import LandscapeOutput from "./components/LandscapeOutput";
import HallucinationMap from "./components/HallucinationMap";
import ConfidenceLandscape3D from "./components/ConfidenceLandscape3D";
import EngineeringProfQuiz from "./components/EngineeringProfQuiz";

const SLIDES = [
  {
    id: "title",
    type: "text",
    title: "How Large Language Models Actually Work",
    subtitle: "An Interactive Journey Through Attention, Context, and Cognition",
    body: "Use arrow keys or click the navigation buttons to advance through the presentation. Each section includes interactive visualizations you can explore.",
  },
  {
    id: "agenda",
    type: "text",
    title: "What We'll Cover",
    bullets: [
      { label: "Self-Attention", desc: "The core mechanism that lets transformers understand relationships between words" },
      { label: "Where Weights Come From", desc: "How billions of training sentences forge the 3x3 attention matrix" },
      { label: "Attention Dilution", desc: "What happens when noise competes with signal for the model's focus" },
      { label: "Context Density", desc: "Why how you write a prompt matters as much as what you write" },
      { label: "Feature Activation Landscape", desc: "3D view of how specific tokens create sharp peaks while vague tokens stay flat" },
      { label: "How Landscape Impacts Output", desc: "Training defaults, sampling variance, and confabulation from unresolved dimensions" },
      { label: "Hallucination Map", desc: "Token-by-token trace showing exactly where the model executes vs invents" },
      { label: "Confidence Landscape", desc: "3D view of certainty vs doubt across every generated token" },
      { label: "Language vs. Thought", desc: "Understanding where LLMs excel and where they fall short" },
    ],
  },
  {
    id: "attention-intro",
    type: "text",
    title: "Self-Attention: The Core Mechanism",
    subtitle: "How transformers decide which words matter to each other",
    body: 'Every word in a sentence looks at every other word and asks: "How relevant are you to me?" This is computed through dot products between Query and Key vectors, scaled and normalized through softmax to produce attention weights. These weights then blend Value vectors into context-aware representations.',
    keyTakeaway: "Self-attention is how transformers move beyond simple word-by-word processing to understand relationships across an entire sequence.",
  },
  {
    id: "attention-demo",
    type: "component",
    component: "AttentionAnimation",
    instructions: 'Click any word to start, then step through the attention computation. Try clicking "it" to see how it resolves coreference back to "animal".',
  },
  {
    id: "weights-intro",
    type: "text",
    title: "Where Weights Come From",
    subtitle: "How billions of training sentences forge the attention matrix",
    body: "The attention weights we just visualized weren't programmed by hand -- they were learned from training data. Every time two words appeared together in a meaningful context across billions of web pages, the gradient update nudged their Q/K dot product a tiny bit higher. Billions of nudges later, the 3x3 matrix encodes the statistical relationships of human language.",
    keyTakeaway: "Weights are crystallized co-occurrence. Words that frequently appeared together in predictively useful contexts develop strong mutual attention. This is both the model's strength and its limitation -- it can only attend to patterns it has seen.",
  },
  {
    id: "weights-demo",
    type: "component",
    component: "WeightOrigins",
    instructions: "Choose a 3-word sentence, then click any cell in the matrix to see the training sentences that built that weight. Use 'Animate Training' or the slider to watch weights grow from zero.",
  },
  {
    id: "dilution-intro",
    type: "text",
    title: "Attention Dilution: The Noise Problem",
    subtitle: "When irrelevant tokens steal attention from what matters",
    body: "Softmax distributes probability mass across ALL tokens in the context. When noise words are added, they each claim a small share of attention weight. Individually, they seem harmless. Collectively, they can significantly reduce the attention available for the words that actually carry meaning.",
    keyTakeaway: "More tokens in the context doesn't mean more information. Noise dilutes the signal that attention can focus on.",
  },
  {
    id: "dilution-demo",
    type: "component",
    component: "AttentionDilution",
    instructions: "Add noise batches and watch how the attention weights on core words (green) get diluted as more irrelevant tokens (red) compete for attention probability mass.",
  },
  {
    id: "density-intro",
    type: "text",
    title: "Context Density: Writing Better Prompts",
    subtitle: "The same task, three ways -- from vague to precise",
    body: "If attention is a limited resource and noise dilutes it, then every token in your prompt should earn its place. Context density measures how much task-relevant information each token carries. Filler words inflate the softmax denominator without contributing signal. Specific, concrete tokens create sharp attention peaks that guide the model precisely.",
    keyTakeaway: "The goal isn't fewer words -- it's fewer words per decision resolved.",
  },
  {
    id: "density-demo",
    type: "component",
    component: "ContextDensity",
    instructions: "Compare three versions of the same prompt. Click individual tokens to see their density scores and what dimensions they resolve. Notice how the dense spec resolves nearly every ambiguity.",
  },
  {
    id: "features-intro",
    type: "text",
    title: "Feature Activation Landscape",
    subtitle: "How tokens light up internal feature dimensions across layers",
    body: "Transformers don't classify tokens into simple categories like 'noun' or 'verb.' Instead, each token activates thousands of learned features simultaneously -- entity type, action, spatial, temporal, technical, domain, and more. Vague words activate many features weakly (broad, flat). Specific words activate few features strongly (tall, narrow). As the signal passes through layers, context from surrounding tokens sharpens the peaks and suppresses the noise.",
    keyTakeaway: "Specific tokens create sharp, narrow activation peaks that compound through layers. Vague tokens create broad, flat activations that the model struggles to disambiguate -- wasting attention budget on competing interpretations.",
  },
  {
    id: "features-demo",
    type: "component",
    component: "FeatureGrid3D",
    instructions: "Switch between Vague and Dense prompts, then animate through layers. Drag to orbit, scroll to zoom. Watch how dense spec tokens grow into towering peaks while vague tokens stay flat.",
  },
  {
    id: "output-intro",
    type: "text",
    title: "How Landscape Impacts Output",
    subtitle: "From internal activations to generated tokens",
    body: "The feature activation landscape doesn't just exist inside the model -- it directly determines what gets generated. A flat, diffuse landscape forces the model to fall back on training data frequency, produces inconsistent outputs across runs, and opens pathways for confabulation. A peaked landscape constrains the output distribution so tightly that the model executes rather than guesses.",
    keyTakeaway: "Every unresolved dimension in your prompt is a hallucination waiting to happen. Dense specs don't make the model smarter -- they eliminate the need to confabulate.",
  },
  {
    id: "output-demo",
    type: "component",
    component: "LandscapeOutput",
    instructions: "Explore three tabs: see how vague prompts mirror training frequency, how Top-K sampling interacts with flat vs peaked distributions, and how each unresolved dimension becomes a confabulation pathway.",
  },
  {
    id: "hallucination-intro",
    type: "text",
    title: "Hallucination Map",
    subtitle: "Where exactly do hallucinations enter the output?",
    body: "Every token the model generates is either grounded in your prompt, logically inferred from it, defaulted from training data patterns, or outright confabulated to fill a gap. By tracing the output token-by-token and inspecting the logit distribution at each position, we can see exactly where the model was executing versus gambling.",
    keyTakeaway: "Hallucinations aren't random failures -- they occur at specific, predictable positions where the prompt left a dimension unresolved. Dense specs close these gaps before the model reaches them.",
  },
  {
    id: "hallucination-demo",
    type: "component",
    component: "HallucinationMap",
    instructions: "Switch between Vague and Dense prompts, then click any token to see its logit distribution. Red tokens are confabulated, gold are defaults, green are grounded. Notice how the vague output is littered with red while the dense output is almost entirely green.",
  },
  {
    id: "confidence-intro",
    type: "text",
    title: "Confidence Landscape",
    subtitle: "Seeing certainty and doubt in three dimensions",
    body: "The Hallucination Map labels each token, but the 3D Confidence Landscape makes the mechanism physical. Each output token becomes a column: the tall front bar is the winning candidate, the bars behind it are runners-up. When the front bar towers alone, the model knew the answer. When it barely rises above the crowd behind it, the model was gambling. Sort by confidence, entropy, or grounding status to watch the pattern separate.",
    keyTakeaway: "Grounded tokens produce solitary peaks. Confabulated tokens produce crowds of near-equals. The 3D shape of the landscape is a direct readout of how much your prompt constrained the output.",
  },
  {
    id: "confidence-demo",
    type: "component",
    component: "ConfidenceLandscape3D",
    instructions: "Drag to orbit, scroll to zoom. Switch prompts and sort modes. Click tokens below the grid to see their logit distributions. Sort by 'By Grounding' to see all hallucination points clustered together.",
  },
  {
    id: "dissociating-intro",
    type: "text",
    title: "Language vs. Thought",
    subtitle: "Why fluent text doesn't mean deep understanding",
    body: "Neuroscience reveals that the human brain uses physically separate networks for language processing and reasoning. LLMs have mastered formal competence -- the rules and patterns of language itself -- but functional competence (reasoning, world knowledge, social understanding) remains inconsistent. Understanding this distinction helps us use LLMs more effectively.",
    keyTakeaway: "Good at language doesn't mean good at thought. Knowing the boundaries helps you leverage LLMs where they're strong and compensate where they're weak.",
  },
  {
    id: "dissociating-demo",
    type: "component",
    component: "DissociatingViz",
    instructions: "Explore the tabs to see how LLMs ace formal language tests but struggle with reasoning, world knowledge, and social understanding. The Brain Map tab shows why.",
  },
  {
    id: "synthesis",
    type: "text",
    title: "Putting It All Together",
    subtitle: "Practical takeaways for working with LLMs",
    bullets: [
      { label: "Attention is the bottleneck", desc: "Every token competes for limited attention weight. Understand this and you understand why prompt structure matters." },
      { label: "Noise has a real cost", desc: "Filler words, redundant context, and irrelevant examples dilute attention away from your actual intent." },
      { label: "Dense prompts win", desc: "Pack more constraints per token. Use specific terms, concrete values, and technical identifiers instead of vague natural language." },
      { label: "Vagueness causes hallucination", desc: "Every unresolved dimension forces the model to confabulate. Constraints close pathways; specificity prevents invention." },
      { label: "Know the limits", desc: "LLMs excel at language form but struggle with reasoning. Provide explicit reasoning scaffolds, external tools, and verification steps." },
    ],
  },
  {
    id: "end",
    type: "text",
    title: "Thank You",
    subtitle: "Questions & Discussion",
    body: "Navigate back to any section to explore the interactive demos further.",
  },
  {
    id: "quiz-intro",
    type: "text",
    title: "Engineering Professional Assessment",
    subtitle: "27 Questions · 9 Sections · Certificate on Completion",
    body: "Each question requires applying the mechanisms from this presentation to novel scenarios — not recalling slide text. You will be asked to reason about new examples drawn from clinical AI, legal systems, domain-shifted corpora, and adversarial prompt design.",
    keyTakeaway: "Pass threshold: 20 / 27 (74%). A personalised certificate is generated on completion regardless of outcome.",
  },
  {
    id: "quiz",
    type: "component",
    component: "EngineeringProfQuiz",
    instructions: "Answer all 27 questions across 9 sections. Select an answer, then click Reveal to see the explanation before advancing.",
  },
];

function TextSlide({ slide }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1120",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 40px",
    }}>
      <div style={{ maxWidth: 860, width: "100%", textAlign: "center" }}>
        {slide.subtitle && (
          <div style={{
            fontSize: 14,
            color: "#E8A838",
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 16,
          }}>
            {slide.subtitle}
          </div>
        )}
        <h1 style={{
          fontSize: slide.id === "title" ? 48 : 38,
          fontWeight: 700,
          color: "#E2E8F0",
          margin: "0 0 24px",
          lineHeight: 1.2,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {slide.title}
        </h1>

        {slide.body && (
          <p style={{
            fontSize: 18,
            color: "#8896A7",
            lineHeight: 1.8,
            maxWidth: 700,
            margin: "0 auto 32px",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}>
            {slide.body}
          </p>
        )}

        {slide.bullets && (
          <div style={{
            display: "grid",
            gridTemplateColumns: slide.bullets.length > 3 ? "1fr 1fr" : "1fr",
            gap: 20,
            textAlign: "left",
            maxWidth: 760,
            margin: "0 auto 32px",
          }}>
            {slide.bullets.map((b, i) => (
              <div key={i} style={{
                background: "rgba(232, 168, 56, 0.06)",
                border: "1px solid rgba(232, 168, 56, 0.15)",
                borderRadius: 12,
                padding: "20px 24px",
              }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#E8A838",
                  marginBottom: 8,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                }}>
                  {b.label}
                </div>
                <div style={{
                  fontSize: 14,
                  color: "#8896A7",
                  lineHeight: 1.6,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                }}>
                  {b.desc}
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.keyTakeaway && (
          <div style={{
            background: "rgba(91, 164, 207, 0.08)",
            border: "1px solid rgba(91, 164, 207, 0.2)",
            borderRadius: 10,
            padding: "16px 24px",
            maxWidth: 650,
            margin: "0 auto",
            textAlign: "left",
          }}>
            <div style={{
              fontSize: 11,
              color: "#5BA4CF",
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 6,
            }}>
              Key Takeaway
            </div>
            <div style={{
              fontSize: 15,
              color: "#C8D6E5",
              lineHeight: 1.6,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              {slide.keyTakeaway}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComponentSlide({ slide }) {
  const components = {
    AttentionAnimation,
    WeightOrigins,
    AttentionDilution,
    ContextDensity,
    DissociatingViz,
    FeatureGrid3D,
    LandscapeOutput,
    HallucinationMap,
    ConfidenceLandscape3D,
    EngineeringProfQuiz,
  };
  const Component = components[slide.component];

  return (
    <div style={{ position: "relative" }}>
      {slide.instructions && (
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(11, 17, 32, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(232, 168, 56, 0.15)",
          padding: "8px 20px",
          textAlign: "center",
        }}>
          <span style={{
            fontSize: 12,
            color: "#E8A838",
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {slide.instructions}
          </span>
        </div>
      )}
      <Component />
    </div>
  );
}

function SlideIndicator({ total, current, onNavigate }) {
  return (
    <div style={{
      display: "flex",
      gap: 6,
      alignItems: "center",
    }}>
      {Array.from({ length: total }, (_, i) => {
        const slide = SLIDES[i];
        const isDemo = slide.type === "component";
        return (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            title={slide.title || slide.component}
            style={{
              width: i === current ? 24 : isDemo ? 10 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              padding: 0,
              background: i === current
                ? "#E8A838"
                : isDemo
                  ? "rgba(91, 164, 207, 0.4)"
                  : "rgba(124, 141, 176, 0.25)",
              transition: "all 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = SLIDES[currentSlide];

  const goNext = useCallback(() => {
    setCurrentSlide(s => Math.min(s + 1, SLIDES.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentSlide(s => Math.max(s - 1, 0));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentSlide]);

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
      background: "#0B1120",
      minHeight: "100vh",
      color: "#C8D6E5",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Navigation bar */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: "rgba(11, 17, 32, 0.95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(124, 141, 176, 0.15)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid rgba(124,141,176,0.2)",
            background: currentSlide === 0 ? "rgba(124,141,176,0.05)" : "rgba(124,141,176,0.1)",
            color: currentSlide === 0 ? "#2D3748" : "#C8D6E5",
            cursor: currentSlide === 0 ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          Previous
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SlideIndicator
            total={SLIDES.length}
            current={currentSlide}
            onNavigate={setCurrentSlide}
          />
          <span style={{
            fontSize: 12,
            color: "#4A5568",
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {currentSlide + 1}/{SLIDES.length}
          </span>
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === SLIDES.length - 1}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid rgba(232,168,56,0.3)",
            background: currentSlide === SLIDES.length - 1
              ? "rgba(124,141,176,0.05)"
              : "rgba(232,168,56,0.15)",
            color: currentSlide === SLIDES.length - 1 ? "#2D3748" : "#E8A838",
            cursor: currentSlide === SLIDES.length - 1 ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          Next
        </button>
      </nav>

      {/* Slide content */}
      <div style={{ paddingBottom: 60 }}>
        {slide.type === "text" && <TextSlide slide={slide} />}
        {slide.type === "component" && <ComponentSlide slide={slide} />}
      </div>
    </div>
  );
}
