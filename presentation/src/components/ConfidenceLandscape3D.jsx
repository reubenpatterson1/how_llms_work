import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ============================================================
//  DESIGN
// ============================================================
const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";
const GREEN = "#7ccea0";
const RED = "#e87c7c";
const GOLD = "#e8c47c";
const BLUE = "#7ca8e8";
const DGRAY = "#555e6e";
const ACCENT = "#e8927c";
const GRAY = "#8899aa";

const STATUS_META = {
  grounded:     { color: GREEN,  label: "Grounded",     order: 0 },
  inferred:     { color: BLUE,   label: "Inferred",     order: 1 },
  defaulted:    { color: GOLD,   label: "Defaulted",    order: 2 },
  confabulated: { color: RED,    label: "Confabulated", order: 3 },
  structural:   { color: DGRAY,  label: "Structural",   order: 4 },
};

// ============================================================
//  GENERATION DATA — same shoe store task, two prompts
//  Each token: word, status, confidence, topK candidates
// ============================================================
const VAGUE_TOKENS = [
  { word: "I'll", status: "structural", confidence: 0.85,
    topK: [{ t: "I'll", p: 0.42 },{ t: "Sure", p: 0.25 },{ t: "Here", p: 0.15 },{ t: "Let", p: 0.10 },{ t: "Great", p: 0.08 }] },
  { word: "create", status: "inferred", confidence: 0.72,
    topK: [{ t: "create", p: 0.35 },{ t: "build", p: 0.30 },{ t: "set", p: 0.18 },{ t: "design", p: 0.12 },{ t: "make", p: 0.05 }] },
  { word: "a", status: "structural", confidence: 0.95,
    topK: [{ t: "a", p: 0.92 },{ t: "an", p: 0.05 },{ t: "the", p: 0.03 }] },
  { word: "Shopify", status: "confabulated", confidence: 0.18,
    topK: [{ t: "Shopify", p: 0.18 },{ t: "WordPress", p: 0.16 },{ t: "React", p: 0.14 },{ t: "modern", p: 0.12 },{ t: "custom", p: 0.10 },{ t: "Wix", p: 0.07 },{ t: "Next", p: 0.05 },{ t: "clean", p: 0.04 }] },
  { word: "e-commerce", status: "inferred", confidence: 0.78,
    topK: [{ t: "e-commerce", p: 0.60 },{ t: "online", p: 0.22 },{ t: "shopping", p: 0.10 },{ t: "retail", p: 0.08 }] },
  { word: "store", status: "inferred", confidence: 0.82,
    topK: [{ t: "store", p: 0.70 },{ t: "site", p: 0.15 },{ t: "platform", p: 0.10 },{ t: "shop", p: 0.05 }] },
  { word: "for", status: "structural", confidence: 0.90,
    topK: [{ t: "for", p: 0.85 },{ t: "to", p: 0.08 },{ t: "targeting", p: 0.07 }] },
  { word: "women's", status: "grounded", confidence: 0.75,
    topK: [{ t: "women's", p: 0.62 },{ t: "selling", p: 0.15 },{ t: "middle", p: 0.12 },{ t: "your", p: 0.06 },{ t: "female", p: 0.05 }] },
  { word: "shoes", status: "grounded", confidence: 0.88,
    topK: [{ t: "shoes", p: 0.78 },{ t: "footwear", p: 0.12 },{ t: "shoe", p: 0.08 },{ t: "fashion", p: 0.02 }] },
  { word: "with", status: "structural", confidence: 0.70,
    topK: [{ t: "with", p: 0.40 },{ t: ".", p: 0.25 },{ t: "featuring", p: 0.18 },{ t: ",", p: 0.10 },{ t: "that", p: 0.07 }] },
  { word: "clean,", status: "confabulated", confidence: 0.15,
    topK: [{ t: "clean", p: 0.15 },{ t: "modern", p: 0.14 },{ t: "sleek", p: 0.12 },{ t: "professional", p: 0.11 },{ t: "elegant", p: 0.10 },{ t: "beautiful", p: 0.09 },{ t: "minimalist", p: 0.08 },{ t: "simple", p: 0.07 }] },
  { word: "modern", status: "confabulated", confidence: 0.22,
    topK: [{ t: "modern", p: 0.22 },{ t: "elegant", p: 0.18 },{ t: "minimalist", p: 0.16 },{ t: "professional", p: 0.14 },{ t: "user-friendly", p: 0.12 },{ t: "responsive", p: 0.10 },{ t: "intuitive", p: 0.08 }] },
  { word: "design", status: "defaulted", confidence: 0.60,
    topK: [{ t: "design", p: 0.55 },{ t: "look", p: 0.20 },{ t: "aesthetic", p: 0.15 },{ t: "layout", p: 0.10 }] },
  { word: "targeting", status: "inferred", confidence: 0.55,
    topK: [{ t: "targeting", p: 0.40 },{ t: "for", p: 0.25 },{ t: "aimed", p: 0.18 },{ t: "focused", p: 0.10 },{ t: "geared", p: 0.07 }] },
  { word: "35-55.", status: "confabulated", confidence: 0.20,
    topK: [{ t: "35-55", p: 0.20 },{ t: "40-60", p: 0.18 },{ t: "35-50", p: 0.15 },{ t: "40-55", p: 0.14 },{ t: "45-60", p: 0.12 },{ t: "30-55", p: 0.08 },{ t: "45-65", p: 0.06 }] },
  { word: "filtering,", status: "confabulated", confidence: 0.25,
    topK: [{ t: "filtering", p: 0.25 },{ t: "pages", p: 0.20 },{ t: "listings", p: 0.18 },{ t: "cards", p: 0.15 },{ t: "categories", p: 0.12 },{ t: "grid", p: 0.10 }] },
  { word: "secure", status: "confabulated", confidence: 0.30,
    topK: [{ t: "secure", p: 0.30 },{ t: "easy", p: 0.22 },{ t: "simple", p: 0.18 },{ t: "streamlined", p: 0.12 },{ t: "fast", p: 0.10 },{ t: "Stripe", p: 0.05 }] },
  { word: "checkout.", status: "defaulted", confidence: 0.75,
    topK: [{ t: "checkout", p: 0.68 },{ t: "payment", p: 0.18 },{ t: "purchasing", p: 0.08 },{ t: "transactions", p: 0.06 }] },
];

const DENSE_TOKENS = [
  { word: "I'll", status: "structural", confidence: 0.82,
    topK: [{ t: "I'll", p: 0.50 },{ t: "Here", p: 0.25 },{ t: "Let", p: 0.15 },{ t: "Setting", p: 0.10 }] },
  { word: "build", status: "grounded", confidence: 0.88,
    topK: [{ t: "build", p: 0.72 },{ t: "create", p: 0.15 },{ t: "set", p: 0.08 },{ t: "implement", p: 0.05 }] },
  { word: "a", status: "structural", confidence: 0.92,
    topK: [{ t: "a", p: 0.88 },{ t: "the", p: 0.08 },{ t: "this", p: 0.04 }] },
  { word: "Next.js", status: "grounded", confidence: 0.92,
    topK: [{ t: "Next.js", p: 0.88 },{ t: "Next", p: 0.06 },{ t: "React", p: 0.04 },{ t: "next", p: 0.02 }] },
  { word: "14", status: "grounded", confidence: 0.95,
    topK: [{ t: "14", p: 0.92 },{ t: "App", p: 0.04 },{ t: "application", p: 0.02 },{ t: "project", p: 0.02 }] },
  { word: "App", status: "inferred", confidence: 0.70,
    topK: [{ t: "App", p: 0.62 },{ t: "app", p: 0.18 },{ t: "application", p: 0.12 },{ t: "SPA", p: 0.08 }] },
  { word: "Router", status: "inferred", confidence: 0.85,
    topK: [{ t: "Router", p: 0.78 },{ t: "router", p: 0.12 },{ t: "Directory", p: 0.06 },{ t: "Pattern", p: 0.04 }] },
  { word: "e-commerce", status: "grounded", confidence: 0.90,
    topK: [{ t: "e-commerce", p: 0.85 },{ t: "ecommerce", p: 0.08 },{ t: "commerce", p: 0.04 },{ t: "store", p: 0.03 }] },
  { word: "app", status: "inferred", confidence: 0.68,
    topK: [{ t: "app", p: 0.55 },{ t: "application", p: 0.22 },{ t: "platform", p: 0.13 },{ t: "site", p: 0.10 }] },
  { word: "with", status: "structural", confidence: 0.85,
    topK: [{ t: "with", p: 0.75 },{ t: "using", p: 0.12 },{ t: "featuring", p: 0.08 },{ t: ".", p: 0.05 }] },
  { word: "Stripe", status: "grounded", confidence: 0.92,
    topK: [{ t: "Stripe", p: 0.88 },{ t: "the", p: 0.05 },{ t: "integrated", p: 0.04 },{ t: "full", p: 0.03 }] },
  { word: "+Apple Pay", status: "grounded", confidence: 0.90,
    topK: [{ t: "Apple Pay", p: 0.85 },{ t: "Apple", p: 0.08 },{ t: "ApplePay", p: 0.04 },{ t: "mobile", p: 0.03 }] },
  { word: "Prisma", status: "grounded", confidence: 0.90,
    topK: [{ t: "Prisma", p: 0.85 },{ t: "a", p: 0.06 },{ t: "PostgreSQL", p: 0.05 },{ t: "the", p: 0.04 }] },
  { word: "ORM,", status: "inferred", confidence: 0.80,
    topK: [{ t: "ORM", p: 0.72 },{ t: "schema", p: 0.12 },{ t: "client", p: 0.10 },{ t: "models", p: 0.06 }] },
  { word: "PostgreSQL,", status: "grounded", confidence: 0.92,
    topK: [{ t: "PostgreSQL", p: 0.88 },{ t: "Postgres", p: 0.06 },{ t: "a", p: 0.04 },{ t: "the", p: 0.02 }] },
  { word: "Tailwind", status: "grounded", confidence: 0.88,
    topK: [{ t: "Tailwind", p: 0.82 },{ t: "styled", p: 0.08 },{ t: "a", p: 0.06 },{ t: "responsive", p: 0.04 }] },
  { word: "WCAG-AA", status: "grounded", confidence: 0.90,
    topK: [{ t: "WCAG", p: 0.85 },{ t: "accessibility", p: 0.08 },{ t: "a11y", p: 0.04 },{ t: "ADA", p: 0.03 }] },
  { word: "LCP<2s.", status: "grounded", confidence: 0.92,
    topK: [{ t: "LCP", p: 0.80 },{ t: "sub", p: 0.08 },{ t: "a", p: 0.07 },{ t: "performance", p: 0.05 }] },
];

// ============================================================
//  SORTING MODES
// ============================================================
const SORT_MODES = {
  sequence:   { label: "Output Sequence",   desc: "Original generation order" },
  confidence: { label: "By Confidence",     desc: "Low confidence (risky) on left" },
  status:     { label: "By Grounding",      desc: "Confabulated to grounded, left to right" },
  entropy:    { label: "By Entropy",        desc: "Highest entropy (flattest distribution) on left" },
};

function tokenEntropy(topK) {
  return -topK.reduce((s, c) => s + (c.p > 1e-10 ? c.p * Math.log2(c.p) : 0), 0);
}

function sortTokens(tokens, mode) {
  const arr = tokens.map((t, i) => ({ ...t, origIdx: i }));
  switch (mode) {
    case "confidence": return arr.sort((a, b) => a.confidence - b.confidence);
    case "status": return arr.sort((a, b) => (STATUS_META[b.status]?.order ?? 0) - (STATUS_META[a.status]?.order ?? 0));
    case "entropy": return arr.sort((a, b) => tokenEntropy(b.topK) - tokenEntropy(a.topK));
    default: return arr;
  }
}

// ============================================================
//  BUILD 3D SCENE
// ============================================================
function buildScene(container, tokens, highlightIdx) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1117);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x445566, 0.7));
  const d1 = new THREE.DirectionalLight(0xffeedd, 0.8);
  d1.position.set(10, 15, 10);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x8899bb, 0.35);
  d2.position.set(-8, 10, -5);
  scene.add(d2);

  const nTokens = tokens.length;
  const maxK = Math.max(...tokens.map(t => t.topK.length));
  const barW = 0.4;
  const gapX = 1.4;
  const gapZ = 0.8;
  const totalX = (nTokens - 1) * gapX;
  const totalZ = (maxK - 1) * gapZ;

  tokens.forEach((tok, ti) => {
    const stColor = new THREE.Color(STATUS_META[tok.status]?.color || "#555");
    const isHighlight = ti === highlightIdx;

    tok.topK.forEach((cand, ki) => {
      const h = Math.max(0.03, cand.p * 12);
      const isWinner = ki === 0;
      const geo = new THREE.BoxGeometry(barW, h, barW);

      // Runner-ups: tint with the status color, scaled by their probability
      // Higher-probability runners are brighter and more saturated
      let barColor;
      let emissive;
      let opacity;
      if (isWinner) {
        barColor = stColor.clone();
        emissive = barColor.clone().multiplyScalar(isHighlight ? 0.5 : 0.25);
        opacity = isHighlight ? 1.0 : 0.85;
      } else {
        // Blend from a warm base toward the status color based on probability
        const strength = Math.min(1, cand.p * 5); // 0.2 prob = full strength
        const base = new THREE.Color("#3a4560");
        barColor = base.clone().lerp(stColor.clone(), strength * 0.6);
        emissive = stColor.clone().multiplyScalar(strength * 0.2);
        opacity = Math.max(0.25, 0.25 + strength * 0.65);
      }

      const mat = new THREE.MeshPhongMaterial({
        color: barColor,
        emissive: emissive,
        transparent: true,
        opacity: opacity,
        shininess: isWinner ? 80 : 30 + cand.p * 50,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        ti * gapX - totalX / 2,
        h / 2,
        ki * gapZ - totalZ / 2
      );
      scene.add(mesh);
    });

    // Confidence ring on the floor under each token
    const ringGeo = new THREE.RingGeometry(0.3, 0.42, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: stColor,
      transparent: true,
      opacity: isHighlight ? 0.6 : 0.2,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(ti * gapX - totalX / 2, 0.01, -totalZ / 2 - 1);
    scene.add(ring);
  });

  // Floor
  const floorGeo = new THREE.PlaneGeometry(totalX + 4, totalZ + 4);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x0a0e15, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  // Token labels
  function makeSprite(text, x, y, z, color, size) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = `bold ${size || 18}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 }));
    sp.position.set(x, y, z);
    sp.scale.set(2.8, 0.7, 1);
    scene.add(sp);
  }

  tokens.forEach((tok, i) => {
    const stC = STATUS_META[tok.status]?.color || "#888";
    makeSprite(tok.word, i * gapX - totalX / 2, -0.6, totalZ / 2 + 1.2, stC, 15);
  });

  // Axis labels
  makeSprite("Winner", -totalX / 2 - 2.0, 0.3, -totalZ / 2, "#667788", 12);
  makeSprite("Runners-up", -totalX / 2 - 2.0, 0.3, totalZ / 2 - 0.5, "#445566", 12);

  return { scene, camera, renderer };
}

// ============================================================
//  MAIN COMPONENT
// ============================================================
export default function ConfidenceLandscape3D() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const autoRotateRef = useRef(true);
  const mouseRef = useRef({ down: false, x: 0, y: 0, theta: 0.6, phi: 0.45, dist: 22 });
  const [prompt, setPrompt] = useState("vague");
  const [sortMode, setSortMode] = useState("sequence");
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const rawTokens = prompt === "vague" ? VAGUE_TOKENS : DENSE_TOKENS;
  const tokens = sortTokens(rawTokens, sortMode);

  const rebuild = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (sceneRef.current) {
      sceneRef.current.renderer.dispose();
      while (c.firstChild) c.removeChild(c.firstChild);
    }
    const s = buildScene(c, tokens, selectedIdx);
    sceneRef.current = s;

    const updateCam = () => {
      const m = mouseRef.current;
      const x = m.dist * Math.sin(m.theta) * Math.cos(m.phi);
      const y = m.dist * Math.sin(m.phi);
      const z = m.dist * Math.cos(m.theta) * Math.cos(m.phi);
      s.camera.position.set(x, Math.max(1.5, y), z);
      s.camera.lookAt(0, 1.5, 0);
    };
    updateCam();

    let fid;
    const animate = () => {
      fid = requestAnimationFrame(animate);
      if (autoRotateRef.current && !mouseRef.current.down) {
        mouseRef.current.theta += 0.003;
        updateCam();
      }
      s.renderer.render(s.scene, s.camera);
    };
    animate();
    return () => cancelAnimationFrame(fid);
  }, [tokens, selectedIdx]);

  useEffect(() => {
    const cleanup = rebuild();
    return () => { if (cleanup) cleanup(); };
  }, [rebuild]);

  // Mouse controls
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onDown = (e) => {
      mouseRef.current.down = true;
      mouseRef.current.x = e.clientX || e.touches?.[0]?.clientX || 0;
      mouseRef.current.y = e.clientY || e.touches?.[0]?.clientY || 0;
    };
    const onUp = () => { mouseRef.current.down = false; };
    const onMove = (e) => {
      if (!mouseRef.current.down) return;
      const cx = e.clientX || e.touches?.[0]?.clientX || 0;
      const cy = e.clientY || e.touches?.[0]?.clientY || 0;
      mouseRef.current.theta -= (cx - mouseRef.current.x) * 0.008;
      mouseRef.current.phi = Math.max(0.08, Math.min(1.4, mouseRef.current.phi + (cy - mouseRef.current.y) * 0.008));
      mouseRef.current.x = cx; mouseRef.current.y = cy;
      if (sceneRef.current) {
        const m = mouseRef.current;
        sceneRef.current.camera.position.set(
          m.dist * Math.sin(m.theta) * Math.cos(m.phi),
          Math.max(1.5, m.dist * Math.sin(m.phi)),
          m.dist * Math.cos(m.theta) * Math.cos(m.phi)
        );
        sceneRef.current.camera.lookAt(0, 1.5, 0);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      mouseRef.current.dist = Math.max(8, Math.min(40, mouseRef.current.dist + e.deltaY * 0.03));
      if (sceneRef.current) {
        const m = mouseRef.current;
        sceneRef.current.camera.position.set(
          m.dist * Math.sin(m.theta) * Math.cos(m.phi),
          Math.max(1.5, m.dist * Math.sin(m.phi)),
          m.dist * Math.cos(m.theta) * Math.cos(m.phi)
        );
        sceneRef.current.camera.lookAt(0, 1.5, 0);
      }
    };
    c.addEventListener("mousedown", onDown);
    c.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    c.addEventListener("mousemove", onMove);
    c.addEventListener("touchmove", onMove, { passive: true });
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      c.removeEventListener("mousedown", onDown);
      c.removeEventListener("touchstart", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      c.removeEventListener("mousemove", onMove);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Token detail for selected
  const selTok = selectedIdx !== null ? tokens[selectedIdx] : null;
  const selSt = selTok ? STATUS_META[selTok.status] : null;
  const selEntropy = selTok ? tokenEntropy(selTok.topK) : 0;

  return (
    <div style={{ background: "#0e1117", minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}>
          3D Interactive Visualization
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8c4b8", margin: "0 0 4px" }}>
          Confidence Landscape
        </h1>
        <p style={{ fontSize: 13, color: GRAY, margin: "0 0 20px", maxWidth: 720, lineHeight: 1.5 }}>
          Each column is one generated token. The front bar (colored) is the winning candidate; bars behind it are the runners-up.
          Tall front bar + tiny runners-up = high confidence, grounded output.
          Short front bar + tall runners-up = coin-flip, confabulated output.
          Sort by different axes to see the pattern emerge.
        </p>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          {["vague", "dense"].map(m => (
            <button key={m} onClick={() => { setPrompt(m); setSelectedIdx(null); }} style={{
              padding: "8px 16px", fontSize: 12, fontFamily: FM, fontWeight: prompt === m ? 700 : 400,
              background: prompt === m ? `${ACCENT}18` : "rgba(255,255,255,0.03)",
              border: prompt === m ? `1px solid ${ACCENT}44` : `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 4, color: prompt === m ? ACCENT : GRAY, cursor: "pointer",
            }}>{m === "vague" ? "Vague Prompt" : "Dense Spec"}</button>
          ))}
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          {Object.entries(SORT_MODES).map(([key, sm]) => (
            <button key={key} onClick={() => { setSortMode(key); setSelectedIdx(null); }} style={{
              padding: "6px 14px", fontSize: 11, fontFamily: FM, fontWeight: sortMode === key ? 700 : 400,
              background: sortMode === key ? `${BLUE}18` : "rgba(255,255,255,0.03)",
              border: sortMode === key ? `1px solid ${BLUE}44` : `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 4, color: sortMode === key ? BLUE : "#667788", cursor: "pointer",
            }}>{sm.label}</button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          {Object.entries(STATUS_META).map(([key, st]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: st.color }} />
              <span style={{ fontSize: 10, fontFamily: FM, color: st.color }}>{st.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "linear-gradient(135deg, #3a4560, #5a6a88)", border: "1px solid #5a6a88" }} />
            <span style={{ fontSize: 10, fontFamily: FM, color: "#8899aa" }}>Runner-up candidates (brighter = higher probability)</span>
          </div>
        </div>

        {/* 3D Canvas */}
        <div style={{ position: "relative" }}>
          <div ref={containerRef} style={{
            width: "100%", height: 460, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
            cursor: "grab", background: "#0e1117",
          }} />
          <button onClick={() => setAutoRotate(r => !r)} style={{
            position: "absolute", bottom: 14, right: 14, width: 40, height: 40, borderRadius: "50%",
            background: autoRotate ? "rgba(124,168,232,0.2)" : "rgba(255,255,255,0.06)",
            border: autoRotate ? "1px solid rgba(124,168,232,0.4)" : "1px solid rgba(255,255,255,0.12)",
            color: autoRotate ? BLUE : "#667788", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "all 0.2s",
          }} title={autoRotate ? "Pause rotation" : "Resume rotation"}>
            {autoRotate ? "⏸" : "▶"}
          </button>
        </div>

        {/* Token row below the canvas */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 14, justifyContent: "center" }}>
          {tokens.map((tok, i) => {
            const st = STATUS_META[tok.status];
            const isSelected = i === selectedIdx;
            return (
              <button key={i} onClick={() => setSelectedIdx(i === selectedIdx ? null : i)} style={{
                padding: "5px 9px", borderRadius: 4, cursor: "pointer", transition: "all 0.15s",
                background: isSelected ? `${st.color}25` : `${st.color}0a`,
                border: isSelected ? `2px solid ${st.color}` : `1px solid ${st.color}33`,
                color: st.color, fontFamily: FM, fontSize: 11, fontWeight: isSelected ? 700 : 500,
              }}>
                {tok.word}
                <div style={{ fontSize: 8, color: "#556677", marginTop: 1 }}>{sortMode === "entropy" ? "H=" + tokenEntropy(tok.topK).toFixed(1) : (tok.confidence * 100).toFixed(0) + "%"}</div>
              </button>
            );
          })}
        </div>

        {/* Selected token detail */}
        {selTok && (
          <div style={{
            marginTop: 16, background: `${selSt.color}08`, border: `1px solid ${selSt.color}25`,
            borderRadius: 8, padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 20, fontFamily: FM, fontWeight: 700, color: selSt.color }}>"{selTok.word}"</span>
              <span style={{
                fontSize: 9, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1,
                padding: "3px 8px", borderRadius: 3, background: `${selSt.color}20`, color: selSt.color,
              }}>{selSt.label}</span>
              <span style={{ fontSize: 12, fontFamily: FM, color: GRAY }}>confidence: {(selTok.confidence * 100).toFixed(0)}%</span>
              <span style={{ fontSize: 12, fontFamily: FM, color: GRAY }}>entropy: {selEntropy.toFixed(2)} bits</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90, marginBottom: 12 }}>
              {selTok.topK.map((c, i) => {
                const maxP = selTok.topK[0].p;
                const h = (c.p / Math.max(maxP, 0.01)) * 70;
                return (
                  <div key={c.t} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 40 }}>
                    <div style={{ fontSize: 8, fontFamily: FM, color: i === 0 ? "#e8c4b8" : "#556677", marginBottom: 2 }}>
                      {(c.p * 100).toFixed(0)}%
                    </div>
                    <div style={{
                      width: "80%", height: Math.max(3, h), borderRadius: "3px 3px 0 0",
                      background: i === 0 ? selSt.color : "#334455",
                    }} />
                    <div style={{ fontSize: 7, fontFamily: FM, color: i === 0 ? "#e8c4b8" : "#556677", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 45, textAlign: "center" }}>
                      {c.t}
                    </div>
                  </div>
                );
              })}
            </div>

            {selTok.topK.length > 2 && selTok.topK[0].p - selTok.topK[1].p < 0.06 && (
              <div style={{ fontSize: 11, color: RED, fontFamily: FM, fontStyle: "italic", marginBottom: 8 }}>
                Top candidates within 6% — this is a lottery, not a decision
              </div>
            )}
            {selTok.topK[0].p > 0.65 && (
              <div style={{ fontSize: 11, color: GREEN, fontFamily: FM, fontStyle: "italic", marginBottom: 8 }}>
                Dominant winner — the model is executing, not guessing
              </div>
            )}
          </div>
        )}

        {/* Insight */}
        <div style={{
          marginTop: 24, padding: 20,
          background: "rgba(232,146,124,0.05)", border: "1px solid rgba(232,146,124,0.12)", borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            What You're Seeing
          </div>
          <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7 }}>
            {prompt === "vague" ? (
              <>
                <strong style={{ color: "#e8c4b8" }}>The vague prompt produces a jagged, uneven skyline.</strong>{" "}
                Sort by confidence or entropy and a clear gradient appears: grounded tokens (green) cluster on the right
                with tall front bars and suppressed runners-up. Confabulated tokens (red) cluster on the left with
                short front bars and a crowd of nearly-equal runners-up. The 3D view makes it visceral — where you see
                a tall colored bar towering alone, the model knew what to generate. Where you see a colored bar barely
                taller than the gray ones behind it, the model was guessing. Try "By Grounding" sort to see all the
                red tokens lined up — that's your hallucination surface.
              </>
            ) : (
              <>
                <strong style={{ color: "#e8c4b8" }}>The dense spec produces a uniform wall of tall front bars.</strong>{" "}
                Almost every token is grounded or inferred, producing a landscape where the colored front bar dominates
                and the gray runners-up are barely visible behind it. Sort by any axis and the picture is the same —
                consistently high confidence, consistently narrow distributions, consistently grounded output.
                The few structural tokens (gray "with", "a") are the only positions where the model had any room
                to vary, and even those are syntactically constrained to a handful of options.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
