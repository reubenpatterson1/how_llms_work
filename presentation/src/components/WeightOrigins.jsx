import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";

const FM = "'IBM Plex Mono', monospace";
const FS = "'IBM Plex Sans', sans-serif";
const ACCENT = "#e8927c";
const GREEN = "#7ccea0";
const BLUE = "#7ca8e8";
const PURPLE = "#c87ce8";
const GOLD = "#e8c47c";
const GRAY = "#8899aa";

// ============================================================
//  SENTENCE OPTIONS
// ============================================================
const SENTENCES = {
  cats: {
    words: ["Cats", "are", "lazy"],
    colors: ["#e8927c", "#8899aa", "#7ca8e8"],
    // Final learned weights (3x3 attention matrix after training)
    finalWeights: [
      [0.30, 0.10, 0.60],  // Cats attends to: Cats=0.30, are=0.10, lazy=0.60
      [0.45, 0.15, 0.40],  // are attends to: Cats=0.45, are=0.15, lazy=0.40
      [0.55, 0.08, 0.37],  // lazy attends to: Cats=0.55, are=0.08, lazy=0.37
    ],
    // Training examples that shaped each weight, grouped by cell
    trainingExamples: [
      // [i][j] = examples that reinforce weight from word i attending to word j
      [
        // Cats->Cats (self-attention, entity reinforcement)
        ["Cats groom cats constantly", "Cats chase other cats at night", "Wild cats and house cats differ", "Cats — especially indoor cats — sleep 16 hours"],
        // Cats->are
        ["Cats are everywhere in Istanbul", "Cats are the most popular pet", "Cats are obligate carnivores"],
        // Cats->lazy (strong association!)
        ["Cats are notoriously lazy creatures", "My lazy cat sleeps all day", "Lazy cats make great apartment pets", "The cat was too lazy to chase the mouse", "Veterinarians say lazy cats need more play", "Cats have a reputation for being lazy and aloof", "Even lazy cats enjoy a good sunbeam"],
      ],
      [
        // are->Cats
        ["Cats are the subject of countless memes", "Cats are independent animals", "Cats are fascinating creatures", "These cats are all rescues"],
        // are->are (copula self-attention, weak)
        ["There are reasons they are popular", "They are what they are"],
        // are->lazy
        ["They are lazy by nature", "Pets that are lazy need less space", "Animals that are lazy conserve energy", "Some breeds are lazy while others are active"],
      ],
      [
        // lazy->Cats (back-reference to subject)
        ["Cats are the laziest pets", "A lazy cat is a happy cat", "The lazy kitten slept on the couch", "Cats known for being lazy include Persians", "The laziest cat breeds are Ragdolls"],
        // lazy->are (weak link)
        ["Lazy animals are common in nature", "Lazy is how they are described"],
        // lazy->lazy (self-attention)
        ["Lazy days lead to lazy habits", "The lazy, lazy afternoon stretched on", "Too lazy to be lazy properly"],
      ],
    ],
  },
  she: {
    words: ["She", "read", "fast"],
    colors: ["#c87ce8", "#7ccea0", "#e8c47c"],
    finalWeights: [
      [0.35, 0.45, 0.20],  // She -> read (strong: subject-verb)
      [0.50, 0.20, 0.30],  // read -> She (who's reading?)
      [0.15, 0.55, 0.30],  // fast -> read (modifies the verb)
    ],
    trainingExamples: [
      [
        ["She paused, she thought, she decided", "She herself was surprised", "She and she alone knew the truth"],
        ["She read the letter twice", "She read every book in the library", "She read aloud to the children", "She read between the lines", "She read voraciously as a child", "She always read before bed"],
        ["She ran fast down the corridor", "She typed fast and accurately", "She learned fast in school"],
      ],
      [
        ["She read the entire novel", "He read, she read, they all read", "She read more than anyone", "The girl who read everything", "She always read the fine print"],
        ["Read and re-read the passage", "I read what you read yesterday"],
        ["Read fast, comprehend faster", "He could read fast but not deeply", "Speed reading means you read fast", "Students who read fast score higher", "Learning to read fast takes practice"],
      ],
      [
        ["She drove fast on the highway", "Running fast requires training"],
        ["Read fast to finish on time", "Those who read fast often skim", "To read fast is a valuable skill", "Children who read fast develop larger vocabularies"],
        ["Fast cars go fast", "The fast lane is the fast track", "Fast, faster, fastest"],
      ],
    ],
  },
  fire: {
    words: ["Fire", "burns", "bright"],
    colors: ["#e87c7c", "#e8927c", "#e8c47c"],
    finalWeights: [
      [0.35, 0.45, 0.20],
      [0.50, 0.15, 0.35],
      [0.40, 0.20, 0.40],
    ],
    trainingExamples: [
      [
        ["Fire and fire alone can forge steel", "Fire meets fire in the clash", "Where there's fire there's fire safety"],
        ["Fire burns through the forest", "Fire burns everything it touches", "The fire burns day and night", "Wildfire burns thousands of acres", "Fire burns hotter with oxygen", "A fire that burns unchecked spreads rapidly"],
        ["Fire burns bright in the darkness", "The fire glowed bright orange", "Bright fire lit up the cave"],
      ],
      [
        ["The fire burns with intensity", "A raging fire burns nearby", "Fire that burns too hot", "When the fire burns out", "The fire burns in the hearth"],
        ["It burns and burns until spent", "The candle burns as it burns down"],
        ["The flame burns bright and hot", "A candle that burns bright burns fast", "The star burns bright tonight", "Love burns bright then fades", "The light burns bright at noon"],
      ],
      [
        ["The bright fire warmed them", "Bright flames from the fire", "Fire cast a bright glow", "A bright crackling fire"],
        ["Bright things that burn attract moths", "The bright ember burns on"],
        ["Bright, brighter, brightest of all", "The bright bright morning sun", "Stars shine bright and bright"],
      ],
    ],
  },
};

// ============================================================
//  BUILD 3D
// ============================================================
function buildScene(container, words, colors, weights) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1117);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x445566, 0.8));
  const d1 = new THREE.DirectionalLight(0xffeedd, 0.9);
  d1.position.set(8, 12, 8);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x8899bb, 0.4);
  d2.position.set(-6, 8, -4);
  scene.add(d2);

  const gap = 2.0;
  const barW = 0.7;
  const offset = gap; // center the 3x3

  const bars = [];

  for (let qi = 0; qi < 3; qi++) {
    for (let ki = 0; ki < 3; ki++) {
      const w = weights[qi][ki];
      const h = Math.max(0.05, w * 8);
      const geo = new THREE.BoxGeometry(barW, h, barW);

      // Color: blend query and key colors
      const qCol = new THREE.Color(colors[qi]);
      const kCol = new THREE.Color(colors[ki]);
      const blended = qCol.clone().lerp(kCol, 0.5);

      const mat = new THREE.MeshPhongMaterial({
        color: blended,
        emissive: blended.clone().multiplyScalar(w * 0.3),
        transparent: true,
        opacity: 0.3 + w * 0.7,
        shininess: 60,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        qi * gap - offset,
        h / 2,
        ki * gap - offset
      );
      bars.push({ mesh, qi, ki, weight: w });
      scene.add(mesh);
    }
  }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(gap * 4, gap * 4);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x0a0e15, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  // Grid lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1e2530, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 3; i++) {
    const pts1 = [new THREE.Vector3(i * gap - offset, 0, -offset - 1), new THREE.Vector3(i * gap - offset, 0, offset + 1)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), lineMat));
    const pts2 = [new THREE.Vector3(-offset - 1, 0, i * gap - offset), new THREE.Vector3(offset + 1, 0, i * gap - offset)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), lineMat));
  }

  // Labels
  function makeSprite(text, x, y, z, color, size) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = `bold ${size || 22}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 }));
    sp.position.set(x, y, z);
    sp.scale.set(2.5, 0.8, 1);
    scene.add(sp);
  }

  // Query labels (rows, along X)
  words.forEach((w, i) => {
    makeSprite(w, i * gap - offset, -0.7, offset + 1.5, colors[i], 20);
  });
  makeSprite("Query (attends from)", 0, -0.7, offset + 2.8, "#667788", 13);

  // Key labels (columns, along Z)
  words.forEach((w, i) => {
    makeSprite(w, -offset - 1.8, -0.7, i * gap - offset, colors[i], 20);
  });
  makeSprite("Key (attends to)", -offset - 1.8, -0.7, -offset - 1.5, "#667788", 13);

  // Weight labels on top of bars
  for (let qi = 0; qi < 3; qi++) {
    for (let ki = 0; ki < 3; ki++) {
      const w = weights[qi][ki];
      const h = Math.max(0.05, w * 8);
      makeSprite((w * 100).toFixed(0) + "%", qi * gap - offset, h + 0.4, ki * gap - offset, "#c0c8d0", 16);
    }
  }

  return { scene, camera, renderer, bars };
}

// ============================================================
//  MAIN COMPONENT
// ============================================================
export default function WeightOrigins() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const autoRotateRef = useRef(true);
  const mouseRef = useRef({ down: false, x: 0, y: 0, theta: 0.6, phi: 0.4, dist: 14 });
  const [sentence, setSentence] = useState("cats");
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedCell, setSelectedCell] = useState({ qi: 0, ki: 2 }); // Cats->lazy default
  const [trainingStep, setTrainingStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const data = SENTENCES[sentence];

  // Animate weights growing from 0 to final
  const currentWeights = useMemo(() => {
    const progress = trainingStep / 100;
    return data.finalWeights.map(row =>
      row.map(w => w * Math.min(1, progress * 1.2) * (0.8 + 0.2 * Math.sin(progress * Math.PI)))
    );
  }, [data, trainingStep]);

  const rebuild = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (sceneRef.current) {
      sceneRef.current.renderer.dispose();
      while (c.firstChild) c.removeChild(c.firstChild);
    }
    const weights = trainingStep === 0 ? data.finalWeights.map(r => r.map(() => 0.02)) :
                    trainingStep >= 100 ? data.finalWeights :
                    currentWeights;
    const s = buildScene(c, data.words, data.colors, weights);
    sceneRef.current = s;

    const updateCam = () => {
      const m = mouseRef.current;
      s.camera.position.set(
        m.dist * Math.sin(m.theta) * Math.cos(m.phi),
        Math.max(2, m.dist * Math.sin(m.phi)),
        m.dist * Math.cos(m.theta) * Math.cos(m.phi)
      );
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
  }, [data, trainingStep, currentWeights]);

  useEffect(() => {
    const cleanup = rebuild();
    return () => { if (cleanup) cleanup(); };
  }, [rebuild]);

  // Mouse controls
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onDown = (e) => { mouseRef.current.down = true; mouseRef.current.x = e.clientX || e.touches?.[0]?.clientX || 0; mouseRef.current.y = e.clientY || e.touches?.[0]?.clientY || 0; };
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
        sceneRef.current.camera.position.set(m.dist * Math.sin(m.theta) * Math.cos(m.phi), Math.max(2, m.dist * Math.sin(m.phi)), m.dist * Math.cos(m.theta) * Math.cos(m.phi));
        sceneRef.current.camera.lookAt(0, 1.5, 0);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      mouseRef.current.dist = Math.max(6, Math.min(25, mouseRef.current.dist + e.deltaY * 0.02));
      if (sceneRef.current) {
        const m = mouseRef.current;
        sceneRef.current.camera.position.set(m.dist * Math.sin(m.theta) * Math.cos(m.phi), Math.max(2, m.dist * Math.sin(m.phi)), m.dist * Math.cos(m.theta) * Math.cos(m.phi));
        sceneRef.current.camera.lookAt(0, 1.5, 0);
      }
    };
    c.addEventListener("mousedown", onDown); c.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mouseup", onUp); window.addEventListener("touchend", onUp);
    c.addEventListener("mousemove", onMove); c.addEventListener("touchmove", onMove, { passive: true });
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      c.removeEventListener("mousedown", onDown); c.removeEventListener("touchstart", onDown);
      window.removeEventListener("mouseup", onUp); window.removeEventListener("touchend", onUp);
      c.removeEventListener("mousemove", onMove); c.removeEventListener("touchmove", onMove);
      c.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Training animation
  const playTraining = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setTrainingStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step += 2;
      setTrainingStep(step);
      if (step >= 100) {
        clearInterval(interval);
        setAnimating(false);
      }
    }, 60);
  }, [animating]);

  // Selected cell examples
  const cellExamples = data.trainingExamples[selectedCell.qi]?.[selectedCell.ki] || [];
  const cellWeight = data.finalWeights[selectedCell.qi][selectedCell.ki];
  const qWord = data.words[selectedCell.qi];
  const kWord = data.words[selectedCell.ki];
  const qColor = data.colors[selectedCell.qi];
  const kColor = data.colors[selectedCell.ki];

  return (
    <div style={{ background: "#0e1117", minHeight: "100vh", color: "#d0d8e0", fontFamily: FS }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

        <div style={{ fontSize: 11, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}>3D Interactive Visualization</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8c4b8", margin: "0 0 4px" }}>Where Weights Come From</h1>
        <p style={{ fontSize: 13, color: GRAY, margin: "0 0 20px", maxWidth: 720, lineHeight: 1.5 }}>
          A 3-word sentence produces a 3x3 attention weight matrix. Each cell's value was shaped by
          billions of training examples where those words appeared together. Click any cell to see the
          training sentences that built that weight. Animate to watch the weights grow from zero.
        </p>

        {/* Sentence selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {Object.entries(SENTENCES).map(([key, s]) => (
            <button key={key} onClick={() => { setSentence(key); setTrainingStep(100); setSelectedCell({ qi: 0, ki: 2 }); }} style={{
              padding: "10px 18px", fontSize: 14, fontFamily: FM, fontWeight: sentence === key ? 700 : 400,
              background: sentence === key ? `${ACCENT}18` : "rgba(255,255,255,0.03)",
              border: sentence === key ? `1px solid ${ACCENT}44` : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, color: sentence === key ? ACCENT : GRAY, cursor: "pointer",
            }}>
              "{s.words.join(" ")}"
            </button>
          ))}
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)" }} />
          <button onClick={playTraining} disabled={animating} style={{
            padding: "10px 18px", fontSize: 12, fontFamily: FM, fontWeight: 600,
            background: animating ? "rgba(255,255,255,0.02)" : `${GREEN}15`,
            border: `1px solid ${animating ? "rgba(255,255,255,0.08)" : GREEN + "44"}`,
            borderRadius: 6, color: animating ? "#556677" : GREEN, cursor: animating ? "default" : "pointer",
          }}>
            {animating ? `Training... ${trainingStep}%` : "Animate Training"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <span style={{ fontSize: 10, fontFamily: FM, color: "#556677" }}>Training:</span>
            <input type="range" min={0} max={100} value={trainingStep}
              onChange={e => setTrainingStep(+e.target.value)}
              style={{ width: 120, accentColor: GREEN }} />
            <span style={{ fontSize: 12, fontFamily: FM, color: GREEN, fontWeight: 700, minWidth: 35 }}>{trainingStep}%</span>
          </div>
        </div>

        {/* 3D grid + cell selector side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, marginBottom: 20 }}>
          {/* 3D Canvas */}
          <div style={{ position: "relative" }}>
            <div ref={containerRef} style={{
              width: "100%", height: 420, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
              cursor: "grab", background: "#0e1117",
            }} />
            <button onClick={() => setAutoRotate(r => !r)} style={{
              position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: "50%",
              background: autoRotate ? "rgba(124,168,232,0.2)" : "rgba(255,255,255,0.06)",
              border: autoRotate ? "1px solid rgba(124,168,232,0.4)" : "1px solid rgba(255,255,255,0.12)",
              color: autoRotate ? BLUE : "#667788", fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)",
            }}>{autoRotate ? "⏸" : "▶"}</button>
          </div>

          {/* 2D matrix cell selector */}
          <div>
            <div style={{ fontSize: 10, color: GRAY, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Click a cell to inspect its training evidence
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(3, 1fr)", gridTemplateRows: "30px repeat(3, 1fr)", gap: 4 }}>
              {/* Header row */}
              <div />
              {data.words.map((w, i) => (
                <div key={`h-${i}`} style={{ textAlign: "center", fontSize: 12, fontFamily: FM, color: data.colors[i], fontWeight: 600, lineHeight: "30px" }}>
                  {w}
                </div>
              ))}
              {/* Matrix rows */}
              {data.words.map((qw, qi) => (
                [
                  <div key={`r-${qi}`} style={{ fontSize: 12, fontFamily: FM, color: data.colors[qi], fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
                    {qw}
                  </div>,
                  ...data.words.map((kw, ki) => {
                    const w = data.finalWeights[qi][ki];
                    const isSelected = selectedCell.qi === qi && selectedCell.ki === ki;
                    const qC = data.colors[qi];
                    const kC = data.colors[ki];
                    return (
                      <button key={`c-${qi}-${ki}`} onClick={() => setSelectedCell({ qi, ki })} style={{
                        padding: "12px 4px", borderRadius: 6, cursor: "pointer", textAlign: "center",
                        background: isSelected ? `${qC}25` : `rgba(255,255,255,${0.02 + w * 0.08})`,
                        border: isSelected ? `2px solid ${qC}` : "1px solid rgba(255,255,255,0.06)",
                        transition: "all 0.15s",
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FM, color: isSelected ? "#e8c4b8" : GRAY }}>
                          {(w * 100).toFixed(0)}%
                        </div>
                        <div style={{
                          marginTop: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden",
                        }}>
                          <div style={{ width: `${w * 100}%`, height: "100%", borderRadius: 2, background: `${qC}cc`, transition: "width 0.3s" }} />
                        </div>
                      </button>
                    );
                  })
                ]
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: "#556677", fontFamily: FM, lineHeight: 1.5 }}>
              Rows = Query (which word is looking)<br />
              Cols = Key (which word it attends to)<br />
              Higher % = stronger learned association
            </div>
          </div>
        </div>

        {/* Training evidence panel */}
        <div style={{
          background: `rgba(255,255,255,0.03)`, border: `1px solid rgba(255,255,255,0.06)`,
          borderRadius: 8, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontFamily: FM, fontWeight: 700, color: qColor }}>{qWord}</span>
            <span style={{ fontSize: 14, color: "#556677" }}>attends to</span>
            <span style={{ fontSize: 18, fontFamily: FM, fontWeight: 700, color: kColor }}>{kWord}</span>
            <span style={{
              fontSize: 11, fontFamily: FM, padding: "4px 10px", borderRadius: 4,
              background: cellWeight > 0.4 ? `${GREEN}20` : cellWeight > 0.2 ? `${GOLD}20` : `${GRAY}20`,
              color: cellWeight > 0.4 ? GREEN : cellWeight > 0.2 ? GOLD : GRAY,
              fontWeight: 700,
            }}>
              Weight: {(cellWeight * 100).toFixed(0)}%
            </span>
          </div>

          <div style={{ fontSize: 10, color: GRAY, fontFamily: FM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Training Sentences That Built This Weight ({cellExamples.length} examples)
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {cellExamples.map((ex, i) => {
              // Highlight the relevant words in each example
              const parts = [];
              let remaining = ex;
              [qWord.toLowerCase(), kWord.toLowerCase()].forEach(target => {
                const idx = remaining.toLowerCase().indexOf(target);
                if (idx >= 0) {
                  if (idx > 0) parts.push({ text: remaining.slice(0, idx), highlight: false });
                  parts.push({ text: remaining.slice(idx, idx + target.length), highlight: true });
                  remaining = remaining.slice(idx + target.length);
                }
              });
              if (remaining) parts.push({ text: remaining, highlight: false });
              // Fallback if no highlighting worked
              if (parts.length === 0) parts.push({ text: ex, highlight: false });

              return (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: 5,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 13, color: "#8899aa", lineHeight: 1.5, fontFamily: FS,
                }}>
                  <span style={{ fontFamily: FM, fontSize: 10, color: "#445566", marginRight: 8 }}>#{i + 1}</span>
                  "{ex}"
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          <div style={{ marginTop: 14, fontSize: 12, color: "#778899", lineHeight: 1.6 }}>
            {cellWeight > 0.4 ? (
              <>
                <strong style={{ color: "#e8c4b8" }}>Strong weight ({(cellWeight * 100).toFixed(0)}%).</strong>{" "}
                These two words appeared together frequently in semantically rich contexts across training data.
                The model learned that when "{qWord}" appears, "{kWord}" is highly relevant — it should
                attend strongly to it when computing its context-aware representation.
              </>
            ) : cellWeight > 0.15 ? (
              <>
                <strong style={{ color: "#e8c4b8" }}>Moderate weight ({(cellWeight * 100).toFixed(0)}%).</strong>{" "}
                These words co-occur in training data but the relationship isn't as strong or as consistent
                as the dominant associations. The model allocates some attention here but prioritizes other
                connections.
              </>
            ) : (
              <>
                <strong style={{ color: "#e8c4b8" }}>Weak weight ({(cellWeight * 100).toFixed(0)}%).</strong>{" "}
                These words rarely appear in contexts where they're directly relevant to each other.
                The low weight means the model learned to mostly ignore this connection, directing
                attention elsewhere.
              </>
            )}
          </div>
        </div>

        {/* Bottom insight */}
        <div style={{
          padding: 24, background: "rgba(232,146,124,0.05)", border: "1px solid rgba(232,146,124,0.12)", borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, color: ACCENT, fontFamily: FM, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            How Training Builds Weights
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, fontSize: 13, color: "#99aabb", lineHeight: 1.7,
          }}>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Co-occurrence is the raw signal.</strong>{" "}
              When "cats" and "lazy" appear together across millions of web pages, blog posts, and books,
              the gradient updates during training incrementally strengthen the Q/K dot product between
              their embeddings. Each training example is a tiny nudge; billions of nudges create the
              final weight.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>Context matters more than frequency.</strong>{" "}
              "Cats" and "the" co-occur even more often than "cats" and "lazy," but in structurally
              generic contexts. The attention mechanism learns to discount these because attending to
              "the" rarely helps predict the next token. High weight requires both co-occurrence
              <em> and</em> predictive utility.
            </div>
            <div>
              <strong style={{ color: "#e8c4b8" }}>This is what your prompt activates.</strong>{" "}
              When you write a prompt, each word's embedding hits the Q/K matrices and produces
              attention scores via these learned weights. A specific token like "Next.js" activates
              a narrow, precise set of weights. A vague token like "website" activates a broad,
              ambiguous set — because training data associated it with everything from WordPress
              to hand-coded HTML.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
