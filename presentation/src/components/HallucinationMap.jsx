import { useState, useMemo } from "react";

// ============================================================
//  DESIGN TOKENS
// ============================================================
const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";
const GREEN = "#7ccea0";
const RED = "#e87c7c";
const GOLD = "#e8c47c";
const BLUE = "#7ca8e8";
const PURPLE = "#c87ce8";
const ACCENT = "#e8927c";
const GRAY = "#8899aa";
const BG = "#0e1117";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.06)";

// ============================================================
//  GROUNDING STATUS
// ============================================================
const STATUS = {
  grounded:    { label: "Grounded",     color: GREEN,  desc: "Directly constrained by the prompt — the model had no choice" },
  inferred:    { label: "Inferred",     color: BLUE,   desc: "Logically follows from grounded tokens — low hallucination risk" },
  defaulted:   { label: "Defaulted",    color: GOLD,   desc: "Model chose from training frequency — plausible but ungrounded" },
  confabulated:{ label: "Confabulated", color: RED,    desc: "Invented to fill a gap — no prompt basis, high hallucination risk" },
  structural:  { label: "Structural",   color: "#555e6e", desc: "Syntax/formatting — no semantic content at risk" },
};

// ============================================================
//  GENERATION TRACES
//  Each token in the output has: word, status, confidence,
//  topCandidates (what the logit distribution looked like),
//  groundedBy (which prompt token constrained it, if any),
//  note (explanation)
// ============================================================
const TRACES = {
  vague: {
    prompt: "Build me a website that sells shoes to middle-aged women",
    output: [
      { word: "I'll", status: "structural", confidence: 0.85, groundedBy: null, note: "Standard assistant preamble — always generated regardless of prompt.",
        topK: [{ t: "I'll", p: 0.42 },{ t: "Sure", p: 0.25 },{ t: "Here", p: 0.15 },{ t: "Let", p: 0.10 },{ t: "Great", p: 0.08 }] },
      { word: "create", status: "inferred", confidence: 0.72, groundedBy: "Build", note: "'Build' in the prompt implies creation, but 'create' vs 'set up' vs 'design' is a soft inference.",
        topK: [{ t: "create", p: 0.35 },{ t: "build", p: 0.30 },{ t: "set", p: 0.18 },{ t: "design", p: 0.12 },{ t: "make", p: 0.05 }] },
      { word: "a", status: "structural", confidence: 0.95, groundedBy: null, note: "Grammatical article.",
        topK: [{ t: "a", p: 0.92 },{ t: "an", p: 0.05 },{ t: "the", p: 0.03 }] },
      { word: "Shopify", status: "confabulated", confidence: 0.18, groundedBy: null, note: "No framework specified in prompt. Model defaults to Shopify because it's the most common 'website that sells' pattern in training data. This could equally have been WordPress, React, or Wix.",
        topK: [{ t: "Shopify", p: 0.18 },{ t: "WordPress", p: 0.16 },{ t: "React", p: 0.14 },{ t: "modern", p: 0.12 },{ t: "custom", p: 0.10 },{ t: "beautiful", p: 0.08 },{ t: "Wix", p: 0.07 },{ t: "responsive", p: 0.06 },{ t: "Next", p: 0.05 },{ t: "clean", p: 0.04 }] },
      { word: "-based", status: "confabulated", confidence: 0.65, groundedBy: null, note: "Follows from the confabulated 'Shopify' — cascading invention.",
        topK: [{ t: "-based", p: 0.55 },{ t: "store", p: 0.25 },{ t: "e-commerce", p: 0.12 },{ t: "site", p: 0.08 }] },
      { word: "e-commerce", status: "inferred", confidence: 0.78, groundedBy: "sells", note: "'Sells' implies e-commerce, though the prompt never used this term.",
        topK: [{ t: "e-commerce", p: 0.60 },{ t: "online", p: 0.22 },{ t: "shopping", p: 0.10 },{ t: "retail", p: 0.08 }] },
      { word: "store", status: "inferred", confidence: 0.82, groundedBy: "sells", note: "Natural completion of 'e-commerce'.",
        topK: [{ t: "store", p: 0.70 },{ t: "site", p: 0.15 },{ t: "platform", p: 0.10 },{ t: "shop", p: 0.05 }] },
      { word: "for", status: "structural", confidence: 0.90, groundedBy: null, note: "Preposition.",
        topK: [{ t: "for", p: 0.85 },{ t: "to", p: 0.08 },{ t: "targeting", p: 0.07 }] },
      { word: "women's", status: "grounded", confidence: 0.75, groundedBy: "women", note: "Directly from prompt. One of the few grounded output tokens.",
        topK: [{ t: "women's", p: 0.62 },{ t: "selling", p: 0.15 },{ t: "middle", p: 0.12 },{ t: "your", p: 0.06 },{ t: "female", p: 0.05 }] },
      { word: "shoes", status: "grounded", confidence: 0.88, groundedBy: "shoes", note: "Directly from prompt.",
        topK: [{ t: "shoes", p: 0.78 },{ t: "footwear", p: 0.12 },{ t: "shoe", p: 0.08 },{ t: "fashion", p: 0.02 }] },
      { word: "with", status: "structural", confidence: 0.70, groundedBy: null, note: "Transition word.",
        topK: [{ t: "with", p: 0.40 },{ t: ".", p: 0.25 },{ t: "featuring", p: 0.18 },{ t: ",", p: 0.10 },{ t: "that", p: 0.07 }] },
      { word: "a", status: "structural", confidence: 0.88, groundedBy: null, note: "Article.",
        topK: [{ t: "a", p: 0.82 },{ t: "an", p: 0.10 },{ t: "the", p: 0.08 }] },
      { word: "clean,", status: "confabulated", confidence: 0.15, groundedBy: null, note: "No design direction in prompt. 'Clean' is the model's default aesthetic — the most generic design adjective in web dev training data.",
        topK: [{ t: "clean", p: 0.15 },{ t: "modern", p: 0.14 },{ t: "sleek", p: 0.12 },{ t: "professional", p: 0.11 },{ t: "elegant", p: 0.10 },{ t: "beautiful", p: 0.09 },{ t: "minimalist", p: 0.08 },{ t: "simple", p: 0.07 },{ t: "warm", p: 0.06 },{ t: "responsive", p: 0.05 },{ t: "bold", p: 0.03 }] },
      { word: "modern", status: "confabulated", confidence: 0.22, groundedBy: null, note: "Another design hallucination. The prompt said nothing about style. 'Modern' is the second most common design adjective after 'clean'.",
        topK: [{ t: "modern", p: 0.22 },{ t: "elegant", p: 0.18 },{ t: "minimalist", p: 0.16 },{ t: "professional", p: 0.14 },{ t: "user-friendly", p: 0.12 },{ t: "responsive", p: 0.10 },{ t: "intuitive", p: 0.08 }] },
      { word: "design", status: "defaulted", confidence: 0.60, groundedBy: null, note: "Completes the confabulated design description.",
        topK: [{ t: "design", p: 0.55 },{ t: "look", p: 0.20 },{ t: "aesthetic", p: 0.15 },{ t: "layout", p: 0.10 }] },
      { word: "targeting", status: "inferred", confidence: 0.55, groundedBy: "middle-aged women", note: "Reasonable inference from demographic info in prompt.",
        topK: [{ t: "targeting", p: 0.40 },{ t: "for", p: 0.25 },{ t: "aimed", p: 0.18 },{ t: "focused", p: 0.10 },{ t: "geared", p: 0.07 }] },
      { word: "women", status: "grounded", confidence: 0.80, groundedBy: "women", note: "From prompt.",
        topK: [{ t: "women", p: 0.72 },{ t: "the", p: 0.12 },{ t: "middle", p: 0.10 },{ t: "your", p: 0.06 }] },
      { word: "aged", status: "grounded", confidence: 0.85, groundedBy: "middle-aged", note: "From prompt.",
        topK: [{ t: "aged", p: 0.78 },{ t: "in", p: 0.12 },{ t: "between", p: 0.06 },{ t: "over", p: 0.04 }] },
      { word: "35-55.", status: "confabulated", confidence: 0.20, groundedBy: null, note: "'Middle-aged' is vague. The model invented a specific range. Could equally have been 40-60, 35-50, or 45-65. This number will shape UX decisions downstream.",
        topK: [{ t: "35-55", p: 0.20 },{ t: "40-60", p: 0.18 },{ t: "35-50", p: 0.15 },{ t: "40-55", p: 0.14 },{ t: "45-60", p: 0.12 },{ t: "30-55", p: 0.08 },{ t: "45-65", p: 0.06 },{ t: ".", p: 0.04 },{ t: "35-65", p: 0.03 }] },
      { word: "I'll", status: "structural", confidence: 0.80, groundedBy: null, note: "Transition.",
        topK: [{ t: "I'll", p: 0.55 },{ t: "The", p: 0.20 },{ t: "Here's", p: 0.15 },{ t: "Let", p: 0.10 }] },
      { word: "include", status: "structural", confidence: 0.70, groundedBy: null, note: "Transition.",
        topK: [{ t: "include", p: 0.50 },{ t: "add", p: 0.25 },{ t: "use", p: 0.15 },{ t: "implement", p: 0.10 }] },
      { word: "product", status: "defaulted", confidence: 0.55, groundedBy: "sells shoes", note: "Reasonable for e-commerce but specifics are ungrounded.",
        topK: [{ t: "product", p: 0.40 },{ t: "a", p: 0.20 },{ t: "shopping", p: 0.15 },{ t: "search", p: 0.12 },{ t: "user", p: 0.08 },{ t: "filter", p: 0.05 }] },
      { word: "filtering,", status: "confabulated", confidence: 0.25, groundedBy: null, note: "The prompt never mentioned filtering. The model is generating features it assumes an e-commerce site 'should' have based on training patterns.",
        topK: [{ t: "filtering", p: 0.25 },{ t: "pages", p: 0.20 },{ t: "listings", p: 0.18 },{ t: "cards", p: 0.15 },{ t: "categories", p: 0.12 },{ t: "grid", p: 0.10 }] },
      { word: "a", status: "structural", confidence: 0.85, groundedBy: null, note: "Article.",
        topK: [{ t: "a", p: 0.80 },{ t: "the", p: 0.12 },{ t: "an", p: 0.08 }] },
      { word: "shopping", status: "defaulted", confidence: 0.50, groundedBy: "sells", note: "Implied by 'sells' but the specific UX pattern is unspecified.",
        topK: [{ t: "shopping", p: 0.45 },{ t: "secure", p: 0.20 },{ t: "simple", p: 0.15 },{ t: "checkout", p: 0.12 },{ t: "payment", p: 0.08 }] },
      { word: "cart,", status: "defaulted", confidence: 0.70, groundedBy: "sells", note: "Standard e-commerce assumption.",
        topK: [{ t: "cart", p: 0.62 },{ t: "bag", p: 0.18 },{ t: "basket", p: 0.12 },{ t: "experience", p: 0.08 }] },
      { word: "and", status: "structural", confidence: 0.88, groundedBy: null, note: "Conjunction.",
        topK: [{ t: "and", p: 0.82 },{ t: ",", p: 0.10 },{ t: "with", p: 0.08 }] },
      { word: "secure", status: "confabulated", confidence: 0.30, groundedBy: null, note: "No security requirements in prompt. 'Secure' is a default adjective the model applies to any checkout mention.",
        topK: [{ t: "secure", p: 0.30 },{ t: "easy", p: 0.22 },{ t: "simple", p: 0.18 },{ t: "streamlined", p: 0.12 },{ t: "fast", p: 0.10 },{ t: "Stripe", p: 0.05 },{ t: "PayPal", p: 0.03 }] },
      { word: "checkout.", status: "defaulted", confidence: 0.75, groundedBy: "sells", note: "Implied by selling but implementation details are all unspecified.",
        topK: [{ t: "checkout", p: 0.68 },{ t: "payment", p: 0.18 },{ t: "purchasing", p: 0.08 },{ t: "transactions", p: 0.06 }] },
    ],
  },
  dense: {
    prompt: "React/Next.js 14 e-commerce SPA · women's comfort footwear · ages 40-60 · $80-200 · Stripe + Apple Pay · OAuth2 (Google/email) · PostgreSQL + Prisma · mobile-first · WCAG-AA · LCP<2s · Tailwind · 48-product catalog · size/width/color variants",
    output: [
      { word: "I'll", status: "structural", confidence: 0.82, groundedBy: null, note: "Standard preamble.",
        topK: [{ t: "I'll", p: 0.50 },{ t: "Here", p: 0.25 },{ t: "Let", p: 0.15 },{ t: "Setting", p: 0.10 }] },
      { word: "build", status: "grounded", confidence: 0.88, groundedBy: "e-commerce SPA", note: "Action directly implied by the spec format.",
        topK: [{ t: "build", p: 0.72 },{ t: "create", p: 0.15 },{ t: "set", p: 0.08 },{ t: "implement", p: 0.05 }] },
      { word: "a", status: "structural", confidence: 0.92, groundedBy: null, note: "Article.",
        topK: [{ t: "a", p: 0.88 },{ t: "the", p: 0.08 },{ t: "this", p: 0.04 }] },
      { word: "Next.js", status: "grounded", confidence: 0.92, groundedBy: "React/Next.js 14", note: "Directly specified in prompt. No competing candidates — the constraint eliminates all alternatives.",
        topK: [{ t: "Next.js", p: 0.88 },{ t: "Next", p: 0.06 },{ t: "React", p: 0.04 },{ t: "next", p: 0.02 }] },
      { word: "14", status: "grounded", confidence: 0.95, groundedBy: "React/Next.js 14", note: "Version number directly from spec.",
        topK: [{ t: "14", p: 0.92 },{ t: "App", p: 0.04 },{ t: "application", p: 0.02 },{ t: "project", p: 0.02 }] },
      { word: "App", status: "inferred", confidence: 0.70, groundedBy: "SPA", note: "Next.js 14 uses the App Router — strong inference from framework + version.",
        topK: [{ t: "App", p: 0.62 },{ t: "app", p: 0.18 },{ t: "application", p: 0.12 },{ t: "SPA", p: 0.08 }] },
      { word: "Router", status: "inferred", confidence: 0.85, groundedBy: "SPA + Next.js 14", note: "App Router is the default for Next.js 14 — high-confidence inference.",
        topK: [{ t: "Router", p: 0.78 },{ t: "router", p: 0.12 },{ t: "Directory", p: 0.06 },{ t: "Pattern", p: 0.04 }] },
      { word: "e-commerce", status: "grounded", confidence: 0.90, groundedBy: "e-commerce", note: "Directly from spec.",
        topK: [{ t: "e-commerce", p: 0.85 },{ t: "ecommerce", p: 0.08 },{ t: "commerce", p: 0.04 },{ t: "store", p: 0.03 }] },
      { word: "application", status: "inferred", confidence: 0.68, groundedBy: "SPA", note: "SPA = single-page application.",
        topK: [{ t: "application", p: 0.55 },{ t: "app", p: 0.22 },{ t: "platform", p: 0.13 },{ t: "site", p: 0.10 }] },
      { word: "with", status: "structural", confidence: 0.85, groundedBy: null, note: "Transition.",
        topK: [{ t: "with", p: 0.75 },{ t: "using", p: 0.12 },{ t: "featuring", p: 0.08 },{ t: ".", p: 0.05 }] },
      { word: "Stripe", status: "grounded", confidence: 0.92, groundedBy: "Stripe + Apple Pay", note: "Directly specified. No ambiguity in payment processor.",
        topK: [{ t: "Stripe", p: 0.88 },{ t: "the", p: 0.05 },{ t: "integrated", p: 0.04 },{ t: "full", p: 0.03 }] },
      { word: "and", status: "structural", confidence: 0.90, groundedBy: null, note: "Conjunction.",
        topK: [{ t: "and", p: 0.82 },{ t: "/", p: 0.10 },{ t: "+", p: 0.05 },{ t: ",", p: 0.03 }] },
      { word: "Apple Pay", status: "grounded", confidence: 0.90, groundedBy: "Apple Pay", note: "Directly specified.",
        topK: [{ t: "Apple Pay", p: 0.85 },{ t: "Apple", p: 0.08 },{ t: "ApplePay", p: 0.04 },{ t: "mobile", p: 0.03 }] },
      { word: "integration,", status: "inferred", confidence: 0.72, groundedBy: "Stripe + Apple Pay", note: "Natural completion — payment processors require 'integration'.",
        topK: [{ t: "integration", p: 0.60 },{ t: "payments", p: 0.20 },{ t: "checkout", p: 0.12 },{ t: "support", p: 0.08 }] },
      { word: "Prisma", status: "grounded", confidence: 0.90, groundedBy: "PostgreSQL + Prisma", note: "ORM directly specified.",
        topK: [{ t: "Prisma", p: 0.85 },{ t: "a", p: 0.06 },{ t: "PostgreSQL", p: 0.05 },{ t: "the", p: 0.04 }] },
      { word: "ORM", status: "inferred", confidence: 0.80, groundedBy: "Prisma", note: "Prisma is an ORM — direct technical inference.",
        topK: [{ t: "ORM", p: 0.72 },{ t: "schema", p: 0.12 },{ t: "client", p: 0.10 },{ t: "models", p: 0.06 }] },
      { word: "with", status: "structural", confidence: 0.82, groundedBy: null, note: "Transition.",
        topK: [{ t: "with", p: 0.70 },{ t: "connected", p: 0.15 },{ t: "on", p: 0.10 },{ t: "for", p: 0.05 }] },
      { word: "PostgreSQL,", status: "grounded", confidence: 0.92, groundedBy: "PostgreSQL", note: "Database directly specified.",
        topK: [{ t: "PostgreSQL", p: 0.88 },{ t: "Postgres", p: 0.06 },{ t: "a", p: 0.04 },{ t: "the", p: 0.02 }] },
      { word: "Tailwind", status: "grounded", confidence: 0.88, groundedBy: "Tailwind", note: "CSS framework directly specified.",
        topK: [{ t: "Tailwind", p: 0.82 },{ t: "styled", p: 0.08 },{ t: "a", p: 0.06 },{ t: "responsive", p: 0.04 }] },
      { word: "CSS", status: "inferred", confidence: 0.88, groundedBy: "Tailwind", note: "Tailwind is a CSS framework — direct inference.",
        topK: [{ t: "CSS", p: 0.82 },{ t: "styling", p: 0.10 },{ t: "classes", p: 0.05 },{ t: "utilities", p: 0.03 }] },
      { word: "styling,", status: "inferred", confidence: 0.75, groundedBy: "Tailwind", note: "Natural completion.",
        topK: [{ t: "styling", p: 0.60 },{ t: ",", p: 0.20 },{ t: "for", p: 0.12 },{ t: "framework", p: 0.08 }] },
      { word: "NextAuth", status: "grounded", confidence: 0.85, groundedBy: "OAuth2 (Google/email)", note: "Auth library implied by Next.js + OAuth2 spec. Note: some specs explicitly name NextAuth.",
        topK: [{ t: "NextAuth", p: 0.72 },{ t: "OAuth", p: 0.12 },{ t: "next-auth", p: 0.10 },{ t: "Auth.js", p: 0.06 }] },
      { word: "for", status: "structural", confidence: 0.88, groundedBy: null, note: "Preposition.",
        topK: [{ t: "for", p: 0.80 },{ t: "with", p: 0.10 },{ t: "handling", p: 0.06 },{ t: "providing", p: 0.04 }] },
      { word: "OAuth2", status: "grounded", confidence: 0.92, groundedBy: "OAuth2", note: "Auth protocol directly from spec.",
        topK: [{ t: "OAuth2", p: 0.88 },{ t: "authentication", p: 0.06 },{ t: "OAuth", p: 0.04 },{ t: "Google", p: 0.02 }] },
      { word: "authentication,", status: "inferred", confidence: 0.82, groundedBy: "OAuth2", note: "OAuth2 is an authentication protocol.",
        topK: [{ t: "authentication", p: 0.75 },{ t: "auth", p: 0.12 },{ t: "login", p: 0.08 },{ t: "sign-in", p: 0.05 }] },
      { word: "and", status: "structural", confidence: 0.85, groundedBy: null, note: "Conjunction.",
        topK: [{ t: "and", p: 0.78 },{ t: "with", p: 0.12 },{ t: ",", p: 0.06 },{ t: "targeting", p: 0.04 }] },
      { word: "WCAG-AA", status: "grounded", confidence: 0.90, groundedBy: "WCAG-AA", note: "Accessibility standard directly from spec.",
        topK: [{ t: "WCAG", p: 0.85 },{ t: "accessibility", p: 0.08 },{ t: "a11y", p: 0.04 },{ t: "ADA", p: 0.03 }] },
      { word: "accessibility", status: "inferred", confidence: 0.88, groundedBy: "WCAG-AA", note: "WCAG is an accessibility standard.",
        topK: [{ t: "accessibility", p: 0.82 },{ t: "compliance", p: 0.10 },{ t: "standards", p: 0.05 },{ t: "conformance", p: 0.03 }] },
      { word: "targeting", status: "inferred", confidence: 0.65, groundedBy: "ages 40-60", note: "Reasonable bridge to demographic section.",
        topK: [{ t: "targeting", p: 0.45 },{ t: ".", p: 0.20 },{ t: "optimized", p: 0.18 },{ t: "with", p: 0.10 },{ t: "for", p: 0.07 }] },
      { word: "LCP", status: "grounded", confidence: 0.88, groundedBy: "LCP<2s", note: "Performance metric directly from spec.",
        topK: [{ t: "LCP", p: 0.80 },{ t: "a", p: 0.08 },{ t: "sub", p: 0.07 },{ t: "performance", p: 0.05 }] },
      { word: "under", status: "grounded", confidence: 0.85, groundedBy: "LCP<2s", note: "Threshold from spec.",
        topK: [{ t: "under", p: 0.75 },{ t: "<", p: 0.12 },{ t: "below", p: 0.08 },{ t: "within", p: 0.05 }] },
      { word: "2s.", status: "grounded", confidence: 0.92, groundedBy: "LCP<2s", note: "Exact threshold from spec.",
        topK: [{ t: "2s", p: 0.88 },{ t: "2", p: 0.06 },{ t: "two", p: 0.04 },{ t: "2000ms", p: 0.02 }] },
    ],
  },
};

// ============================================================
//  COMPUTED STATS
// ============================================================
function computeStats(trace) {
  const tokens = trace.output;
  const total = tokens.length;
  const counts = {};
  Object.keys(STATUS).forEach(k => { counts[k] = 0; });
  tokens.forEach(t => { counts[t.status]++; });
  const avgConf = tokens.reduce((s, t) => s + t.confidence, 0) / total;
  const groundedPct = (counts.grounded + counts.inferred) / total;
  const confabPct = counts.confabulated / total;
  const hallucinationSurface = tokens.filter(t => t.status === "confabulated" || t.status === "defaulted").length / total;
  return { total, counts, avgConf, groundedPct, confabPct, hallucinationSurface };
}

// ============================================================
//  COMPONENTS
// ============================================================
function TokenChip({ token, isSelected, onClick }) {
  const st = STATUS[token.status];
  return (
    <button onClick={onClick} style={{
      padding: "6px 10px", borderRadius: 4, cursor: "pointer", transition: "all 0.2s",
      background: isSelected ? `${st.color}25` : `${st.color}10`,
      border: isSelected ? `2px solid ${st.color}` : `2px solid ${st.color}22`,
      color: st.color, fontFamily: FM, fontSize: 13, fontWeight: isSelected ? 700 : 500,
      position: "relative",
    }}>
      {token.word}
      {/* Confidence indicator */}
      <div style={{
        position: "absolute", bottom: -1, left: 2, right: 2, height: 3,
        borderRadius: "0 0 2px 2px", overflow: "hidden",
        background: "rgba(0,0,0,0.3)",
      }}>
        <div style={{
          width: `${token.confidence * 100}%`, height: "100%",
          background: st.color, borderRadius: 2, transition: "width 0.3s",
        }} />
      </div>
    </button>
  );
}

function LogitPanel({ token }) {
  if (!token) return null;
  const st = STATUS[token.status];
  const maxP = Math.max(...token.topK.map(t => t.p));

  return (
    <div style={{
      background: `${st.color}08`, border: `1px solid ${st.color}25`,
      borderRadius: 8, padding: "16px 20px", marginTop: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontFamily: FM, fontWeight: 700, color: st.color }}>"{token.word}"</span>
        <span style={{
          fontSize: 9, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1,
          padding: "3px 8px", borderRadius: 3, background: `${st.color}20`, color: st.color,
        }}>{st.label}</span>
        <span style={{ fontSize: 12, fontFamily: FM, color: GRAY }}>
          confidence: {(token.confidence * 100).toFixed(0)}%
        </span>
        {token.groundedBy && (
          <span style={{ fontSize: 11, fontFamily: FM, color: GREEN }}>
            grounded by: "{token.groundedBy}"
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#99aabb", lineHeight: 1.6, marginBottom: 16 }}>{token.note}</div>

      {/* Logit distribution */}
      <div style={{ fontSize: 10, color: GRAY, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Output Logit Distribution at This Position
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
        {token.topK.map((c, i) => {
          const h = (c.p / maxP) * 80;
          const isWinner = i === 0;
          return (
            <div key={c.t} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 8, fontFamily: FM, color: isWinner ? "#e8c4b8" : "#556677", marginBottom: 2 }}>
                {(c.p * 100).toFixed(0)}%
              </div>
              <div style={{
                width: "100%", maxWidth: 32, height: Math.max(3, h), borderRadius: "3px 3px 0 0",
                background: isWinner ? st.color : `${st.color}44`,
                transition: "all 0.3s",
              }} />
              <div style={{
                fontSize: 8, fontFamily: FM, color: isWinner ? "#e8c4b8" : "#556677",
                marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: 50, textAlign: "center",
              }}>{c.t}</div>
            </div>
          );
        })}
      </div>
      {token.topK.length > 3 && token.topK[0].p - token.topK[1].p < 0.05 && (
        <div style={{ fontSize: 11, color: RED, fontFamily: FM, marginTop: 8, fontStyle: "italic" }}>
          Top candidates are within 5% — this is a coin-flip decision
        </div>
      )}
      {token.topK[0].p > 0.7 && (
        <div style={{ fontSize: 11, color: GREEN, fontFamily: FM, marginTop: 8, fontStyle: "italic" }}>
          Dominant candidate — the model is highly confident
        </div>
      )}
    </div>
  );
}

function StatsBar({ stats, label, accent }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 8, padding: "16px 20px", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 10, color: accent, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(STATUS).map(([key, st]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 16, borderRadius: 3, background: `${st.color}cc`, textAlign: "center", lineHeight: "16px", fontSize: 9, fontFamily: FM, color: "#000", fontWeight: 700 }}>
              {stats.counts[key]}
            </div>
            <span style={{ fontSize: 10, fontFamily: FM, color: st.color }}>{st.label}</span>
          </div>
        ))}
      </div>
      {/* Stacked bar */}
      <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        {Object.entries(STATUS).map(([key, st]) => {
          const pct = (stats.counts[key] / stats.total) * 100;
          if (pct === 0) return null;
          return (
            <div key={key} style={{
              width: `${pct}%`, background: `${st.color}aa`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontFamily: FM, color: "#000", fontWeight: 600,
              transition: "width 0.4s",
            }}>
              {pct > 8 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: "#556677", fontFamily: FM, textTransform: "uppercase" }}>Avg Confidence</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FM, color: stats.avgConf > 0.7 ? GREEN : stats.avgConf > 0.5 ? GOLD : RED }}>
            {(stats.avgConf * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#556677", fontFamily: FM, textTransform: "uppercase" }}>Hallucination Surface</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FM, color: stats.hallucinationSurface < 0.15 ? GREEN : stats.hallucinationSurface < 0.35 ? GOLD : RED }}>
            {(stats.hallucinationSurface * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#556677", fontFamily: FM, textTransform: "uppercase" }}>Grounded</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FM, color: stats.groundedPct > 0.6 ? GREEN : stats.groundedPct > 0.35 ? GOLD : RED }}>
            {(stats.groundedPct * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN
// ============================================================
export default function HallucinationMap() {
  const [mode, setMode] = useState("vague");
  const [selectedIdx, setSelectedIdx] = useState(null);

  const trace = TRACES[mode];
  const stats = useMemo(() => computeStats(trace), [trace]);
  const selectedToken = selectedIdx !== null ? trace.output[selectedIdx] : null;

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px 48px" }}>
        <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 3, marginBottom: 8 }}>
          Interactive Visualization
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#e8c4b8", margin: "0 0 6px" }}>
          Hallucination Map
        </h1>
        <p style={{ fontSize: 14, color: GRAY, margin: "0 0 24px", maxWidth: 720, lineHeight: 1.6 }}>
          Every token in the model's output is either grounded in your prompt or invented to fill a gap.
          Click any token to see the logit distribution that produced it and understand whether the model
          was executing your spec or gambling with its training priors.
        </p>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {Object.entries(STATUS).map(([key, st]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: st.color }} />
              <div>
                <span style={{ fontSize: 11, fontFamily: FM, color: st.color, fontWeight: 600 }}>{st.label}</span>
                <span style={{ fontSize: 10, fontFamily: FM, color: "#556677", marginLeft: 6 }}>{st.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {["vague", "dense"].map(m => (
            <button key={m} onClick={() => { setMode(m); setSelectedIdx(null); }} style={{
              padding: "10px 20px", fontSize: 13, fontFamily: FM, fontWeight: mode === m ? 700 : 400,
              background: mode === m ? `${ACCENT}15` : SURFACE, border: mode === m ? `1px solid ${ACCENT}44` : `1px solid ${BORDER}`,
              borderRadius: 6, color: mode === m ? ACCENT : GRAY, cursor: "pointer", transition: "all 0.2s",
            }}>
              {m === "vague" ? "Vague Prompt" : "Dense Spec"}
            </button>
          ))}
        </div>

        {/* Input prompt */}
        <div style={{
          background: SURFACE, borderRadius: 8, padding: "12px 16px", marginBottom: 20,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 10, color: GRAY, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Input Prompt</div>
          <div style={{ fontSize: 13, fontFamily: FM, color: "#b0b8c0", lineHeight: 1.6, wordBreak: "break-word" }}>{trace.prompt}</div>
        </div>

        {/* Output generation trace */}
        <div style={{
          background: SURFACE, borderRadius: 8, padding: "16px 20px", marginBottom: 20,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 10, color: GRAY, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Generated Output — click any token to inspect
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {trace.output.map((tok, i) => (
              <TokenChip key={i} token={tok} isSelected={selectedIdx === i} onClick={() => setSelectedIdx(i)} />
            ))}
          </div>

          {/* Selected token detail */}
          <LogitPanel token={selectedToken} />
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <StatsBar stats={computeStats(TRACES.vague)} label="Vague Prompt" accent={RED} />
          <StatsBar stats={computeStats(TRACES.dense)} label="Dense Spec" accent={GREEN} />
        </div>

        {/* Insight */}
        <div style={{
          padding: 24, background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            Reading the Map
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, fontSize: 13, color: "#99aabb", lineHeight: 1.7,
          }}>
            <div>
              <strong style={{ color: GREEN }}>Green tokens are safe.</strong>{" "}
              They're either directly from your prompt or logically entailed by it. The logit distribution
              at these positions is sharply peaked — one token dominates at 70%+ and the model generates
              with high confidence. No hallucination risk.
            </div>
            <div>
              <strong style={{ color: RED }}>Red tokens are inventions.</strong>{" "}
              The model had to choose among many equally plausible options because the prompt left the
              dimension unspecified. Click any red token and you'll see a flat logit distribution where
              the top candidates are within a few percent of each other. A different sampling run would
              produce a different "choice."
            </div>
            <div>
              <strong style={{ color: GOLD }}>Gold tokens are defaults.</strong>{" "}
              Not directly constrained but following a common pattern the model learned in training.
              They're plausible and often correct, but ungrounded — the model picked the most popular
              option rather than the right one. These are the subtlest hallucinations because they
              sound authoritative.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
