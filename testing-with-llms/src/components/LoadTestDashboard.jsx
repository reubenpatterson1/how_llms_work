import React, { useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.15)",
  green: "#22C55E", greenGlow: "rgba(34,197,94,0.15)",
  red: "#EF4444", yellow: "#EAB308", orange: "#F97316",
};

const font = "'IBM Plex Sans', system-ui, sans-serif";

function computeResponseTime(users) {
  return 200 + users * 5 + Math.pow(Math.max(0, users - 30), 2.5);
}

function generateResponseTimeData(maxUsers) {
  const points = [];
  for (let u = 1; u <= maxUsers; u++) {
    const rt = computeResponseTime(u) + (Math.random() - 0.5) * 40;
    points.push({ users: u, responseTime: Math.round(rt) });
  }
  return points;
}

const successBuckets = [
  { bucket: "1-10", min: 1, max: 10, rate: 100 },
  { bucket: "11-20", min: 11, max: 20, rate: 100 },
  { bucket: "21-40", min: 21, max: 40, rate: 98 },
  { bucket: "41-60", min: 41, max: 60, rate: 85 },
  { bucket: "61-80", min: 61, max: 80, rate: 60 },
  { bucket: "81-100", min: 81, max: 100, rate: 25 },
];

function generateSuccessData(maxUsers) {
  return successBuckets
    .filter((b) => b.min <= maxUsers)
    .map((b) => ({
      bucket: b.bucket,
      rate: b.max <= maxUsers ? b.rate : b.rate + (100 - b.rate) * ((b.max - maxUsers) / (b.max - b.min)),
    }))
    .map((d) => ({ ...d, rate: Math.round(d.rate) }));
}

function generateRateLimitData(maxUsers) {
  const points = [];
  const peakRps = maxUsers * 0.6;
  for (let t = 0; t <= 60; t++) {
    const rampFactor = Math.min(1, t / 15);
    const noise = (Math.random() - 0.5) * peakRps * 0.15;
    const rps = Math.max(0, peakRps * rampFactor + noise);
    points.push({ time: t, rps: parseFloat(rps.toFixed(2)) });
  }
  return points;
}

function barColor(rate) {
  if (rate >= 90) return C.green;
  if (rate >= 60) return C.yellow;
  return C.red;
}

const cardStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
};

const labelStyle = {
  fontFamily: font,
  fontSize: 11,
  fill: C.textDim,
  fontWeight: 500,
};

export default function LoadTestDashboard() {
  const [concurrentUsers, setConcurrentUsers] = useState(1);
  const [responseTimeData, setResponseTimeData] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [rateLimitData, setRateLimitData] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const runTest = useCallback(() => {
    setResponseTimeData(generateResponseTimeData(concurrentUsers));
    setSuccessData(generateSuccessData(concurrentUsers));
    setRateLimitData(generateRateLimitData(concurrentUsers));
    setHasRun(true);
  }, [concurrentUsers]);

  const reset = useCallback(() => {
    setResponseTimeData(null);
    setSuccessData(null);
    setRateLimitData(null);
    setHasRun(false);
  }, []);

  const peakResponseTime = responseTimeData
    ? Math.max(...responseTimeData.map((d) => d.responseTime))
    : null;
  const minSuccessRate = successData
    ? Math.min(...successData.map((d) => d.rate))
    : null;

  const rateLimitExceededAt = (() => {
    if (!rateLimitData) return null;
    const first = rateLimitData.find((d) => d.rps > 1);
    return first ? concurrentUsers : null;
  })();

  const rateLimitExceeded = rateLimitData
    ? rateLimitData.some((d) => d.rps > 1)
    : false;

  const slaPass = peakResponseTime !== null && peakResponseTime < 3000 && minSuccessRate > 90;

  const failUserThreshold = (() => {
    if (!responseTimeData) return null;
    const failing = responseTimeData.find((d) => d.responseTime >= 3000);
    return failing ? failing.users : null;
  })();

  const showHockeyStick = concurrentUsers > 40;

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: font,
        minHeight: "100vh",
        padding: "32px 40px",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        Load Test Dashboard
      </h2>
      <p style={{ margin: "0 0 28px", color: C.textDim, fontSize: 14 }}>
        Hello World Weather App — Simulated Load Testing
      </p>

      {/* Controls Row */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280 }}>
          <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            Concurrent Users
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={concurrentUsers}
            onChange={(e) => setConcurrentUsers(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.accent, cursor: "pointer" }}
          />
          <span
            style={{
              background: C.accentGlow,
              color: C.accent,
              fontWeight: 700,
              fontSize: 15,
              padding: "4px 14px",
              borderRadius: 8,
              minWidth: 36,
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {concurrentUsers}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={runTest}
            style={{
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 28px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: font,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.target.style.opacity = 0.85)}
            onMouseLeave={(e) => (e.target.style.opacity = 1)}
          >
            Run Test
          </button>
          <button
            onClick={reset}
            style={{
              background: "transparent",
              color: C.textDim,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: font,
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.target.style.borderColor = C.textDim)}
            onMouseLeave={(e) => (e.target.style.borderColor = C.border)}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Hockey Stick Annotation */}
      {showHockeyStick && (
        <div
          style={{
            background: "rgba(234,179,8,0.08)",
            border: `1px solid rgba(234,179,8,0.3)`,
            borderRadius: 10,
            padding: "14px 20px",
            marginBottom: 24,
            fontSize: 13,
            lineHeight: 1.6,
            color: C.yellow,
          }}
        >
          <strong>You've found the hockey stick!</strong> Response time goes exponential beyond
          ~40 concurrent users. This is the app's capacity ceiling — LLM-generated code
          optimized for correctness, not throughput.
        </div>
      )}

      {/* Charts Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Chart 1: Response Time */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600 }}>
            Response Time vs Concurrent Users
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={responseTimeData || []} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <XAxis
                dataKey="users"
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Concurrent Users", position: "insideBottom", offset: -2, style: { ...labelStyle, fontSize: 10 } }}
              />
              <YAxis
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Response Time (ms)", angle: -90, position: "insideLeft", offset: 4, style: { ...labelStyle, fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontFamily: font,
                  fontSize: 12,
                }}
                labelStyle={{ color: C.textDim }}
                itemStyle={{ color: C.text }}
                formatter={(v) => [`${v} ms`, "Response Time"]}
                labelFormatter={(v) => `${v} users`}
              />
              <ReferenceLine
                y={3000}
                stroke={C.red}
                strokeDasharray="6 4"
                label={{
                  value: "SLA Threshold (3000ms)",
                  position: "right",
                  fill: C.red,
                  fontSize: 10,
                  fontFamily: font,
                }}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke={C.accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: C.accent }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Success Rate */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600 }}>
            Success Rate
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={successData || []} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <XAxis
                dataKey="bucket"
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Concurrent Users", position: "insideBottom", offset: -2, style: { ...labelStyle, fontSize: 10 } }}
              />
              <YAxis
                domain={[0, 100]}
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Success Rate (%)", angle: -90, position: "insideLeft", offset: 4, style: { ...labelStyle, fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontFamily: font,
                  fontSize: 12,
                }}
                labelStyle={{ color: C.textDim }}
                itemStyle={{ color: C.text }}
                formatter={(v) => [`${v}%`, "Success Rate"]}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {(successData || []).map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Rate Limit Consumption */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600 }}>
            API Rate Limit Consumption
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rateLimitData || []} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.red} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={C.red} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Time (seconds)", position: "insideBottom", offset: -2, style: { ...labelStyle, fontSize: 10 } }}
              />
              <YAxis
                tick={labelStyle}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                label={{ value: "Requests / sec", angle: -90, position: "insideLeft", offset: 4, style: { ...labelStyle, fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontFamily: font,
                  fontSize: 12,
                }}
                labelStyle={{ color: C.textDim }}
                itemStyle={{ color: C.text }}
                formatter={(v) => [`${v} req/s`, "Throughput"]}
                labelFormatter={(v) => `${v}s`}
              />
              <ReferenceLine
                y={1}
                stroke={C.orange}
                strokeDasharray="6 4"
                label={{
                  value: "1 req/s (recommended limit)",
                  position: "right",
                  fill: C.orange,
                  fontSize: 10,
                  fontFamily: font,
                }}
              />
              <Area
                type="monotone"
                dataKey="rps"
                stroke={C.red}
                strokeWidth={2}
                fill="url(#rpsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Panel */}
      {hasRun && (
        <div
          style={{
            ...cardStyle,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 20,
          }}
        >
          <SummaryItem
            label="Peak Response Time"
            value={`${peakResponseTime} ms`}
            color={peakResponseTime < 3000 ? C.green : C.red}
          />
          <SummaryItem
            label="Min Success Rate"
            value={`${minSuccessRate}%`}
            color={minSuccessRate > 90 ? C.green : C.red}
          />
          <SummaryItem
            label="Rate Limit Exceeded"
            value={rateLimitExceeded ? `Yes at ${concurrentUsers} concurrent users` : "No"}
            color={rateLimitExceeded ? C.red : C.green}
          />
          <div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 500 }}>
              Verdict
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: slaPass ? C.green : C.red,
                padding: "8px 16px",
                borderRadius: 8,
                background: slaPass ? C.greenGlow : "rgba(239,68,68,0.1)",
                display: "inline-block",
              }}
            >
              {slaPass
                ? "PASS — within SLA"
                : `FAIL — SLA exceeded${failUserThreshold ? ` at ${failUserThreshold} users` : ""}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
