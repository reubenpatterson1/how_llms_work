import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { C, CHUNK_COLORS, FONT_MONO, FONT_SANS } from '../lib/theme.js'
import { tokenAnalogShort } from '../lib/token-analogs.js'
import profileData from '../data/prompt-profiles.json'

const CHUNKS = profileData.chunks // 6 rows, z axis
const PROFILES = profileData.profiles // 4 columns, x axis
const MAX_BAR_H = 6 // a 100% bar would be 6 units tall

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
  // Elevated 3/4 view, no orbit controls.
  camera.position.set(11, 10, 14)
  camera.lookAt(0, 2, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2))
  container.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x334455, 0.8))
  const dir = new THREE.DirectionalLight(0xffeedd, 0.95)
  dir.position.set(10, 15, 10)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0x8899bb, 0.4)
  dir2.position.set(-8, 10, -5)
  scene.add(dir2)

  const numX = PROFILES.length
  const numZ = CHUNKS.length
  const barW = 0.7
  const gapX = 2.2
  const gapZ = 1.2
  const totalX = (numX - 1) * gapX
  const totalZ = (numZ - 1) * gapZ

  const bars = [] // { mesh, profileKey, chunk }
  const colHeaderSprites = [] // per-column header sprites for dimming

  // Floor
  const floorGeo = new THREE.PlaneGeometry(totalX + 5, totalZ + 4)
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x131b2e, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.02
  scene.add(floor)

  // Subtle gridlines per row/column.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1e2940, transparent: true, opacity: 0.55 })
  for (let i = 0; i < numX; i++) {
    const x = i * gapX - totalX / 2
    const pts = [
      new THREE.Vector3(x, 0, -totalZ / 2 - 1),
      new THREE.Vector3(x, 0, totalZ / 2 + 1),
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

  // Bars
  PROFILES.forEach((prof, xi) => {
    CHUNKS.forEach((chunk, zi) => {
      const pct = prof.breakdown[chunk] || 0
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
      bars.push({ mesh, profileKey: prof.key, chunk, baseOpacity: mat.opacity })
    })
  })

  // Column header sprites (prompt label + total tokens + analog).
  PROFILES.forEach((prof, xi) => {
    const analog = tokenAnalogShort(prof.totalTokens)
    const tokenStr = prof.totalTokens.toLocaleString()
    const line1 = prof.label
    const line2 = `${tokenStr} tok ${analog}`
    const sprite = makeLabelSprite(`${line1}\n${line2}`, '#e8c4b8', { fontSize: 18, w: 384, h: 96 })
    sprite.position.set(xi * gapX - totalX / 2, MAX_BAR_H + 1.2, -totalZ / 2 - 0.6)
    if (sprite.scale && sprite.scale.set) sprite.scale.set(4.4, 1.1, 1)
    scene.add(sprite)
    colHeaderSprites.push({ sprite, profileKey: prof.key, baseOpacity: 0.9 })
  })

  // X-axis prompt labels on the floor (front).
  PROFILES.forEach((prof, xi) => {
    const sprite = makeLabelSprite(prof.key, '#9fb4d0', { fontSize: 18, w: 256, h: 64 })
    sprite.position.set(xi * gapX - totalX / 2, -0.3, totalZ / 2 + 1.4)
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

  return { scene, camera, renderer, bars, colHeaderSprites }
}

export default function ContextAnatomyBars3D() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [highlight, setHighlight] = useState('all') // 'all' | profile.key

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
      s.renderer.render(s.scene, s.camera)
    }
    animate()

    return () => { if (frameId) cancelAnimationFrame(frameId) }
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
      if (highlight === 'all' || highlight === b.profileKey) {
        mat.opacity = b.baseOpacity
      } else {
        mat.opacity = 0.15
      }
    })
    s.colHeaderSprites.forEach((h) => {
      const mat = h.sprite.material
      if (!mat) return
      if (highlight === 'all' || highlight === h.profileKey) {
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
          What actually fills the window
        </h2>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 16px', maxWidth: 720, lineHeight: 1.5 }}>
          Each column is one prompt type. Bars show the percentage of that session's total tokens occupied by each
          chunk type. Headers above each column give you the absolute token count and a size analog. Click a button
          to isolate a column.
        </p>

        {/* Chunk legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          {CHUNKS.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: CHUNK_COLORS[c] }} />
              <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: C.textDim }}>{c}</span>
            </div>
          ))}
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

        {/* Highlight buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', justifyContent: 'center' }}>
          {PROFILES.map((p) => (
            <button
              key={p.key}
              data-testid={`prompt-btn-${p.key}`}
              onClick={() => setHighlight((cur) => (cur === p.key ? 'all' : p.key))}
              style={btnStyle(highlight === p.key)}
              title={p.blurb}
            >
              {p.label}
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
            const prof = PROFILES.find((p) => p.key === highlight)
            if (!prof) return null
            return (
              <span style={{ fontSize: 12, fontFamily: FONT_MONO, color: C.textDim }}>
                <strong style={{ color: C.text }}>{prof.label}</strong>
                {' — '}
                {prof.blurb}
                {' · '}
                {prof.totalTokens.toLocaleString()} tok {tokenAnalogShort(prof.totalTokens)}
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
