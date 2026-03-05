import { useState, useMemo } from "react";

// ============================================================
//  FONTS
// ============================================================
const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";

// ============================================================
//  PROMPT DATA — three versions of the same task
// ============================================================

// Density categories
const CAT = {
  filler:     { label: "Filler",      color: "#555e6e", desc: "Grammatical glue — no task information" },
  vague:      { label: "Vague Intent", color: "#8b7355", desc: "Conveys intent but leaves interpretation open" },
  moderate:   { label: "Moderate",     color: "#b08840", desc: "Narrows the space but still ambiguous" },
  specific:   { label: "Specific",     color: "#4a9e6e", desc: "Resolves a dimension to a concrete value" },
  constraint: { label: "Constraint",   color: "#3a8fd4", desc: "Hard requirement — measurable, testable" },
  technical:  { label: "Technical",    color: "#9b6dd7", desc: "Implementation-level specification" },
};

const PROMPTS = [
  {
    id: "casual",
    label: "Casual Request",
    subtitle: "How most people prompt",
    text: "Build me a website that sells shoes to middle-aged women",
    tokens: [
      { word: "Build",       density: 0.15, cat: "vague",    resolves: "action", note: "Create something — but what kind of build? From scratch? Template? Redesign?" },
      { word: "me",          density: 0.05, cat: "filler",   resolves: null, note: "Grammatical filler — adds no task information" },
      { word: "a",           density: 0.02, cat: "filler",   resolves: null, note: "Article — zero information content" },
      { word: "website",     density: 0.25, cat: "vague",    resolves: "platform", note: "Web platform — but SPA? MPA? Static? CMS? Landing page? Full app?" },
      { word: "that",        density: 0.02, cat: "filler",   resolves: null, note: "Relative pronoun — structural glue only" },
      { word: "sells",       density: 0.35, cat: "moderate", resolves: "function", note: "E-commerce function — but what payment? Cart? Checkout flow? Inventory?" },
      { word: "shoes",       density: 0.40, cat: "moderate", resolves: "product", note: "Product category — but what type? Athletic? Formal? Comfort? Price range?" },
      { word: "to",          density: 0.02, cat: "filler",   resolves: null, note: "Preposition — structural glue only" },
      { word: "middle-aged", density: 0.20, cat: "vague",    resolves: "demographic", note: "Vague age range — 35? 45? 55? Different cultures define this differently" },
      { word: "women",       density: 0.30, cat: "moderate", resolves: "demographic", note: "Gender demographic — narrows audience but not preferences, needs, or behavior" },
    ],
    ambiguities: [
      { dimension: "Technology Stack", status: "unknown", question: "What framework? What hosting? What database?" },
      { dimension: "Design System", status: "unknown", question: "Visual style? Brand colors? Typography? Layout?" },
      { dimension: "Product Details", status: "partial", question: "Shoe types? Price range? Inventory size?" },
      { dimension: "User Experience", status: "unknown", question: "Mobile? Accessibility? Performance targets?" },
      { dimension: "Business Logic", status: "partial", question: "Payment processing? Shipping? Returns? Tax?" },
      { dimension: "Authentication", status: "unknown", question: "User accounts? Guest checkout? OAuth?" },
      { dimension: "Content Strategy", status: "unknown", question: "Product descriptions? Reviews? Blog? SEO?" },
      { dimension: "Performance", status: "unknown", question: "Load time targets? CDN? Image optimization?" },
    ],
  },
  {
    id: "improved",
    label: "Improved Prompt",
    subtitle: "Natural language with more detail",
    text: "Build a mobile-friendly e-commerce site using React for selling women's comfort shoes in the $80-200 range, with Stripe checkout, user accounts, and fast load times",
    tokens: [
      { word: "Build",          density: 0.15, cat: "vague",      resolves: "action", note: "Still generic — but context narrows it" },
      { word: "a",              density: 0.02, cat: "filler",     resolves: null, note: "Article" },
      { word: "mobile-friendly", density: 0.55, cat: "specific",  resolves: "responsive", note: "Resolves device strategy — but not breakpoints or mobile-first vs adaptive" },
      { word: "e-commerce",     density: 0.50, cat: "specific",   resolves: "function", note: "Specific platform type — resolves the 'what kind of website' question" },
      { word: "site",           density: 0.10, cat: "filler",     resolves: "platform", note: "Redundant with e-commerce — low marginal information" },
      { word: "using",          density: 0.02, cat: "filler",     resolves: null, note: "Preposition" },
      { word: "React",          density: 0.70, cat: "technical",  resolves: "framework", note: "Specific framework — resolves entire technology decision tree" },
      { word: "for",            density: 0.02, cat: "filler",     resolves: null, note: "Preposition" },
      { word: "selling",        density: 0.10, cat: "filler",     resolves: null, note: "Redundant with e-commerce" },
      { word: "women's",        density: 0.25, cat: "moderate",   resolves: "demographic", note: "Audience gender — still vague on age, preferences" },
      { word: "comfort",        density: 0.45, cat: "specific",   resolves: "product-type", note: "Narrows product category significantly — implies cushioning, support, casual" },
      { word: "shoes",          density: 0.40, cat: "moderate",   resolves: "product-domain", note: "Anchors 'comfort' to footwear — without it, 'comfort' floats across domains (mattresses, clothing, chairs). Same disambiguator role as 'footwear' in the dense spec." },
      { word: "in",             density: 0.02, cat: "filler",     resolves: null, note: "Preposition" },
      { word: "the",            density: 0.02, cat: "filler",     resolves: null, note: "Article" },
      { word: "$80-200",        density: 0.75, cat: "constraint", resolves: "price-range", note: "Concrete price constraint — defines market positioning, margin expectations" },
      { word: "range,",         density: 0.02, cat: "filler",     resolves: null, note: "Structural word" },
      { word: "with",           density: 0.02, cat: "filler",     resolves: null, note: "Preposition" },
      { word: "Stripe",         density: 0.80, cat: "technical",  resolves: "payment", note: "Specific payment processor — resolves entire payment integration question" },
      { word: "checkout,",      density: 0.30, cat: "moderate",   resolves: "payment-flow", note: "Implies cart → checkout flow, but not details" },
      { word: "user",           density: 0.20, cat: "moderate",   resolves: "auth", note: "Implies authentication — but what kind?" },
      { word: "accounts,",      density: 0.35, cat: "moderate",   resolves: "auth", note: "Confirms user registration — but not OAuth, email, SSO specifics" },
      { word: "and",            density: 0.02, cat: "filler",     resolves: null, note: "Conjunction" },
      { word: "fast",           density: 0.15, cat: "vague",      resolves: "performance", note: "Vague performance goal — fast means different things to different people" },
      { word: "load",           density: 0.10, cat: "filler",     resolves: null, note: "Partial — with 'times' forms a concept but alone is low-info" },
      { word: "times",          density: 0.10, cat: "filler",     resolves: null, note: "Completes 'load times' but 'fast' is still vague" },
    ],
    ambiguities: [
      { dimension: "Technology Stack", status: "partial", question: "React chosen, but Next.js? Vite? State management? Database?" },
      { dimension: "Design System", status: "unknown", question: "Visual style? Brand? Typography? Layout approach?" },
      { dimension: "Product Details", status: "mostly", question: "Comfort shoes, $80-200 — but inventory size? Variants? Sizing?" },
      { dimension: "User Experience", status: "partial", question: "Mobile-friendly specified — but accessibility? Specific UX patterns?" },
      { dimension: "Business Logic", status: "partial", question: "Stripe chosen — but shipping? Returns? Tax calculation?" },
      { dimension: "Authentication", status: "partial", question: "User accounts — but OAuth? Email/password? SSO?" },
      { dimension: "Content Strategy", status: "unknown", question: "Product descriptions? Reviews? Blog? SEO approach?" },
      { dimension: "Performance", status: "vague", question: "'Fast load times' — what metric? What threshold? LCP? FCP?" },
    ],
  },
  {
    id: "spec",
    label: "Dense Spec",
    subtitle: "Maximum context density",
    text: "React/Next.js 14 e-commerce SPA · women's comfort footwear · ages 40-60 · $80-200 · Stripe + Apple Pay · OAuth2 (Google/email) · PostgreSQL + Prisma · mobile-first · WCAG-AA · LCP <2s · inventory REST API · Tailwind · 48-product catalog · size/width/color variants · real-time stock · Next Auth · Vercel deploy",
    tokens: [
      { word: "React/Next.js",  density: 0.90, cat: "technical",  resolves: "framework", note: "Framework + meta-framework — resolves rendering, routing, SSR decisions" },
      { word: "14",             density: 0.75, cat: "constraint", resolves: "version", note: "Specific version — resolves API compatibility, feature availability" },
      { word: "e-commerce",     density: 0.50, cat: "specific",   resolves: "function", note: "Platform type" },
      { word: "SPA",            density: 0.65, cat: "technical",  resolves: "architecture", note: "Single-page app — resolves routing, loading, navigation patterns" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "women's",        density: 0.25, cat: "moderate",   resolves: "demographic", note: "Audience gender" },
      { word: "comfort",        density: 0.45, cat: "specific",   resolves: "product-type", note: "Product subcategory" },
      { word: "footwear",       density: 0.45, cat: "moderate",   resolves: "product-domain", note: "Anchors the product domain — without it, 'comfort' could mean clothing, bedding, accessories. This is the disambiguator." },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "ages",           density: 0.50, cat: "specific",   resolves: "dimension-key", note: "Semantic key — without it, '40-60' is ambiguous (size range? quantity? price?). This token tells the model which dimension the constraint applies to." },
      { word: "40-60",          density: 0.70, cat: "constraint", resolves: "age-range", note: "Concrete range — resolves UX assumptions, font size, accessibility priority" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "$80-200",        density: 0.75, cat: "constraint", resolves: "price-range", note: "Market positioning — mid-premium comfort segment" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "Stripe",         density: 0.80, cat: "technical",  resolves: "payment-primary", note: "Primary payment processor" },
      { word: "+",              density: 0.0,  cat: "filler",     resolves: null, note: "Operator" },
      { word: "Apple Pay",      density: 0.70, cat: "technical",  resolves: "payment-alt", note: "Alternative payment — resolves mobile payment UX" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "OAuth2",         density: 0.85, cat: "technical",  resolves: "auth-protocol", note: "Authentication protocol — resolves security model" },
      { word: "(Google/email)", density: 0.65, cat: "specific",   resolves: "auth-providers", note: "Specific providers — resolves OAuth implementation scope" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "PostgreSQL",     density: 0.85, cat: "technical",  resolves: "database", note: "Database engine — resolves entire data layer" },
      { word: "+",              density: 0.0,  cat: "filler",     resolves: null, note: "Operator" },
      { word: "Prisma",         density: 0.80, cat: "technical",  resolves: "orm", note: "ORM — resolves data access patterns, migrations, type safety" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "mobile-first",   density: 0.60, cat: "constraint", resolves: "responsive", note: "Design strategy — not just responsive, mobile is primary" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "WCAG-AA",        density: 0.85, cat: "constraint", resolves: "accessibility", note: "Specific accessibility standard — testable, auditable" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "LCP",            density: 0.70, cat: "technical",  resolves: "perf-metric", note: "Largest Contentful Paint — specific Core Web Vital" },
      { word: "<2s",            density: 0.80, cat: "constraint", resolves: "perf-target", note: "Measurable threshold — pass/fail, no ambiguity" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "inventory",      density: 0.40, cat: "specific",   resolves: "data-domain", note: "Core data entity" },
      { word: "REST API",       density: 0.70, cat: "technical",  resolves: "integration", note: "Integration pattern — resolves how inventory data flows" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "Tailwind",       density: 0.75, cat: "technical",  resolves: "css-framework", note: "Styling framework — resolves design system implementation" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "48-product",     density: 0.70, cat: "constraint", resolves: "catalog-size", note: "Concrete catalog scope — resolves pagination, grid, search needs" },
      { word: "catalog",        density: 0.20, cat: "filler",     resolves: null, note: "Label — real info is '48'" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "size/width/color", density: 0.75, cat: "specific", resolves: "variants", note: "Product variant dimensions — resolves SKU structure, filter UI" },
      { word: "variants",       density: 0.20, cat: "filler",     resolves: null, note: "Label" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "real-time",      density: 0.55, cat: "constraint", resolves: "data-freshness", note: "Freshness requirement — implies WebSockets or polling" },
      { word: "stock",          density: 0.30, cat: "moderate",   resolves: "data-domain", note: "Inventory availability tracking" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "NextAuth",       density: 0.75, cat: "technical",  resolves: "auth-library", note: "Specific auth library — resolves session management" },
      { word: "\u00B7",         density: 0.0,  cat: "filler",     resolves: null, note: "Separator" },
      { word: "Vercel",         density: 0.75, cat: "technical",  resolves: "hosting", note: "Deployment platform — resolves CI/CD, edge functions, CDN" },
      { word: "deploy",         density: 0.15, cat: "filler",     resolves: null, note: "Label" },
    ],
    ambiguities: [
      { dimension: "Technology Stack", status: "resolved", question: "React/Next.js 14, PostgreSQL, Prisma, Tailwind, Vercel" },
      { dimension: "Design System", status: "partial", question: "Tailwind chosen — but specific theme? Brand colors? Component library?" },
      { dimension: "Product Details", status: "resolved", question: "Comfort footwear, $80-200, 48 products, size/width/color variants" },
      { dimension: "User Experience", status: "mostly", question: "Mobile-first, WCAG-AA — specific component patterns still open" },
      { dimension: "Business Logic", status: "mostly", question: "Stripe + Apple Pay, real-time stock — shipping/returns still open" },
      { dimension: "Authentication", status: "resolved", question: "OAuth2 via Google/email, NextAuth library" },
      { dimension: "Content Strategy", status: "partial", question: "48-product catalog defined — but descriptions? Reviews? SEO?" },
      { dimension: "Performance", status: "resolved", question: "LCP <2s — concrete, measurable, testable" },
    ],
  },
];

const STATUS_COLORS = {
  unknown: "#e87c7c",
  vague: "#c89050",
  partial: "#b08840",
  mostly: "#6aaa70",
  resolved: "#3a9e6e",
};

// ============================================================
//  COMPUTED METRICS
// ============================================================
function computeMetrics(prompt) {
  const toks = prompt.tokens;
  const nonSep = toks.filter(t => t.word !== "\u00B7" && t.word !== "+");
  const total = nonSep.length;
  const fillerCount = nonSep.filter(t => t.cat === "filler").length;
  const highDensity = nonSep.filter(t => t.density >= 0.5).length;
  const avgDensity = nonSep.reduce((s, t) => s + t.density, 0) / (total || 1);

  const resolvedDimensions = prompt.ambiguities.filter(a => a.status === "resolved" || a.status === "mostly").length;
  const totalDimensions = prompt.ambiguities.length;

  // Shannon entropy of density distribution (binned)
  const bins = [0, 0, 0, 0, 0]; // 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0
  nonSep.forEach(t => {
    const b = Math.min(4, Math.floor(t.density * 5));
    bins[b]++;
  });
  const probs = bins.map(b => b / (total || 1)).filter(p => p > 0);
  const entropy = -probs.reduce((s, p) => s + p * Math.log2(p), 0);
  const maxEntropy = Math.log2(5);

  return {
    total,
    fillerCount,
    fillerPct: fillerCount / (total || 1),
    highDensity,
    highDensityPct: highDensity / (total || 1),
    avgDensity,
    resolvedDimensions,
    totalDimensions,
    resolutionPct: resolvedDimensions / (totalDimensions || 1),
    entropy,
    maxEntropy,
    informationYield: avgDensity * (1 - fillerCount / (total || 1)),
  };
}

// ============================================================
//  COMPONENTS
// ============================================================
function TokenStrip({ tokens, selectedIdx, onSelect }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "16px" }}>
      {tokens.map((t, i) => {
        if (t.word === "\u00B7" || t.word === "+") {
          return <span key={i} style={{ color: "#445", fontSize: "14px", lineHeight: "32px", padding: "0 2px" }}>{t.word}</span>;
        }
        const catMeta = CAT[t.cat];
        const isSelected = i === selectedIdx;
        const barH = Math.max(2, t.density * 20);
        return (
          <button key={i} onClick={() => onSelect(i)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            padding: "4px 8px 2px", borderRadius: "4px", cursor: "pointer", transition: "all 0.2s",
            background: isSelected ? `${catMeta.color}30` : `${catMeta.color}10`,
            border: isSelected ? `2px solid ${catMeta.color}` : "2px solid transparent",
            position: "relative",
          }}>
            <span style={{ fontSize: "13px", fontFamily: FM, color: catMeta.color, fontWeight: isSelected ? 700 : 500 }}>{t.word}</span>
            <div style={{ width: "100%", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{ width: `${t.density * 100}%`, height: "100%", background: catMeta.color, borderRadius: "2px", transition: "width 0.3s" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DensityHistogram({ tokens }) {
  const nonSep = tokens.filter(t => t.word !== "\u00B7" && t.word !== "+");
  const bins = [
    { label: "0\u2013.2", range: [0, 0.2], count: 0, color: "#555e6e" },
    { label: ".2\u2013.4", range: [0.2, 0.4], count: 0, color: "#8b7355" },
    { label: ".4\u2013.6", range: [0.4, 0.6], count: 0, color: "#b08840" },
    { label: ".6\u2013.8", range: [0.6, 0.8], count: 0, color: "#4a9e6e" },
    { label: ".8\u20131", range: [0.8, 1.01], count: 0, color: "#3a8fd4" },
  ];
  nonSep.forEach(t => {
    for (const b of bins) { if (t.density >= b.range[0] && t.density < b.range[1]) { b.count++; break; } }
  });
  const maxCount = Math.max(...bins.map(b => b.count), 1);

  return (
    <div>
      <div style={{ fontSize: "10px", color: "#667788", fontFamily: FM, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Density Distribution</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px" }}>
        {bins.map((b, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "9px", color: "#8899aa", fontFamily: FM, marginBottom: "3px" }}>{b.count}</div>
            <div style={{
              width: "100%", maxWidth: "40px", height: `${(b.count / maxCount) * 60}px`, minHeight: "2px",
              background: b.color, borderRadius: "3px 3px 0 0", transition: "height 0.4s",
            }} />
            <div style={{ fontSize: "8px", color: "#667788", fontFamily: FM, marginTop: "4px" }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AmbiguityPanel({ ambiguities }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "#667788", fontFamily: FM, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
        Dimension Resolution Map
      </div>
      <div style={{ display: "grid", gap: "6px" }}>
        {ambiguities.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: STATUS_COLORS[a.status], flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontFamily: FM, color: "#c0c8d0", fontWeight: 600 }}>{a.dimension}</span>
                <span style={{
                  fontSize: "9px", fontFamily: FM, textTransform: "uppercase", letterSpacing: "0.5px",
                  color: STATUS_COLORS[a.status], padding: "2px 6px",
                  background: `${STATUS_COLORS[a.status]}15`, borderRadius: "3px",
                }}>{a.status}</span>
              </div>
              <div style={{ fontSize: "10px", color: "#778899", marginTop: "2px", lineHeight: 1.4 }}>{a.question}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricGauge({ label, value, maxVal, format, accent }) {
  const pct = Math.min(1, value / (maxVal || 1));
  return (
    <div style={{ flex: 1, minWidth: "120px" }}>
      <div style={{ fontSize: "9px", color: "#667788", fontFamily: FM, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: FM, color: accent || "#e8c4b8", lineHeight: 1 }}>{format || value}</div>
      <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: accent || "#e8c4b8", borderRadius: "2px", transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function TokenDetail({ token }) {
  if (!token) return null;
  const catMeta = CAT[token.cat];
  return (
    <div style={{
      background: `${catMeta.color}10`, border: `1px solid ${catMeta.color}30`,
      borderRadius: "6px", padding: "14px", marginTop: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span style={{ fontSize: "18px", fontFamily: FM, fontWeight: 700, color: catMeta.color }}>"{token.word}"</span>
        <span style={{
          fontSize: "9px", fontFamily: FM, textTransform: "uppercase", letterSpacing: "1px",
          padding: "3px 8px", borderRadius: "3px", background: `${catMeta.color}20`, color: catMeta.color,
        }}>{catMeta.label}</span>
        <span style={{ fontSize: "12px", fontFamily: FM, color: "#8899aa" }}>
          density: {(token.density * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ fontSize: "12px", color: "#99aabb", lineHeight: 1.6 }}>{token.note}</div>
      {token.resolves && (
        <div style={{ fontSize: "10px", color: "#667788", fontFamily: FM, marginTop: "6px" }}>
          Resolves: <span style={{ color: catMeta.color }}>{token.resolves}</span>
        </div>
      )}
    </div>
  );
}

function PromptPanel({ prompt, isActive }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const metrics = useMemo(() => computeMetrics(prompt), [prompt]);
  const selectedToken = selectedIdx !== null ? prompt.tokens[selectedIdx] : null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", borderRadius: "10px", padding: "20px",
      border: isActive ? "1px solid rgba(232,146,124,0.3)" : "1px solid rgba(255,255,255,0.06)",
      transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8c4b8", fontFamily: FM }}>{prompt.label}</div>
        <div style={{ fontSize: "11px", color: "#667788", fontFamily: FM }}>{prompt.subtitle}</div>
      </div>

      {/* Token strip */}
      <TokenStrip tokens={prompt.tokens} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />

      {/* Selected token detail */}
      {selectedToken && selectedToken.word !== "\u00B7" && selectedToken.word !== "+" && (
        <TokenDetail token={selectedToken} />
      )}

      {/* Metrics row */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "20px 0" }}>
        <MetricGauge label="Tokens" value={metrics.total} maxVal={50} format={metrics.total}
          accent="#8899aa" />
        <MetricGauge label="Avg Density" value={metrics.avgDensity} maxVal={1}
          format={`${(metrics.avgDensity * 100).toFixed(0)}%`}
          accent={metrics.avgDensity > 0.45 ? "#3a9e6e" : metrics.avgDensity > 0.25 ? "#b08840" : "#e87c7c"} />
        <MetricGauge label="Filler %" value={metrics.fillerPct} maxVal={1}
          format={`${(metrics.fillerPct * 100).toFixed(0)}%`}
          accent={metrics.fillerPct < 0.25 ? "#3a9e6e" : metrics.fillerPct < 0.45 ? "#b08840" : "#e87c7c"} />
        <MetricGauge label="High-value" value={metrics.highDensityPct} maxVal={1}
          format={`${(metrics.highDensityPct * 100).toFixed(0)}%`}
          accent={metrics.highDensityPct > 0.4 ? "#3a9e6e" : metrics.highDensityPct > 0.2 ? "#b08840" : "#e87c7c"} />
        <MetricGauge label="Resolved" value={metrics.resolutionPct} maxVal={1}
          format={`${metrics.resolvedDimensions}/${metrics.totalDimensions}`}
          accent={metrics.resolutionPct > 0.6 ? "#3a9e6e" : metrics.resolutionPct > 0.3 ? "#b08840" : "#e87c7c"} />
      </div>

      {/* Histogram + Ambiguity side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "20px", alignItems: "start" }}>
        <DensityHistogram tokens={prompt.tokens} />
        <AmbiguityPanel ambiguities={prompt.ambiguities} />
      </div>
    </div>
  );
}

// ============================================================
//  COMPARISON SUMMARY
// ============================================================
function ComparisonBar({ prompts }) {
  const allMetrics = prompts.map(p => computeMetrics(p));
  const labels = prompts.map(p => p.label);
  const rows = [
    { label: "Avg Token Density", values: allMetrics.map(m => m.avgDensity), format: v => `${(v * 100).toFixed(0)}%`, goodHigh: true },
    { label: "Filler Ratio", values: allMetrics.map(m => m.fillerPct), format: v => `${(v * 100).toFixed(0)}%`, goodHigh: false },
    { label: "High-Value Tokens", values: allMetrics.map(m => m.highDensityPct), format: v => `${(v * 100).toFixed(0)}%`, goodHigh: true },
    { label: "Dimensions Resolved", values: allMetrics.map(m => m.resolutionPct), format: v => `${(v * 100).toFixed(0)}%`, goodHigh: true },
    { label: "Info Yield", values: allMetrics.map(m => m.informationYield), format: v => (v * 100).toFixed(1), goodHigh: true },
  ];

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "10px", padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: "11px", color: "#e8927c", fontFamily: FM, textTransform: "uppercase", letterSpacing: "2px", marginBottom: "16px" }}>
        Cross-Prompt Comparison
      </div>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "140px repeat(3, 1fr)", gap: "8px", marginBottom: "8px" }}>
        <div />
        {labels.map((l, i) => (
          <div key={i} style={{ fontSize: "11px", fontFamily: FM, color: "#8899aa", textAlign: "center", fontWeight: 600 }}>{l}</div>
        ))}
      </div>
      {/* Rows */}
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: "grid", gridTemplateColumns: "140px repeat(3, 1fr)", gap: "8px",
          padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ fontSize: "11px", fontFamily: FM, color: "#778899" }}>{row.label}</div>
          {row.values.map((v, vi) => {
            const best = row.goodHigh ? Math.max(...row.values) : Math.min(...row.values);
            const isBest = v === best;
            return (
              <div key={vi} style={{ textAlign: "center" }}>
                <span style={{
                  fontSize: "14px", fontWeight: isBest ? 700 : 400, fontFamily: FM,
                  color: isBest ? "#7ccea0" : "#8899aa",
                }}>{row.format(v)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  MAIN
// ============================================================
export default function ContextDensity() {
  const [activePrompt, setActivePrompt] = useState(0);

  return (
    <div style={{ background: "#0e1117", minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "11px", color: "#e8927c", fontFamily: FM, textTransform: "uppercase", letterSpacing: "3px", marginBottom: "8px" }}>Interactive Visualization</div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8c4b8", margin: "0 0 6px" }}>Context Density</h1>
          <p style={{ fontSize: "14px", color: "#8899aa", margin: 0, maxWidth: "750px", lineHeight: 1.6 }}>
            The same task described three ways — from vague request to dense specification.
            Every token is scored by how much task-relevant information it carries. Click any word
            to see what it resolves and what it leaves ambiguous.
          </p>
        </div>

        {/* Explainer */}
        <div style={{
          background: "rgba(232,146,124,0.06)", border: "1px solid rgba(232,146,124,0.15)",
          borderRadius: "8px", padding: "16px 20px", marginBottom: "24px",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#e8927c", fontFamily: FM, marginBottom: "6px" }}>
            Why Density Matters for Attention
          </div>
          <div style={{ fontSize: "13px", color: "#bfc8d0", lineHeight: 1.7 }}>
            Every token in the context competes for attention weight via softmax. Filler words
            like "me," "a," and "that" produce nonzero Q·K dot products, inflating the softmax
            denominator and diluting the probability mass available for meaningful tokens.
            A dense spec packs more <em>resolvable constraints</em> per token, keeping the
            attention matrix concentrated on information that actually shapes the output.
            The goal isn't fewer words — it's fewer words <em>per decision resolved</em>.
          </div>
        </div>

        {/* Category legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
          {Object.entries(CAT).map(([key, meta]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: meta.color }} />
              <span style={{ fontSize: "10px", fontFamily: FM, color: "#8899aa" }}>{meta.label}</span>
            </div>
          ))}
        </div>

        {/* Prompt selector tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
          {PROMPTS.map((p, i) => (
            <button key={p.id} onClick={() => setActivePrompt(i)} style={{
              flex: 1, padding: "14px 16px", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s",
              background: activePrompt === i ? "rgba(232,146,124,0.1)" : "rgba(255,255,255,0.02)",
              border: activePrompt === i ? "1px solid rgba(232,146,124,0.3)" : "1px solid rgba(255,255,255,0.06)",
              textAlign: "left",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: FM, color: activePrompt === i ? "#e8927c" : "#667788" }}>{p.label}</div>
              <div style={{ fontSize: "10px", color: "#556677", fontFamily: FM, marginTop: "2px" }}>{p.subtitle}</div>
              <div style={{
                fontSize: "11px", color: "#556677", fontFamily: FM, marginTop: "8px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{p.text.slice(0, 60)}...</div>
            </button>
          ))}
        </div>

        {/* Active prompt panel */}
        <PromptPanel prompt={PROMPTS[activePrompt]} isActive={true} />

        {/* Full prompt text */}
        <div style={{
          marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)",
          borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: "10px", color: "#667788", fontFamily: FM, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Full Prompt Text</div>
          <div style={{ fontSize: "14px", color: "#b0b8c0", fontFamily: FM, lineHeight: 1.8, wordBreak: "break-word" }}>
            {PROMPTS[activePrompt].text}
          </div>
        </div>

        {/* Comparison table */}
        <div style={{ marginTop: "32px" }}>
          <ComparisonBar prompts={PROMPTS} />
        </div>

        {/* Bottom insight */}
        <div style={{
          marginTop: "32px", padding: "24px",
          background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ fontSize: "11px", color: "#e8927c", fontFamily: FM, textTransform: "uppercase", letterSpacing: "2px", marginBottom: "12px" }}>
            The Density Principle
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px", fontSize: "13px", color: "#99aabb", lineHeight: 1.7,
          }}>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Filler inflates the denominator.</strong>{" "}
              Words like "Build me a website that" consume 5 tokens to convey what "e-commerce SPA"
              conveys in 2. Both produce Q/K vectors, both enter the softmax denominator, but only
              one set carries information that constrains the output. The filler tokens are the "noise words"
              from the dilution demo — they spread attention without contributing signal.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Specificity sharpens attention peaks.</strong>{" "}
              "Stripe" has a narrow, distinctive embedding that produces high dot-product scores with
              payment-related tokens and low scores with everything else. "Sells" has a broad embedding
              that matches shopping, marketing, real estate, and more. Specific tokens create taller,
              sharper peaks in the attention distribution; vague tokens create broad, flat humps.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Constraints are testable tokens.</strong>{" "}
              "LCP &lt;2s" resolves a dimension to a pass/fail threshold. "Fast load times" leaves the
              same dimension as an open question the model must guess at. Every unresolved dimension
              is a degree of freedom where the model's output may diverge from your intent — and
              each resolution costs roughly one high-density token versus many vague ones.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
