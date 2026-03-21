import React, { useState, useEffect, useCallback } from "react";

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

const font = "'IBM Plex Sans', system-ui, sans-serif";
const mono = "'IBM Plex Mono', 'Fira Code', monospace";

const codeLines = [
  { tokens: [{ text: "async ", color: C.accent }, { text: "function ", color: C.accent }, { text: "fetchWeather", color: C.yellow }, { text: "(", color: C.textDim }, { text: "lat", color: C.orange }, { text: ", ", color: C.textDim }, { text: "lon", color: C.orange }, { text: ") {", color: C.textDim }] },
  { tokens: [{ text: "  const ", color: C.accent }, { text: "pointsRes", color: C.text }, { text: " = ", color: C.textDim }, { text: "await ", color: C.accent }, { text: "fetch", color: C.yellow }, { text: "(", color: C.textDim }] },
  { tokens: [{ text: "    `", color: C.green }, { text: "https://api.weather.gov/points/", color: C.green }, { text: "${", color: C.accent }, { text: "lat", color: C.orange }, { text: "}", color: C.accent }, { text: ",", color: C.green }, { text: "${", color: C.accent }, { text: "lon", color: C.orange }, { text: "}", color: C.accent }, { text: "`", color: C.green }, { text: ",", color: C.textDim }] },
  { tokens: [{ text: "    { ", color: C.textDim }, { text: "headers", color: C.text }, { text: ": { ", color: C.textDim }, { text: "'User-Agent'", color: C.green }, { text: ": ", color: C.textDim }, { text: "'HowLLMsWork/1.0'", color: C.green }, { text: " } }", color: C.textDim }] },
  { tokens: [{ text: "  );", color: C.textDim }] },
  { tokens: [{ text: "  const ", color: C.accent }, { text: "points", color: C.text }, { text: " = ", color: C.textDim }, { text: "await ", color: C.accent }, { text: "pointsRes", color: C.text }, { text: ".", color: C.textDim }, { text: "json", color: C.yellow }, { text: "();", color: C.textDim }] },
  { tokens: [{ text: "  const ", color: C.accent }, { text: "forecastUrl", color: C.text }, { text: " = ", color: C.textDim }, { text: "points", color: C.text }, { text: ".", color: C.textDim }, { text: "properties", color: C.text }, { text: ".", color: C.textDim }, { text: "forecastUrl", color: C.text }, { text: ";", color: C.textDim }] },
  { tokens: [{ text: "  const ", color: C.accent }, { text: "forecastRes", color: C.text }, { text: " = ", color: C.textDim }, { text: "await ", color: C.accent }, { text: "fetch", color: C.yellow }, { text: "(", color: C.textDim }, { text: "forecastUrl", color: C.text }, { text: ", {", color: C.textDim }] },
  { tokens: [{ text: "    ", color: C.textDim }, { text: "headers", color: C.text }, { text: ": { ", color: C.textDim }, { text: "'User-Agent'", color: C.green }, { text: ": ", color: C.textDim }, { text: "'HowLLMsWork/1.0'", color: C.green }, { text: " }", color: C.textDim }] },
  { tokens: [{ text: "  });", color: C.textDim }] },
  { tokens: [{ text: "  const ", color: C.accent }, { text: "forecast", color: C.text }, { text: " = ", color: C.textDim }, { text: "await ", color: C.accent }, { text: "forecastRes", color: C.text }, { text: ".", color: C.textDim }, { text: "json", color: C.yellow }, { text: "();", color: C.textDim }] },
  { tokens: [{ text: "  return ", color: C.accent }, { text: "{", color: C.textDim }] },
  { tokens: [{ text: "    ", color: C.textDim }, { text: "temp", color: C.text }, { text: ": ", color: C.textDim }, { text: "forecast", color: C.text }, { text: ".properties.periods[", color: C.textDim }, { text: "0", color: C.orange }, { text: "].temperature,", color: C.textDim }] },
  { tokens: [{ text: "    ", color: C.textDim }, { text: "description", color: C.text }, { text: ": ", color: C.textDim }, { text: "forecast", color: C.text }, { text: ".properties.periods[", color: C.textDim }, { text: "0", color: C.orange }, { text: "].shortForecast,", color: C.textDim }] },
  { tokens: [{ text: "    ", color: C.textDim }, { text: "icon", color: C.text }, { text: ": ", color: C.textDim }, { text: "forecast", color: C.text }, { text: ".properties.periods[", color: C.textDim }, { text: "0", color: C.orange }, { text: "].icon", color: C.textDim }] },
  { tokens: [{ text: "  };", color: C.textDim }] },
  { tokens: [{ text: "}", color: C.textDim }] },
];

const llmTests = [
  { name: "fetches weather for valid coordinates", result: "pass" },
  { name: "returns temperature as a number", result: "pass" },
  { name: "returns description as a string", result: "pass" },
];

const completeTests = [
  { name: "fetches weather for valid coordinates", result: "pass" },
  { name: "returns temperature as a number", result: "pass" },
  { name: "returns description as a string", result: "pass" },
  { name: "handles 500 server error from points endpoint", result: "pass" },
  { name: "handles 500 server error from forecast endpoint", result: "pass" },
  { name: "handles network timeout", result: "pass" },
  { name: "handles invalid coordinates (NaN)", result: "pass" },
  { name: "handles API rate limit (429 response)", result: "pass" },
  { name: "handles malformed JSON response", result: "pass" },
  { name: "handles missing properties in forecast response", result: "pass" },
];

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: `2px solid ${C.border}`,
        borderTop: `2px solid ${C.accent}`,
        borderRadius: "50%",
        animation: "uteSpin 0.6s linear infinite",
      }}
    />
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill={C.greenGlow} stroke={C.green} strokeWidth="1" />
      <path d="M5 8l2 2 4-4" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(239,68,68,0.15)" stroke={C.red} strokeWidth="1" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={C.red} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="none" stroke={C.border} strokeWidth="1" />
      <circle cx="8" cy="8" r="2" fill={C.textDim} />
    </svg>
  );
}

function TestCard({ test, status }) {
  const bgMap = {
    pending: "transparent",
    running: C.accentGlow,
    passed: C.greenGlow,
    failed: "rgba(239,68,68,0.1)",
  };
  const borderMap = {
    pending: C.border,
    running: C.accent,
    passed: C.green,
    failed: C.red,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 6,
        border: `1px solid ${borderMap[status]}`,
        background: bgMap[status],
        transition: "all 0.3s ease",
        fontFamily: font,
        fontSize: 13,
      }}
    >
      <div style={{ flexShrink: 0, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {status === "pending" && <PendingIcon />}
        {status === "running" && <Spinner />}
        {status === "passed" && <CheckIcon />}
        {status === "failed" && <FailIcon />}
      </div>
      <span style={{ color: status === "pending" ? C.textDim : C.text }}>
        {test.name}
      </span>
      {status !== "pending" && status !== "running" && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: status === "passed" ? C.green : C.red,
          }}
        >
          {status}
        </span>
      )}
    </div>
  );
}

export default function UnitTestExplorer() {
  const [activeTab, setActiveTab] = useState("llm");
  const [testStatuses, setTestStatuses] = useState(null);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const tests = activeTab === "llm" ? llmTests : completeTests;

  useEffect(() => {
    setTestStatuses(null);
    setRunning(false);
    setHasRun(false);
  }, [activeTab]);

  const runTests = useCallback(() => {
    if (running) return;
    setRunning(true);
    setHasRun(true);
    const initialStatuses = tests.map(() => "pending");
    setTestStatuses(initialStatuses);

    tests.forEach((test, i) => {
      setTimeout(() => {
        setTestStatuses((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          next[i] = "running";
          return next;
        });
      }, i * 200);

      setTimeout(() => {
        setTestStatuses((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          next[i] = test.result === "pass" ? "passed" : "failed";
          return next;
        });
        if (i === tests.length - 1) {
          setRunning(false);
        }
      }, i * 200 + 400);
    });
  }, [tests, running]);

  const allDone = hasRun && !running;

  const llmCoverage = { tests: 3, lineCov: 100, errorPaths: 0 };
  const completeCoverage = { tests: 10, lineCov: 100, errorPaths: 7 };
  const cov = activeTab === "llm" ? llmCoverage : completeCoverage;

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: font,
        padding: 24,
        borderRadius: 12,
        maxWidth: 780,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <style>{`
        @keyframes uteSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Code Panel */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EAB308" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
          <span style={{ marginLeft: 8, fontSize: 12, color: C.textDim, fontFamily: mono }}>
            fetchWeather.js
          </span>
        </div>
        <pre
          style={{
            margin: 0,
            padding: "14px 16px",
            fontFamily: mono,
            fontSize: 12,
            lineHeight: 1.6,
            overflowX: "auto",
          }}
        >
          {codeLines.map((line, li) => (
            <div key={li} style={{ display: "flex" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 28,
                  textAlign: "right",
                  marginRight: 14,
                  color: C.textDim,
                  opacity: 0.4,
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {li + 1}
              </span>
              <span>
                {line.tokens.map((tok, ti) => (
                  <span key={ti} style={{ color: tok.color }}>
                    {tok.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[
          { key: "llm", label: "LLM-Generated Tests" },
          { key: "complete", label: "Complete Tests" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontFamily: font,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: activeTab === tab.key ? C.accent : C.surface,
              color: activeTab === tab.key ? "#fff" : C.textDim,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Test List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tests.map((test, i) => (
          <TestCard
            key={`${activeTab}-${i}`}
            test={test}
            status={testStatuses ? testStatuses[i] || "pending" : "pending"}
          />
        ))}
      </div>

      {/* Run Tests Button */}
      <button
        onClick={runTests}
        disabled={running}
        style={{
          padding: "10px 24px",
          fontFamily: font,
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          cursor: running ? "not-allowed" : "pointer",
          background: running ? C.border : C.accent,
          color: running ? C.textDim : "#fff",
          transition: "all 0.2s ease",
          alignSelf: "center",
        }}
      >
        {running ? "Running..." : "Run Tests"}
      </button>

      {/* Coverage Comparison */}
      {allDone && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 16,
            borderRadius: 8,
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Coverage Report
          </div>

          {/* LLM row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: activeTab === "llm" ? C.accentGlow : "transparent",
              border: `1px solid ${activeTab === "llm" ? C.accent : C.border}`,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: C.text, minWidth: 140 }}>
              LLM-Generated
            </span>
            <CoverageChip label={`${llmCoverage.tests} tests`} color={C.textDim} />
            <CoverageChip label={`${llmCoverage.lineCov}% line coverage`} color={C.green} />
            <CoverageChip label={`${llmCoverage.errorPaths} error paths tested`} color={C.red} />
          </div>

          {/* Complete row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: activeTab === "complete" ? C.accentGlow : "transparent",
              border: `1px solid ${activeTab === "complete" ? C.accent : C.border}`,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: C.text, minWidth: 140 }}>
              Complete Suite
            </span>
            <CoverageChip label={`${completeCoverage.tests} tests`} color={C.textDim} />
            <CoverageChip label={`${completeCoverage.lineCov}% line coverage`} color={C.green} />
            <CoverageChip label={`${completeCoverage.errorPaths} error paths tested`} color={C.green} />
          </div>

          {/* Insight */}
          <div
            style={{
              marginTop: 4,
              padding: "10px 14px",
              borderRadius: 6,
              background: "rgba(234,179,8,0.08)",
              border: `1px solid rgba(234,179,8,0.3)`,
              fontSize: 13,
              fontWeight: 600,
              color: C.yellow,
              textAlign: "center",
            }}
          >
            Same line coverage, vastly different reliability
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageChip({ label, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 4,
        color,
        background: color === C.textDim ? C.border : `${color}18`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
