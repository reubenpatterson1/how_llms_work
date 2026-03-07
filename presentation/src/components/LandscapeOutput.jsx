import { useState, useMemo, useCallback } from "react";

// ============================================================
//  DESIGN TOKENS
// ============================================================
const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";
const ACCENT = "#e8927c";
const GREEN = "#7ccea0";
const BLUE = "#7ca8e8";
const PURPLE = "#c87ce8";
const GOLD = "#e8c47c";
const RED = "#e87c7c";
const GRAY = "#8899aa";
const BG = "#0e1117";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.06)";

// ============================================================
//  SECTION 1 DATA: FILLING IN THE GAPS
//  Simulated logit distributions for "what framework to use"
// ============================================================
const FRAMEWORK_CANDIDATES = [
  { token: "React",      vagueProb: 0.14, denseProb: 0.005, trainingFreq: 0.22, color: "#61dafb" },
  { token: "Shopify",    vagueProb: 0.18, denseProb: 0.002, trainingFreq: 0.28, color: "#7ab55c" },
  { token: "WordPress",  vagueProb: 0.16, denseProb: 0.001, trainingFreq: 0.25, color: "#21759b" },
  { token: "Next",       vagueProb: 0.08, denseProb: 0.82,  trainingFreq: 0.08, color: "#f0f0f0" },
  { token: "HTML",       vagueProb: 0.09, denseProb: 0.001, trainingFreq: 0.05, color: "#e34c26" },
  { token: "Wix",        vagueProb: 0.07, denseProb: 0.001, trainingFreq: 0.04, color: "#faad4d" },
  { token: "Django",     vagueProb: 0.05, denseProb: 0.001, trainingFreq: 0.03, color: "#092e20" },
  { token: "Vue",        vagueProb: 0.06, denseProb: 0.003, trainingFreq: 0.02, color: "#42b883" },
  { token: "PHP",        vagueProb: 0.04, denseProb: 0.001, trainingFreq: 0.015, color: "#777bb4" },
  { token: "Angular",    vagueProb: 0.03, denseProb: 0.002, trainingFreq: 0.01, color: "#dd1b16" },
  { token: "Svelte",     vagueProb: 0.02, denseProb: 0.001, trainingFreq: 0.008, color: "#ff3e00" },
  { token: "other",      vagueProb: 0.08, denseProb: 0.002, trainingFreq: 0.032, color: "#555" },
];

// ============================================================
//  SECTION 2 DATA: TOP-K SAMPLING
// ============================================================
const SAMPLING_TOKENS_VAGUE = [
  { token: "Shopify",   prob: 0.18 },
  { token: "WordPress", prob: 0.16 },
  { token: "React",     prob: 0.14 },
  { token: "HTML",      prob: 0.09 },
  { token: "Next",      prob: 0.08 },
  { token: "Wix",       prob: 0.07 },
  { token: "Vue",       prob: 0.06 },
  { token: "Django",    prob: 0.05 },
  { token: "PHP",       prob: 0.04 },
  { token: "Angular",   prob: 0.03 },
  { token: "Svelte",    prob: 0.02 },
  { token: "Flask",     prob: 0.015 },
  { token: "Ruby",      prob: 0.012 },
  { token: "Laravel",   prob: 0.010 },
  { token: "Gatsby",    prob: 0.008 },
  { token: "Nuxt",      prob: 0.007 },
  { token: "Remix",     prob: 0.006 },
  { token: "Express",   prob: 0.005 },
  { token: "Spring",    prob: 0.004 },
  { token: "ASP.NET",   prob: 0.003 },
];

const SAMPLING_TOKENS_DENSE = [
  { token: "Next",       prob: 0.82 },
  { token: ".js",        prob: 0.06 },
  { token: "React",      prob: 0.03 },
  { token: "js",         prob: 0.015 },
  { token: "14",         prob: 0.012 },
  { token: "app",        prob: 0.008 },
  { token: "pages",      prob: 0.006 },
  { token: "component",  prob: 0.005 },
  { token: "router",     prob: 0.004 },
  { token: "layout",     prob: 0.003 },
  { token: "server",     prob: 0.003 },
  { token: "src",        prob: 0.002 },
  { token: "import",     prob: 0.002 },
  { token: "export",     prob: 0.0015 },
  { token: "function",   prob: 0.0012 },
  { token: "const",      prob: 0.001 },
  { token: "Tailwind",   prob: 0.001 },
  { token: "Prisma",     prob: 0.0008 },
  { token: "stripe",     prob: 0.0007 },
  { token: "api",        prob: 0.0005 },
];

// ============================================================
//  SECTION 3 DATA: CONFABULATION PATHWAYS
// ============================================================
const CONFAB_DIMENSIONS = [
  {
    id: "framework",
    label: "Framework",
    vagueStatus: "unresolved",
    denseStatus: "locked",
    denseValue: "React/Next.js 14",
    confabExamples: [
      "I'll set up a WordPress site with WooCommerce for your shoe store.",
      "Let me create this with Shopify — it's perfect for e-commerce.",
      "I'll build a custom HTML/CSS site with a simple checkout page.",
    ],
    riskLevel: 0.9,
    icon: "\u2699",
    desc: "Without a framework specified, the model picks one based on training frequency. Different runs may choose different frameworks, producing inconsistent results.",
  },
  {
    id: "database",
    label: "Database",
    vagueStatus: "unresolved",
    denseStatus: "locked",
    denseValue: "PostgreSQL + Prisma",
    confabExamples: [
      "We'll store products in a MongoDB collection...",
      "I'll use SQLite for simplicity since this is a small store.",
      "Let me set up a Firebase Realtime Database for the product catalog.",
    ],
    riskLevel: 0.85,
    icon: "\u{1F4BE}",
    desc: "The prompt says 'sells shoes' but never mentions data storage. The model must invent a database choice — and each invention cascades into different ORMs, schemas, and query patterns.",
  },
  {
    id: "auth",
    label: "Authentication",
    vagueStatus: "unresolved",
    denseStatus: "locked",
    denseValue: "OAuth2 (Google/email) via NextAuth",
    confabExamples: [
      "Users can create accounts with email and password...",
      "I'll add a guest checkout — no login required.",
      "Let me integrate Firebase Auth with Google sign-in.",
    ],
    riskLevel: 0.75,
    icon: "\u{1F512}",
    desc: "Does the store need user accounts? Guest checkout? Social login? The vague prompt doesn't say, so the model guesses — and each guess shapes the entire user flow.",
  },
  {
    id: "design",
    label: "Visual Design",
    vagueStatus: "unresolved",
    denseStatus: "partial",
    denseValue: "Tailwind, mobile-first, WCAG-AA",
    confabExamples: [
      "I'll use a clean minimalist design with lots of white space...",
      "Here's a bold, colorful layout targeting younger shoppers...",
      "The design uses a classic e-commerce grid with sidebar filters.",
    ],
    riskLevel: 0.7,
    icon: "\u{1F3A8}",
    desc: "Design is inherently open-ended, but the vague prompt gives zero visual direction. The model fills in aesthetics from the most common patterns in its training data.",
  },
  {
    id: "performance",
    label: "Performance",
    vagueStatus: "unresolved",
    denseStatus: "locked",
    denseValue: "LCP < 2s",
    confabExamples: [
      "This should load quickly with standard caching.",
      "I'll optimize images for fast page loads.",
      "Performance will be fine with a CDN.",
    ],
    riskLevel: 0.5,
    icon: "\u26A1",
    desc: "Without a measurable target, the model generates vague performance claims that can't be tested. 'Fast' is a hallucination if there's no threshold to verify against.",
  },
  {
    id: "pricing",
    label: "Price Range",
    vagueStatus: "unresolved",
    denseStatus: "locked",
    denseValue: "$80\u2013200",
    confabExamples: [
      "Products range from $29.99 to $149.99...",
      "We'll position these as premium shoes starting at $200...",
      "The budget-friendly collection starts under $50.",
    ],
    riskLevel: 0.65,
    icon: "\u{1F4B0}",
    desc: "Price range determines UX (filter ranges, sort defaults), design (luxury vs budget aesthetic), and even copy tone. The model fabricates a price tier and designs around it.",
  },
];

// ============================================================
//  UTILITY
// ============================================================
function entropy(probs) {
  return -probs.reduce((s, p) => s + (p > 1e-10 ? p * Math.log2(p) : 0), 0);
}

function Box({ children, style, accent }) {
  return (
    <div style={{
      background: accent ? `${accent}08` : SURFACE,
      border: `1px solid ${accent ? accent + "25" : BORDER}`,
      borderRadius: 8, padding: "16px 20px", ...style,
    }}>{children}</div>
  );
}

function Label({ children, color }) {
  return (
    <div style={{
      fontSize: 10, color: color || GRAY, fontFamily: FM,
      textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8,
    }}>{children}</div>
  );
}

function Metric({ label, value, accent, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 9, color: "#667788", fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FM, color: accent || "#e8c4b8", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#556677", fontFamily: FM, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ============================================================
//  SECTION 1: FILLING IN THE GAPS
// ============================================================
function FillingGaps() {
  const [showTraining, setShowTraining] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const sorted = useMemo(() =>
    [...FRAMEWORK_CANDIDATES].sort((a, b) => b.vagueProb - a.vagueProb),
  []);

  const vagueEntropy = entropy(FRAMEWORK_CANDIDATES.map(t => t.vagueProb));
  const denseEntropy = entropy(FRAMEWORK_CANDIDATES.map(t => t.denseProb));
  const correlation = useMemo(() => {
    // Pearson between vagueProb and trainingFreq
    const n = FRAMEWORK_CANDIDATES.length;
    const xm = FRAMEWORK_CANDIDATES.reduce((s, t) => s + t.vagueProb, 0) / n;
    const ym = FRAMEWORK_CANDIDATES.reduce((s, t) => s + t.trainingFreq, 0) / n;
    let num = 0, dx = 0, dy = 0;
    FRAMEWORK_CANDIDATES.forEach(t => {
      num += (t.vagueProb - xm) * (t.trainingFreq - ym);
      dx += (t.vagueProb - xm) ** 2;
      dy += (t.trainingFreq - ym) ** 2;
    });
    return num / (Math.sqrt(dx) * Math.sqrt(dy));
  }, []);

  return (
    <div>
      <Box accent={ACCENT} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: FM, marginBottom: 6 }}>
          The Prompt: "Build me a website that sells shoes"
        </div>
        <div style={{ fontSize: 13, color: "#bfc8d0", lineHeight: 1.7, fontFamily: FS }}>
          The model has processed your vague prompt and must now generate the first implementation token.
          Which framework should it choose? Nothing in the prompt constrains this decision, so the output
          logit distribution reflects <em>what the model saw most often in training</em>, not your intent.
        </div>
      </Box>

      {/* Side-by-side distributions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Vague distribution */}
        <Box>
          <Label color={RED}>Vague Prompt \u2192 Output Logits</Label>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, marginBottom: 8 }}>
            {sorted.map((t, i) => {
              const h = t.vagueProb * 600;
              const isSelected = selectedToken === t.token;
              return (
                <div key={t.token} onClick={() => setSelectedToken(t.token)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 8, fontFamily: FM, color: isSelected ? "#fff" : "#667788", marginBottom: 2 }}>
                    {(t.vagueProb * 100).toFixed(0)}%
                  </div>
                  <div style={{
                    width: "100%", maxWidth: 28, height: Math.max(3, h), borderRadius: "3px 3px 0 0",
                    background: showTraining
                      ? `linear-gradient(to top, ${t.color}88, ${GOLD}${Math.round(t.trainingFreq * 255 * 3).toString(16).padStart(2,"0")})`
                      : isSelected ? t.color : `${t.color}88`,
                    transition: "all 0.4s", border: isSelected ? `1px solid ${t.color}` : "none",
                  }} />
                  <div style={{
                    fontSize: 7, fontFamily: FM, color: isSelected ? "#e8c4b8" : "#556677",
                    marginTop: 3, transform: "rotate(-45deg)", transformOrigin: "top center",
                    whiteSpace: "nowrap", height: 20,
                  }}>{t.token}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Metric label="Entropy" value={vagueEntropy.toFixed(2)} accent={RED} sub={`Max: ${Math.log2(sorted.length).toFixed(2)}`} />
            <Metric label="Top Token" value="18%" accent={GOLD} sub="Shopify" />
            <Metric label="Gap 1st\u21922nd" value="2%" accent={RED} sub="Nearly tied" />
          </div>
        </Box>

        {/* Dense distribution */}
        <Box>
          <Label color={GREEN}>Dense Spec \u2192 Output Logits</Label>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, marginBottom: 8 }}>
            {[...FRAMEWORK_CANDIDATES].sort((a, b) => b.denseProb - a.denseProb).map((t) => {
              const h = t.denseProb * 200;
              const isSelected = selectedToken === t.token;
              return (
                <div key={t.token} onClick={() => setSelectedToken(t.token)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 8, fontFamily: FM, color: isSelected ? "#fff" : "#667788", marginBottom: 2 }}>
                    {t.denseProb >= 0.01 ? `${(t.denseProb * 100).toFixed(0)}%` : "<1%"}
                  </div>
                  <div style={{
                    width: "100%", maxWidth: 28, height: Math.max(3, h), borderRadius: "3px 3px 0 0",
                    background: isSelected ? t.color : `${t.color}88`,
                    transition: "all 0.4s", border: isSelected ? `1px solid ${t.color}` : "none",
                  }} />
                  <div style={{
                    fontSize: 7, fontFamily: FM, color: isSelected ? "#e8c4b8" : "#556677",
                    marginTop: 3, transform: "rotate(-45deg)", transformOrigin: "top center",
                    whiteSpace: "nowrap", height: 20,
                  }}>{t.token}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Metric label="Entropy" value={denseEntropy.toFixed(2)} accent={GREEN} sub={`Max: ${Math.log2(sorted.length).toFixed(2)}`} />
            <Metric label="Top Token" value="82%" accent={GREEN} sub="Next" />
            <Metric label="Gap 1st\u21922nd" value="76%" accent={GREEN} sub="Dominant" />
          </div>
        </Box>
      </div>

      {/* Training frequency overlay toggle */}
      <Box style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Label color={GOLD}>Training Data Frequency Overlay</Label>
            <div style={{ fontSize: 12, color: "#99aabb", lineHeight: 1.6 }}>
              Toggle to see how closely the vague prompt's logit distribution mirrors the frequency of
              framework mentions in training data. The correlation is <strong style={{ color: GOLD }}>r = {correlation.toFixed(3)}</strong> \u2014
              the model is essentially <em>reproducing its training distribution</em> because the prompt
              provides no signal to deviate from it.
            </div>
          </div>
          <button onClick={() => setShowTraining(!showTraining)} style={{
            padding: "10px 20px", fontSize: 12, fontFamily: FM, fontWeight: 600, cursor: "pointer",
            background: showTraining ? `${GOLD}20` : SURFACE,
            border: `1px solid ${showTraining ? GOLD + "55" : BORDER}`,
            borderRadius: 6, color: showTraining ? GOLD : GRAY, transition: "all 0.2s", whiteSpace: "nowrap",
          }}>{showTraining ? "Hide Overlay" : "Show Overlay"}</button>
        </div>
      </Box>

      {/* Insight */}
      <Box accent={ACCENT}>
        <Label color={ACCENT}>Why This Matters</Label>
        <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7 }}>
          <strong style={{ color: "#e8c4b8" }}>When the feature landscape is flat, the model defaults to its priors.</strong>{" "}
          The vague prompt produces a logit distribution that is almost a mirror of training data frequency \u2014 Shopify
          leads because it appeared most often in "website that sells" contexts, not because it matches your intent.
          The dense spec overrides these priors entirely: "React/Next.js 14" creates such a sharp feature peak that
          the logit distribution collapses to a single dominant token. The model doesn't guess \u2014 it executes.
        </div>
      </Box>
    </div>
  );
}

// ============================================================
//  SECTION 2: SAMPLING WINDOW
// ============================================================
function SamplingWindow() {
  const [topK, setTopK] = useState(5);
  const [mode, setMode] = useState("vague");
  const tokens = mode === "vague" ? SAMPLING_TOKENS_VAGUE : SAMPLING_TOKENS_DENSE;

  const totalProb = tokens.slice(0, topK).reduce((s, t) => s + t.prob, 0);
  const outsideProb = 1 - totalProb;

  // Renormalized probabilities within the top-k window
  const renormed = tokens.slice(0, topK).map(t => ({ ...t, renormedProb: t.prob / totalProb }));
  const topEntropy = entropy(renormed.map(t => t.renormedProb));
  const maxEntropy = Math.log2(topK);
  const dominance = renormed.length > 0 ? renormed[0].renormedProb : 0;

  // Simulate multiple "rolls" to show non-determinism
  const rolls = useMemo(() => {
    const r = [];
    for (let i = 0; i < 8; i++) {
      let rand = Math.random() * totalProb;
      let cum = 0;
      for (const t of tokens.slice(0, topK)) {
        cum += t.prob;
        if (rand <= cum) { r.push(t.token); break; }
      }
    }
    return r;
  }, [topK, mode, totalProb]);

  return (
    <div>
      <Box accent={PURPLE} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: PURPLE, fontFamily: FM, marginBottom: 6 }}>
          The Sampling Window
        </div>
        <div style={{ fontSize: 13, color: "#bfc8d0", lineHeight: 1.7, fontFamily: FS }}>
          After the model computes logits, it doesn't always pick the highest-probability token. Instead,
          it samples from the top <em>K</em> tokens, renormalized to sum to 1.0. Drag the slider to see
          how the sampling window interacts differently with peaked vs. flat distributions.
        </div>
      </Box>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["vague", "dense"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "8px 16px", fontSize: 12, fontFamily: FM, fontWeight: mode === m ? 700 : 400,
              background: mode === m ? `${ACCENT}18` : SURFACE, border: mode === m ? `1px solid ${ACCENT}44` : `1px solid ${BORDER}`,
              borderRadius: 4, color: mode === m ? ACCENT : GRAY, cursor: "pointer",
            }}>{m === "vague" ? "Vague Prompt" : "Dense Spec"}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 11, fontFamily: FM, color: GRAY }}>Top-K:</span>
          <input type="range" min={1} max={20} value={topK} onChange={e => setTopK(+e.target.value)}
            style={{ flex: 1, accentColor: PURPLE }} />
          <span style={{ fontSize: 16, fontFamily: FM, fontWeight: 700, color: PURPLE, minWidth: 30 }}>{topK}</span>
        </div>
      </div>

      {/* Distribution visualization */}
      <Box style={{ marginBottom: 20 }}>
        <Label>Logit Distribution \u2014 Top-{topK} Window Highlighted</Label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 180, marginBottom: 12, position: "relative" }}>
          {tokens.map((t, i) => {
            const inWindow = i < topK;
            const maxP = Math.max(...tokens.map(x => x.prob));
            const h = (t.prob / maxP) * 160;
            return (
              <div key={t.token} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                opacity: inWindow ? 1 : 0.25, transition: "opacity 0.3s",
              }}>
                <div style={{ fontSize: 7, fontFamily: FM, color: inWindow ? "#e8c4b8" : "#445566", marginBottom: 2 }}>
                  {(t.prob * 100).toFixed(1)}
                </div>
                <div style={{
                  width: "100%", maxWidth: 24, height: Math.max(2, h), borderRadius: "3px 3px 0 0",
                  background: inWindow
                    ? (i === 0 ? GREEN : mode === "vague" ? `${GOLD}cc` : `${GREEN}88`)
                    : "rgba(255,255,255,0.08)",
                  transition: "all 0.3s",
                  border: inWindow ? `1px solid ${mode === "vague" ? GOLD : GREEN}44` : "none",
                }} />
                <div style={{
                  fontSize: 7, fontFamily: FM, color: inWindow ? "#8899aa" : "#334",
                  marginTop: 3, transform: "rotate(-55deg)", transformOrigin: "top center",
                  whiteSpace: "nowrap", height: 18,
                }}>{t.token}</div>
              </div>
            );
          })}
          {/* Window bracket */}
          <div style={{
            position: "absolute", bottom: 38, left: 0,
            width: `${(topK / tokens.length) * 100}%`,
            borderBottom: `2px solid ${PURPLE}`, borderLeft: `2px solid ${PURPLE}`, borderRight: `2px solid ${PURPLE}`,
            height: 8, borderRadius: "0 0 4px 4px", transition: "width 0.3s",
          }} />
        </div>

        {/* Metrics */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <Metric label="Window Coverage" value={`${(totalProb * 100).toFixed(1)}%`}
            accent={totalProb > 0.8 ? GREEN : totalProb > 0.5 ? GOLD : RED}
            sub={`${(outsideProb * 100).toFixed(1)}% excluded`} />
          <Metric label="Window Entropy" value={topEntropy.toFixed(2)}
            accent={topEntropy / (maxEntropy || 1) < 0.5 ? GREEN : topEntropy / (maxEntropy || 1) < 0.8 ? GOLD : RED}
            sub={`Max: ${maxEntropy.toFixed(2)} bits`} />
          <Metric label="#1 After Renorm" value={`${(dominance * 100).toFixed(1)}%`}
            accent={dominance > 0.6 ? GREEN : dominance > 0.3 ? GOLD : RED}
            sub={renormed[0]?.token || ""} />
          <Metric label="Excluded Prob" value={`${(outsideProb * 100).toFixed(1)}%`}
            accent={outsideProb < 0.1 ? GREEN : outsideProb < 0.3 ? GOLD : RED}
            sub="Mass discarded" />
        </div>

        {/* Renormalized bars */}
        <Label>Renormalized Within Window (what the sampler actually sees)</Label>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80, marginBottom: 12 }}>
          {renormed.map((t, i) => {
            const h = t.renormedProb * 70;
            return (
              <div key={t.token} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 8, fontFamily: FM, color: "#e8c4b8", marginBottom: 2 }}>
                  {(t.renormedProb * 100).toFixed(0)}%
                </div>
                <div style={{
                  width: "100%", maxWidth: 32, height: Math.max(3, h), borderRadius: "3px 3px 0 0",
                  background: i === 0 ? GREEN : `${PURPLE}88`, transition: "all 0.3s",
                }} />
                <div style={{ fontSize: 8, fontFamily: FM, color: "#8899aa", marginTop: 3 }}>{t.token}</div>
              </div>
            );
          })}
        </div>
      </Box>

      {/* Simulated rolls */}
      <Box style={{ marginBottom: 20 }}>
        <Label color={PURPLE}>8 Simulated Samples from This Window</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {rolls.map((r, i) => (
            <span key={i} style={{
              padding: "6px 14px", borderRadius: 4, fontSize: 13, fontFamily: FM, fontWeight: 600,
              background: `${PURPLE}15`, border: `1px solid ${PURPLE}33`, color: PURPLE,
            }}>{r}</span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#778899", lineHeight: 1.6 }}>
          {mode === "vague"
            ? "Notice the variety \u2014 the same prompt produces different framework choices each time. This is non-determinism caused by a flat logit distribution giving the sampler too many viable options."
            : "Nearly every sample is the same token. The peaked distribution means Top-K barely matters \u2014 even K=10 produces consistent output because one token dominates so heavily."}
        </div>
      </Box>

      {/* Insight */}
      <Box accent={PURPLE}>
        <Label color={PURPLE}>The Key Insight</Label>
        <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7 }}>
          <strong style={{ color: "#e8c4b8" }}>Top-K doesn't fix a flat distribution \u2014 it just limits the damage.</strong>{" "}
          With the vague prompt at K=5, you're choosing among Shopify (18%), WordPress (16%), React (14%),
          HTML (9%), and Next (8%). After renormalization these become ~28%, 25%, 22%, 14%, 12% \u2014 still
          essentially a coin flip. With the dense spec at K=5, the renormalized window is 93% "Next" and scraps.
          The distribution shape, set by the input landscape, determines whether sampling is a focused selection or a lottery.
        </div>
      </Box>
    </div>
  );
}

// ============================================================
//  SECTION 3: CONFABULATION PATHWAYS
// ============================================================
function ConfabulationPathways() {
  const [selectedDim, setSelectedDim] = useState("framework");
  const [showDense, setShowDense] = useState(false);

  const dim = CONFAB_DIMENSIONS.find(d => d.id === selectedDim);
  const totalRisk = CONFAB_DIMENSIONS.filter(d => d.vagueStatus === "unresolved").length;
  const denseResolved = CONFAB_DIMENSIONS.filter(d => d.denseStatus === "locked").length;

  return (
    <div>
      <Box accent={RED} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: RED, fontFamily: FM, marginBottom: 6 }}>
          Confabulation: When the Model Must Invent
        </div>
        <div style={{ fontSize: 13, color: "#bfc8d0", lineHeight: 1.7, fontFamily: FS }}>
          Each unresolved dimension in the prompt is a <em>confabulation pathway</em> \u2014 a point where the model
          must generate information that wasn't grounded in the input. Click each dimension below to see the
          competing outputs the model might produce and why each one is technically a hallucination.
        </div>
      </Box>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[false, true].map(d => (
          <button key={String(d)} onClick={() => setShowDense(d)} style={{
            padding: "8px 16px", fontSize: 12, fontFamily: FM, fontWeight: showDense === d ? 700 : 400,
            background: showDense === d ? `${ACCENT}18` : SURFACE, border: showDense === d ? `1px solid ${ACCENT}44` : `1px solid ${BORDER}`,
            borderRadius: 4, color: showDense === d ? ACCENT : GRAY, cursor: "pointer",
          }}>{d ? "Dense Spec" : "Vague Prompt"}</button>
        ))}
      </div>

      {/* Dimension cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 20 }}>
        {CONFAB_DIMENSIONS.map(d => {
          const status = showDense ? d.denseStatus : d.vagueStatus;
          const isActive = selectedDim === d.id;
          const statusColor = status === "locked" ? GREEN : status === "partial" ? GOLD : RED;
          return (
            <button key={d.id} onClick={() => setSelectedDim(d.id)} style={{
              padding: "14px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              background: isActive ? `${statusColor}15` : SURFACE,
              border: isActive ? `2px solid ${statusColor}55` : `1px solid ${BORDER}`,
              transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
              <div style={{ fontSize: 12, fontFamily: FM, fontWeight: 600, color: isActive ? "#e8c4b8" : GRAY }}>{d.label}</div>
              <div style={{
                fontSize: 9, fontFamily: FM, textTransform: "uppercase", letterSpacing: 0.5,
                color: statusColor, marginTop: 4,
              }}>{status}</div>
              {!showDense && (
                <div style={{
                  marginTop: 6, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden",
                }}>
                  <div style={{
                    width: `${d.riskLevel * 100}%`, height: "100%", background: RED, borderRadius: 2,
                    transition: "width 0.3s",
                  }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected dimension detail */}
      {dim && (
        <Box style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{dim.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FM, color: "#e8c4b8" }}>{dim.label}</div>
              <div style={{ fontSize: 11, fontFamily: FM, color: showDense ? GREEN : RED }}>
                {showDense ? (dim.denseStatus === "locked" ? `Locked: ${dim.denseValue}` : `Partial: ${dim.denseValue}`) : "Unresolved \u2014 model must invent"}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7, marginBottom: 16 }}>{dim.desc}</div>

          {!showDense && (
            <>
              <Label color={RED}>Competing Outputs (each is equally plausible)</Label>
              <div style={{ display: "grid", gap: 8 }}>
                {dim.confabExamples.map((ex, i) => (
                  <div key={i} style={{
                    padding: "12px 16px", borderRadius: 6,
                    background: "rgba(232,124,124,0.06)", border: "1px solid rgba(232,124,124,0.15)",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 11, fontFamily: FM, color: RED, fontWeight: 700, minWidth: 50 }}>Run {i + 1}:</span>
                    <span style={{ fontSize: 12, color: "#b0b8c0", lineHeight: 1.5, fontStyle: "italic" }}>"{ex}"</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#778899", marginTop: 10, lineHeight: 1.5 }}>
                Each output sounds confident and competent. None is "wrong" in isolation. But they're
                mutually exclusive \u2014 the model chose differently each time because the flat logit distribution
                gave the sampler room to wander.
              </div>
            </>
          )}

          {showDense && dim.denseStatus === "locked" && (
            <Box accent={GREEN}>
              <div style={{ fontSize: 12, color: GREEN, fontFamily: FM, fontWeight: 600, marginBottom: 6 }}>
                Pathway Closed
              </div>
              <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.6 }}>
                The constraint <strong style={{ color: "#e8c4b8" }}>"{dim.denseValue}"</strong> in the spec
                collapses the logit distribution for this dimension to a single option. The model doesn't need
                to sample \u2014 the constraint eliminates all competing tokens. No sampling variance means no confabulation.
              </div>
            </Box>
          )}
        </Box>
      )}

      {/* Summary metrics */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <Metric label="Open Pathways (vague)" value={totalRisk} accent={RED} sub="Dimensions where model must guess" />
        <Metric label="Locked (dense)" value={denseResolved} accent={GREEN} sub={`of ${CONFAB_DIMENSIONS.length} total`} />
        <Metric label="Hallucination Surface" value={showDense ? "17%" : "100%"} accent={showDense ? GREEN : RED}
          sub={showDense ? "Only design partially open" : "Every dimension is a guess"} />
      </div>

      {/* Insight */}
      <Box accent={RED}>
        <Label color={RED}>The Confabulation Principle</Label>
        <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7 }}>
          <strong style={{ color: "#e8c4b8" }}>Every unresolved dimension is a hallucination waiting to happen.</strong>{" "}
          The model <em>must</em> generate something for each open question \u2014 it can't leave blanks. So it fills
          gaps with training-frequency defaults, producing output that sounds authoritative but is ungrounded.
          The dense spec doesn't make the model "smarter" \u2014 it eliminates the <em>need</em> to confabulate by
          pre-answering the questions the model would otherwise have to invent answers for. Each specific token
          in your prompt is a closed door through which hallucination cannot pass.
        </div>
      </Box>
    </div>
  );
}

// ============================================================
//  MAIN SHELL
// ============================================================
const TABS = [
  { id: "gaps",    label: "Filling in the Gaps",   sub: "Training data defaults", accent: ACCENT, icon: "\u{1F4CA}" },
  { id: "sampling", label: "Sampling Window",       sub: "Top-K interaction",      accent: PURPLE, icon: "\u{1F3B2}" },
  { id: "confab",  label: "Confabulation Pathways", sub: "Hallucination anatomy",  accent: RED,    icon: "\u{1F6A8}" },
];

export default function LandscapeOutput() {
  const [tab, setTab] = useState("gaps");

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px 48px" }}>
        {/* Header */}
        <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 3, marginBottom: 8 }}>
          Interactive Visualization
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#e8c4b8", margin: "0 0 6px", lineHeight: 1.2 }}>
          How Landscape Impacts Output
        </h1>
        <p style={{ fontSize: 14, color: GRAY, margin: "0 0 28px", maxWidth: 720, lineHeight: 1.6 }}>
          The feature activation landscape from the previous module flows forward through the model
          and ultimately determines what tokens get generated. A flat landscape produces guesswork.
          A peaked landscape produces precision.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "14px 20px", fontSize: 13, fontFamily: FM, fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? "rgba(255,255,255,0.05)" : "transparent",
              border: "none", borderBottom: tab === t.id ? `2px solid ${t.accent}` : "2px solid transparent",
              color: tab === t.id ? "#e8c4b8" : "#667788", cursor: "pointer", borderRadius: "6px 6px 0 0",
              transition: "all 0.2s",
            }}>
              <span style={{ marginRight: 8 }}>{t.icon}</span>{t.label}
              <span style={{ fontSize: 10, display: "block", fontWeight: 400, color: tab === t.id ? GRAY : "#445566", marginTop: 2 }}>
                {t.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "gaps" && <FillingGaps />}
        {tab === "sampling" && <SamplingWindow />}
        {tab === "confab" && <ConfabulationPathways />}

        {/* Bottom: connecting statement */}
        <div style={{
          marginTop: 32, padding: 24, background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            The Full Chain
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, fontSize: 13, color: "#99aabb", lineHeight: 1.7,
          }}>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Flat landscape \u2192 training defaults.</strong>{" "}
              When features are diffuse, the model's output distribution mirrors what it saw most often in pre-training.
              Your vague prompt doesn't override these priors \u2014 it surrenders to them. The most popular framework
              in training data becomes the model's "choice," regardless of your actual needs.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Flat distribution \u2192 sampling lottery.</strong>{" "}
              Top-K and temperature settings exist to manage output diversity, but they can't create clarity from
              confusion. When 6 tokens are all within 5% of each other, any sampling strategy produces inconsistent
              results. The variance is in the input, not the sampler.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Open dimensions \u2192 forced confabulation.</strong>{" "}
              The model must generate <em>something</em> for every unspecified dimension. Each generation is
              ungrounded \u2014 plausible but invented. Dense specs close these pathways before the model reaches
              them, converting "guess" into "execute." Every constraint token is a hallucination prevented.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
