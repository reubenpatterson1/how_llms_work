import React, { useState, useRef, useEffect, useCallback } from "react";

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

const REQUIREMENTS = [
  {
    id: 1,
    text: "Page displays animated 'Hello, World!' text on load",
    covered: true,
    tests: [
      "renders Hello World text on mount",
      "animation starts automatically",
    ],
  },
  {
    id: 2,
    text: "Animation uses typewriter effect letter-by-letter",
    covered: true,
    tests: ["text appears letter by letter over animation duration"],
  },
  {
    id: 3,
    text: "Reset button replays the animation from start",
    covered: true,
    tests: ["clicking reset restarts animation from first character"],
  },
  {
    id: 4,
    text: "City dropdown shows 15 US cities",
    covered: true,
    tests: ["dropdown contains exactly 15 city options"],
  },
  {
    id: 5,
    text: "Selecting a city fetches weather from api.weather.gov",
    covered: true,
    tests: [
      "selecting city triggers fetch to api.weather.gov/points/{lat},{lon}",
    ],
  },
  {
    id: 6,
    text: "Weather display shows temperature and conditions",
    covered: true,
    tests: [
      "weather card displays temperature in Fahrenheit and condition text",
    ],
  },
  {
    id: 7,
    text: "API requests include User-Agent header",
    covered: false,
    tests: [],
  },
  {
    id: 8,
    text: "Error state shown when API request fails",
    covered: false,
    tests: [],
  },
];

const TOTAL = REQUIREMENTS.length;
const COVERED = REQUIREMENTS.filter((r) => r.covered).length;
const COVERAGE_PCT = Math.round((COVERED / TOTAL) * 100);
const GAPS = TOTAL - COVERED;

export default function FunctionalTestViz() {
  const [selectedId, setSelectedId] = useState(null);
  const [lines, setLines] = useState([]);
  const containerRef = useRef(null);
  const reqRefs = useRef({});
  const testRefs = useRef({});

  const selected = REQUIREMENTS.find((r) => r.id === selectedId) || null;

  const computeLines = useCallback(() => {
    if (!selected || !containerRef.current) {
      setLines([]);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const reqEl = reqRefs.current[selected.id];
    if (!reqEl) {
      setLines([]);
      return;
    }
    const reqRect = reqEl.getBoundingClientRect();
    const startX = reqRect.right - containerRect.left;
    const startY = reqRect.top + reqRect.height / 2 - containerRect.top;

    const newLines = [];
    if (selected.tests.length === 0) {
      const testEl = testRefs.current["gap"];
      if (testEl) {
        const testRect = testEl.getBoundingClientRect();
        newLines.push({
          x1: startX,
          y1: startY,
          x2: testRect.left - containerRect.left,
          y2: testRect.top + testRect.height / 2 - containerRect.top,
          color: C.red,
        });
      }
    } else {
      selected.tests.forEach((t, i) => {
        const testEl = testRefs.current[`${selected.id}-${i}`];
        if (testEl) {
          const testRect = testEl.getBoundingClientRect();
          newLines.push({
            x1: startX,
            y1: startY,
            x2: testRect.left - containerRect.left,
            y2: testRect.top + testRect.height / 2 - containerRect.top,
            color: C.green,
          });
        }
      });
    }
    setLines(newLines);
  }, [selected]);

  useEffect(() => {
    const timer = setTimeout(computeLines, 60);
    return () => clearTimeout(timer);
  }, [computeLines]);

  useEffect(() => {
    window.addEventListener("resize", computeLines);
    return () => window.removeEventListener("resize", computeLines);
  }, [computeLines]);

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        padding: "32px 40px",
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <h2
        style={{
          margin: "0 0 8px 0",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        Spec-to-Test Mapping
      </h2>
      <p
        style={{
          margin: "0 0 28px 0",
          fontSize: 14,
          color: C.textDim,
          maxWidth: 640,
          lineHeight: 1.5,
        }}
      >
        Hello World Weather App — click a requirement to see its mapped test
        cases.
      </p>

      {/* Two-panel layout with SVG overlay */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          marginBottom: 32,
        }}
      >
        {/* SVG connecting lines */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <defs>
            <marker
              id="arrowGreen"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill={C.green} />
            </marker>
            <marker
              id="arrowRed"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill={C.red} />
            </marker>
          </defs>
          {lines.map((l, i) => {
            const midX = (l.x1 + l.x2) / 2;
            const path = `M${l.x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${l.x2},${l.y2}`;
            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd={
                  l.color === C.red
                    ? "url(#arrowRed)"
                    : "url(#arrowGreen)"
                }
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="20"
                  to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            );
          })}
        </svg>

        {/* Left Panel: Requirements */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.accent,
              marginBottom: 12,
            }}
          >
            Requirements
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {REQUIREMENTS.map((req) => {
              const isSelected = selectedId === req.id;
              return (
                <div
                  key={req.id}
                  ref={(el) => (reqRefs.current[req.id] = el)}
                  onClick={() =>
                    setSelectedId(isSelected ? null : req.id)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: isSelected ? C.accentGlow : C.surface,
                    border: `1px solid ${isSelected ? C.accent : C.border}`,
                    borderLeft: `4px solid ${req.covered ? C.green : C.red}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    ...(isSelected
                      ? { boxShadow: `0 0 16px ${C.accentGlow}` }
                      : {}),
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.textDim,
                      minWidth: 18,
                    }}
                  >
                    {req.id}.
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>
                    {req.text}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      background: req.covered ? C.greenGlow : "rgba(239,68,68,0.12)",
                      color: req.covered ? C.green : C.red,
                    }}
                  >
                    {req.covered
                      ? `${req.tests.length} test${req.tests.length > 1 ? "s" : ""}`
                      : "GAP"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Test Cases */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.accent,
              marginBottom: 12,
            }}
          >
            Test Cases
          </div>

          {!selected && (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: C.textDim,
                fontSize: 14,
                border: `1px dashed ${C.border}`,
                borderRadius: 8,
              }}
            >
              Select a requirement to see its mapped tests
            </div>
          )}

          {selected && selected.covered && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {selected.tests.map((test, i) => (
                <div
                  key={i}
                  ref={(el) =>
                    (testRefs.current[`${selected.id}-${i}`] = el)
                  }
                  style={{
                    padding: "12px 16px",
                    background: C.greenGlow,
                    border: `1px solid ${C.green}`,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      color: C.green,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    &#10003;
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>
                    {test}
                  </span>
                </div>
              ))}
            </div>
          )}

          {selected && !selected.covered && (
            <div
              ref={(el) => (testRefs.current["gap"] = el)}
              style={{
                padding: "20px 20px",
                background: "rgba(239,68,68,0.08)",
                border: `1px solid ${C.red}`,
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.red,
                  marginBottom: 6,
                }}
              >
                Coverage Gap
              </div>
              <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
                No tests cover this requirement. This is a blind spot in the
                LLM-generated test suite.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coverage Summary Bar */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {COVERED}/{TOTAL} requirements covered ({COVERAGE_PCT}%)
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.red,
            }}
          >
            {GAPS} coverage gap{GAPS !== 1 ? "s" : ""} found
          </span>
        </div>

        {/* Bar */}
        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: C.border,
            overflow: "hidden",
            display: "flex",
          }}
        >
          {REQUIREMENTS.map((req) => {
            const isSelected = selectedId === req.id;
            const segmentColor = req.covered ? C.green : C.red;
            return (
              <div
                key={req.id}
                style={{
                  flex: 1,
                  background: segmentColor,
                  opacity: selectedId == null || isSelected ? 1 : 0.25,
                  transition: "opacity 0.2s ease",
                  borderRight:
                    req.id < TOTAL ? `1px solid ${C.bg}` : "none",
                }}
              />
            );
          })}
        </div>

        {/* Insight */}
        <p
          style={{
            marginTop: 14,
            marginBottom: 0,
            fontSize: 13,
            color: C.textDim,
            lineHeight: 1.55,
          }}
        >
          LLM-generated tests covered observable behavior but missed protocol
          requirements (User-Agent) and error handling — two of the most common
          blind spots.
        </p>
      </div>
    </div>
  );
}
