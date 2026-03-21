import React, { useState, useEffect, useCallback, useRef } from "react";

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

const FONT = "'IBM Plex Sans', sans-serif";

const NODES = [
  { id: "AnimationEngine", wave: 1, time: 30, deps: [] },
  { id: "WeatherService", wave: 1, time: 45, deps: [] },
  { id: "CitySelector", wave: 1, time: 20, deps: [] },
  { id: "ResetController", wave: 2, time: 15, deps: ["AnimationEngine"] },
  {
    id: "LayoutShell",
    wave: 3,
    time: 25,
    deps: ["AnimationEngine", "WeatherService", "CitySelector", "ResetController"],
  },
];

const SERIAL_TIME = NODES.reduce((s, n) => s + n.time, 0);
const WAVE1_TIME = Math.max(...NODES.filter((n) => n.wave === 1).map((n) => n.time));
const WAVE2_TIME = Math.max(...NODES.filter((n) => n.wave === 2).map((n) => n.time));
const WAVE3_TIME = Math.max(...NODES.filter((n) => n.wave === 3).map((n) => n.time));
const PARALLEL_TIME = WAVE1_TIME + WAVE2_TIME + WAVE3_TIME;
const SAVINGS = Math.round((1 - PARALLEL_TIME / SERIAL_TIME) * 100);

const NODE_W = 140;
const NODE_H = 60;
const SVG_W = 700;
const SVG_H = 320;

function nodePos(node) {
  const waveX = { 1: 80, 2: 320, 3: 540 };
  const x = waveX[node.wave];
  if (node.wave === 1) {
    const idx = NODES.filter((n) => n.wave === 1).indexOf(node);
    return { x, y: 60 + idx * 90 };
  }
  return { x, y: 150 };
}

const positions = {};
NODES.forEach((n) => {
  positions[n.id] = nodePos(n);
});

function edgePath(fromId, toId) {
  const from = positions[fromId];
  const to = positions[toId];
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const cx = (x1 + x2) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

function allEdges() {
  const edges = [];
  NODES.forEach((n) => {
    n.deps.forEach((dep) => {
      edges.push({ from: dep, to: n.id });
    });
  });
  return edges;
}

const EDGES = allEdges();

// ---------- component ----------

export default function ParallelismGraph() {
  // progress per node: 0..1
  const [progress, setProgress] = useState(() => {
    const p = {};
    NODES.forEach((n) => (p[n.id] = 0));
    return p;
  });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [elapsedParallel, setElapsedParallel] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const p = {};
    NODES.forEach((n) => (p[n.id] = 0));
    setProgress(p);
    setRunning(false);
    setDone(false);
    setElapsedParallel(0);
    startRef.current = null;
  }, []);

  const runBuild = useCallback(() => {
    if (running) return;
    reset();
    setRunning(true);

    const SPEED = 40; // ms per simulated second (so 45s node takes ~1.8 real seconds)

    const totalDuration = PARALLEL_TIME * SPEED;
    const wave1End = WAVE1_TIME * SPEED;
    const wave2End = (WAVE1_TIME + WAVE2_TIME) * SPEED;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      const next = {};
      NODES.forEach((n) => {
        const dur = n.time * SPEED;
        let nodeStart;
        if (n.wave === 1) nodeStart = 0;
        else if (n.wave === 2) nodeStart = wave1End;
        else nodeStart = wave2End;

        if (elapsed < nodeStart) {
          next[n.id] = 0;
        } else {
          next[n.id] = Math.min(1, (elapsed - nodeStart) / dur);
        }
      });

      setProgress(next);
      setElapsedParallel(Math.min(PARALLEL_TIME, (elapsed / totalDuration) * PARALLEL_TIME));

      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setRunning(false);
        setDone(true);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [running, reset]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function nodeStatus(id) {
    const p = progress[id];
    if (p >= 1) return "done";
    if (p > 0) return "building";
    // check if wave has started
    const node = NODES.find((n) => n.id === id);
    if (running) {
      if (node.wave === 1) return "waiting";
      const depsComplete = node.deps.every((d) => progress[d] >= 1);
      if (depsComplete) return "waiting";
    }
    return "idle";
  }

  function statusColor(id) {
    const s = nodeStatus(id);
    if (s === "done") return C.green;
    if (s === "building") return C.green;
    if (s === "waiting") return C.accent;
    return C.textDim;
  }

  function renderNode(node) {
    const pos = positions[node.id];
    const p = progress[node.id];
    const status = nodeStatus(node.id);
    const isHovered = hoveredNode === node.id;
    const strokeColor = status === "building" || status === "done" ? C.green : status === "waiting" ? C.accent : C.border;
    const glowFilter = status === "building" ? "url(#greenGlow)" : status === "waiting" ? "url(#blueGlow)" : "none";

    return (
      <g
        key={node.id}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        style={{ cursor: "pointer" }}
      >
        {/* glow rect */}
        {(status === "building" || status === "waiting") && (
          <rect
            x={pos.x - 3}
            y={pos.y - 3}
            width={NODE_W + 6}
            height={NODE_H + 6}
            rx={12}
            fill="none"
            stroke={status === "building" ? C.green : C.accent}
            strokeWidth={1}
            opacity={0.3}
            filter={glowFilter}
          />
        )}
        {/* background */}
        <rect
          x={pos.x}
          y={pos.y}
          width={NODE_W}
          height={NODE_H}
          rx={10}
          fill={C.surface}
          stroke={strokeColor}
          strokeWidth={isHovered ? 2 : 1.5}
        />
        {/* progress fill */}
        {p > 0 && (
          <clipPath id={`clip-${node.id}`}>
            <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={10} />
          </clipPath>
        )}
        {p > 0 && (
          <rect
            x={pos.x}
            y={pos.y}
            width={NODE_W * p}
            height={NODE_H}
            fill={C.greenGlow}
            clipPath={`url(#clip-${node.id})`}
          />
        )}
        {/* label */}
        <text
          x={pos.x + NODE_W / 2}
          y={pos.y + 24}
          textAnchor="middle"
          fill={C.text}
          fontSize={12}
          fontFamily={FONT}
          fontWeight={600}
        >
          {node.id}
        </text>
        {/* time */}
        <text
          x={pos.x + NODE_W / 2}
          y={pos.y + 44}
          textAnchor="middle"
          fill={C.textDim}
          fontSize={11}
          fontFamily={FONT}
        >
          {node.time}s
        </text>
        {/* tooltip */}
        {isHovered && (
          <g>
            <rect
              x={pos.x + NODE_W / 2 - 90}
              y={pos.y - 42}
              width={180}
              height={32}
              rx={6}
              fill={C.bg}
              stroke={C.border}
              strokeWidth={1}
            />
            <text
              x={pos.x + NODE_W / 2}
              y={pos.y - 22}
              textAnchor="middle"
              fill={C.textDim}
              fontSize={10}
              fontFamily={FONT}
            >
              {node.deps.length === 0
                ? "No dependencies (standalone)"
                : `Depends on: ${node.deps.join(", ")}`}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <div
      style={{
        background: C.bg,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: 28,
        fontFamily: FONT,
        color: C.text,
        maxWidth: 780,
        margin: "0 auto",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Dependency DAG — Hello World Weather App
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={runBuild}
            disabled={running}
            style={{
              background: running ? C.border : C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 18px",
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            Run Build
          </button>
          <button
            onClick={reset}
            style={{
              background: C.surface,
              color: C.textDim,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* SVG DAG */}
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: "block", marginBottom: 20 }}
      >
        <defs>
          <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={C.textDim} />
          </marker>
          <marker
            id="arrowheadGreen"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={C.green} />
          </marker>
        </defs>

        {/* wave labels */}
        {[
          { label: "Wave 1", x: 80 + NODE_W / 2 },
          { label: "Wave 2", x: 320 + NODE_W / 2 },
          { label: "Wave 3", x: 540 + NODE_W / 2 },
        ].map((w) => (
          <text
            key={w.label}
            x={w.x}
            y={38}
            textAnchor="middle"
            fill={C.textDim}
            fontSize={11}
            fontFamily={FONT}
            fontWeight={600}
            letterSpacing={1}
          >
            {w.label.toUpperCase()}
          </text>
        ))}

        {/* edges */}
        {EDGES.map((e) => {
          const fromDone = progress[e.from] >= 1;
          const toDone = progress[e.to] >= 1 || progress[e.to] > 0;
          const active = fromDone && toDone;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke={active ? C.green : C.border}
              strokeWidth={active ? 1.8 : 1.2}
              strokeDasharray={active ? "none" : "4,4"}
              markerEnd={active ? "url(#arrowheadGreen)" : "url(#arrowhead)"}
              opacity={active ? 0.9 : 0.5}
            />
          );
        })}

        {/* nodes */}
        {NODES.map(renderNode)}
      </svg>

      {/* time comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {/* serial */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 600 }}>
            SERIAL TIME
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.red }}>
            {SERIAL_TIME}s
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
            30 + 45 + 20 + 15 + 25
          </div>
        </div>
        {/* parallel */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${done ? C.green : C.border}`,
            borderRadius: 10,
            padding: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 600 }}>
            PARALLEL TIME
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>
            {running || done ? Math.round(elapsedParallel) : PARALLEL_TIME}s
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
            max(30,45,20) + 15 + 25
          </div>
        </div>
        {/* savings */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 600 }}>
            SAVINGS
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.accent }}>
            {done ? `${SAVINGS}%` : running ? `${Math.round((elapsedParallel / PARALLEL_TIME) * SAVINGS)}%` : `${SAVINGS}%`}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>faster with parallelism</div>
        </div>
      </div>

      {/* progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            height: 6,
            background: C.border,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(elapsedParallel / PARALLEL_TIME) * 100}%`,
              background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
              borderRadius: 3,
              transition: running ? "none" : "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          fontSize: 11,
          color: C.textDim,
        }}
      >
        {[
          { color: C.green, label: "Green = Building" },
          { color: C.accent, label: "Blue = Waiting" },
          { color: C.textDim, label: "Gray = Not Started" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: item.color,
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
