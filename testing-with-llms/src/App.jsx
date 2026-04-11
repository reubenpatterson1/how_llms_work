import { useState, useEffect, useCallback } from "react";
import FunctionalTestViz from "./components/FunctionalTestViz";
import UnitTestExplorer from "./components/UnitTestExplorer";
import E2ETestRunner from "./components/E2ETestRunner";
import HappyPathFallacy from "./components/HappyPathFallacy";
import LoadTestDashboard from "./components/LoadTestDashboard";
import TestingQuiz from "./components/TestingQuiz";

const SLIDES = [
  {
    id: "title",
    type: "text",
    title: "How to Test with LLMs",
    subtitle: "From Working Code to Reliable Code",
    body: "Part 3 decomposed the Hello World Weather App into atomic components, built them in parallel, orchestrated multi-step generation, and monitored costs. The app works — in a demo. This module stress-tests that same app at every level: functional, unit, end-to-end, edge cases, and load. Because code that works once isn't code you can ship.",
  },
  {
    id: "bridge",
    type: "text",
    title: "The Testing Gap in LLM-Generated Code",
    subtitle: "Why generated code passes demos but fails production",
    body: "LLMs are trained on tutorials, blog posts, and open-source code — overwhelmingly happy-path examples. When you ask an LLM to test its own output, it generates tests that mirror its own assumptions. The result: 100% test pass rate on code that breaks the moment a user does something unexpected. This module teaches you to test AGAINST the LLM's blind spots, not alongside them.",
    keyTakeaway: "An LLM that generates both the code AND the tests is grading its own homework. External test design — driven by requirements, not by the generated implementation — is the only reliable strategy.",
  },
  {
    id: "hello-world-recap",
    type: "text",
    title: "Recap: The Hello World Weather App",
    subtitle: "Built in Part 3 — now we break it",
    body: "Our running example has three features: a typewriter animation for 'Hello, World!' text, a reset button that replays the animation, and a weather integration fetching from api.weather.gov for 15 US cities. In Part 3, we decomposed it into 5 components (AnimationEngine, ResetController, WeatherService, CitySelector, LayoutShell), built them in parallel waves, and orchestrated their integration. Now we test each layer.",
    keyTakeaway: "The same decomposition that improved generation quality now improves test design. Each component boundary is a natural test boundary.",
  },
  {
    id: "testing-overview",
    type: "text",
    title: "The Testing Pyramid for LLM-Generated Code",
    subtitle: "Functional · Unit · E2E · Edge Cases · Load",
    bullets: [
      { label: "Functional Tests", desc: "Does the app do what the spec says? Map requirements to verifications — spec-first, not implementation-first." },
      { label: "Unit Tests", desc: "Does each function work correctly? Test the decomposed components in isolation with controlled inputs." },
      { label: "E2E Tests", desc: "Does the full user flow work? Simulate real interactions from page load to weather display." },
      { label: "Edge Case Tests", desc: "What did the LLM assume wouldn't happen? Network failures, empty inputs, rate limits, slow devices." },
      { label: "Load Tests", desc: "Does it survive real traffic? Concurrent users, API rate limits, response time degradation." },
    ],
    keyTakeaway: "LLMs are good at generating unit tests. They're bad at imagining failure. Your testing strategy must compensate for this structural blindness.",
  },
  {
    id: "functional-intro",
    type: "text",
    title: "4a: Functional Testing",
    subtitle: "Does the app do what we asked?",
    body: "Functional tests verify that requirements are met — not that code works internally, but that the user-visible behavior matches the specification. For LLM-generated code, this is critical because the model may have generated code that works differently from what was specified. The test must be derived from the SPEC, not from reading the generated code.",
    keyTakeaway: "Functional tests are spec-to-behavior mappings. If you derive tests from the implementation, you're testing that the LLM is consistent with itself — not that it's correct.",
  },
  {
    id: "functional-principles",
    type: "text",
    title: "Spec-to-Test Mapping",
    subtitle: "Every requirement becomes a verification",
    bullets: [
      { label: "Requirement Tracing", desc: "Each spec item maps to one or more test cases. Unmatched specs = untested behavior = risk." },
      { label: "Behavioral Focus", desc: "Test what the user sees, not how the code works. 'Animation plays on load' not 'useState updates correctly'." },
      { label: "Coverage Gaps", desc: "The gap between specs covered by tests and total specs is your functional risk surface." },
      { label: "Independent Authoring", desc: "Tests should be written from the spec by someone (or something) that hasn't seen the implementation." },
    ],
    keyTakeaway: "A functional test suite with 100% spec coverage and 0% implementation knowledge is the gold standard for LLM-generated code.",
  },
  {
    id: "functional-demo",
    type: "component",
    component: "FunctionalTestViz",
    instructions: "Click each requirement on the left to see its mapped test cases on the right. Green = covered, Red = gap. Notice which requirements the LLM-generated tests miss.",
  },
  {
    id: "unit-intro",
    type: "text",
    title: "4b: Unit Testing",
    subtitle: "Testing individual functions in isolation",
    body: "Unit tests verify that each decomposed component works correctly with controlled inputs. For the Hello World app, this means testing AnimationEngine with various text lengths, WeatherService with mock API responses, CitySelector with edge-case city data, and ResetController with rapid successive clicks. The key insight: LLM-generated unit tests have a 34-62% syntax error rate (Red Hat Research, 2025). Always validate generated tests before trusting them.",
    keyTakeaway: "LLMs generate tests that test the happy path of their own implementation. Effective unit tests come from analyzing the INTERFACE, not the code.",
  },
  {
    id: "unit-principles",
    type: "text",
    title: "Unit Test Strategies for LLM Output",
    subtitle: "Mock strategies · Assertion design · Coverage traps",
    bullets: [
      { label: "Interface-Driven Tests", desc: "Test the function signature contract: given these inputs, expect these outputs. Don't test internal state." },
      { label: "Mock External Dependencies", desc: "WeatherService calls api.weather.gov — mock the HTTP layer. Test the parsing logic, not the network." },
      { label: "Edge Input Matrices", desc: "For each parameter: null, undefined, empty string, very long string, special characters, type mismatch." },
      { label: "The LLM Test Trap", desc: "LLMs generate tests that exercise the code paths they wrote. They don't generate tests for paths they didn't think of." },
    ],
    keyTakeaway: "Generate tests from the interface spec, not from the implementation. An LLM that tests its own code has the same blind spots in both.",
  },
  {
    id: "unit-demo",
    type: "component",
    component: "UnitTestExplorer",
    instructions: "View the fetchWeather function and its tests. Toggle between 'LLM-Generated Tests' (mostly happy path) and 'Complete Tests' (with edge cases) to see the coverage gap. Click 'Run Tests' to see results.",
  },
  {
    id: "e2e-intro",
    type: "text",
    title: "4c: End-to-End Testing",
    subtitle: "Full user flows from page load to final interaction",
    body: "E2E tests simulate real user behavior: load the page, watch the animation, click reset, select a city, verify weather data appears. Unlike unit tests, E2E tests catch integration bugs — where Component A's output doesn't match Component B's input, or where timing between animation completion and user interaction causes state conflicts.",
    keyTakeaway: "E2E tests are the integration check that catches what parallel generation can miss. A component that passes unit tests in isolation may fail when composed.",
  },
  {
    id: "e2e-principles",
    type: "text",
    title: "E2E Testing Approaches",
    subtitle: "Browser automation · Visual regression · Integration points",
    bullets: [
      { label: "User Journey Mapping", desc: "Define the critical path: Load → Animation plays → Reset works → City selected → Weather displays. Each step depends on the previous." },
      { label: "Failure Cascades", desc: "If the animation step fails, all downstream steps are invalid. E2E tests reveal these dependency chains." },
      { label: "Timing Sensitivity", desc: "Animations have duration. API calls have latency. E2E tests must wait correctly — not too short (false fail), not too long (slow suite)." },
      { label: "Visual Regression", desc: "Does the rendered output LOOK correct? Layout shifts, missing elements, and styling bugs are invisible to unit tests." },
    ],
    keyTakeaway: "E2E tests are expensive but irreplaceable. They're the only test level that verifies the user's actual experience.",
  },
  {
    id: "e2e-demo",
    type: "component",
    component: "E2ETestRunner",
    instructions: "Watch the E2E test flow step by step. Click 'Inject Failure' to simulate an API timeout and see how it cascades through downstream steps.",
  },
  {
    id: "happy-path-intro",
    type: "text",
    title: "4d: The Happy Path Fallacy",
    subtitle: "Why LLM-generated tests create a false sense of security",
    body: "The happy path fallacy is the belief that passing tests means working software. LLMs are particularly susceptible because they're trained on code that demonstrates success, not failure. When asked to test a weather API, the LLM generates tests where the API returns valid data, the network is fast, and the user selects a real city. It doesn't generate tests for: API returns 429 (rate limit), network drops mid-request, user double-clicks the dropdown, or city name contains Unicode characters.",
    keyTakeaway: "100% line coverage with 0% failure scenario coverage is worse than 50% coverage that includes error paths. The happy path fallacy is the single most dangerous blind spot in LLM-generated test suites.",
  },
  {
    id: "happy-path-principles",
    type: "text",
    title: "Systematic Edge Case Discovery",
    subtitle: "What LLMs don't test — and why",
    bullets: [
      { label: "Network Failures", desc: "Timeout, DNS failure, partial response, connection reset, SSL errors. LLMs rarely generate these scenarios." },
      { label: "Input Boundaries", desc: "Empty strings, null values, extremely long inputs, special characters, SQL injection attempts, XSS payloads." },
      { label: "State Corruption", desc: "Rapid successive clicks, back button during animation, selecting a city while weather is loading, browser tab switching." },
      { label: "Resource Exhaustion", desc: "API rate limits (429), memory pressure on slow devices, excessive DOM nodes from animation loops." },
      { label: "Training Bias", desc: "LLMs test what they've seen tested. Error handling, rate limiting, and accessibility are underrepresented in training data." },
    ],
    keyTakeaway: "For every happy path test, ask: 'What are 5 ways this could fail in production?' If the LLM can't answer, you've found a blind spot.",
  },
  {
    id: "happy-path-demo",
    type: "component",
    component: "HappyPathFallacy",
    instructions: "Compare the LLM-generated test suite (left) with the real-world scenario list (right). Notice the 'Coverage Illusion' meter: 100% line coverage but only 33% scenario coverage. Click edge cases to see what happens.",
  },
  {
    id: "load-intro",
    type: "text",
    title: "4e: Load & Scale Testing",
    subtitle: "Does it survive real traffic?",
    body: "The Hello World app fetches weather data from api.weather.gov on every city selection. What happens when 100 users select cities simultaneously? The API has rate limits. The browser has connection limits. The server (if you add one) has memory limits. Load testing reveals the breaking point — and for LLM-generated code, the breaking point is usually much lower than expected because the model optimized for correctness, not throughput.",
    keyTakeaway: "LLMs generate code that works for one user. Load testing verifies it works for N users. The gap between 1 and N is where production incidents live.",
  },
  {
    id: "load-principles",
    type: "text",
    title: "Load Testing LLM-Generated Systems",
    subtitle: "Rate limits · Concurrency · Latency curves · Resource saturation",
    bullets: [
      { label: "Rate Limit Awareness", desc: "api.weather.gov recommends no more than ~1 request/second for unauthenticated users. LLM-generated code rarely implements throttling." },
      { label: "Concurrency Patterns", desc: "Response time is linear up to a threshold, then exponential. Find the inflection point before your users do." },
      { label: "The Hockey Stick", desc: "System load vs response time forms a hockey stick curve. The flat part is your capacity. The vertical part is your outage." },
      { label: "Realistic Profiles", desc: "Don't test with identical requests. Vary city selection, timing, and user patterns to match real behavior." },
    ],
    keyTakeaway: "Load testing is the only way to find the hockey stick. LLMs don't know your traffic patterns — they generate code for the tutorial case, not the production case.",
  },
  {
    id: "load-demo",
    type: "component",
    component: "LoadTestDashboard",
    instructions: "Adjust the concurrent users slider and click 'Run Test' to simulate load. Watch the response time curve — find the hockey stick where response time goes vertical. Notice the rate limit consumption chart.",
  },
  {
    id: "synthesis",
    type: "text",
    title: "Key Takeaways",
    bullets: [
      { label: "Spec-Driven Tests", desc: "Derive functional tests from requirements, not implementation. Test what was asked for, not what was generated." },
      { label: "Interface-Driven Units", desc: "Unit tests should exercise the function contract, not the internal code paths the LLM happened to write." },
      { label: "E2E for Integration", desc: "End-to-end tests catch the cross-component bugs that parallel generation introduces." },
      { label: "Fight the Happy Path", desc: "For every passing test, write 3 failure tests. LLMs don't imagine failure — that's your job." },
      { label: "Load Before Launch", desc: "Find the hockey stick in staging, not production. LLM-generated code optimizes for correctness, not throughput." },
      { label: "Test ≠ Trust", desc: "100% coverage with 0% failure scenarios is a liability, not an asset." },
    ],
  },
  {
    id: "quiz-intro",
    type: "text",
    title: "Engineering Professional Assessment",
    subtitle: "15 Questions · 5 Sections · Certificate on Completion",
    body: "Each question tests your ability to design testing strategies for LLM-generated code. You'll diagnose coverage gaps, design edge case tests, identify the happy path fallacy, and analyze load test results — all applied to the Hello World Weather App.",
    keyTakeaway: "Pass threshold: 11 / 15 (73%). A personalised certificate is generated on completion regardless of outcome.",
  },
  {
    id: "quiz",
    type: "component",
    component: "TestingQuiz",
    instructions: "Answer all 15 questions across 5 sections. Select an answer, then click Reveal to see the explanation before advancing.",
  },
  {
    id: "part5-link",
    type: "text",
    title: "Continue to Part 5",
    subtitle: "How to Deploy with LLMs",
    body: "Part 4 tested the Hello World Weather App at every level — functional, unit, E2E, edge cases, and load. The app now has comprehensive test coverage and a known performance envelope. Part 5 takes this tested app and deploys it: pull vs push strategies, code versioning for LLM-generated projects, environment variable management, and auto-scaling configuration.",
    keyTakeaway: "",
    nextModuleUrl: "http://localhost:5177",
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
  FunctionalTestViz,
  UnitTestExplorer,
  E2ETestRunner,
  HappyPathFallacy,
  LoadTestDashboard,
  TestingQuiz,
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
