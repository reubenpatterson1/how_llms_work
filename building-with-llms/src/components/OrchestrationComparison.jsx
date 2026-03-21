import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

const FONT_SANS = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

// Token grounding types
const G = "grounded";
const I = "inferred";
const D = "defaulted";
const X = "confabulated";

const TOKEN_COLORS = {
  [G]: C.green,
  [I]: C.yellow,
  [D]: C.orange,
  [X]: C.red,
};

const TOKEN_LABELS = {
  [G]: "Grounded",
  [I]: "Inferred",
  [D]: "Defaulted",
  [X]: "Confabulated",
};

// --- Lone Wolf pseudo-code with token-level grounding ---
const LONE_WOLF_PROMPT = `"Build me a Hello World website with animated text, a reset button, and weather API integration using api.weather.gov with a city dropdown."`;

const LONE_WOLF_LINES = [
  [
    { text: "import ", type: D },
    { text: "React, { useState, useEffect }", type: I },
    { text: " from ", type: D },
    { text: "'react';", type: D },
  ],
  [
    { text: "import ", type: D },
    { text: "axios", type: X },
    { text: " from ", type: D },
    { text: "'axios';", type: X },
  ],
  [],
  [
    { text: "const API_KEY = ", type: X },
    { text: "'sk-abc123...';", type: X },
    { text: "  // OpenWeatherMap", type: X },
  ],
  [
    { text: "const BASE_URL = ", type: D },
    { text: "'https://api.openweathermap.org'", type: X },
    { text: ";", type: D },
  ],
  [],
  [
    { text: "function App() {", type: D },
  ],
  [
    { text: "  const [text] = useState(", type: I },
    { text: "'Hello World'", type: G },
    { text: ");", type: I },
  ],
  [
    { text: "  const [animate, setAnimate] = ", type: I },
    { text: "useState(true);", type: I },
  ],
  [
    { text: "  const [city, setCity] = useState('');", type: G },
  ],
  [
    { text: "  const [weather, setWeather] = useState(null);", type: I },
  ],
  [
    { text: "  const [forecast, setForecast] = ", type: X },
    { text: "useState([]);", type: X },
    { text: " // 5-day", type: X },
  ],
  [
    { text: "  const [units] = useState(", type: X },
    { text: "'metric'", type: X },
    { text: ");", type: X },
  ],
  [],
  [
    { text: "  useEffect(() => {", type: I },
  ],
  [
    { text: "    navigator.geolocation", type: X },
    { text: ".getCurrentPosition(", type: X },
    { text: "...", type: X },
    { text: ");", type: X },
  ],
  [
    { text: "  }, []);", type: I },
  ],
  [],
  [
    { text: "  const ", type: D },
    { text: "fetchWeather", type: I },
    { text: " = async () => {", type: D },
  ],
  [
    { text: "    try {", type: D },
  ],
  [
    { text: "      const res = await ", type: D },
    { text: "fetch(", type: I },
    { text: "`${BASE_URL}/data/2.5/weather", type: X },
  ],
  [
    { text: "        ?q=${city}&units=${units}", type: X },
    { text: "&appid=${API_KEY}`);", type: X },
  ],
  [
    { text: "      setWeather(res.data);", type: I },
  ],
  [
    { text: "    } catch(e) { console.log(e); }", type: D },
  ],
  [
    { text: "  };", type: D },
  ],
  [],
  [
    { text: "  const ", type: D },
    { text: "reset", type: G },
    { text: " = () => setAnimate(false);", type: I },
  ],
  [],
  [
    { text: "  return (", type: D },
  ],
  [
    { text: "    <div", type: D },
    { text: " style={{padding: 20}}", type: D },
    { text: ">", type: D },
  ],
  [
    { text: "      <h1 className=", type: D },
    { text: "{animate ? 'typewriter' : ''}", type: G },
    { text: ">", type: D },
  ],
  [
    { text: "        {text}", type: G },
  ],
  [
    { text: "      </h1>", type: D },
  ],
  [
    { text: "      <button onClick={reset}>", type: G },
    { text: "Reset</button>", type: G },
  ],
  [
    { text: "      <select onChange={...}>", type: G },
    { text: " {/* city dropdown */}", type: G },
  ],
  [
    { text: "    </div>", type: D },
  ],
  [
    { text: "  );", type: D },
  ],
  [
    { text: "}", type: D },
  ],
];

// --- Orchestrated steps ---
const ORCHESTRATED_STEPS = [
  {
    name: "AnimationEngine",
    prompt: `Create a React component that renders text with a CSS keyframe typewriter animation. Props: text (string), speed (number, ms per char). Use @keyframes, inject via <style> tag. Export as default.`,
    lines: [
      [
        { text: "import React from 'react';", type: G },
      ],
      [],
      [
        { text: "const keyframes = `", type: G },
      ],
      [
        { text: "  @keyframes typewriter {", type: G },
      ],
      [
        { text: "    from { width: 0 }", type: G },
      ],
      [
        { text: "    to { width: var(--chars) }", type: G },
      ],
      [
        { text: "  }", type: G },
      ],
      [
        { text: "`;", type: G },
      ],
      [],
      [
        { text: "export default function AnimationEngine", type: G },
        { text: "({ text, speed }) {", type: G },
      ],
      [
        { text: "  const duration = ", type: G },
        { text: "text.length * speed;", type: G },
      ],
      [
        { text: "  return (", type: G },
      ],
      [
        { text: "    <>", type: I },
      ],
      [
        { text: "      <style>{keyframes}</style>", type: G },
      ],
      [
        { text: "      <span style={{", type: G },
      ],
      [
        { text: "        animation: `typewriter ${duration}ms", type: G },
        { text: " steps(${text.length})`", type: G },
      ],
      [
        { text: "      }}>{text}</span>", type: G },
      ],
      [
        { text: "    </>", type: I },
      ],
      [
        { text: "  );", type: G },
      ],
      [
        { text: "}", type: G },
      ],
    ],
    grounded: 95,
  },
  {
    name: "ResetController",
    prompt: `Create a React component with a button that increments a \`key\` state variable to force re-mount. Props: onReset (callback). Styled with border: 1px solid #3B82F6, background: transparent, color: #3B82F6, border-radius: 6px, padding: 8px 20px.`,
    lines: [
      [
        { text: "import React from 'react';", type: G },
      ],
      [],
      [
        { text: "export default function ResetController", type: G },
        { text: "({ onReset }) {", type: G },
      ],
      [
        { text: "  return (", type: G },
      ],
      [
        { text: "    <button", type: G },
      ],
      [
        { text: "      onClick={onReset}", type: G },
      ],
      [
        { text: "      style={{", type: G },
      ],
      [
        { text: "        border: '1px solid #3B82F6',", type: G },
      ],
      [
        { text: "        background: 'transparent',", type: G },
      ],
      [
        { text: "        color: '#3B82F6',", type: G },
      ],
      [
        { text: "        borderRadius: 6,", type: G },
      ],
      [
        { text: "        padding: '8px 20px',", type: G },
      ],
      [
        { text: "        cursor: 'pointer',", type: I },
      ],
      [
        { text: "      }}", type: G },
      ],
      [
        { text: "    >Reset</button>", type: G },
      ],
      [
        { text: "  );", type: G },
      ],
      [
        { text: "}", type: G },
      ],
    ],
    grounded: 97,
  },
  {
    name: "WeatherService",
    prompt: `Create an async function fetchWeather(lat, lon). Call https://api.weather.gov/points/{lat},{lon}, extract the forecast URL from properties.forecast, then fetch that URL. Set User-Agent header to 'HowLLMsWork/1.0'. Return { temp, description, icon }.`,
    lines: [
      [
        { text: "export async function fetchWeather", type: G },
        { text: "(lat, lon) {", type: G },
      ],
      [
        { text: "  const headers = {", type: G },
      ],
      [
        { text: "    'User-Agent': 'HowLLMsWork/1.0'", type: G },
      ],
      [
        { text: "  };", type: G },
      ],
      [],
      [
        { text: "  const pts = await fetch(", type: G },
      ],
      [
        { text: "    `https://api.weather.gov/points/", type: G },
        { text: "${lat},${lon}`", type: G },
        { text: ",", type: G },
      ],
      [
        { text: "    { headers }", type: G },
      ],
      [
        { text: "  );", type: G },
      ],
      [
        { text: "  const ptsData = await pts.json();", type: G },
      ],
      [
        { text: "  const forecastUrl = ", type: G },
        { text: "ptsData.properties.forecast;", type: G },
      ],
      [],
      [
        { text: "  const fc = await fetch(", type: G },
        { text: "forecastUrl, { headers });", type: G },
      ],
      [
        { text: "  const fcData = await fc.json();", type: G },
      ],
      [
        { text: "  const p = fcData.properties", type: G },
        { text: ".periods[0];", type: G },
      ],
      [],
      [
        { text: "  return {", type: G },
      ],
      [
        { text: "    temp: p.temperature,", type: G },
      ],
      [
        { text: "    description: p.shortForecast,", type: G },
      ],
      [
        { text: "    icon: p.icon", type: I },
      ],
      [
        { text: "  };", type: G },
      ],
      [
        { text: "}", type: G },
      ],
    ],
    grounded: 96,
  },
  {
    name: "CitySelector",
    prompt: `Create a React <select> dropdown. Options: 15 US cities with lat/lon data (NYC, LA, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Denver, Seattle, Miami, Atlanta, Boston, Nashville). onChange returns { name, lat, lon }. Styled with background: #131B2E, color: #E2E8F0, border: 1px solid #1E293B.`,
    lines: [
      [
        { text: "import React from 'react';", type: G },
      ],
      [],
      [
        { text: "const CITIES = [", type: G },
      ],
      [
        { text: "  { name: 'New York, NY',", type: G },
        { text: " lat: 40.7128, lon: -74.006 },", type: G },
      ],
      [
        { text: "  { name: 'Los Angeles, CA',", type: G },
        { text: " lat: 34.0522, lon: -118.2437 },", type: G },
      ],
      [
        { text: "  // ... 13 more cities", type: G },
      ],
      [
        { text: "];", type: G },
      ],
      [],
      [
        { text: "export default function CitySelector", type: G },
        { text: "({ onChange }) {", type: G },
      ],
      [
        { text: "  return (", type: G },
      ],
      [
        { text: "    <select", type: G },
      ],
      [
        { text: "      onChange={e =>", type: G },
        { text: " onChange(CITIES[e.target.value])}", type: G },
      ],
      [
        { text: "      style={{", type: G },
      ],
      [
        { text: "        background: '#131B2E',", type: G },
      ],
      [
        { text: "        color: '#E2E8F0',", type: G },
      ],
      [
        { text: "        border: '1px solid #1E293B',", type: G },
      ],
      [
        { text: "        borderRadius: 6,", type: I },
      ],
      [
        { text: "        padding: '10px 14px',", type: I },
      ],
      [
        { text: "      }}", type: G },
      ],
      [
        { text: "    >", type: G },
      ],
      [
        { text: "      {CITIES.map((c, i) => (", type: G },
      ],
      [
        { text: "        <option key={i} value={i}>", type: G },
        { text: "{c.name}</option>", type: G },
      ],
      [
        { text: "      ))}", type: G },
      ],
      [
        { text: "    </select>", type: G },
      ],
      [
        { text: "  );", type: G },
      ],
      [
        { text: "}", type: G },
      ],
    ],
    grounded: 92,
  },
  {
    name: "LayoutShell",
    prompt: `Create a React component that composes AnimationEngine, ResetController, CitySelector, and WeatherService results into a centered card layout. Max-width: 600px. Background: #131B2E. Border: 1px solid #1E293B. Border-radius: 12px. Padding: 32px.`,
    lines: [
      [
        { text: "import React, { useState, useCallback }", type: G },
        { text: " from 'react';", type: G },
      ],
      [
        { text: "import AnimationEngine", type: G },
        { text: " from './AnimationEngine';", type: G },
      ],
      [
        { text: "import ResetController", type: G },
        { text: " from './ResetController';", type: G },
      ],
      [
        { text: "import CitySelector", type: G },
        { text: " from './CitySelector';", type: G },
      ],
      [
        { text: "import { fetchWeather }", type: G },
        { text: " from './WeatherService';", type: G },
      ],
      [],
      [
        { text: "export default function LayoutShell() {", type: G },
      ],
      [
        { text: "  const [key, setKey] = useState(0);", type: G },
      ],
      [
        { text: "  const [weather, setWeather]", type: G },
        { text: " = useState(null);", type: G },
      ],
      [],
      [
        { text: "  return (", type: G },
      ],
      [
        { text: "    <div style={{", type: G },
      ],
      [
        { text: "      maxWidth: 600,", type: G },
      ],
      [
        { text: "      margin: '0 auto',", type: I },
      ],
      [
        { text: "      background: '#131B2E',", type: G },
      ],
      [
        { text: "      border: '1px solid #1E293B',", type: G },
      ],
      [
        { text: "      borderRadius: 12,", type: G },
      ],
      [
        { text: "      padding: 32,", type: G },
      ],
      [
        { text: "    }}>", type: G },
      ],
      [
        { text: "      <AnimationEngine key={key}", type: G },
        { text: " text=\"Hello World\" speed={100} />", type: G },
      ],
      [
        { text: "      <ResetController onReset={", type: G },
        { text: "() => setKey(k => k+1)} />", type: G },
      ],
      [
        { text: "      <CitySelector onChange={", type: G },
        { text: "async c => {", type: G },
      ],
      [
        { text: "        const w = await fetchWeather", type: G },
        { text: "(c.lat, c.lon);", type: G },
      ],
      [
        { text: "        setWeather(w);", type: G },
      ],
      [
        { text: "      }} />", type: G },
      ],
      [
        { text: "      {weather && <WeatherDisplay", type: I },
        { text: " data={weather} />}", type: I },
      ],
      [
        { text: "    </div>", type: G },
      ],
      [
        { text: "  );", type: G },
      ],
      [
        { text: "}", type: G },
      ],
    ],
    grounded: 93,
  },
];

// --- Comparison chart data ---
const CHART_DATA = [
  { metric: "Grounded", loneWolf: 35, orchestrated: 94, unit: "%" },
  { metric: "Confabulated", loneWolf: 20, orchestrated: 0, unit: "%" },
  { metric: "Quality", loneWolf: 45, orchestrated: 97, unit: "/100" },
];

const COST_DATA = [
  { metric: "Cost", loneWolf: 1.2, orchestrated: 1.8, unit: "\u00A2" },
];

// ─── Helper components ───

function TokenLine({ tokens }) {
  if (!tokens || tokens.length === 0) {
    return <div style={{ height: 20 }}>{"\u00A0"}</div>;
  }
  return (
    <div style={{ height: 20, whiteSpace: "pre" }}>
      {tokens.map((tok, i) => (
        <span
          key={i}
          style={{ color: TOKEN_COLORS[tok.type] }}
          title={TOKEN_LABELS[tok.type]}
        >
          {tok.text}
        </span>
      ))}
    </div>
  );
}

function CodeBlock({ lines, maxHeight = 340 }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "14px 16px",
        fontFamily: FONT_MONO,
        fontSize: 12,
        lineHeight: "20px",
        overflowY: "auto",
        overflowX: "auto",
        maxHeight,
      }}
    >
      {lines.map((tokens, i) => (
        <TokenLine key={i} tokens={tokens} />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      {[G, I, D, X].map((type) => (
        <div
          key={type}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: FONT_SANS,
            fontSize: 11,
            color: C.textDim,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: TOKEN_COLORS[type],
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {TOKEN_LABELS[type]}
        </div>
      ))}
    </div>
  );
}

function StatRow({ items }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 12,
      }}
    >
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          style={{
            background: (color || C.accent) + "12",
            border: `1px solid ${(color || C.accent)}33`,
            borderRadius: 6,
            padding: "6px 12px",
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: color || C.text,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: C.textDim, fontFamily: FONT_SANS, fontSize: 11 }}>
            {label}
          </span>
          {value}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───

export default function OrchestrationComparison() {
  const [activeView, setActiveView] = useState("both"); // "lone", "orch", "both"
  const [expandedStep, setExpandedStep] = useState(null);

  const toggleStep = (idx) => {
    setExpandedStep(expandedStep === idx ? null : idx);
  };

  const tabStyle = (active) => ({
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 20px",
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 6,
    background: active ? C.accentGlow : "transparent",
    color: active ? C.accent : C.textDim,
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
  });

  const panelStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 20,
    flex: 1,
    minWidth: 0,
    transition: "opacity 0.3s ease, transform 0.3s ease",
  };

  const showLone = activeView === "both" || activeView === "lone";
  const showOrch = activeView === "both" || activeView === "orch";

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        color: C.text,
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: C.accent,
            marginBottom: 8,
          }}
        >
          Prompt Engineering
        </div>
        <h2
          style={{
            fontFamily: FONT_SANS,
            fontSize: 24,
            fontWeight: 700,
            color: C.text,
            margin: 0,
          }}
        >
          Single Prompt vs. Orchestrated Prompts
        </h2>
        <p
          style={{
            fontFamily: FONT_SANS,
            fontSize: 14,
            color: C.textDim,
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          Building the same Hello World Weather App with one mega-prompt versus
          five focused prompts.
        </p>
      </div>

      {/* View toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {[
          { key: "both", label: "Side by Side" },
          { key: "lone", label: "Lone Wolf" },
          { key: "orch", label: "Orchestrated" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            style={tabStyle(activeView === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        {/* Left: Lone Wolf */}
        {showLone && (
          <div
            style={{
              ...panelStyle,
              opacity: 1,
              transform: "translateX(0)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: C.red,
                  boxShadow: `0 0 8px ${C.red}66`,
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                }}
              >
                Lone Wolf
              </h3>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  color: C.textDim,
                  marginLeft: "auto",
                }}
              >
                Single Prompt
              </span>
            </div>

            {/* Prompt */}
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "10px 14px",
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.textDim,
                lineHeight: 1.6,
                marginBottom: 14,
                fontStyle: "italic",
              }}
            >
              {LONE_WOLF_PROMPT}
            </div>

            <Legend />
            <CodeBlock lines={LONE_WOLF_LINES} maxHeight={400} />

            <StatRow
              items={[
                { label: "Grounded", value: "35%", color: C.green },
                { label: "Inferred", value: "20%", color: C.yellow },
                { label: "Defaulted", value: "25%", color: C.orange },
                { label: "Confabulated", value: "20%", color: C.red },
              ]}
            />
            <StatRow
              items={[
                { label: "Tokens", value: "~800" },
                { label: "Cost", value: "~$0.012" },
              ]}
            />
          </div>
        )}

        {/* Right: Orchestrated */}
        {showOrch && (
          <div
            style={{
              ...panelStyle,
              opacity: 1,
              transform: "translateX(0)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: C.green,
                  boxShadow: `0 0 8px ${C.green}66`,
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                }}
              >
                Orchestrated
              </h3>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  color: C.textDim,
                  marginLeft: "auto",
                }}
              >
                5-Step Pipeline
              </span>
            </div>

            {/* Step list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ORCHESTRATED_STEPS.map((step, idx) => {
                const isOpen = expandedStep === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      background: isOpen ? C.bg : "transparent",
                      border: `1px solid ${isOpen ? C.accent + "44" : C.border}`,
                      borderRadius: 8,
                      overflow: "hidden",
                      transition: "all 0.25s ease",
                    }}
                  >
                    {/* Step header */}
                    <button
                      onClick={() => toggleStep(idx)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        outline: "none",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.accent,
                          background: C.accentGlow,
                          borderRadius: 4,
                          padding: "2px 8px",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.text,
                          flex: 1,
                        }}
                      >
                        {step.name}
                      </span>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          color: C.green,
                          flexShrink: 0,
                        }}
                      >
                        {step.grounded}% grounded
                      </span>
                      <span
                        style={{
                          color: C.textDim,
                          fontSize: 14,
                          flexShrink: 0,
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          display: "inline-block",
                        }}
                      >
                        {"\u25BE"}
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div
                        style={{
                          padding: "0 14px 14px",
                          animation: "hwp-fadeIn 0.25s ease-out",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: 11,
                            color: C.textDim,
                            lineHeight: 1.6,
                            marginBottom: 10,
                            padding: "8px 12px",
                            background: C.surface,
                            borderRadius: 6,
                            border: `1px solid ${C.border}`,
                            fontStyle: "italic",
                          }}
                        >
                          {step.prompt}
                        </div>
                        <Legend />
                        <CodeBlock lines={step.lines} maxHeight={300} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <StatRow
              items={[
                { label: "Grounded", value: "94%", color: C.green },
                { label: "Inferred", value: "5%", color: C.yellow },
                { label: "Defaulted", value: "1%", color: C.orange },
                { label: "Confabulated", value: "0%", color: C.green },
              ]}
            />
            <StatRow
              items={[
                { label: "Tokens", value: "~1,200" },
                { label: "Cost", value: "~$0.018" },
              ]}
            />
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes hwp-fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Bottom: Comparison Bar Chart */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24,
        }}
      >
        <h3
          style={{
            fontFamily: FONT_SANS,
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            margin: "0 0 20px",
            textAlign: "center",
          }}
        >
          Head-to-Head Comparison
        </h3>

        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Main metrics chart */}
          <div style={{ flex: 2, minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={CHART_DATA}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                barCategoryGap="30%"
              >
                <XAxis
                  dataKey="metric"
                  tick={{
                    fill: C.textDim,
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                  }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: C.textDim,
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                    color: C.text,
                  }}
                  formatter={(value, name) => [
                    `${value}${name === "loneWolf" || name === "orchestrated" ? "" : ""}`,
                    name === "loneWolf" ? "Lone Wolf" : "Orchestrated",
                  ]}
                  cursor={{ fill: C.border + "44" }}
                />
                <Bar dataKey="loneWolf" name="Lone Wolf" radius={[4, 4, 0, 0]}>
                  {CHART_DATA.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.metric === "Confabulated" ? C.red : C.textDim}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="orchestrated"
                  name="Orchestrated"
                  radius={[4, 4, 0, 0]}
                >
                  {CHART_DATA.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.metric === "Confabulated" ? C.green : C.accent
                      }
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cost comparison */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={COST_DATA}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                barCategoryGap="40%"
              >
                <XAxis
                  dataKey="metric"
                  tick={{
                    fill: C.textDim,
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                  }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: C.textDim,
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 2.5]}
                  tickFormatter={(v) => `${v}\u00A2`}
                />
                <Tooltip
                  contentStyle={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                    color: C.text,
                  }}
                  formatter={(value, name) => [
                    `${value}\u00A2`,
                    name === "loneWolf" ? "Lone Wolf" : "Orchestrated",
                  ]}
                  cursor={{ fill: C.border + "44" }}
                />
                <Bar
                  dataKey="loneWolf"
                  name="Lone Wolf"
                  fill={C.textDim}
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="orchestrated"
                  name="Orchestrated"
                  fill={C.accent}
                  fillOpacity={0.9}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 12,
          }}
        >
          {[
            { label: "Lone Wolf", color: C.textDim },
            { label: "Orchestrated", color: C.accent },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: FONT_SANS,
                fontSize: 12,
                color: C.textDim,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: color,
                  display: "inline-block",
                  opacity: label === "Lone Wolf" ? 0.7 : 0.9,
                }}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Takeaway */}
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: C.greenGlow,
            border: `1px solid ${C.green}33`,
            borderRadius: 8,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.green,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Orchestrated prompts cost 50% more in tokens but eliminate
          confabulation and nearly double quality. The extra $0.006 buys
          correctness.
        </div>
      </div>
    </div>
  );
}
