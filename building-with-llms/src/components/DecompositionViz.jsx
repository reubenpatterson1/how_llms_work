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

const NODES = [
  {
    id: "animation-engine",
    name: "AnimationEngine",
    icon: "\u25B6",
    brief: "Typewriter animation for greeting text",
    signature: "function AnimationEngine({ text, speed, onComplete })",
    inputs: "string text, number speed (ms per char), callback onComplete",
    outputs: "Animated DOM element rendering text character-by-character",
    prompt:
      'Write a React component that takes a `text` string and renders it with a typewriter animation. Each character should appear one at a time at a configurable `speed` (default 80ms). When the full string has been displayed, call `onComplete()`. Use useState and useEffect. The cursor should blink at the end using a CSS animation. Do not use any external libraries.',
    tokenCost: "~450 input tokens, ~200 output tokens, ~$0.003",
    complexity: "Simple",
  },
  {
    id: "reset-controller",
    name: "ResetController",
    icon: "\u21BA",
    brief: "Manages animation state reset via button",
    signature: "function ResetController({ onReset, disabled })",
    inputs: "callback onReset, boolean disabled",
    outputs: "A styled button that calls onReset when clicked, visually disabled when animation is running",
    prompt:
      'Write a React component that renders a "Reset" button. It accepts an `onReset` callback and a `disabled` boolean prop. When clicked (and not disabled), it calls onReset. Style it with a subtle border, hover glow effect, and a disabled state with reduced opacity. Use only inline styles. Dark theme with blue accent (#3B82F6).',
    tokenCost: "~300 input tokens, ~150 output tokens, ~$0.002",
    complexity: "Simple",
  },
  {
    id: "weather-service",
    name: "WeatherService",
    icon: "\u2601",
    brief: "Fetches weather data from api.weather.gov",
    signature: "function WeatherService({ lat, lon, onData, onError })",
    inputs: "number lat, number lon, callback onData, callback onError",
    outputs: "Calls onData with { temperature, description, humidity, windSpeed } or onError with error message",
    prompt:
      'Write a React component that fetches weather data from the NWS API (api.weather.gov). Given `lat` and `lon` props, first fetch the /points endpoint to get the forecast URL, then fetch the forecast. Pass a User-Agent header "HelloWorldApp/1.0". Call `onData` with parsed weather object or `onError` on failure. Show a loading spinner while fetching. Handle network errors gracefully.',
    tokenCost: "~600 input tokens, ~350 output tokens, ~$0.005",
    complexity: "Complex",
  },
  {
    id: "city-selector",
    name: "CitySelector",
    icon: "\uD83D\uDCCD",
    brief: "Dropdown UI for selecting US cities",
    signature: "function CitySelector({ cities, selected, onSelect })",
    inputs: "array cities [{ name, lat, lon }], string selected, callback onSelect",
    outputs: "A styled <select> dropdown that calls onSelect(city) on change",
    prompt:
      'Write a React component that renders a styled dropdown selector for US cities. It receives a `cities` array of { name, lat, lon } objects, the currently `selected` city name, and an `onSelect` callback. Style it as a dark-themed select element with rounded corners, a subtle border, and a blue focus ring. Include 15 US cities as a default prop. No external dependencies.',
    tokenCost: "~400 input tokens, ~250 output tokens, ~$0.003",
    complexity: "Moderate",
  },
  {
    id: "layout-shell",
    name: "LayoutShell",
    icon: "\u2B1C",
    brief: "Card-based responsive layout wrapper",
    signature: "function LayoutShell({ title, children })",
    inputs: "string title, ReactNode children",
    outputs: "A centered card container with header, responsive padding, and dark theme styling",
    prompt:
      'Write a React layout component that renders a centered card on a dark background (#0B1120). It takes a `title` string for the header and `children` for the body. The card should have a max-width of 480px, rounded corners (12px), a subtle border (#1E293B), and inner padding. The title should be rendered in a semi-bold font with a bottom border. Make it responsive: full-width on mobile with reduced padding. Inline styles only.',
    tokenCost: "~350 input tokens, ~200 output tokens, ~$0.002",
    complexity: "Simple",
  },
];

const complexityColor = (c) =>
  c === "Simple" ? C.green : c === "Moderate" ? C.yellow : C.orange;

export default function DecompositionViz() {
  const [expanded, setExpanded] = useState(null);

  const handleToggle = (id) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const rootX = 400;
  const rootY = 50;
  const rootW = 260;
  const rootH = 56;
  const childY = 180;
  const childW = 144;
  const childH = 100;
  const totalW = 800;
  const gap = (totalW - NODES.length * childW) / (NODES.length + 1);

  const childPositions = NODES.map((_, i) => ({
    x: gap + i * (childW + gap) + childW / 2,
    y: childY,
  }));

  const selectedNode = expanded ? NODES.find((n) => n.id === expanded) : null;

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
        color: C.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .decomp-node {
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .decomp-node:hover {
          transform: translateY(-2px);
        }
        .decomp-detail-panel {
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.3s ease,
                      margin-top 0.3s ease;
        }
        .decomp-detail-panel.collapsed {
          max-height: 0;
          opacity: 0;
          margin-top: 0;
        }
        .decomp-detail-panel.open {
          max-height: 600px;
          opacity: 1;
          margin-top: 32px;
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 8px ${C.accentGlow}, 0 0 20px ${C.accentGlow}; }
          50% { box-shadow: 0 0 12px ${C.accentGlow}, 0 0 32px ${C.accentGlow}; }
        }
        .decomp-node-active {
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}</style>

      <h2
        style={{
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 8,
          letterSpacing: "-0.02em",
          textAlign: "center",
        }}
      >
        Decomposition: Atomic Components
      </h2>
      <p
        style={{
          color: C.textDim,
          fontSize: 15,
          marginBottom: 36,
          textAlign: "center",
          maxWidth: 520,
          lineHeight: 1.5,
        }}
      >
        Click each component to see its interface, the LLM prompt that builds
        it, and estimated token cost.
      </p>

      {/* SVG Tree */}
      <div
        style={{
          position: "relative",
          width: totalW,
          maxWidth: "100%",
          overflow: "visible",
        }}
      >
        <svg
          width={totalW}
          height={childY + childH + 20}
          viewBox={`0 0 ${totalW} ${childY + childH + 20}`}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* Connecting lines */}
          {childPositions.map((pos, i) => {
            const startX = rootX;
            const startY = rootY + rootH;
            const endX = pos.x;
            const endY = pos.y;
            const midY = startY + (endY - startY) * 0.5;
            return (
              <path
                key={NODES[i].id}
                d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                fill="none"
                stroke={expanded === NODES[i].id ? C.accent : C.border}
                strokeWidth={expanded === NODES[i].id ? 2 : 1.5}
                opacity={expanded === NODES[i].id ? 1 : 0.6}
                style={{ transition: "stroke 0.3s ease, opacity 0.3s ease" }}
              />
            );
          })}

          {/* Root node */}
          <foreignObject
            x={rootX - rootW / 2}
            y={rootY - 8}
            width={rootW}
            height={rootH}
          >
            <div
              style={{
                background: C.surface,
                border: `1.5px solid ${C.accent}`,
                borderRadius: 12,
                padding: "10px 20px",
                textAlign: "center",
                fontWeight: 600,
                fontSize: 15,
                color: C.text,
                boxShadow: `0 0 16px ${C.accentGlow}`,
                whiteSpace: "nowrap",
              }}
            >
              Hello World Weather App
            </div>
          </foreignObject>

          {/* Child nodes */}
          {NODES.map((node, i) => {
            const pos = childPositions[i];
            const isActive = expanded === node.id;
            return (
              <foreignObject
                key={node.id}
                x={pos.x - childW / 2}
                y={pos.y}
                width={childW}
                height={childH}
              >
                <div
                  className={`decomp-node ${isActive ? "decomp-node-active" : ""}`}
                  onClick={() => handleToggle(node.id)}
                  style={{
                    background: isActive ? C.accentGlow : C.surface,
                    border: `1.5px solid ${isActive ? C.accent : C.border}`,
                    borderRadius: 10,
                    padding: "10px 8px",
                    textAlign: "center",
                    height: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{node.icon}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActive ? C.accent : C.text,
                      fontFamily: "'IBM Plex Mono', monospace",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {node.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textDim,
                      lineHeight: 1.3,
                    }}
                  >
                    {node.brief}
                  </span>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* Detail Panel */}
      <div
        className={`decomp-detail-panel ${selectedNode ? "open" : "collapsed"}`}
        style={{ width: totalW, maxWidth: "100%" }}
      >
        {selectedNode && (
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>{selectedNode.icon}</span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: C.accent,
                  }}
                >
                  {selectedNode.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background:
                    selectedNode.complexity === "Simple"
                      ? C.greenGlow
                      : selectedNode.complexity === "Moderate"
                        ? "rgba(234,179,8,0.15)"
                        : "rgba(249,115,22,0.15)",
                  color: complexityColor(selectedNode.complexity),
                  border: `1px solid ${complexityColor(selectedNode.complexity)}33`,
                }}
              >
                {selectedNode.complexity}
              </span>
            </div>

            {/* Signature */}
            <div>
              <div style={labelStyle}>Function Signature</div>
              <code style={codeBlockStyle}>{selectedNode.signature}</code>
            </div>

            {/* Inputs / Outputs */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={labelStyle}>Inputs</div>
                <div style={valueStyle}>{selectedNode.inputs}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={labelStyle}>Outputs</div>
                <div style={valueStyle}>{selectedNode.outputs}</div>
              </div>
            </div>

            {/* LLM Prompt */}
            <div>
              <div style={labelStyle}>LLM Prompt</div>
              <div
                style={{
                  ...codeBlockStyle,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  fontSize: 12,
                }}
              >
                {selectedNode.prompt}
              </div>
            </div>

            {/* Token Cost */}
            <div>
              <div style={labelStyle}>Estimated Token Cost</div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: C.green,
                }}
              >
                {selectedNode.tokenCost}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 40,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
          maxWidth: totalW,
        }}
      >
        {[
          {
            label: "Single Responsibility",
            desc: "Each component does exactly one thing",
            color: C.accent,
          },
          {
            label: "Clear Interfaces",
            desc: "Inputs and outputs are well-defined",
            color: C.green,
          },
          {
            label: "Testable in Isolation",
            desc: "Each can be tested independently",
            color: C.yellow,
          },
          {
            label: "LLM-Friendly Size",
            desc: "Each fits comfortably in a single prompt",
            color: C.orange,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "10px 16px",
              flex: "1 1 160px",
              maxWidth: 220,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                {item.label}
              </span>
            </div>
            <span style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>
              {item.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: C.textDim,
  marginBottom: 6,
};

const valueStyle = {
  fontSize: 13,
  color: C.text,
  lineHeight: 1.5,
};

const codeBlockStyle = {
  display: "block",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 13,
  color: C.accent,
  overflowX: "auto",
};
