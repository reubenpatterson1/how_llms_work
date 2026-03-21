import { useState, useMemo } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308",
};

const SECTIONS = [
  { name: "Functional Testing", icon: "\u25C8" },
  { name: "Unit Testing", icon: "\u229E" },
  { name: "E2E Testing", icon: "\u25C9" },
  { name: "Happy Path Fallacy", icon: "\u25B3" },
  { name: "Load & Scale Testing", icon: "\u2B21" },
];

const QUESTIONS = [
  // Section 0: Functional Testing
  {
    section: 0,
    q: `A functional test suite for the Hello World app achieves 100% pass rate. However, the app uses OpenWeatherMap instead of the specified api.weather.gov. How did this happen?`,
    options: [
      `The test framework has a bug`,
      `The tests were derived from the implementation (which uses OpenWeatherMap) rather than the spec (which requires api.weather.gov) \u2014 they verify the wrong behavior correctly`,
      `OpenWeatherMap and api.weather.gov return the same data`,
      `The API endpoint doesn't matter for functional testing`,
    ],
    answer: 1,
    explanation: `This is the core risk of implementation-derived tests. The LLM generated code using OpenWeatherMap (its training default) and then generated tests that verify OpenWeatherMap calls. Both are internally consistent but wrong per spec. Spec-driven tests would have asserted calls to api.weather.gov and caught the error immediately.`,
  },
  {
    section: 0,
    q: `The spec says "Error state shown when API request fails." An LLM generates a test that mocks a 404 response and checks for an error message. Is this sufficient?`,
    options: [
      `Yes \u2014 404 covers the error case`,
      `No \u2014 it covers one error type. Production errors include 429 (rate limit), 500 (server error), network timeout, DNS failure, and malformed response. Each requires different handling and different user messages`,
      `Yes \u2014 if one error type works, all will work because they use the same error handling code`,
      `No \u2014 but only because 404 isn't a real API error`,
    ],
    answer: 1,
    explanation: `"API request fails" is an underspecified requirement with at least 5 failure modes. A 404 is "resource not found" (show "city not supported"). A 429 is "rate limited" (show "please wait"). A 500 is "server error" (show "try again later"). Each failure mode may need different UI treatment. Testing only 404 gives false confidence that error handling works. The spec should enumerate failure modes; the tests should cover each one.`,
  },
  {
    section: 0,
    q: `A team has 8 requirements and 8 functional tests, all passing. A new developer adds a 9th feature (dark mode toggle) but no requirement exists for it. The test suite still passes. What's the risk?`,
    options: [
      `No risk \u2014 extra features are always welcome`,
      `The new feature is untested AND unspecified. If the LLM generated dark mode (from training defaults) without it being requested, it's a confabulation that happens to look useful. It could break in production, interact poorly with the animation CSS, or violate accessibility requirements \u2014 and no test would catch it.`,
      `The team should just add a test for dark mode`,
      `Functional tests don't cover UI features`,
    ],
    answer: 1,
    explanation: `Unspecified features are confabulations \u2014 even beneficial-looking ones. Dark mode interacts with the typewriter animation colors, the weather card styling, and the dropdown theme. If the LLM generated it without constraints, it likely used training defaults (simple body class toggle) that won't handle all component-specific styles. The test suite can't catch regressions in unspecified features because there's no spec to test against. The fix: either add dark mode to the spec and design it properly, or remove the confabulated feature.`,
  },

  // Section 1: Unit Testing
  {
    section: 1,
    q: `An LLM generates 3 unit tests for fetchWeather(lat, lon). All pass. Red Hat Research found that 34-62% of LLM-generated tests are syntactically invalid. Why did these pass?`,
    options: [
      `The LLM used in this project is better than average`,
      `Three tests is such a small sample that survivorship bias makes them look reliable. Additionally, LLM-generated tests that do compile tend to be trivially correct (happy path assertions) rather than meaningfully rigorous`,
      `Unit tests are simpler than other test types so LLMs handle them well`,
      `The test framework auto-corrects syntax errors`,
    ],
    answer: 1,
    explanation: `With only 3 tests, you're seeing the tests that happened to compile and pass. LLMs often generate many more tests that fail \u2014 those get discarded. The surviving 3 are typically the simplest happy-path assertions: "it returns something", "the result has a temp field", "it doesn't throw". These pass easily but provide no meaningful coverage of error paths, edge cases, or boundary conditions. The 34-62% invalid rate applies to comprehensive test suites, not cherry-picked survivors.`,
  },
  {
    section: 1,
    q: `The WeatherService unit tests mock fetch() to return valid weather data. A developer argues mocks are "cheating" and wants to test against the real API. What's the tradeoff?`,
    options: [
      `Real API tests are always better because they test real behavior`,
      `Mocked tests verify parsing logic deterministically and instantly. Real API tests also verify network handling, but are slow (2-5s per test), flaky (API may be down), rate-limited (api.weather.gov throttles), and can't test error scenarios reliably. Use mocks for unit tests, real API for a small integration test suite`,
      `Mocks should be avoided entirely \u2014 they give false confidence`,
      `Real API tests are impossible because api.weather.gov doesn't have a sandbox`,
    ],
    answer: 1,
    explanation: `Unit tests should be fast, deterministic, and isolated \u2014 mocks achieve this. But mocks only test your code's parsing and handling logic, not the actual API contract. The ideal approach: mock-based unit tests for all paths (happy + error), plus a small integration test suite (1-2 tests) that hits the real API to verify the contract hasn't changed. This gives you speed (mocked suite runs in <1s) plus confidence (integration suite validates the real world).`,
  },
  {
    section: 1,
    q: `An LLM generates a unit test for CitySelector: "renders 15 city options." A reviewer notes this test hardcodes the number 15. If the city list changes to 20, the test fails even though the component works correctly. What's the design flaw?`,
    options: [
      `The test is too strict \u2014 it should use "greater than 0" instead`,
      `The test couples to implementation data (the specific count) rather than the behavioral contract (the component renders all cities passed to it). A better test: pass a mock array of N cities, verify N options rendered. This tests the component's behavior, not a specific dataset`,
      `The city count should be a constant shared between component and test`,
      `Unit tests shouldn't test rendering`,
    ],
    answer: 1,
    explanation: `The flaw is testing data rather than behavior. "15" is an implementation detail that could change. The behavioral contract is: "given an array of cities, render one option per city." A test that passes [{name:"A"},{name:"B"}] and asserts 2 options tests the behavior. A test that asserts exactly 15 tests a data snapshot. LLMs frequently generate data-coupled tests because their training data shows tests with hardcoded expectations.`,
  },

  // Section 2: E2E Testing
  {
    section: 2,
    q: `An E2E test for the Hello World app passes locally but fails in CI. The failure is on "Verify Animation" \u2014 the typewriter animation doesn't complete within the 2-second timeout. Why?`,
    options: [
      `The CI environment is broken`,
      `CI environments typically have slower CPUs and no GPU acceleration. The typewriter animation depends on CSS animation timing which can be slower in headless browsers. The test's 2s timeout was calibrated for a developer laptop, not a CI container. Fix: use animation-complete events instead of fixed timeouts, or increase the timeout for CI`,
      `CSS animations don't work in CI`,
      `The test has a race condition that only appears sometimes`,
    ],
    answer: 1,
    explanation: `E2E timing issues are the #1 cause of CI flakiness. CSS animations in headless Chrome on a shared CI runner can be 3-5x slower than on a developer's M-series MacBook. Hardcoded timeouts are brittle \u2014 they work on fast machines and fail on slow ones. The robust solution: listen for the animationend event or use waitForSelector that polls for the final state rather than waiting a fixed duration. This makes the test environment-independent.`,
  },
  {
    section: 2,
    q: `The E2E test "Select City \u2192 Wait for Weather \u2192 Verify Display" passes when run alone but fails when run after 50 other tests in the full suite. What's likely happening?`,
    options: [
      `The test framework has a memory leak`,
      `State pollution from previous tests. Earlier tests may have left the app in a state where the city dropdown has a pre-selected value, the weather cache contains stale data, or a pending fetch from a previous test interferes. Each E2E test should start from a clean state: fresh page load, cleared storage, no pending network requests`,
      `The API rate-limited after 50 requests`,
      `The test is flaky and should be retried`,
    ],
    answer: 1,
    explanation: `State pollution is the second most common E2E failure mode (after timing). If test #3 selects Denver and test #51 assumes no city is selected, the test fails because the dropdown already shows Denver. LLM-generated E2E tests rarely include cleanup steps because tutorial E2E tests typically show a single test in isolation. The fix: beforeEach should reload the page, clear localStorage, and abort pending fetches. This adds ~500ms per test but eliminates cross-test interference entirely.`,
  },
  {
    section: 2,
    q: `A team runs E2E tests with "API Timeout" injection. Step 6 ("Wait for Weather") fails as expected, but Step 7 ("Verify Display") also runs and passes (incorrectly). Why is this a problem?`,
    options: [
      `Step 7 passing after Step 6 fails is correct behavior`,
      `Step 7 should have been skipped, not run. It passed because it checked for the EXISTENCE of the weather display element (which shows a loading state), not for VALID content. The test asserts "weather card is visible" rather than "weather card shows temperature > 0". This masks the failure \u2014 the card is visible but empty or stuck on loading`,
      `The failure injection isn't working correctly`,
      `E2E tests should always run all steps regardless of failures`,
    ],
    answer: 1,
    explanation: `This is a cascade failure masked by weak assertions. Step 7's assertion is "weather display exists" rather than "weather display contains valid data." After an API timeout, the display might show a loading spinner, "undefined" for temperature, or a stale cached value \u2014 all of which satisfy "element exists." Strong E2E assertions verify content, not just presence: "temperature is a number between -50 and 150", "condition text is non-empty." LLM-generated E2E tests frequently use existence checks because they're simpler to generate.`,
  },

  // Section 3: Happy Path Fallacy
  {
    section: 3,
    q: `The Hello World app's test suite has 100% line coverage and all tests pass. A production user reports: "I selected Miami, weather showed briefly, then I quickly selected Denver. Now it shows Denver's name but Miami's weather." What happened?`,
    options: [
      `The weather API returned wrong data`,
      `Race condition: the Miami request completed after the Denver request was initiated. The response handler updated the display with Miami's data even though Denver was now selected. LLM-generated code rarely handles request cancellation because race conditions aren't in tutorial examples. Fix: use AbortController to cancel the previous request when a new city is selected`,
      `The browser cached Miami's weather`,
      `The test framework doesn't support rapid selections`,
    ],
    answer: 1,
    explanation: `Race conditions are the quintessential happy-path blind spot. In tutorials and tests, users wait patiently for each request to complete before making the next selection. In production, users click rapidly. The LLM generated code that handles one request at a time without cancellation \u2014 it works perfectly in sequential testing and fails in real usage. 100% line coverage didn't help because the code path for "second request arrives before first completes" doesn't exist \u2014 it's a missing code path, not an untested one.`,
  },
  {
    section: 3,
    q: `An LLM generates the Happy Path test: "typing in the city search box filters cities." But the Hello World app uses a dropdown, not a search box. The test passes because the LLM ALSO generated a search box (confabulated feature). What does this reveal about LLM test generation?`,
    options: [
      `The LLM improved the app with a useful feature`,
      `The LLM generated tests that are consistent with its OWN implementation, not with the spec. The search box is a confabulated feature (city search is the most common pattern in the LLM's training data). The test validates the confabulation rather than catching it. This is why test generation and code generation must be independent processes`,
      `Search boxes are better than dropdowns, so this is an improvement`,
      `The test framework should detect confabulated features`,
    ],
    answer: 1,
    explanation: `This is the "grading its own homework" problem. The LLM's training data associates city selection with search-style inputs (Google Maps, Uber, etc.). It confabulates a search box, then generates tests that exercise the search box. The code and tests are internally consistent but both wrong per spec. Independent test generation \u2014 tests derived from the spec by a different process than the one that generated the code \u2014 would have tested for a dropdown and caught the confabulation.`,
  },
  {
    section: 3,
    q: `A security auditor finds that the Hello World app's weather fetch doesn't sanitize the lat/lon values from the city data before inserting them into the URL. The test suite has 100% coverage and all pass. Why?`,
    options: [
      `Sanitization isn't needed for lat/lon`,
      `The test data only uses valid lat/lon values. No test passes negative, NaN, Infinity, or string values for coordinates. LLMs generate tests with realistic data because that's what training examples use. Security edge cases (injection, overflow, type coercion) require adversarial thinking that LLMs don't perform unless explicitly prompted`,
      `JavaScript automatically sanitizes URL parameters`,
      `The city data is hardcoded so it can't be tampered with`,
    ],
    answer: 1,
    explanation: `LLM-generated tests use realistic test data: valid coordinates for real cities. They don't test what happens when coordinates are NaN, Infinity, "40.7128; DROP TABLE cities", or -999999. Even with hardcoded city data, the function's interface accepts any lat/lon. If another developer reuses fetchWeather() with user input, unsanitized coordinates could cause unexpected API behavior. Security testing requires adversarial thinking: "what if someone passes malicious input?" This mindset is absent from the LLM's training data, which overwhelmingly shows cooperative test scenarios.`,
  },

  // Section 4: Load & Scale Testing
  {
    section: 4,
    q: `Load testing the Hello World app reveals a "hockey stick" response time curve at 40 concurrent users. The LLM-generated code has no throttling. What's the cheapest fix?`,
    options: [
      `Add more servers`,
      `Implement client-side request debouncing and a shared request cache. If 40 users in Denver all trigger weather fetches simultaneously, the cache ensures only 1 API call is made. Debouncing ensures rapid city changes don't fire multiple requests. Cost: ~20 lines of code. Impact: capacity increases from 40 to 200+ effective users`,
      `Upgrade to a paid weather API`,
      `Rate-limit users to 1 request per minute`,
    ],
    answer: 1,
    explanation: `The hockey stick at 40 users is caused by 40 simultaneous API calls overwhelming the connection pool and hitting api.weather.gov's rate limits. A shared cache with a 5-minute TTL means the second user requesting Denver weather gets a cached response (0ms) instead of a new API call. Debouncing prevents rapid city switching from creating request storms. These are ~20 lines of code that transform the scaling characteristics without infrastructure changes. LLMs don't generate caching or debouncing by default because tutorials don't need them.`,
  },
  {
    section: 4,
    q: `The load test shows 100% success rate at 20 users but only 60% at 60 users. The 40% failures are all "TypeError: Cannot read property 'temperature' of undefined." What caused this?`,
    options: [
      `The API returns different data under load`,
      `Under high concurrency, some API responses are rate-limited (429) or timeout. The LLM-generated code doesn't check the response status before accessing nested properties (response.properties.periods[0].temperature). A 429 response has no 'properties' field, causing the TypeError. Fix: validate response structure before accessing nested data`,
      `JavaScript has a concurrency limit that causes undefined values`,
      `The temperature field was renamed in a recent API update`,
    ],
    answer: 1,
    explanation: `This is the intersection of load testing and happy-path coding. The LLM generated: const temp = data.properties.periods[0].temperature without checking if data.properties exists. Under normal load, the API always returns valid data. Under high load, some requests get 429 responses or timeout, returning non-standard response structures. The fix: defensive access (data?.properties?.periods?.[0]?.temperature) or explicit status code checking before parsing. LLMs generate the happy-path access pattern because 99% of their training examples don't check response structure.`,
  },
  {
    section: 4,
    q: `A team decides their load test target is 100 concurrent users. They optimize until the hockey stick moves from 40 to 100 users. Six months later, actual usage hits 150 users and the app crashes. What was wrong with their approach?`,
    options: [
      `They should have targeted 200 users`,
      `Fixed-target load testing optimizes for a number, not for resilience. When the hockey stick moves from 40 to 100, the system still breaks catastrophically at 101+. Resilient design requires graceful degradation: rate limiting, circuit breakers, queue-based processing, and cached fallbacks that maintain partial service under any load, not just below the target`,
      `Load testing can't predict future usage`,
      `They needed to rewrite the app in a more performant language`,
    ],
    answer: 1,
    explanation: `Moving the hockey stick doesn't eliminate it \u2014 it just delays the crash. At 100 users everything works; at 150, it fails catastrophically. Resilient design ensures the app degrades gracefully: at 100 users, full service; at 150 users, cached weather (30s stale); at 200 users, weather unavailable but animation and reset still work. This requires circuit breakers, fallback responses, and priority queuing \u2014 patterns that LLMs don't generate because tutorials optimize for the demo case, not the overload case.`,
  },
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function IntroScreen({ onStart, name, setName }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 40px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u25B3"}</div>
      <h2 style={{ color: C.text, fontSize: 28, marginBottom: 8 }}>Engineering Professional Assessment</h2>
      <p style={{ color: C.accent, fontSize: 16, marginBottom: 24 }}>Testing LLM-Generated Code</p>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        15 questions across 5 sections testing your ability to identify testing blind spots,
        diagnose happy-path fallacies, and design robust test strategies for LLM-generated code.
        Pass threshold: 11/15 (73%).
      </p>
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="Your name (for certificate)"
        style={{ width: "100%", maxWidth: 300, padding: "10px 14px", background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14,
          marginBottom: 16, outline: "none", textAlign: "center" }}
      />
      <br />
      <button onClick={onStart} disabled={!name.trim()}
        style={{ background: C.accent, color: "#fff", border: "none", padding: "12px 32px",
          borderRadius: 6, fontSize: 15, cursor: name.trim() ? "pointer" : "default",
          opacity: name.trim() ? 1 : 0.5 }}>
        Begin Assessment
      </button>
    </div>
  );
}

function SectionHeader({ section }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 40px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{section.icon}</div>
      <h2 style={{ color: C.text, fontSize: 24 }}>Section: {section.name}</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginTop: 8 }}>3 questions</p>
    </div>
  );
}

function QuestionScreen({ q, qNum, total, selected, setSelected, revealed, onReveal, onNext }) {
  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "20px 30px" }}>
      <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>
        Question {qNum} of {total}
      </div>
      <p style={{ color: C.text, fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}>{q.q}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {q.options.map((opt, i) => {
          let bg = C.surface;
          let borderColor = C.border;
          if (revealed) {
            if (i === q.answer) { bg = `${C.green}15`; borderColor = C.green; }
            else if (i === selected && i !== q.answer) { bg = `${C.red}15`; borderColor = C.red; }
          } else if (i === selected) {
            bg = `${C.accent}15`; borderColor = C.accent;
          }

          return (
            <div key={i} onClick={() => !revealed && setSelected(i)}
              style={{
                background: bg, border: `1px solid ${borderColor}`, borderRadius: 6,
                padding: "12px 16px", cursor: revealed ? "default" : "pointer",
                transition: "all 0.2s",
              }}>
              <span style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{opt}</span>
            </div>
          );
        })}
      </div>

      {!revealed && selected !== null && (
        <button onClick={onReveal}
          style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
            borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          Reveal Answer
        </button>
      )}

      {revealed && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: selected === q.answer ? `${C.green}10` : `${C.red}10`,
            border: `1px solid ${selected === q.answer ? C.green : C.red}33`,
            borderRadius: 6, padding: "12px 16px", marginBottom: 16,
          }}>
            <p style={{ color: selected === q.answer ? C.green : C.red, fontSize: 13, margin: "0 0 4px",
              fontWeight: 600 }}>
              {selected === q.answer ? "Correct!" : "Incorrect"}
            </p>
            <p style={{ color: C.textDim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {q.explanation}
            </p>
          </div>
          <button onClick={onNext}
            style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
              borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Certificate({ name, score, total, sectionScores }) {
  const pct = Math.round((score / total) * 100);
  const passed = score >= 11;
  const tier = pct >= 93 ? "Distinction" : pct >= 73 ? "Pass" : "Below Threshold";
  const id = `TLLM-${hashCode(name + score)}-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{
        background: C.surface, border: `2px solid ${passed ? C.green : C.red}`,
        borderRadius: 12, padding: "40px 32px", textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{passed ? "\u25C8" : "\u25B3"}</div>
        <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>
          {passed ? "Certificate of Completion" : "Assessment Result"}
        </h2>
        <p style={{ color: C.accent, fontSize: 14, marginBottom: 24 }}>
          Engineering Professional — Testing with LLMs
        </p>

        <p style={{ color: C.text, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{name}</p>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
          Score: {score}/{total} ({pct}%) — {tier}
        </p>

        {/* Section breakdown */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Section</th>
              <th style={{ textAlign: "right", padding: "6px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((sec, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 12px", color: C.text, fontSize: 13,
                  borderBottom: `1px solid ${C.border}` }}>
                  {sec.icon} {sec.name}
                </td>
                <td style={{ padding: "6px 12px", color: C.text, fontSize: 13, textAlign: "right",
                  borderBottom: `1px solid ${C.border}` }}>
                  {sectionScores[i]}/3
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ color: C.textDim, fontSize: 11 }}>Certificate ID: {id}</p>
        <p style={{ color: C.textDim, fontSize: 11 }}>
          How to Test with LLMs — {new Date().toLocaleDateString()}
        </p>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button onClick={() => window.print()}
          style={{ background: "none", color: C.textDim, border: `1px solid ${C.border}`,
            padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Print Certificate
        </button>
      </div>
    </div>
  );
}

export default function TestingQuiz() {
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState("");
  const [seqIdx, setSeqIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const sequence = useMemo(() => {
    const seq = [];
    for (let s = 0; s < SECTIONS.length; s++) {
      seq.push({ type: "section", section: s });
      QUESTIONS.filter(q => q.section === s).forEach((q, qi) => {
        seq.push({ type: "question", question: q, globalIdx: QUESTIONS.indexOf(q) });
      });
    }
    return seq;
  }, []);

  const current = sequence[seqIdx];

  const handleNext = () => {
    if (current?.type === "question" && selected !== null) {
      setAnswers(prev => ({ ...prev, [current.globalIdx]: selected }));
    }
    setSelected(null);
    setRevealed(false);
    if (seqIdx < sequence.length - 1) {
      setSeqIdx(seqIdx + 1);
    } else {
      setPhase("done");
    }
  };

  if (phase === "intro") {
    return <IntroScreen onStart={() => setPhase("sequence")} name={name} setName={setName} />;
  }

  if (phase === "done") {
    const score = QUESTIONS.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
    const sectionScores = SECTIONS.map((_, si) =>
      QUESTIONS.filter(q => q.section === si)
        .reduce((s, q) => s + (answers[QUESTIONS.indexOf(q)] === q.answer ? 1 : 0), 0)
    );
    return <Certificate name={name} score={score} total={QUESTIONS.length} sectionScores={sectionScores} />;
  }

  if (current.type === "section") {
    return (
      <div>
        <SectionHeader section={SECTIONS[current.section]} />
        <div style={{ textAlign: "center" }}>
          <button onClick={handleNext}
            style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
              borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
            Start Section
          </button>
        </div>
      </div>
    );
  }

  const qNum = Object.keys(answers).length + 1;

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
  );
}
