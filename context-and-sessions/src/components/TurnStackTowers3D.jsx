import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { C, CHUNK_COLORS, FONT_MONO, FONT_SANS } from '../lib/theme.js'

// ---- Data constants -----------------------------------------------------
const MAX_TURNS = 40
const TURN_TOKENS_MONO = 1800      // avg tokens added to the monolithic tower per turn
const CONSTRAINT_TOKENS = 480      // the fixed constraint size
const MONO_CONSTRAINT_TURN = 1     // constraint placed at turn 1
const AGENT_TOKENS = 3500          // each decomposed agent's total session size
const MAX_AGENTS = 10              // cap for visual scale
const CONSTRAINT_COLOR = '#FBBF24' // gold

// Shared token→height scale so the visual contrast between the tall mono tower
// and the short decomposed stacks is quantitatively fair. Tuned so turn-40
// monolithic height ~ 9 units (TURN_TOKENS_MONO * MAX_TURNS / SCALE = 72000/8000).
const SCALE = 8000
const MIN_LAYER_H = 0.05 // visible floor so sub-layers don't vanish at this scale

// Rough weighting of what a monolithic turn contributes. Later turns are noisier:
// tool outputs and history dominate once the session stretches.
function chunkForTurn(turn) {
  if (turn === MONO_CONSTRAINT_TURN) return 'user' // the original ask
  if (turn % 7 === 0) return 'system' // rare re-pin
  if (turn % 3 === 0) return 'tool'
  if (turn % 5 === 0) return 'attachment'
  if (turn % 2 === 0) return 'history'
  return 'history'
}

const AGENT_NAMES = ['DB', 'API', 'Auth', 'Pay', 'Cart', 'Search', 'Pages', 'Email', 'Tests', 'Deploy']

// ---- Canvas label sprite (same pattern as ContextAnatomyBars3D) ---------
function makeLabelSprite(text, colorHex, { fontSize = 18, w = 256, h = 64, bold = true, font = 'IBM Plex Mono, monospace' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext && canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = colorHex
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = String(text).split('\n')
    if (lines.length === 1) {
      ctx.fillText(lines[0], w / 2, h / 2)
    } else {
      const lh = fontSize * 1.25
      const total = lh * lines.length
      lines.forEach((ln, i) => {
        ctx.fillText(ln, w / 2, h / 2 - total / 2 + lh / 2 + i * lh)
      })
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  if (tex && THREE.LinearFilter !== undefined) tex.minFilter = THREE.LinearFilter
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 }))
}

// ---- Scene construction -------------------------------------------------
function buildScene(container) {
  const W = container.clientWidth || 900
  const H = container.clientHeight || 480
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1120)

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
  camera.position.set(0, 10, 18)
  camera.lookAt(0, 4, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2))
  container.appendChild(renderer.domElement)

  let controls = null
  if (typeof OrbitControls === 'function' && renderer.domElement && renderer.domElement.addEventListener) {
    try {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 4, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.enableZoom = true
      controls.minDistance = 8
      controls.maxDistance = 40
      controls.maxPolarAngle = Math.PI / 2 - 0.05
      controls.update()
    } catch {
      controls = null
    }
  }

  scene.add(new THREE.AmbientLight(0x334455, 0.85))
  const dir = new THREE.DirectionalLight(0xffeedd, 0.95)
  dir.position.set(8, 14, 10)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0x8899bb, 0.4)
  dir2.position.set(-10, 12, -6)
  scene.add(dir2)

  // Floor plane spanning both sides.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 12),
    new THREE.MeshPhongMaterial({ color: 0x131b2e, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.02
  scene.add(floor)

  // Vertical divider line between the two regions.
  {
    const mat = new THREE.LineBasicMaterial({ color: 0x1e2940, transparent: true, opacity: 0.6 })
    const pts = [new THREE.Vector3(-2, 0, -5), new THREE.Vector3(-2, 0, 5)]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat))
  }

  // ---- Monolithic tower: 40 pre-built layers (left region, x ≈ -6). -----
  const monoX = -6
  const monoLayerW = 1.4
  const monoLayers = [] // { mesh, turn, tokens, isConstraint }

  // Pre-compute vertical stacking, since all turns share the same geometry.
  let runningY = 0
  for (let t = 1; t <= MAX_TURNS; t++) {
    const isConstraintTurn = t === MONO_CONSTRAINT_TURN
    const chunk = chunkForTurn(t)
    const colorHex = isConstraintTurn ? CONSTRAINT_COLOR : (CHUNK_COLORS[chunk] || '#ffffff')
    // Turn 1 is the combined user ask + constraint; size = TURN_TOKENS_MONO (already includes ~480 constraint).
    const tokens = TURN_TOKENS_MONO
    const hRaw = Math.max(MIN_LAYER_H, tokens / SCALE)
    const geo = new THREE.BoxGeometry(monoLayerW, hRaw, monoLayerW)
    const color = new THREE.Color(colorHex)
    const emissive = color.clone().multiplyScalar(isConstraintTurn ? 0.6 : 0.2)
    const mat = new THREE.MeshPhongMaterial({
      color,
      emissive,
      transparent: true,
      opacity: isConstraintTurn ? 0.98 : 0.88,
      shininess: isConstraintTurn ? 90 : 50,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(monoX, runningY + hRaw / 2, 0)
    mesh.visible = false // revealed by the turn slider
    scene.add(mesh)
    monoLayers.push({ mesh, turn: t, tokens, isConstraint: isConstraintTurn, yTop: runningY + hRaw, yBot: runningY })
    runningY += hRaw
  }

  // Floating label above the monolithic tower.
  const monoLabel = makeLabelSprite('Vibe — Turn 1', '#e8c4b8', { fontSize: 20, w: 512, h: 128 })
  monoLabel.position.set(monoX, 11.2, 0)
  if (monoLabel.scale && monoLabel.scale.set) monoLabel.scale.set(6.5, 1.6, 1)
  scene.add(monoLabel)

  // Base label under the tower.
  const monoBaseLabel = makeLabelSprite('One long session', '#94A3B8', { fontSize: 16, w: 320, h: 48, bold: false })
  monoBaseLabel.position.set(monoX, -0.75, 0)
  if (monoBaseLabel.scale && monoBaseLabel.scale.set) monoBaseLabel.scale.set(3.6, 0.55, 1)
  scene.add(monoBaseLabel)

  // ---- Decomposed stacks (right region). --------------------------------
  // Per-agent: system (bottom), internal (middle), constraint/spec-slice (top).
  // Constraint rendered LAST so it always sits at the top — visually reachable.
  const decompStartX = 2
  const decompGapX = 1.8
  const agentStackW = 0.95
  const agents = [] // { group, meshes: [...], topMesh, idx, label, totalTokens, appearanceTurn }

  for (let i = 0; i < MAX_AGENTS; i++) {
    const x = decompStartX + i * decompGapX
    const appearanceTurn = Math.min(MAX_TURNS, 1 + i * 4)
    const internalTokens = AGENT_TOKENS - CONSTRAINT_TOKENS - 200 // system=200, constraint=480, internal≈2820
    const hSystem = Math.max(MIN_LAYER_H, 200 / SCALE)
    const hInternal = Math.max(MIN_LAYER_H, internalTokens / SCALE)
    const hConstraint = Math.max(MIN_LAYER_H, CONSTRAINT_TOKENS / SCALE)

    const meshes = []

    // System layer (purple-ish from CHUNK_COLORS.system).
    {
      const geo = new THREE.BoxGeometry(agentStackW, hSystem, agentStackW)
      const color = new THREE.Color(CHUNK_COLORS.system)
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.2),
        transparent: true,
        opacity: 0.85,
        shininess: 55,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, hSystem / 2, 0)
      mesh.visible = false
      scene.add(mesh)
      meshes.push(mesh)
    }
    // Internal / tool-output layer.
    {
      const geo = new THREE.BoxGeometry(agentStackW, hInternal, agentStackW)
      const color = new THREE.Color(CHUNK_COLORS.tool)
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.2),
        transparent: true,
        opacity: 0.85,
        shininess: 55,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, hSystem + hInternal / 2, 0)
      mesh.visible = false
      scene.add(mesh)
      meshes.push(mesh)
    }
    // Constraint / spec-slice (gold, top — always visually reachable).
    let topMesh
    {
      const geo = new THREE.BoxGeometry(agentStackW * 1.08, hConstraint, agentStackW * 1.08)
      const color = new THREE.Color(CONSTRAINT_COLOR)
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.6),
        transparent: true,
        opacity: 0.98,
        shininess: 90,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, hSystem + hInternal + hConstraint / 2, 0)
      mesh.visible = false
      scene.add(mesh)
      meshes.push(mesh)
      topMesh = mesh
    }

    // Per-agent label above its stack.
    const topY = hSystem + hInternal + hConstraint
    const label = makeLabelSprite(`${AGENT_NAMES[i]}\n${AGENT_TOKENS} tok`, '#e8c4b8', { fontSize: 16, w: 256, h: 80 })
    label.position.set(x, topY + 0.9, 0)
    if (label.scale && label.scale.set) label.scale.set(1.8, 0.7, 1)
    label.visible = false
    scene.add(label)

    agents.push({ meshes, topMesh, idx: i, label, totalTokens: AGENT_TOKENS, appearanceTurn })
  }

  // Section header for the decomposed region.
  const decompHeader = makeLabelSprite('Engineered — many agents, each scoped', '#e8c4b8', { fontSize: 18, w: 512, h: 64 })
  decompHeader.position.set(decompStartX + (MAX_AGENTS - 1) * decompGapX / 2, 11.2, 0)
  if (decompHeader.scale && decompHeader.scale.set) decompHeader.scale.set(7, 0.85, 1)
  scene.add(decompHeader)

  return {
    scene, camera, renderer, controls,
    monoLayers, monoLabel,
    agents,
  }
}

// ---- React component ---------------------------------------------------
export default function TurnStackTowers3D() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [turn, setTurn] = useState(1)
  const [playing, setPlaying] = useState(false)
  const playTimerRef = useRef(null)

  // Build scene once on mount.
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const s = buildScene(c)
    sceneRef.current = s

    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (s.controls) s.controls.update()
      s.renderer.render(s.scene, s.camera)
    }
    animate()

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      if (s.controls && typeof s.controls.dispose === 'function') {
        try { s.controls.dispose() } catch { /* noop */ }
      }
      try { s.renderer.dispose() } catch { /* noop */ }
      while (c.firstChild) c.removeChild(c.firstChild)
    }
  }, [])

  // Apply turn: show/hide mono layers and agents.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return

    // Monolithic tower: layers 1..turn visible.
    s.monoLayers.forEach((layer) => {
      layer.mesh.visible = layer.turn <= turn
    })

    // Decomposed agents: visible when appearanceTurn <= turn.
    s.agents.forEach((a) => {
      const visible = a.appearanceTurn <= turn
      a.meshes.forEach((m) => { m.visible = visible })
      a.label.visible = visible
    })

    // Update floating mono label.
    const monoTotal = turn * TURN_TOKENS_MONO
    const depth = turn - MONO_CONSTRAINT_TURN // layers above the constraint layer
    if (s.monoLabel && s.monoLabel.material && s.monoLabel.material.map) {
      // Rebuild label sprite cheaply: write a new CanvasTexture.
      const canvas = document.createElement('canvas')
      canvas.width = 512; canvas.height = 128
      const ctx = canvas.getContext && canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#e8c4b8'
        ctx.font = 'bold 20px IBM Plex Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lines = [
          `Vibe — Turn ${turn}`,
          `${monoTotal.toLocaleString()} tok accumulated`,
          `Constraint buried at depth: ${Math.max(0, depth)} layers`,
        ]
        const lh = 26
        const total = lh * lines.length
        lines.forEach((ln, i) => {
          ctx.fillText(ln, canvas.width / 2, canvas.height / 2 - total / 2 + lh / 2 + i * lh)
        })
      }
      const tex = new THREE.CanvasTexture(canvas)
      if (tex && THREE.LinearFilter !== undefined) tex.minFilter = THREE.LinearFilter
      // Swap the texture; dispose old one to prevent leaks.
      const oldMap = s.monoLabel.material.map
      s.monoLabel.material.map = tex
      s.monoLabel.material.needsUpdate = true
      if (oldMap && typeof oldMap.dispose === 'function') {
        try { oldMap.dispose() } catch { /* noop */ }
      }
    }
  }, [turn])

  // Play-button animation: step from current turn → MAX_TURNS over ~8s.
  const handlePlay = useCallback(() => {
    if (playing) return
    setPlaying(true)
    setTurn(1)
    const totalMs = 8000
    const stepMs = totalMs / MAX_TURNS
    let current = 1
    playTimerRef.current = setInterval(() => {
      current += 1
      if (current >= MAX_TURNS) {
        setTurn(MAX_TURNS)
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
        setPlaying(false)
      } else {
        setTurn(current)
      }
    }, stepMs)
  }, [playing])

  // Clean up play interval on unmount.
  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [])

  // ---- Derived stats for the readouts. ---------------------------------
  const monoTotal = turn * TURN_TOKENS_MONO
  const towerHeightApprox = (turn * TURN_TOKENS_MONO / SCALE).toFixed(1)
  const constraintDepth = Math.max(0, turn - MONO_CONSTRAINT_TURN)
  const visibleAgents = Math.min(MAX_AGENTS, Math.max(1, Math.floor(turn / 4) + 1))
  const decompTotal = visibleAgents * AGENT_TOKENS
  const avgStackHeight = (AGENT_TOKENS / SCALE).toFixed(2)

  const btnStyle = (disabled) => ({
    padding: '8px 16px',
    fontSize: 12,
    fontFamily: FONT_MONO,
    fontWeight: 600,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.18)',
    border: disabled ? `1px solid ${C.border}` : `1px solid ${C.accent}`,
    borderRadius: 6,
    color: disabled ? C.textFaint : C.accent,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: 0.3,
  })

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: FONT_SANS, padding: '20px 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 }}>
          Turn Stack Towers — 3D
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
          One tall tower vs. many short stacks
        </h2>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 16px', maxWidth: 820, lineHeight: 1.5 }}>
          Same 40 turns of work, two fates. On the left, a single monolithic session stacks every turn
          on top of the last — the gold constraint layer sits near the base, getting buried. On the right,
          decomposed agents grow in width, not height: each agent&rsquo;s constraint lives at the top of its
          own short stack, always within the recency window.
        </p>

        {/* 3D canvas */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 480,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            background: C.bg,
          }}
        />

        {/* Slider + Play */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontFamily: FONT_MONO, color: C.textDim, minWidth: 80 }}>
            Turn: <strong style={{ color: C.text }}>{turn}</strong> / {MAX_TURNS}
          </label>
          <input
            data-testid="turn-slider"
            type="range"
            min={1}
            max={MAX_TURNS}
            step={1}
            value={turn}
            onChange={(e) => setTurn(Number(e.target.value))}
            disabled={playing}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            data-testid="play-btn"
            onClick={handlePlay}
            disabled={playing}
            style={btnStyle(playing)}
          >
            {playing ? 'Playing…' : 'Play ▶'}
          </button>
        </div>

        {/* Summary readouts */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12, fontFamily: FONT_MONO, fontSize: 12 }}>
          <div style={{ color: C.textDim }}>
            <span style={{ color: C.red }}>Vibe</span> total: <strong style={{ color: C.text }}>{monoTotal.toLocaleString()}</strong> tok
            {' • '}tower height: <strong style={{ color: C.text }}>{towerHeightApprox}</strong>
            {' • '}constraint depth: <strong style={{ color: CONSTRAINT_COLOR }}>{constraintDepth}</strong> layers
          </div>
          <div style={{ color: C.textDim }}>
            <span style={{ color: C.green }}>Engineered</span> total: <strong style={{ color: C.text }}>{decompTotal.toLocaleString()}</strong> tok across <strong style={{ color: C.text }}>{visibleAgents}</strong> agents
            {' • '}avg stack: <strong style={{ color: C.text }}>{avgStackHeight}</strong>
          </div>
        </div>

        {/* Caption strip */}
        <div
          data-testid="towers-caption"
          style={{
            fontSize: 12,
            fontFamily: FONT_MONO,
            color: C.textFaint,
            textAlign: 'center',
            marginTop: 14,
            lineHeight: 1.5,
          }}
        >
          At turn 1 both sides hold the same constraint. By turn 40 the vibe tower is 30+ layers
          tall and the constraint sits near the base — far from the model&rsquo;s recency window. The
          engineered side grew in width, not height: each agent&rsquo;s constraint stays near the top.
        </div>
      </div>
    </div>
  )
}
