import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { C, FONT_MONO, FONT_SANS } from '../lib/theme.js'

// ---- Data constants -----------------------------------------------------
const MAX_TURNS = 20
const TARGET_RADIUS = 1.0    // green sphere — "task-aligned" zone
const DRIFT_RADIUS  = 2.4    // yellow shell — drift detected past here
const DANGER_RADIUS = 4.0    // red shell — irrecoverable per the paper
const CHECKPOINT_INTERVAL = 4 // summarize every N turns when summarization is on
const RNG_SEED = 0xc0ffee     // deterministic so the path is reproducible

const CHECKPOINT_COLOR = '#FBBF24' // gold (matches CONSTRAINT_COLOR pattern)
const CHECKPOINT_PATH_COLOR = '#22C55E' // green (with checkpoints)
const DRIFT_PATH_COLOR = '#EF4444' // red (without checkpoints)

// Tiny PRNG so the trajectory is the same every render.
function mulberry32(seed) {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6D2B79F5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Pre-compute a deterministic trajectory of length MAX_TURNS.
// Both share the same drift impulses; checkpoints simply dampen accumulated
// error every CHECKPOINT_INTERVAL turns.
function buildTrajectories() {
  const rand = mulberry32(RNG_SEED)
  const impulses = []
  for (let i = 0; i < MAX_TURNS; i++) {
    // Each turn drifts in a biased random direction; bias grows with turn
    // (premature assumptions compound).
    const bias = 0.05 + i * 0.03
    const r = () => (rand() - 0.5) * 0.8 + bias * (rand() < 0.6 ? 1 : -0.3)
    impulses.push(new THREE.Vector3(r(), r(), r()))
  }

  const without = []
  let pos = new THREE.Vector3(0, 0, 0)
  for (let i = 0; i < MAX_TURNS; i++) {
    pos = pos.clone().add(impulses[i])
    without.push(pos.clone())
  }

  // Same impulses, but every CHECKPOINT_INTERVAL turns the checkpoint pulls
  // position 55% back toward the last checkpoint. Even between checkpoints,
  // the summarize-on path takes only 60% of each impulse — summary pre-empts
  // assumptions before they compound.
  const withChk = []
  const checkpointTurns = []
  let cur = new THREE.Vector3(0, 0, 0)
  let lastChk = new THREE.Vector3(0, 0, 0)
  for (let i = 0; i < MAX_TURNS; i++) {
    cur = cur.clone().add(impulses[i].clone().multiplyScalar(0.6))
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      // Snap back partway toward last checkpoint, then save.
      cur.lerp(lastChk, 0.55)
      lastChk = cur.clone()
      checkpointTurns.push(i)
    }
    withChk.push(cur.clone())
  }
  return { without, withChk, checkpointTurns }
}

// ---- Canvas label sprite (same pattern as TurnStackTowers3D) ------------
function makeLabelSprite(text, colorHex, { fontSize = 18, w = 256, h = 64, bold = true, font = "'IBM Plex Mono', monospace" } = {}) {
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
function buildScene(container, trajectories) {
  const W = container.clientWidth || 900
  const H = container.clientHeight || 480
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1120)

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
  camera.position.set(6, 6, 9)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2))
  container.appendChild(renderer.domElement)

  let controls = null
  if (typeof OrbitControls === 'function' && renderer.domElement && renderer.domElement.addEventListener) {
    try {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.enableZoom = true
      controls.minDistance = 4
      controls.maxDistance = 30
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

  // ---- Floor grid for spatial reference --------------------------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14, 14, 14),
    new THREE.MeshPhongMaterial({ color: 0x131b2e, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -DANGER_RADIUS - 0.05
  scene.add(floor)

  // Faint grid lines on the floor.
  {
    const mat = new THREE.LineBasicMaterial({ color: 0x1e2940, transparent: true, opacity: 0.5 })
    const gridSize = 14
    const gridStep = 1
    const halfG = gridSize / 2
    for (let g = -halfG; g <= halfG; g += gridStep) {
      const ptsX = [new THREE.Vector3(-halfG, -DANGER_RADIUS - 0.04, g), new THREE.Vector3(halfG, -DANGER_RADIUS - 0.04, g)]
      const ptsZ = [new THREE.Vector3(g, -DANGER_RADIUS - 0.04, -halfG), new THREE.Vector3(g, -DANGER_RADIUS - 0.04, halfG)]
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsX), mat))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsZ), mat))
    }
  }

  // ---- Concentric zone shells -----------------------------------------
  // Target (green, translucent solid).
  const targetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(TARGET_RADIUS, 32, 24),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color(C.green),
      emissive: new THREE.Color(C.green).clone().multiplyScalar(0.3),
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    })
  )
  scene.add(targetMesh)

  // Drift threshold (yellow, wireframe).
  const driftMesh = new THREE.Mesh(
    new THREE.SphereGeometry(DRIFT_RADIUS, 24, 18),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.yellow),
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    })
  )
  scene.add(driftMesh)

  // Danger (red, wireframe).
  const dangerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(DANGER_RADIUS, 24, 18),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.red),
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    })
  )
  scene.add(dangerMesh)

  // Origin marker (small dot at the task center).
  {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    m.position.set(0, 0, 0)
    scene.add(m)
  }

  // ---- Two trajectory lines (revealed by turn slider) -----------------
  // We pre-compute geometry buffers and update via setDrawRange + position
  // attribute on each turn change.
  const buildLine = (points, colorHex, opacity = 0.95) => {
    const positions = new Float32Array(points.length * 3)
    points.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
    })
    const geom = new THREE.BufferGeometry()
    geom.setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity,
      linewidth: 2,
    })
    return new THREE.Line(geom, mat)
  }

  const lineWith = buildLine(trajectories.withChk, CHECKPOINT_PATH_COLOR, 0.95)
  scene.add(lineWith)
  const lineWithout = buildLine(trajectories.without, DRIFT_PATH_COLOR, 0.95)
  scene.add(lineWithout)

  // ---- Per-turn dot markers along each path ---------------------------
  // (small spheres so the path reads turn-by-turn).
  const buildDots = (points, colorHex, radius = 0.07) => {
    const dots = []
    points.forEach((p) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 10, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) })
      )
      m.position.set(p.x, p.y, p.z)
      m.visible = false
      scene.add(m)
      dots.push(m)
    })
    return dots
  }
  const dotsWith = buildDots(trajectories.withChk, CHECKPOINT_PATH_COLOR, 0.07)
  const dotsWithout = buildDots(trajectories.without, DRIFT_PATH_COLOR, 0.07)

  // ---- Gold checkpoint spheres along the with-checkpoints path --------
  const checkpointMeshes = []
  trajectories.checkpointTurns.forEach((turnIdx) => {
    const p = trajectories.withChk[turnIdx]
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(CHECKPOINT_COLOR),
        emissive: new THREE.Color(CHECKPOINT_COLOR).clone().multiplyScalar(0.5),
        shininess: 90,
      })
    )
    m.position.set(p.x, p.y, p.z)
    m.visible = false
    scene.add(m)
    checkpointMeshes.push({ mesh: m, turnIdx })
  })

  // ---- Brighter "current head" markers --------------------------------
  const headWith = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color(CHECKPOINT_PATH_COLOR),
      emissive: new THREE.Color(CHECKPOINT_PATH_COLOR).clone().multiplyScalar(0.7),
      shininess: 90,
    })
  )
  scene.add(headWith)

  const headWithout = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color(DRIFT_PATH_COLOR),
      emissive: new THREE.Color(DRIFT_PATH_COLOR).clone().multiplyScalar(0.7),
      shininess: 90,
    })
  )
  scene.add(headWithout)

  // ---- Floating zone labels -------------------------------------------
  const targetLabel = makeLabelSprite('On track', C.green, { fontSize: 14, w: 192, h: 40, bold: false })
  targetLabel.position.set(0, TARGET_RADIUS + 0.4, 0)
  if (targetLabel.scale && targetLabel.scale.set) targetLabel.scale.set(1.6, 0.4, 1)
  scene.add(targetLabel)

  const driftLabel = makeLabelSprite('Drifting', C.yellow, { fontSize: 14, w: 192, h: 40, bold: false })
  driftLabel.position.set(DRIFT_RADIUS - 0.1, DRIFT_RADIUS - 0.2, 0)
  if (driftLabel.scale && driftLabel.scale.set) driftLabel.scale.set(1.6, 0.4, 1)
  scene.add(driftLabel)

  const dangerLabel = makeLabelSprite('Past recovery', C.red, { fontSize: 14, w: 256, h: 40, bold: false })
  dangerLabel.position.set(DANGER_RADIUS - 0.2, DANGER_RADIUS - 0.3, 0)
  if (dangerLabel.scale && dangerLabel.scale.set) dangerLabel.scale.set(2.0, 0.4, 1)
  scene.add(dangerLabel)

  return {
    scene, camera, renderer, controls,
    lineWith, lineWithout,
    dotsWith, dotsWithout,
    checkpointMeshes,
    headWith, headWithout,
    targetMesh, driftMesh, dangerMesh,
    targetLabel, driftLabel, dangerLabel,
    trajectories,
  }
}

// ---- Apply a sliced point list to a Line's BufferGeometry --------------
function updateLinePoints(line, points) {
  if (!line || !line.geometry) return
  // Rebuild via setFromPoints if fewer than MAX points are visible.
  try {
    const geom = new THREE.BufferGeometry().setFromPoints(points)
    if (line.geometry.dispose) line.geometry.dispose()
    line.geometry = geom
  } catch {
    /* mocked test env — noop */
  }
}

// ---- React component ---------------------------------------------------
export default function ConversationDriftPath3D() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [turn, setTurn] = useState(8)
  const [summarizationOn, setSummarizationOn] = useState(true)
  // Nuclear restart effectively clamps the visible head back to the last
  // checkpoint reached at the time of the click.
  const [nukeTurn, setNukeTurn] = useState(null)

  // Memoize the trajectory once so the scene + readouts agree.
  const trajectories = useMemo(() => buildTrajectories(), [])

  // Build scene once.
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const s = buildScene(c, trajectories)
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
  }, [trajectories])

  // Resolve the effective turn for the active path after a nuclear restart.
  const effectiveTurn = useMemo(() => {
    if (nukeTurn == null) return turn
    return Math.min(turn, nukeTurn)
  }, [turn, nukeTurn])

  // Apply turn + summarization toggle to the scene.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return

    // Reveal first N points of each line.
    const nWith = effectiveTurn
    const nWithout = turn

    const ptsWith = s.trajectories.withChk.slice(0, Math.max(1, nWith))
    const ptsWithout = s.trajectories.without.slice(0, Math.max(1, nWithout))
    updateLinePoints(s.lineWith, ptsWith)
    updateLinePoints(s.lineWithout, ptsWithout)

    // Summarization-off hides the green path entirely (and its checkpoints).
    if (s.lineWith && s.lineWith.material) {
      s.lineWith.material.opacity = summarizationOn ? 0.95 : 0.0
      s.lineWith.material.transparent = true
      s.lineWith.material.needsUpdate = true
    }
    if (s.lineWith) s.lineWith.visible = summarizationOn

    // Per-turn dots.
    s.dotsWith.forEach((m, i) => { m.visible = summarizationOn && i < nWith })
    s.dotsWithout.forEach((m, i) => { m.visible = i < nWithout })

    // Gold checkpoints visible only when summarization on AND turn passed.
    s.checkpointMeshes.forEach(({ mesh, turnIdx }) => {
      mesh.visible = summarizationOn && turnIdx < nWith
    })

    // Heads.
    if (s.headWith) {
      const p = s.trajectories.withChk[Math.max(0, nWith - 1)]
      if (p && s.headWith.position && s.headWith.position.set) {
        s.headWith.position.set(p.x, p.y, p.z)
      }
      s.headWith.visible = summarizationOn
    }
    if (s.headWithout) {
      const p = s.trajectories.without[Math.max(0, nWithout - 1)]
      if (p && s.headWithout.position && s.headWithout.position.set) {
        s.headWithout.position.set(p.x, p.y, p.z)
      }
    }
  }, [effectiveTurn, turn, summarizationOn])

  // Number of checkpoints REACHED so far on the active (with-checkpoints) path
  // up to effectiveTurn (post-nuke). Used to enable/disable the nuke button
  // and to display the live count.
  const checkpointsReached = useMemo(() => {
    if (!summarizationOn) return 0
    return trajectories.checkpointTurns.filter((t) => t < effectiveTurn).length
  }, [trajectories, effectiveTurn, summarizationOn])

  // Distance from origin for the visible head of the active path.
  const activeHead = summarizationOn
    ? trajectories.withChk[Math.max(0, effectiveTurn - 1)]
    : trajectories.without[Math.max(0, turn - 1)]
  const activeDist = activeHead ? Math.hypot(activeHead.x, activeHead.y, activeHead.z) : 0

  let status = 'On track'
  let statusColor = C.green
  if (activeDist >= DANGER_RADIUS) { status = 'Past recovery'; statusColor = C.red }
  else if (activeDist >= DRIFT_RADIUS) { status = 'Lost'; statusColor = C.red }
  else if (activeDist >= TARGET_RADIUS) { status = 'Drifting'; statusColor = C.yellow }

  // Distance from origin on the no-summarize path (always shown for contrast).
  const noSumHead = trajectories.without[Math.max(0, turn - 1)]
  const noSumDist = noSumHead ? Math.hypot(noSumHead.x, noSumHead.y, noSumHead.z) : 0

  // ---- Nuclear restart action ------------------------------------------
  const handleNuke = () => {
    if (!summarizationOn) return
    // Snap to the most recent checkpoint reached so far.
    const reached = trajectories.checkpointTurns.filter((t) => t < turn)
    if (reached.length === 0) return // disabled state covers this; defensive
    const lastChkTurnIdx = reached[reached.length - 1]
    // +1 because checkpointTurns stores the i-th index (0-based); we display
    // the head for "turn = checkpointTurnIdx + 1".
    setNukeTurn(lastChkTurnIdx + 1)
  }

  const nukeDisabled = !summarizationOn ||
    trajectories.checkpointTurns.filter((t) => t < turn).length === 0

  // Slider handler — also clears any pending nuclear-restart clamp once the
  // slider moves below it (so the user can keep exploring).
  const handleTurnChange = (e) => {
    const next = Number(e.target.value)
    setTurn(next)
    if (nukeTurn != null && next < nukeTurn) setNukeTurn(null)
  }

  // Toggle handler — flipping summarization clears any active nuke clamp.
  const handleSummarizeToggle = () => {
    setSummarizationOn((s) => !s)
    setNukeTurn(null)
  }

  // ---- UI styles --------------------------------------------------------
  const btnStyle = (disabled, accent = C.red) => ({
    padding: '8px 16px',
    fontSize: 12,
    fontFamily: FONT_MONO,
    fontWeight: 600,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.18)',
    border: disabled ? `1px solid ${C.border}` : `1px solid ${accent}`,
    borderRadius: 6,
    color: disabled ? C.textFaint : accent,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: 0.3,
  })

  const toggleStyle = (on) => ({
    padding: '8px 14px',
    fontSize: 12,
    fontFamily: FONT_MONO,
    fontWeight: 600,
    background: on ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${on ? C.green : C.border}`,
    borderRadius: 6,
    color: on ? C.green : C.textDim,
    cursor: 'pointer',
    letterSpacing: 0.3,
  })

  const statusPill = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontFamily: FONT_MONO,
    fontWeight: 700,
    color: statusColor,
    background: `${statusColor}22`,
    border: `1px solid ${statusColor}55`,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: FONT_SANS, padding: '20px 28px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 }}>
          Multi-Turn Drift — 3D
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
          When LLMs take a wrong turn, they get lost — and don&rsquo;t recover
        </h2>
        <div style={{ marginBottom: 10, fontSize: 12, color: C.textDim, fontFamily: FONT_MONO }}>
          Based on{' '}
          <a
            href="https://arxiv.org/abs/2505.06120"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.accent, textDecoration: 'none', borderBottom: `1px dashed ${C.accent}55` }}
          >
            Laban et al. 2025 — &ldquo;LLMs Get Lost in Multi-Turn Conversation&rdquo;
          </a>
          &nbsp;&middot; 39% avg performance drop in multi-turn vs. single-turn settings.
        </div>

        {/* Two-column layout: canvas + side panel */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
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

          {/* Side panel — best-practice notes */}
          <aside style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.55,
          }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: C.green, fontFamily: FONT_MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                Going right?
              </div>
              <div style={{ color: C.textDim }}>
                <strong style={{ color: C.text }}>Summarize / recap.</strong>{' '}
                Each checkpoint preserves the conversation&rsquo;s trajectory and pulls drift back
                toward the task. Costs ~200 tokens; saves your session.
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: C.red, fontFamily: FONT_MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                Drift detected?
              </div>
              <div style={{ color: C.textDim }}>
                <strong style={{ color: C.text }}>Nuclear option.</strong>{' '}
                Restart from your last <code style={{ color: CHECKPOINT_COLOR }}>MEMORY.md</code>{' '}
                checkpoint. The paper is empirical: once a conversation is past the drift threshold,
                the model does not recover on its own.
              </div>
            </div>
            <div>
              <div style={{ color: C.yellow, fontFamily: FONT_MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                No checkpoints?
              </div>
              <div style={{ color: C.textDim }}>
                <strong style={{ color: C.text }}>You have nothing to restart from.</strong>{' '}
                Set the practice early — every scoped task should land its decisions in{' '}
                <code style={{ color: CHECKPOINT_COLOR }}>MEMORY.md</code> before continuing.
              </div>
            </div>
          </aside>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontFamily: FONT_MONO, color: C.textDim, minWidth: 100 }}>
            Turn: <strong style={{ color: C.text }}>{turn}</strong> / {MAX_TURNS}
          </label>
          <input
            data-testid="turn-slider"
            type="range"
            min={1}
            max={MAX_TURNS}
            step={1}
            value={turn}
            onChange={handleTurnChange}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            data-testid="summarize-toggle"
            onClick={handleSummarizeToggle}
            style={toggleStyle(summarizationOn)}
          >
            Summarize: {summarizationOn ? 'ON' : 'OFF'}
          </button>
          <button
            data-testid="nuke-btn"
            onClick={handleNuke}
            disabled={nukeDisabled}
            style={btnStyle(nukeDisabled, C.red)}
          >
            Nuclear Restart
          </button>
        </div>

        {/* Live readout strip */}
        <div style={{
          display: 'flex', gap: 18, flexWrap: 'wrap',
          marginTop: 12, fontFamily: FONT_MONO, fontSize: 12, color: C.textDim,
          alignItems: 'center',
        }}>
          <div>
            Status: <span style={statusPill}>{status}</span>
          </div>
          <div>
            Active head distance:{' '}
            <strong style={{ color: C.text }}>{activeDist.toFixed(2)}</strong>
            {' '}/ target {TARGET_RADIUS} · drift {DRIFT_RADIUS} · danger {DANGER_RADIUS}
          </div>
          <div>
            <span style={{ color: C.red }}>No-summarize</span> distance:{' '}
            <strong style={{ color: C.text }}>{noSumDist.toFixed(2)}</strong>
          </div>
          {summarizationOn && (
            <div>
              Checkpoints reached:{' '}
              <strong style={{ color: CHECKPOINT_COLOR }}>{checkpointsReached}</strong>
            </div>
          )}
          {nukeTurn != null && (
            <div style={{ color: C.red }}>
              Restored to turn <strong style={{ color: CHECKPOINT_COLOR }}>{nukeTurn}</strong>
            </div>
          )}
        </div>

        {/* Caption strip */}
        <div
          style={{
            fontSize: 12,
            fontFamily: FONT_MONO,
            color: C.textFaint,
            textAlign: 'center',
            marginTop: 14,
            lineHeight: 1.55,
          }}
        >
          The red trajectory takes every drift impulse on the chin and keeps walking — past the
          yellow drift shell, then past the red danger shell. The green trajectory takes the same
          impulses but every {CHECKPOINT_INTERVAL} turns a gold checkpoint pulls it back toward the
          last saved trajectory. Same conversation; one of them keeps the task in view.
        </div>
      </div>
    </div>
  )
}
