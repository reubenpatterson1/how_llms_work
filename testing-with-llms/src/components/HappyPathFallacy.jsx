import React, { useState } from "react";

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
  red: "#EF4444",
  yellow: "#EAB308",
  orange: "#F97316",
};

const font = "'IBM Plex Sans', sans-serif";

const happyPathTests = [
  { id: 1, label: "Animation plays 'Hello, World!' on page load" },
  { id: 2, label: "Reset button restarts animation" },
  { id: 3, label: "City dropdown shows 15 cities" },
  { id: 4, label: "Selecting Denver fetches weather data" },
  { id: 5, label: "Weather card displays temperature" },
];

const edgeCases = [
  {
    id: 6,
    label: "API returns 429 rate limit",
    expected: "Show retry message with countdown timer",
    actual: "Unhandled error crashes the component — user sees white screen",
    why: "LLM training data overwhelmingly shows successful API calls. Rate limiting patterns appear in backend code, rarely in frontend test suites the model was trained on.",
  },
  {
    id: 7,
    label: "Network drops mid-request",
    expected: "Timeout message after 10 seconds with retry button",
    actual: "Infinite loading spinner — no timeout configured",
    why: "Fetch examples in training data almost never include AbortController or timeout logic. The 'happy path' fetch pattern is vastly overrepresented.",
  },
  {
    id: 8,
    label: "City name with apostrophe (O'Fallon)",
    expected: "Proper URL encoding of special characters",
    actual: "City not in dropdown, but URL encoding is untested for edge-case characters",
    why: "LLM test generators pick common city names (Denver, Chicago). They don't think adversarially about string encoding because training examples use simple inputs.",
  },
  {
    id: 9,
    label: "Double-click reset during animation",
    expected: "Single clean restart of the animation",
    actual: "Animation stutters — two animation frames run simultaneously",
    why: "Training data tests button clicks as single discrete events. Rapid interaction patterns are rarely represented in example test suites.",
  },
  {
    id: 10,
    label: "Select city while weather is loading",
    expected: "Cancel previous request, fetch new city",
    actual: "Race condition — wrong city's weather displayed when first request resolves after second",
    why: "Race conditions require understanding temporal ordering. LLM tests are sequential by nature and don't model concurrent async operations.",
  },
  {
    id: 11,
    label: "Browser back button during load",
    expected: "Clean navigation, abort pending fetch",
    actual: "Memory leak from abandoned fetch — setState called on unmounted component",
    why: "Component lifecycle cleanup is an intermediate React pattern. LLM-generated tests rarely simulate navigation away from a component mid-operation.",
  },
  {
    id: 12,
    label: "Screen reader announces weather",
    expected: "aria-live region announces weather updates",
    actual: "No accessibility markup — screen reader users get no feedback",
    why: "Accessibility testing is underrepresented in training data. Most example test suites focus on visual output, not assistive technology compatibility.",
  },
  {
    id: 13,
    label: "Slow 3G connection (5s+ latency)",
    expected: "Visible loading indicator within 200ms",
    actual: "No loading state shown — user thinks app is broken and clicks repeatedly",
    why: "Development and test environments use fast connections. LLMs mirror this bias — mocked fetches resolve instantly in training examples.",
  },
  {
    id: 14,
    label: "api.weather.gov returns unexpected JSON schema",
    expected: "Graceful fallback with 'data unavailable' message",
    actual: "Cannot read property of undefined — assumes exact schema shape",
    why: "LLM-generated mocks mirror the expected schema perfectly. Real APIs change schemas, return partial data, or wrap responses differently across versions.",
  },
  {
    id: 15,
    label: "100+ rapid city selections",
    expected: "Debounced requests — only last selection triggers fetch",
    actual: "100 concurrent fetch requests fired, browser tab freezes",
    why: "Performance testing requires adversarial thinking about scale. Training data tests individual actions, not volume patterns that emerge in real usage.",
  },
];

function CheckIcon() {
  return (
    <span style={{ color: C.green, fontWeight: 700, fontSize: 16, marginRight: 8, flexShrink: 0 }}>
      ✓
    </span>
  );
}

function XIcon() {
  return (
    <span style={{ color: C.red, fontWeight: 700, fontSize: 16, marginRight: 8, flexShrink: 0 }}>
      ✗
    </span>
  );
}

function TestRow({ label, passing }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRadius: 6,
        backgroundColor: passing ? C.greenGlow : "transparent",
        marginBottom: 4,
        fontFamily: font,
        fontSize: 14,
        color: C.text,
        lineHeight: 1.5,
      }}
    >
      <CheckIcon />
      <span>{label}</span>
    </div>
  );
}

function EdgeCaseRow({ item, expanded, onToggle }) {
  const isExpanded = expanded === item.id;

  return (
    <div
      style={{
        marginBottom: 4,
        borderRadius: 6,
        border: isExpanded ? `2px solid ${C.orange}` : `1px solid transparent`,
        backgroundColor: isExpanded ? "rgba(249,115,22,0.08)" : "transparent",
        transition: "all 0.2s ease",
      }}
    >
      <div
        onClick={() => onToggle(isExpanded ? null : item.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          padding: "8px 12px",
          cursor: "pointer",
          fontFamily: font,
          fontSize: 14,
          color: C.text,
          lineHeight: 1.5,
          userSelect: "none",
        }}
      >
        <XIcon />
        <span style={{ flex: 1 }}>{item.label}</span>
        <span
          style={{
            color: C.textDim,
            fontSize: 12,
            marginLeft: 8,
            flexShrink: 0,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </div>
      {isExpanded && (
        <div
          style={{
            padding: "4px 12px 12px 36px",
            fontFamily: font,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: C.green, fontWeight: 600 }}>Expected: </span>
            <span style={{ color: C.textDim }}>{item.expected}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: C.red, fontWeight: 600 }}>Actual: </span>
            <span style={{ color: C.textDim }}>{item.actual}</span>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              backgroundColor: C.accentGlow,
              borderLeft: `3px solid ${C.accent}`,
            }}
          >
            <span style={{ color: C.accent, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Why the LLM missed it
            </span>
            <div style={{ color: C.textDim, marginTop: 4 }}>{item.why}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageMeter({ label, percent, color, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
          fontFamily: font,
        }}
      >
        <span style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 18 }}>{percent}%</span>
      </div>
      <div
        style={{
          width: "100%",
          height: 12,
          borderRadius: 6,
          backgroundColor: C.border,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 6,
            backgroundColor: color,
            transition: "width 0.6s ease",
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
      </div>
      <div style={{ color: C.textDim, fontSize: 12, marginTop: 4, fontFamily: font }}>
        {description}
      </div>
    </div>
  );
}

export default function HappyPathFallacy() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div
      style={{
        backgroundColor: C.bg,
        minHeight: "100vh",
        padding: 32,
        fontFamily: font,
        color: C.text,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: C.text,
            marginBottom: 4,
            fontFamily: font,
          }}
        >
          The Happy Path Fallacy
        </h1>
        <p
          style={{
            fontSize: 15,
            color: C.textDim,
            marginTop: 0,
            marginBottom: 32,
            fontFamily: font,
          }}
        >
          What LLMs test vs. what production needs — applied to the Hello World Weather App
        </p>

        {/* Two Columns */}
        <div style={{ display: "flex", gap: 24, marginBottom: 32, alignItems: "flex-start" }}>
          {/* Left Column: LLM-Generated Tests */}
          <div
            style={{
              flex: 1,
              backgroundColor: C.surface,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: 20,
              minWidth: 0,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.green,
                marginTop: 0,
                marginBottom: 16,
                fontFamily: font,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: C.green,
                  display: "inline-block",
                  boxShadow: `0 0 8px ${C.green}66`,
                }}
              />
              LLM-Generated Tests
            </h2>

            {happyPathTests.map((t) => (
              <TestRow key={t.id} label={t.label} passing />
            ))}

            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 8,
                backgroundColor: C.greenGlow,
                textAlign: "center",
                fontFamily: font,
                fontSize: 14,
                fontWeight: 600,
                color: C.green,
              }}
            >
              5/5 passing — 100% pass rate
            </div>
          </div>

          {/* Right Column: Production Scenarios */}
          <div
            style={{
              flex: 1,
              backgroundColor: C.surface,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: 20,
              minWidth: 0,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                background: `linear-gradient(90deg, ${C.red}, ${C.orange})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginTop: 0,
                marginBottom: 16,
                fontFamily: font,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: C.orange,
                  display: "inline-block",
                  boxShadow: `0 0 8px ${C.orange}66`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  background: `linear-gradient(90deg, ${C.red}, ${C.orange})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Production Scenarios
              </span>
            </h2>

            {/* Happy path subset */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.textDim,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                  paddingLeft: 12,
                  fontFamily: font,
                }}
              >
                Happy Path (covered)
              </div>
              {happyPathTests.map((t) => (
                <TestRow key={t.id} label={t.label} passing />
              ))}
            </div>

            {/* Edge cases */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.red,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                  marginTop: 12,
                  paddingLeft: 12,
                  fontFamily: font,
                }}
              >
                Edge Cases (missed by LLM)
              </div>
              {edgeCases.map((item) => (
                <EdgeCaseRow
                  key={item.id}
                  item={item}
                  expanded={expanded}
                  onToggle={setExpanded}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Coverage Illusion Meter */}
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.text,
              marginTop: 0,
              marginBottom: 20,
              fontFamily: font,
            }}
          >
            Coverage Illusion Meter
          </h2>

          <CoverageMeter
            label="Line Coverage"
            percent={100}
            color={C.green}
            description="All code paths the LLM wrote are executed"
          />

          <CoverageMeter
            label="Scenario Coverage"
            percent={33}
            color={C.red}
            description="Only 5 of 15 real-world scenarios are tested"
          />

          <div
            style={{
              marginTop: 20,
              padding: "16px 20px",
              borderRadius: 8,
              backgroundColor: "rgba(234,179,8,0.08)",
              border: `1px solid ${C.yellow}33`,
              textAlign: "center",
              fontFamily: font,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: C.yellow,
                marginBottom: 4,
              }}
            >
              The Coverage Illusion
            </div>
            <div style={{ fontSize: 15, color: C.textDim }}>
              100% line coverage masks <span style={{ color: C.red, fontWeight: 700 }}>67% scenario blindness</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
