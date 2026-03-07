import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const FEATURES = [
  { id: "entity",    label: "Entity Type",     color: "#e8927c" },
  { id: "action",    label: "Action/Verb",      color: "#7ccea0" },
  { id: "spatial",   label: "Spatial",           color: "#7ca8e8" },
  { id: "temporal",  label: "Temporal",          color: "#c87ce8" },
  { id: "quantity",  label: "Quantity",          color: "#e8c47c" },
  { id: "technical", label: "Technical",         color: "#4ac8c8" },
  { id: "domain",    label: "Domain",            color: "#c84a7c" },
  { id: "quality",   label: "Quality/Attr",      color: "#8bc84a" },
];

const PROMPTS = {
  vague: {
    label: "Vague: \"Build me a website that sells shoes\"",
    tokens: [
      { word: "Build", activations: { entity:[.05,.05,.04,.04,.03], action:[.40,.38,.35,.30,.28], spatial:[.05,.05,.04,.03,.03], temporal:[.03,.03,.03,.02,.02], quantity:[.02,.02,.02,.02,.01], technical:[.15,.18,.20,.18,.15], domain:[.20,.22,.25,.22,.18], quality:[.05,.05,.04,.03,.03] }},
      { word: "me", activations: { entity:[.25,.22,.18,.15,.12], action:[.05,.04,.03,.03,.02], spatial:[.03,.03,.02,.02,.02], temporal:[.02,.02,.02,.01,.01], quantity:[.02,.02,.01,.01,.01], technical:[.02,.02,.01,.01,.01], domain:[.05,.04,.03,.02,.02], quality:[.03,.03,.02,.02,.01] }},
      { word: "a", activations: { entity:[.08,.06,.04,.03,.02], action:[.02,.02,.01,.01,.01], spatial:[.02,.01,.01,.01,.01], temporal:[.01,.01,.01,.01,.01], quantity:[.05,.04,.03,.02,.02], technical:[.01,.01,.01,.01,.01], domain:[.02,.02,.01,.01,.01], quality:[.02,.02,.01,.01,.01] }},
      { word: "website", activations: { entity:[.30,.32,.28,.25,.22], action:[.08,.08,.07,.06,.05], spatial:[.10,.12,.10,.08,.07], temporal:[.03,.03,.03,.02,.02], quantity:[.03,.03,.02,.02,.02], technical:[.30,.35,.38,.35,.30], domain:[.28,.30,.32,.28,.25], quality:[.08,.08,.07,.06,.05] }},
      { word: "that", activations: { entity:[.03,.02,.02,.01,.01], action:[.02,.02,.01,.01,.01], spatial:[.01,.01,.01,.01,.01], temporal:[.01,.01,.01,.01,.01], quantity:[.01,.01,.01,.01,.01], technical:[.01,.01,.01,.01,.01], domain:[.01,.01,.01,.01,.01], quality:[.01,.01,.01,.01,.01] }},
      { word: "sells", activations: { entity:[.08,.08,.07,.06,.05], action:[.45,.42,.38,.35,.30], spatial:[.05,.05,.05,.04,.04], temporal:[.05,.05,.04,.04,.03], quantity:[.15,.18,.20,.18,.15], technical:[.08,.08,.07,.06,.05], domain:[.35,.38,.40,.38,.32], quality:[.05,.05,.04,.04,.03] }},
      { word: "shoes", activations: { entity:[.50,.48,.45,.40,.35], action:[.05,.05,.04,.04,.03], spatial:[.05,.05,.04,.04,.03], temporal:[.02,.02,.02,.02,.01], quantity:[.08,.08,.07,.06,.05], technical:[.03,.03,.03,.02,.02], domain:[.35,.38,.40,.38,.32], quality:[.20,.22,.25,.22,.18] }},
    ],
  },
  dense: {
    label: "Dense: \"React/Next.js 14 e-commerce SPA \u00B7 comfort footwear \u00B7 $80-200 \u00B7 Stripe \u00B7 WCAG-AA \u00B7 LCP<2s\"",
    tokens: [
      { word: "React/Next.js", activations: { entity:[.08,.06,.04,.03,.02], action:[.05,.04,.03,.02,.02], spatial:[.02,.02,.01,.01,.01], temporal:[.02,.02,.01,.01,.01], quantity:[.03,.03,.02,.02,.01], technical:[.60,.72,.82,.88,.92], domain:[.30,.25,.20,.15,.10], quality:[.05,.04,.03,.02,.02] }},
      { word: "14", activations: { entity:[.03,.03,.02,.02,.01], action:[.02,.01,.01,.01,.01], spatial:[.01,.01,.01,.01,.01], temporal:[.15,.12,.08,.05,.03], quantity:[.40,.35,.28,.20,.15], technical:[.25,.35,.48,.60,.72], domain:[.05,.04,.03,.02,.02], quality:[.03,.03,.02,.02,.01] }},
      { word: "e-commerce", activations: { entity:[.15,.12,.10,.08,.06], action:[.20,.22,.18,.15,.12], spatial:[.08,.06,.05,.04,.03], temporal:[.03,.03,.02,.02,.01], quantity:[.15,.15,.12,.10,.08], technical:[.30,.35,.40,.42,.38], domain:[.55,.62,.70,.78,.85], quality:[.05,.05,.04,.03,.03] }},
      { word: "SPA", activations: { entity:[.05,.04,.03,.02,.02], action:[.03,.03,.02,.02,.01], spatial:[.03,.02,.02,.01,.01], temporal:[.02,.02,.01,.01,.01], quantity:[.02,.02,.01,.01,.01], technical:[.50,.60,.72,.82,.88], domain:[.20,.18,.15,.12,.10], quality:[.05,.04,.03,.02,.02] }},
      { word: "comfort", activations: { entity:[.15,.15,.12,.10,.08], action:[.05,.05,.04,.03,.03], spatial:[.05,.04,.04,.03,.03], temporal:[.02,.02,.02,.01,.01], quantity:[.03,.03,.02,.02,.02], technical:[.03,.03,.02,.02,.02], domain:[.30,.35,.40,.42,.38], quality:[.55,.60,.68,.75,.82] }},
      { word: "footwear", activations: { entity:[.55,.60,.68,.75,.82], action:[.05,.04,.03,.03,.02], spatial:[.05,.05,.04,.03,.03], temporal:[.02,.02,.01,.01,.01], quantity:[.08,.08,.06,.05,.04], technical:[.03,.03,.02,.02,.02], domain:[.40,.45,.50,.55,.58], quality:[.20,.22,.25,.22,.18] }},
      { word: "$80-200", activations: { entity:[.05,.04,.03,.02,.02], action:[.03,.03,.02,.02,.01], spatial:[.02,.02,.01,.01,.01], temporal:[.02,.02,.01,.01,.01], quantity:[.60,.68,.78,.85,.90], technical:[.05,.05,.04,.03,.03], domain:[.30,.32,.35,.38,.35], quality:[.15,.15,.12,.10,.08] }},
      { word: "Stripe", activations: { entity:[.20,.18,.15,.12,.08], action:[.05,.05,.04,.03,.02], spatial:[.02,.02,.01,.01,.01], temporal:[.02,.02,.01,.01,.01], quantity:[.08,.08,.06,.05,.04], technical:[.55,.65,.75,.85,.92], domain:[.30,.32,.35,.32,.28], quality:[.03,.03,.02,.02,.02] }},
      { word: "WCAG-AA", activations: { entity:[.05,.04,.03,.02,.02], action:[.03,.03,.02,.02,.01], spatial:[.02,.02,.01,.01,.01], temporal:[.02,.02,.01,.01,.01], quantity:[.05,.05,.04,.03,.03], technical:[.50,.60,.72,.82,.90], domain:[.15,.15,.12,.10,.08], quality:[.35,.38,.42,.48,.55] }},
      { word: "LCP<2s", activations: { entity:[.03,.03,.02,.02,.01], action:[.05,.04,.03,.03,.02], spatial:[.02,.02,.01,.01,.01], temporal:[.15,.15,.12,.10,.08], quantity:[.45,.50,.58,.65,.72], technical:[.50,.58,.68,.78,.88], domain:[.10,.10,.08,.06,.05], quality:[.20,.22,.25,.28,.30] }},
    ],
  },
};

const LAYER_LABELS = ["Embed", "Layer 1", "Layer 2", "Layer 3", "Final"];
const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";

function buildScene(container, promptData, layerIdx) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1117);
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
  camera.position.set(14, 12, 18);
  camera.lookAt(0, 2, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x334455, 0.8));
  const dir = new THREE.DirectionalLight(0xffeedd, 0.9);
  dir.position.set(10, 15, 10);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x8899bb, 0.4);
  dir2.position.set(-8, 10, -5);
  scene.add(dir2);

  const tokens = promptData.tokens;
  const numTokens = tokens.length;
  const numFeatures = FEATURES.length;
  const barW = 0.5, gapX = 1.2, gapZ = 1.2;
  const totalX = (numTokens - 1) * gapX;
  const totalZ = (numFeatures - 1) * gapZ;
  const bars = [];

  tokens.forEach((tok, ti) => {
    FEATURES.forEach((feat, fi) => {
      const val = tok.activations[feat.id]?.[layerIdx] || 0;
      const h = Math.max(0.04, val * 10);
      const geo = new THREE.BoxGeometry(barW, h, barW);
      const color = new THREE.Color(feat.color);
      const mat = new THREE.MeshPhongMaterial({
        color, emissive: color.clone().multiplyScalar(val * 0.4),
        transparent: true, opacity: Math.max(0.15, Math.min(1, val * 2.5)), shininess: 60,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ti * gapX - totalX / 2, h / 2, fi * gapZ - totalZ / 2);
      scene.add(mesh);
      bars.push({ mesh, tok, feat, val, ti, fi });
    });
  });

  const gridGeo = new THREE.PlaneGeometry(totalX + 4, totalZ + 4);
  const gridMat = new THREE.MeshPhongMaterial({ color: 0x151a22, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const gridMesh = new THREE.Mesh(gridGeo, gridMat);
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.y = -0.02;
  scene.add(gridMesh);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x1e2530, transparent: true, opacity: 0.5 });
  for (let i = 0; i < numTokens; i++) {
    const pts = [new THREE.Vector3(i * gapX - totalX / 2, 0, -totalZ / 2 - 1), new THREE.Vector3(i * gapX - totalX / 2, 0, totalZ / 2 + 1)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  for (let j = 0; j < numFeatures; j++) {
    const pts = [new THREE.Vector3(-totalX / 2 - 1, 0, j * gapZ - totalZ / 2), new THREE.Vector3(totalX / 2 + 1, 0, j * gapZ - totalZ / 2)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }

  function makeLabel(text, x, y, z, color, size) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = `bold ${size || 20}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 }));
    sp.position.set(x, y, z);
    sp.scale.set(3, 0.75, 1);
    scene.add(sp);
  }

  tokens.forEach((tok, i) => makeLabel(tok.word, i * gapX - totalX / 2, -0.5, totalZ / 2 + 1.8, "#c0c8d0", 18));
  FEATURES.forEach((feat, j) => makeLabel(feat.label, -totalX / 2 - 2.5, -0.5, j * gapZ - totalZ / 2, feat.color, 14));

  return { scene, camera, renderer, bars };
}

export default function FeatureGrid3D() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const mouseRef = useRef({ down: false, x: 0, y: 0, theta: 0.7, phi: 0.5, dist: 24 });
  const autoRotateRef = useRef(true);
  const [prompt, setPrompt] = useState("vague");
  const [layerIdx, setLayerIdx] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [animatingLayers, setAnimatingLayers] = useState(false);

  // Keep ref in sync with state (no scene rebuild on toggle)
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const buildAndMount = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (sceneRef.current) {
      sceneRef.current.renderer.dispose();
      while (c.firstChild) c.removeChild(c.firstChild);
    }
    const s = buildScene(c, PROMPTS[prompt], layerIdx);
    sceneRef.current = s;

    const updateCamera = () => {
      const m = mouseRef.current;
      const x = m.dist * Math.sin(m.theta) * Math.cos(m.phi);
      const y = m.dist * Math.sin(m.phi);
      const z = m.dist * Math.cos(m.theta) * Math.cos(m.phi);
      s.camera.position.set(x, Math.max(2, y), z);
      s.camera.lookAt(0, 2, 0);
    };
    updateCamera();

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotateRef.current && !mouseRef.current.down) {
        mouseRef.current.theta += 0.003;
        updateCamera();
      }
      s.renderer.render(s.scene, s.camera);
    };
    animate();

    return () => cancelAnimationFrame(frameId);
  }, [prompt, layerIdx]); // autoRotate NOT in deps

  useEffect(() => {
    const cleanup = buildAndMount();
    return () => { if (cleanup) cleanup(); };
  }, [buildAndMount]);

  // Mouse / touch controls
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
      mouseRef.current.phi = Math.max(0.1, Math.min(1.4, mouseRef.current.phi + (cy - mouseRef.current.y) * 0.008));
      mouseRef.current.x = cx; mouseRef.current.y = cy;
      if (sceneRef.current) {
        const m = mouseRef.current;
        sceneRef.current.camera.position.set(
          m.dist * Math.sin(m.theta) * Math.cos(m.phi),
          Math.max(2, m.dist * Math.sin(m.phi)),
          m.dist * Math.cos(m.theta) * Math.cos(m.phi)
        );
        sceneRef.current.camera.lookAt(0, 2, 0);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      mouseRef.current.dist = Math.max(10, Math.min(45, mouseRef.current.dist + e.deltaY * 0.03));
      if (sceneRef.current) {
        const m = mouseRef.current;
        sceneRef.current.camera.position.set(
          m.dist * Math.sin(m.theta) * Math.cos(m.phi),
          Math.max(2, m.dist * Math.sin(m.phi)),
          m.dist * Math.cos(m.theta) * Math.cos(m.phi)
        );
        sceneRef.current.camera.lookAt(0, 2, 0);
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

  const playLayers = useCallback(() => {
    if (animatingLayers) return;
    setAnimatingLayers(true);
    let i = 0;
    const step = () => {
      setLayerIdx(i);
      i++;
      if (i < 5) setTimeout(step, 800);
      else setAnimatingLayers(false);
    };
    step();
  }, [animatingLayers]);

  const currentData = PROMPTS[prompt];
  const peakFeatures = currentData.tokens.map(tok => {
    let maxVal = 0, maxFeat = "";
    FEATURES.forEach(f => {
      const v = tok.activations[f.id]?.[layerIdx] || 0;
      if (v > maxVal) { maxVal = v; maxFeat = f.label; }
    });
    return { word: tok.word, maxVal, maxFeat };
  });

  return (
    <div style={{ background: "#0e1117", minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        <div style={{ fontSize: 11, color: "#e8927c", fontFamily: FM, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}>3D Interactive Visualization</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8c4b8", margin: "0 0 4px" }}>Feature Activation Landscape</h1>
        <p style={{ fontSize: 13, color: "#8899aa", margin: "0 0 20px", maxWidth: 700, lineHeight: 1.5 }}>
          Each bar = one token's activation on one feature dimension. Taller &amp; brighter = stronger association.
          Step through layers to watch vague activations stay flat while specific tokens sharpen into peaks.
        </p>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          {Object.entries(PROMPTS).map(([key]) => (
            <button key={key} onClick={() => setPrompt(key)} style={{
              padding: "8px 16px", fontSize: 12, fontFamily: FM, fontWeight: prompt === key ? 700 : 400,
              background: prompt === key ? "rgba(232,146,124,0.15)" : "rgba(255,255,255,0.03)",
              border: prompt === key ? "1px solid rgba(232,146,124,0.4)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 4, color: prompt === key ? "#e8927c" : "#8899aa", cursor: "pointer",
            }}>{key === "vague" ? "Vague Prompt" : "Dense Spec"}</button>
          ))}
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          {LAYER_LABELS.map((l, i) => (
            <button key={i} onClick={() => setLayerIdx(i)} style={{
              padding: "6px 12px", fontSize: 11, fontFamily: FM, fontWeight: layerIdx === i ? 700 : 400,
              background: layerIdx === i ? "rgba(124,206,160,0.15)" : "rgba(255,255,255,0.03)",
              border: layerIdx === i ? "1px solid rgba(124,206,160,0.4)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 4, color: layerIdx === i ? "#7ccea0" : "#667788", cursor: "pointer",
            }}>{l}</button>
          ))}
          <button onClick={playLayers} disabled={animatingLayers} style={{
            padding: "6px 14px", fontSize: 11, fontFamily: FM, fontWeight: 600,
            background: animatingLayers ? "rgba(255,255,255,0.02)" : "rgba(232,146,124,0.12)",
            border: "1px solid rgba(232,146,124,0.3)", borderRadius: 4,
            color: animatingLayers ? "#556677" : "#e8927c", cursor: animatingLayers ? "default" : "pointer",
          }}>{animatingLayers ? "Playing..." : "\u25B6 Animate Layers"}</button>
        </div>

        {/* Feature legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {FEATURES.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: f.color }} />
              <span style={{ fontSize: 10, fontFamily: FM, color: "#8899aa" }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* 3D Canvas with pause overlay */}
        <div style={{ position: "relative" }}>
          <div ref={containerRef} style={{
            width: "100%", height: 480, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
            cursor: "grab", background: "#0e1117",
          }} />
          {/* Pause / Play overlay button */}
          <button
            onClick={() => setAutoRotate(r => !r)}
            style={{
              position: "absolute", bottom: 16, right: 16,
              width: 44, height: 44, borderRadius: "50%",
              background: autoRotate ? "rgba(124,168,232,0.2)" : "rgba(255,255,255,0.06)",
              border: autoRotate ? "1px solid rgba(124,168,232,0.4)" : "1px solid rgba(255,255,255,0.12)",
              color: autoRotate ? "#7ca8e8" : "#667788",
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)", transition: "all 0.2s",
            }}
            title={autoRotate ? "Pause rotation" : "Resume rotation"}
          >
            {autoRotate ? "\u23F8" : "\u25B6"}
          </button>
        </div>

        {/* Layer label */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{
            fontSize: 13, fontFamily: FM, color: "#7ccea0", fontWeight: 700,
            padding: "6px 16px", background: "rgba(124,206,160,0.1)",
            border: "1px solid rgba(124,206,160,0.25)", borderRadius: 20,
          }}>
            {LAYER_LABELS[layerIdx]} {"\u2014"} {prompt === "vague" ? "Broad, diffuse activation" : "Narrow, peaked activation"}
          </span>
        </div>

        {/* Token peak summary */}
        <div style={{ marginTop: 20, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {peakFeatures.map((p, i) => (
            <div key={i} style={{
              padding: "8px 12px", borderRadius: 6, textAlign: "center", minWidth: 90,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 13, fontFamily: FM, color: "#e8c4b8", fontWeight: 600 }}>{p.word}</div>
              <div style={{
                fontSize: 18, fontFamily: FM, fontWeight: 700, lineHeight: 1.2,
                color: p.maxVal > 0.6 ? "#7ccea0" : p.maxVal > 0.3 ? "#e8c47c" : "#e87c7c",
              }}>{(p.maxVal * 100).toFixed(0)}%</div>
              <div style={{ fontSize: 9, fontFamily: FM, color: "#667788" }}>{p.maxFeat}</div>
            </div>
          ))}
        </div>

        {/* Insight */}
        <div style={{
          marginTop: 24, padding: 20,
          background: "rgba(232,146,124,0.05)", border: "1px solid rgba(232,146,124,0.12)", borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, color: "#e8927c", fontFamily: FM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>What You're Seeing</div>
          <div style={{ fontSize: 13, color: "#99aabb", lineHeight: 1.7 }}>
            {prompt === "vague" ? (
              <>
                <strong style={{ color: "#e8c4b8" }}>The vague prompt creates a flat, diffuse landscape.</strong>{" "}
                "Sells" activates action, domain, and quantity features roughly equally {"\u2014"} the model can't tell if you mean
                retail sales, real estate, or persuasion. "Shoes" lights up entity and domain features broadly. As you step
                through layers, activations barely sharpen because <em>the context provides no signal to disambiguate</em>.
                Each remaining bump on an irrelevant feature is attention budget wasted on wrong interpretations.
              </>
            ) : (
              <>
                <strong style={{ color: "#e8c4b8" }}>The dense spec creates tall, narrow peaks.</strong>{" "}
                "React/Next.js" almost exclusively activates the Technical feature {"\u2014"} by the final layer it's at 92% and everything
                else has decayed to near-zero. "Footwear" sends Entity to 82%. "$80-200" pins Quantity at 90%. Step through
                the layers and watch peaks <em>grow taller while the floor drops</em> {"\u2014"} that's attention reinforcing
                the correct interpretation and pruning the rest.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
