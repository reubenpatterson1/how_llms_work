import React, { useState, useCallback, useRef } from "react";

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

const STEPS = [
  { name: "Load Page", description: "Verify page loads without errors" },
  { name: "Verify Animation", description: 'Confirm typewriter animation plays "Hello, World!"' },
  { name: "Click Reset", description: "Click reset button, verify animation restarts" },
  { name: "Open Dropdown", description: "Open city selector, verify 15 options present" },
  { name: "Select City", description: 'Select "Denver, CO" from dropdown' },
  { name: "Wait for Weather", description: "Wait for API response from api.weather.gov" },
  { name: "Verify Display", description: "Confirm temperature and conditions are shown" },
];

const DURATIONS = [320, 850, 420, 610, 280, 2500, 120];

const FAILURE_MODES = [
  { label: "None", value: "none" },
  { label: "API Timeout", value: "api_timeout" },
  { label: "Animation Stuck", value: "animation_stuck" },
  { label: "Network Offline", value: "network_offline" },
];

function getFailureConfig(mode) {
  switch (mode) {
    case "api_timeout":
      return { failAt: 5, reason: "API request to api.weather.gov timed out after 5000ms" };
    case "animation_stuck":
      return { failAt: 1, reason: 'Typewriter animation did not complete \u2014 expected "Hello, World!" but got "Hello, W"' };
    case "network_offline":
      return { failAt: 5, reason: "net::ERR_INTERNET_DISCONNECTED \u2014 no network connection available" };
    default:
      return null;
  }
}

const font = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: `2px solid ${C.border}`,
        borderTopColor: C.accent,
        borderRadius: "50%",
        animation: "e2e-spin 0.6s linear infinite",
      }}
    />
  );
}

function StepCard({ step, index, status, duration }) {
  const isRunning = status === "running";
  const isPassed = status === "passed";
  const isFailed = status === "failed";
  const isSkipped = status === "skipped";

  let borderColor = C.border;
  let bgColor = C.surface;
  let glowShadow = "none";

  if (isRunning) {
    borderColor = C.accent;
    bgColor = C.surface;
    glowShadow = `0 0 16px ${C.accentGlow}, inset 0 0 8px ${C.accentGlow}`;
  } else if (isPassed) {
    borderColor = C.green;
    bgColor = C.surface;
    glowShadow = `0 0 12px ${C.greenGlow}`;
  } else if (isFailed) {
    borderColor = C.red;
    bgColor = "rgba(239,68,68,0.06)";
    glowShadow = `0 0 12px rgba(239,68,68,0.2)`;
  } else if (isSkipped) {
    bgColor = "rgba(15,20,35,0.8)";
    borderColor = C.border;
  }

  let statusIcon = null;
  if (isPassed) {
    statusIcon = (
      <span style={{ color: C.green, fontSize: 18, fontWeight: 700 }}>&#10003;</span>
    );
  } else if (isFailed) {
    statusIcon = (
      <span style={{ color: C.red, fontSize: 18, fontWeight: 700 }}>&times;</span>
    );
  } else if (isSkipped) {
    statusIcon = (
      <span style={{ color: C.textDim, fontSize: 16 }}>{"\u2298"}</span>
    );
  } else if (isRunning) {
    statusIcon = <Spinner />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 10,
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        boxShadow: glowShadow,
        minWidth: 130,
        maxWidth: 150,
        opacity: isSkipped ? 0.45 : 1,
        transition: "all 0.3s ease",
        fontFamily: font,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isPassed ? C.green : isFailed ? C.red : isRunning ? C.accent : C.border,
          color: isPassed || isFailed || isRunning ? "#fff" : C.textDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isSkipped ? C.textDim : C.text,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {step.name}
      </div>
      <div
        style={{
          fontSize: 11,
          color: C.textDim,
          textAlign: "center",
          lineHeight: 1.35,
          minHeight: 30,
        }}
      >
        {step.description}
      </div>
      <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {statusIcon}
      </div>
      {(isPassed || isFailed) && duration != null && (
        <div
          style={{
            fontSize: 11,
            color: isFailed ? C.red : C.green,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500,
          }}
        >
          {duration}ms
        </div>
      )}
    </div>
  );
}

function Arrow({ status }) {
  let color = C.border;
  if (status === "passed") color = C.green;
  else if (status === "failed") color = C.red;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 2px",
        flexShrink: 0,
        transition: "color 0.3s ease",
      }}
    >
      <svg width="28" height="16" viewBox="0 0 28 16">
        <line x1="0" y1="8" x2="20" y2="8" stroke={color} strokeWidth="2" />
        <polyline points="18,3 24,8 18,13" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function E2ETestRunner() {
  const [statuses, setStatuses] = useState(() => STEPS.map(() => "pending"));
  const [durations, setDurations] = useState(() => STEPS.map(() => null));
  const [failureMode, setFailureMode] = useState("none");
  const [isRunning, setIsRunning] = useState(false);
  const [runComplete, setRunComplete] = useState(false);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatuses(STEPS.map(() => "pending"));
    setDurations(STEPS.map(() => null));
    setIsRunning(false);
    setRunComplete(false);
  }, []);

  const runTests = useCallback(() => {
    abortRef.current = false;
    setIsRunning(true);
    setRunComplete(false);

    const failConfig = getFailureConfig(failureMode);
    const newStatuses = STEPS.map(() => "pending");
    const newDurations = STEPS.map(() => null);

    setStatuses([...newStatuses]);
    setDurations([...newDurations]);

    let chain = Promise.resolve();

    STEPS.forEach((_, i) => {
      chain = chain.then(() => {
        if (abortRef.current) return;

        return new Promise((resolve) => {
          // Set running
          newStatuses[i] = "running";
          setStatuses([...newStatuses]);

          const stepDuration = DURATIONS[i];

          setTimeout(() => {
            if (abortRef.current) return resolve();

            if (failConfig && i === failConfig.failAt) {
              newStatuses[i] = "failed";
              newDurations[i] = stepDuration;
              // Skip remaining
              for (let j = i + 1; j < STEPS.length; j++) {
                newStatuses[j] = "skipped";
              }
              setStatuses([...newStatuses]);
              setDurations([...newDurations]);
              setIsRunning(false);
              setRunComplete(true);
              return resolve();
            }

            newStatuses[i] = "passed";
            newDurations[i] = stepDuration;
            setStatuses([...newStatuses]);
            setDurations([...newDurations]);

            if (i === STEPS.length - 1) {
              setIsRunning(false);
              setRunComplete(true);
            }

            setTimeout(resolve, 300);
          }, Math.min(stepDuration, 800));
        });
      });
    });
  }, [failureMode]);

  // Compute summary
  const passed = statuses.filter((s) => s === "passed").length;
  const failed = statuses.filter((s) => s === "failed").length;
  const skipped = statuses.filter((s) => s === "skipped").length;
  const totalDuration = durations.reduce((sum, d) => sum + (d || 0), 0);
  const allPassed = passed === STEPS.length;

  const failConfig = getFailureConfig(failureMode);
  const hasFailure = statuses.some((s) => s === "failed");
  const failedIndex = statuses.indexOf("failed");

  // Arrow statuses
  function arrowStatus(i) {
    if (statuses[i] === "passed" && statuses[i + 1] !== "pending") return "passed";
    if (statuses[i] === "failed") return "failed";
    return "pending";
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        padding: "32px 24px",
        fontFamily: font,
        color: C.text,
      }}
    >
      <style>{`
        @keyframes e2e-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: C.text,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          E2E Test Flow: Hello World Weather App
        </h2>
        <p style={{ fontSize: 14, color: C.textDim, marginTop: 6 }}>
          Visual step-by-step end-to-end test execution with failure injection
        </p>
      </div>

      {/* Test Flow Timeline */}
      <div
        style={{
          overflowX: "auto",
          paddingBottom: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            minWidth: "fit-content",
            padding: "0 8px",
          }}
        >
          {STEPS.map((step, i) => (
            <React.Fragment key={i}>
              <StepCard
                step={step}
                index={i}
                status={statuses[i]}
                duration={durations[i]}
              />
              {i < STEPS.length - 1 && <Arrow status={arrowStatus(i)} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Controls Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={runTests}
          disabled={isRunning}
          style={{
            background: isRunning ? C.border : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: font,
            cursor: isRunning ? "not-allowed" : "pointer",
            opacity: isRunning ? 0.6 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {isRunning ? "Running\u2026" : "Run E2E Test"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: C.textDim, fontWeight: 500 }}>
            Inject Failure:
          </label>
          <select
            value={failureMode}
            onChange={(e) => setFailureMode(e.target.value)}
            disabled={isRunning}
            style={{
              background: C.surface,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: font,
              cursor: isRunning ? "not-allowed" : "pointer",
              outline: "none",
            }}
          >
            {FAILURE_MODES.map((fm) => (
              <option key={fm.value} value={fm.value}>
                {fm.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={reset}
          style={{
            background: "transparent",
            color: C.textDim,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: font,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Reset
        </button>
      </div>

      {/* Failure Cascade Panel */}
      {hasFailure && runComplete && failConfig && (
        <div
          style={{
            background: "rgba(239,68,68,0.05)",
            border: `1px solid rgba(239,68,68,0.25)`,
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 24,
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.red,
              marginBottom: 12,
            }}
          >
            Failure Cascade
          </div>

          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: C.red, fontWeight: 600 }}>
                Step {failedIndex + 1} failed:
              </span>{" "}
              <span style={{ color: C.textDim }}>{STEPS[failedIndex].name}</span>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 6,
                padding: "10px 14px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: C.red,
                marginBottom: 12,
                overflowX: "auto",
              }}
            >
              {failConfig.reason}
            </div>

            {skipped > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: C.textDim, fontWeight: 600 }}>
                  Skipped steps:
                </span>{" "}
                {statuses.map((s, i) =>
                  s === "skipped" ? (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 12,
                        color: C.textDim,
                        marginRight: 6,
                        marginBottom: 4,
                      }}
                    >
                      {i + 1}. {STEPS[i].name}
                    </span>
                  ) : null
                )}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "rgba(234,179,8,0.08)",
                border: `1px solid rgba(234,179,8,0.2)`,
                borderRadius: 6,
                fontSize: 13,
                color: C.yellow,
                fontWeight: 500,
              }}
            >
              1 failure &rarr; {skipped} skipped test{skipped !== 1 ? "s" : ""} &rarr;{" "}
              {skipped + 1} unknown behavior{skipped + 1 !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Test Summary */}
      {runComplete && (
        <div
          style={{
            background: allPassed ? C.greenGlow : "rgba(239,68,68,0.06)",
            border: `1px solid ${allPassed ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
            borderRadius: 10,
            padding: "16px 24px",
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: allPassed ? C.green : C.red,
            }}
          >
            {allPassed
              ? `${passed}/${STEPS.length} passed \u2014 E2E flow verified`
              : `${passed}/${STEPS.length} passed, ${failed} failed, ${skipped} skipped \u2014 see cascade above`}
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.textDim,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            Total: {totalDuration}ms
          </div>
        </div>
      )}
    </div>
  );
}
