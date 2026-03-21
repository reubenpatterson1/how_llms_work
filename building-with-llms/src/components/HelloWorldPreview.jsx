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

const CITIES = [
  { name: "New York, NY", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago, IL", lat: 41.8781, lon: -87.6298 },
  { name: "Houston, TX", lat: 29.7604, lon: -95.3698 },
  { name: "Phoenix, AZ", lat: 33.4484, lon: -112.074 },
  { name: "Philadelphia, PA", lat: 39.9526, lon: -75.1652 },
  { name: "San Antonio, TX", lat: 29.4241, lon: -98.4936 },
  { name: "San Diego, CA", lat: 32.7157, lon: -117.1611 },
  { name: "Dallas, TX", lat: 32.7767, lon: -96.797 },
  { name: "Denver, CO", lat: 39.7392, lon: -104.9903 },
  { name: "Seattle, WA", lat: 47.6062, lon: -122.3321 },
  { name: "Miami, FL", lat: 25.7617, lon: -80.1918 },
  { name: "Atlanta, GA", lat: 33.749, lon: -84.388 },
  { name: "Boston, MA", lat: 42.3601, lon: -71.0589 },
  { name: "Nashville, TN", lat: 36.1627, lon: -86.7816 },
];

const TYPEWRITER_CSS = `
@keyframes hwp-typewriter {
  from { width: 0; }
  to { width: 13ch; }
}
@keyframes hwp-blink {
  0%, 100% { border-color: ${C.accent}; }
  50% { border-color: transparent; }
}
@keyframes hwp-spin {
  to { transform: rotate(360deg); }
}
@keyframes hwp-fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const FONT_SANS = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

function getWeatherEmoji(shortForecast) {
  const f = (shortForecast || "").toLowerCase();
  if (f.includes("sunny") || f.includes("clear")) return "\u2600\uFE0F";
  if (f.includes("partly cloudy") || f.includes("partly sunny")) return "\u26C5";
  if (f.includes("cloudy") || f.includes("overcast")) return "\u2601\uFE0F";
  if (f.includes("rain") || f.includes("shower")) return "\uD83C\uDF27\uFE0F";
  if (f.includes("thunder") || f.includes("storm")) return "\u26C8\uFE0F";
  if (f.includes("snow") || f.includes("blizzard")) return "\uD83C\uDF28\uFE0F";
  if (f.includes("fog") || f.includes("haze") || f.includes("mist")) return "\uD83C\uDF2B\uFE0F";
  if (f.includes("wind")) return "\uD83C\uDF2C\uFE0F";
  if (f.includes("hot")) return "\uD83C\uDF21\uFE0F";
  if (f.includes("cold") || f.includes("freez")) return "\u2744\uFE0F";
  return "\uD83C\uDF24\uFE0F";
}

export default function HelloWorldPreview() {
  const [animKey, setAnimKey] = useState(0);
  const [selectedCity, setSelectedCity] = useState(0);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetAnimation = useCallback(() => {
    setAnimKey((k) => k + 1);
  }, []);

  const fetchWeather = useCallback(async () => {
    const city = CITIES[selectedCity];
    setLoading(true);
    setError(null);
    setWeather(null);

    const headers = {
      "User-Agent": "HowLLMsWork-Presentation/1.0 (educational)",
      Accept: "application/geo+json",
    };

    try {
      const pointsRes = await fetch(
        `https://api.weather.gov/points/${city.lat},${city.lon}`,
        { headers }
      );
      if (!pointsRes.ok) {
        throw new Error(`Points API returned ${pointsRes.status}`);
      }
      const pointsData = await pointsRes.json();
      const forecastUrl = pointsData?.properties?.forecast;
      if (!forecastUrl) {
        throw new Error("No forecast URL returned from API");
      }

      const forecastRes = await fetch(forecastUrl, { headers });
      if (!forecastRes.ok) {
        throw new Error(`Forecast API returned ${forecastRes.status}`);
      }
      const forecastData = await forecastRes.json();
      const current = forecastData?.properties?.periods?.[0];
      if (!current) {
        throw new Error("No forecast periods available");
      }

      setWeather({
        temperature: current.temperature,
        unit: current.temperatureUnit,
        shortForecast: current.shortForecast,
        detailedForecast: current.detailedForecast,
        windSpeed: current.windSpeed,
        windDirection: current.windDirection,
        name: current.name,
        isDaytime: current.isDaytime,
      });
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  // Styles
  const cardStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 32,
    maxWidth: 520,
    width: "100%",
    boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${C.border}`,
    fontFamily: FONT_SANS,
    animation: "hwp-fadeIn 0.4s ease-out",
  };

  const typewriterStyle = {
    fontFamily: FONT_MONO,
    fontSize: 36,
    fontWeight: 700,
    color: C.text,
    overflow: "hidden",
    whiteSpace: "nowrap",
    borderRight: `3px solid ${C.accent}`,
    width: 0,
    animation: `hwp-typewriter 1.8s steps(13) 0.4s forwards, hwp-blink 0.75s step-end 2.2s infinite`,
    margin: "0 auto",
    display: "inline-block",
    letterSpacing: "-0.02em",
  };

  const buttonBase = {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.15s ease",
    outline: "none",
  };

  const resetBtnStyle = {
    ...buttonBase,
    background: C.accentGlow,
    color: C.accent,
    padding: "8px 20px",
    border: `1px solid ${C.accent}33`,
  };

  const fetchBtnStyle = {
    ...buttonBase,
    background: C.accent,
    color: "#fff",
    padding: "10px 24px",
    fontSize: 14,
    opacity: loading ? 0.6 : 1,
    pointerEvents: loading ? "none" : "auto",
  };

  const selectStyle = {
    fontFamily: FONT_SANS,
    fontSize: 14,
    background: C.bg,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "10px 14px",
    width: "100%",
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  };

  const dividerStyle = {
    height: 1,
    background: C.border,
    margin: "24px 0",
    border: "none",
  };

  const labelStyle = {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: C.textDim,
    marginBottom: 8,
    display: "block",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "100%",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <style>{TYPEWRITER_CSS}</style>

      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: C.accent,
              marginBottom: 16,
              fontFamily: FONT_SANS,
            }}
          >
            Live Demo
          </div>

          {/* Typewriter animation */}
          <div
            style={{
              minHeight: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span key={animKey} style={typewriterStyle}>
              Hello, World!
            </span>
          </div>
        </div>

        {/* Reset button */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={resetAnimation}
            style={resetBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.accent + "22";
              e.currentTarget.style.borderColor = C.accent + "66";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.accentGlow;
              e.currentTarget.style.borderColor = C.accent + "33";
            }}
          >
            Replay Animation
          </button>
        </div>

        <hr style={dividerStyle} />

        {/* Weather section */}
        <div>
          <label style={labelStyle}>Weather Lookup</label>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(Number(e.target.value))}
                style={selectStyle}
              >
                {CITIES.map((city, i) => (
                  <option key={city.name} value={i}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchWeather}
              style={fetchBtnStyle}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "#2563EB";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.background = C.accent;
              }}
            >
              {loading ? "Fetching..." : "Get Weather"}
            </button>
          </div>

          {/* Loading spinner */}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: `2px solid ${C.border}`,
                  borderTopColor: C.accent,
                  borderRadius: "50%",
                  animation: "hwp-spin 0.8s linear infinite",
                }}
              />
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 13,
                  color: C.textDim,
                }}
              >
                Fetching weather data...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div
              style={{
                background: C.red + "12",
                border: `1px solid ${C.red}33`,
                borderRadius: 8,
                padding: "14px 16px",
                animation: "hwp-fadeIn 0.3s ease-out",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 13,
                  color: C.red,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Failed to load weather
              </div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  color: C.textDim,
                  wordBreak: "break-word",
                }}
              >
                {error}
              </div>
            </div>
          )}

          {/* Weather results */}
          {weather && !loading && (
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 20,
                animation: "hwp-fadeIn 0.3s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                {/* Weather icon */}
                <div
                  style={{
                    fontSize: 40,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {getWeatherEmoji(weather.shortForecast)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Temperature */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 32,
                        fontWeight: 700,
                        color: C.text,
                        lineHeight: 1,
                      }}
                    >
                      {weather.temperature}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT_SANS,
                        fontSize: 16,
                        color: C.textDim,
                        fontWeight: 500,
                      }}
                    >
                      {"\u00B0"}{weather.unit}
                    </span>
                  </div>

                  {/* Conditions */}
                  <div
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 14,
                      color: C.text,
                      fontWeight: 500,
                      marginBottom: 2,
                    }}
                  >
                    {weather.shortForecast}
                  </div>

                  {/* Period name and wind */}
                  <div
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 12,
                      color: C.textDim,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    <span>{weather.name}</span>
                    {weather.windSpeed && (
                      <span>
                        {" \u00B7 Wind: "}
                        {weather.windSpeed} {weather.windDirection}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed forecast */}
              {weather.detailedForecast && (
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                    color: C.textDim,
                    lineHeight: 1.6,
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  {weather.detailedForecast}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!weather && !loading && !error && (
            <div
              style={{
                textAlign: "center",
                padding: "16px 0 4px",
                fontFamily: FONT_SANS,
                fontSize: 13,
                color: C.textDim,
              }}
            >
              Select a city and click "Get Weather" to see live data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
