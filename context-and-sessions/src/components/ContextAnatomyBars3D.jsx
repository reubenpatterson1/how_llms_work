import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { C, CHUNK_COLORS, FONT_MONO, FONT_SANS } from '../lib/theme.js'
import { tokenAnalogShort } from '../lib/token-analogs.js'
import profileData from '../data/prompt-profiles.json'

const CHUNKS = profileData.chunks // 6 rows, z axis
const TURNS = profileData.turns   // 4 columns, x axis
const CONSTRAINT = profileData.constraint
const MAX_BAR_H = 6 // a 100% bar would be 6 units tall
const CONSTRAINT_COLOR = '#FBBF24'
const CONSTRAINT_MIN_H = 0.15 // always-visible floor so 1% at turn 20 is still a sliver

function makeLabelSprite(text, colorHex, { fontSize = 18, w = 256, h = 64, bold = true, font = 'IBM Plex Mono, monospace' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext && canvas.getContext('2d')
  // In jsdom, getContext('2d') returns null — skip drawing, still return a sprite so the scene graph stays intact.
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
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 }))
}

function buildScene(container) {
  const W = container.clientWidth || 900
  const H = container.clientHeight || 460
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1120)
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200)
  // Elevated 3/4 view; user can orbit, zoom, and pan.
  camera.position.set(11, 10, 14)
  camera.lookAt(0, 2, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2))
  container.appendChild(renderer.domElement)

  let controls = null
  if (typeof OrbitControls === 'function' && renderer.domElement && renderer.domElement.addEventListener) {
    try {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 2, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.enableZoom = true
      controls.minDistance = 6
      controls.maxDistance = 40
      controls.maxPolarAngle = Math.PI / 2 - 0.05  // don't let camera dip below the floor
      controls.update()
    } catch {
      controls = null
    }
  }

  scene.add(new THREE.AmbientLight(0x334455, 0.8))
  const dir = new THREE.DirectionalLight(0xffeedd, 0.95)
  dir.position.set(10, 15, 10)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0x8899bb, 0.4)
  dir2.position.set(-8, 10, -5)
  scene.add(dir2)

  const numX = TURNS.length
  const numZ = CHUNKS.length
  const barW = 0.7
  const gapX = 2.2
  const gapZ = 1.2
  const totalX = (numX - 1) * gapX
  const totalZ = (numZ - 1) * gapZ
  // Place the constraint bar one extra row in FRONT of the chunk grid (positive Z side).
  const constraintZ = totalZ / 2 + gapZ

  const bars = [] // { mesh, turnKey, chunk }
  const constraintBars = [] // { mesh, turnKey, baseEmissive }
  const colHeaderSprites = [] // per-column header sprites for dimming
  const colConstraintSprites = [] // per-column constraint% sprites for dimming

  // Floor — extend slightly in +Z to cover the new constraint row.
  const floorGeo = new THREE.PlaneGeometry(totalX + 5, totalZ + 6)
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x131b2e, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.02
  floor.position.z = gapZ / 2
  scene.add(floor)

  // Subtle gridlines per row/column.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1e2940, transparent: true, opacity: 0.55 })
  for (let i = 0; i < numX; i++) {
    const x = i * gapX - totalX / 2
    const pts = [
      new THREE.Vector3(x, 0, -totalZ / 2 - 1),
      new THREE.Vector3(x, 0, constraintZ + 1),
    ]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
  }
  for (let j = 0; j < numZ; j++) {
    const z = j * gapZ - totalZ / 2
    const pts = [
      new THREE.Vector3(-totalX / 2 - 1.5, 0, z),
      new THREE.Vector3(totalX / 2 + 1.5, 0, z),
    ]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
  }
  // Gridline marking the constraint row in front.
  {
    const pts = [
      new THREE.Vector3(-totalX / 2 - 1.5, 0, constraintZ),
      new THREE.Vector3(totalX / 2 + 1.5, 0, constraintZ),
    ]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
  }

  // Chunk bars
  TURNS.forEach((turn, xi) => {
    CHUNKS.forEach((chunk, zi) => {
      const pct = turn.breakdown[chunk] || 0
      const frac = pct / 100
      const hRaw = Math.max(0.02, frac * MAX_BAR_H)
      const geo = new THREE.BoxGeometry(barW, hRaw, barW)
      const colorHex = CHUNK_COLORS[chunk] || '#ffffff'
      const color = new THREE.Color(colorHex)
      const emissive = color.clone().multiplyScalar(Math.min(0.5, frac * 0.55))
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive,
        transparent: true,
        opacity: Math.max(0.35, Math.min(1, 0.35 + frac * 0.75)),
        shininess: 55,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(xi * gapX - totalX / 2, hRaw / 2, zi * gapZ - totalZ / 2)
      scene.add(mesh)
      bars.push({ mesh, turnKey: turn.key, chunk, baseOpacity: mat.opacity })
    })
  })

  // Gold constraint bars — rendered in front of each column's chunk row.
  TURNS.forEach((turn, xi) => {
    const share = Number(turn.constraintShare) || 0
    const frac = share / 100
    // Enforce a minimum visible height so the "buried" 1% case still reads as a sliver.
    const hRaw = Math.max(CONSTRAINT_MIN_H, frac * MAX_BAR_H)
    const geo = new THREE.BoxGeometry(barW * 1.1, hRaw, barW * 1.1)
    const color = new THREE.Color(CONSTRAINT_COLOR)
    const emissive = color.clone().multiplyScalar(0.6)
    const mat = new THREE.MeshPhongMaterial({
      color,
      emissive,
      transparent: true,
      opacity: 0.95,
      shininess: 90,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(xi * gapX - totalX / 2, hRaw / 2, constraintZ)
    scene.add(mesh)
    constraintBars.push({ mesh, turnKey: turn.key, baseOpacity: 0.95 })
  })

  // Column header sprites (turn label + total tokens + analog) with blurb subtitle.
  TURNS.forEach((turn, xi) => {
    const analog = tokenAnalogShort(turn.totalTokens)
    const tokenStr = turn.totalTokens.toLocaleString()
    const headerText = `${turn.label}\n${tokenStr} tok ${analog}`
    const sprite = makeLabelSprite(headerText, '#e8c4b8', { fontSize: 18, w: 384, h: 96 })
    sprite.position.set(xi * gapX - totalX / 2, MAX_BAR_H + 2.1, -totalZ / 2 - 0.6)
    if (sprite.scale && sprite.scale.set) sprite.scale.set(4.4, 1.1, 1)
    scene.add(sprite)
    colHeaderSprites.push({ sprite, turnKey: turn.key, baseOpacity: 0.9 })

    // Subtitle: blurb, one line below header, faint text.
    const subSprite = makeLabelSprite(turn.blurb || '', '#94A3B8', { fontSize: 14, w: 512, h: 48, bold: false })
    subSprite.position.set(xi * gapX - totalX / 2, MAX_BAR_H + 1.3, -totalZ / 2 - 0.6)
    if (subSprite.scale && subSprite.scale.set) subSprite.scale.set(5.0, 0.55, 1)
    scene.add(subSprite)
    colHeaderSprites.push({ sprite: subSprite, turnKey: turn.key, baseOpacity: 0.8 })

    // Constraint label below header: "Constraint: N% (480 tok)".
    const cPct = Number(turn.constraintShare) || 0
    const cText = `Constraint: ${cPct}% (${CONSTRAINT.tokens} tok)`
    const cSprite = makeLabelSprite(cText, CONSTRAINT_COLOR, { fontSize: 16, w: 384, h: 48 })
    cSprite.position.set(xi * gapX - totalX / 2, MAX_BAR_H + 0.55, -totalZ / 2 - 0.6)
    if (cSprite.scale && cSprite.scale.set) cSprite.scale.set(4.0, 0.55, 1)
    scene.add(cSprite)
    colConstraintSprites.push({ sprite: cSprite, turnKey: turn.key, baseOpacity: 0.95 })
  })

  // X-axis turn-key labels on the floor (front).
  TURNS.forEach((turn, xi) => {
    const sprite = makeLabelSprite(turn.key, '#9fb4d0', { fontSize: 18, w: 256, h: 64 })
    sprite.position.set(xi * gapX - totalX / 2, -0.3, constraintZ + 1.2)
    if (sprite.scale && sprite.scale.set) sprite.scale.set(2.4, 0.6, 1)
    scene.add(sprite)
  })

  // Z-axis chunk labels (left side), colored per chunk.
  CHUNKS.forEach((chunk, zi) => {
    const hex = CHUNK_COLORS[chunk] || '#ffffff'
    const sprite = makeLabelSprite(chunk, hex, { fontSize: 18, w: 256, h: 64 })
    sprite.position.set(-totalX / 2 - 2.4, -0.3, zi * gapZ - totalZ / 2)
    if (sprite.scale && sprite.scale.set) sprite.scale.set(2.4, 0.6, 1)
    scene.add(sprite)
  })

  // Constraint-row label on the left, gold.
  {
    const sprite = makeLabelSprite('constraint', CONSTRAINT_COLOR, { fontSize: 18, w: 256, h: 64 })
    sprite.position.set(-totalX / 2 - 2.4, -0.3, constraintZ)
    if (sprite.scale && sprite.scale.set) sprite.scale.set(2.6, 0.6, 1)
    scene.add(sprite)
  }

  return { scene, camera, renderer, controls, bars, constraintBars, colHeaderSprites, colConstraintSprites }
}

export default function ContextAnatomyBars3D() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [highlight, setHighlight] = useState('all') // 'all' | turn.key

  const rebuild = useCallback(() => {
    const c = containerRef.current
    if (!c) return
    if (sceneRef.current) {
      try { sceneRef.current.renderer.dispose() } catch { /* noop */ }
      while (c.firstChild) c.removeChild(c.firstChild)
    }
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
    }
  }, [])

  useEffect(() => {
    const cleanup = rebuild()
    return () => { if (cleanup) cleanup() }
  }, [rebuild])

  // Apply highlight by mutating opacity — no scene rebuild.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.bars.forEach((b) => {
      const mat = b.mesh.material
      if (!mat) return
      if (highlight === 'all' || highlight === b.turnKey) {
        mat.opacity = b.baseOpacity
      } else {
        mat.opacity = 0.15
      }
    })
    s.constraintBars.forEach((b) => {
      const mat = b.mesh.material
      if (!mat) return
      if (highlight === 'all' || highlight === b.turnKey) {
        mat.opacity = b.baseOpacity
      } else {
        mat.opacity = 0.18
      }
    })
    s.colHeaderSprites.forEach((h) => {
      const mat = h.sprite.material
      if (!mat) return
      if (highlight === 'all' || highlight === h.turnKey) {
        mat.opacity = h.baseOpacity
      } else {
        mat.opacity = 0.2
      }
    })
    s.colConstraintSprites.forEach((h) => {
      const mat = h.sprite.material
      if (!mat) return
      if (highlight === 'all' || highlight === h.turnKey) {
        mat.opacity = h.baseOpacity
      } else {
        mat.opacity = 0.2
      }
    })
  }, [highlight])

  const btnStyle = (active) => ({
    padding: '8px 14px',
    fontSize: 12,
    fontFamily: FONT_MONO,
    fontWeight: active ? 700 : 500,
    background: active ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.03)',
    border: active ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
    borderRadius: 6,
    color: active ? C.accent : C.textDim,
    cursor: 'pointer',
    letterSpacing: 0.3,
  })

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: FONT_SANS, padding: '20px 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 }}>
          Context Anatomy — 3D
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
          One session, four moments
        </h2>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 16px', maxWidth: 760, lineHeight: 1.5 }}>
          Each column is a snapshot of the same session at turn 1, 2, 10, and 20. A single {CONSTRAINT.tokens}-token
          hard constraint is placed at turn 1 and never restated — the gold bar in front of each column shows its
          shrinking share of the context window as history, tool outputs, and attachments pile up behind it.
        </p>

        {/* Chunk legend + constraint swatch */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          {CHUNKS.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: CHUNK_COLORS[c] }} />
              <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: C.textDim }}>{c}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: CONSTRAINT_COLOR, boxShadow: `0 0 6px ${CONSTRAINT_COLOR}` }} />
            <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: CONSTRAINT_COLOR }}>constraint</span>
          </div>
        </div>

        {/* 3D canvas */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 460,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            background: C.bg,
          }}
        />

        {/* Caption strip */}
        <div
          data-testid="constraint-caption"
          style={{
            fontSize: 12,
            fontFamily: FONT_MONO,
            color: C.textFaint,
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          The {CONSTRAINT.tokens}-token constraint was placed once at turn 1. Its share of the model&rsquo;s attention
          falls 60% &rarr; 32% &rarr; 2% &rarr; 1%. The model can&rsquo;t see what it can&rsquo;t reach.
        </div>

        {/* Highlight buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', justifyContent: 'center' }}>
          {TURNS.map((t) => (
            <button
              key={t.key}
              data-testid={`prompt-btn-${t.key}`}
              onClick={() => setHighlight((cur) => (cur === t.key ? 'all' : t.key))}
              style={btnStyle(highlight === t.key)}
              title={t.blurb}
            >
              {t.label}
            </button>
          ))}
          <button
            data-testid="prompt-btn-all"
            onClick={() => setHighlight('all')}
            style={btnStyle(highlight === 'all')}
          >
            All
          </button>
        </div>

        {/* Currently highlighted blurb */}
        <div style={{ textAlign: 'center', marginTop: 10, minHeight: 18 }}>
          {highlight !== 'all' && (() => {
            const turn = TURNS.find((t) => t.key === highlight)
            if (!turn) return null
            return (
              <span style={{ fontSize: 12, fontFamily: FONT_MONO, color: C.textDim }}>
                <strong style={{ color: C.text }}>{turn.label}</strong>
                {' — '}
                {turn.blurb}
                {' · '}
                {turn.totalTokens.toLocaleString()} tok {tokenAnalogShort(turn.totalTokens)}
                {' · '}
                <span style={{ color: CONSTRAINT_COLOR }}>constraint {turn.constraintShare}%</span>
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
