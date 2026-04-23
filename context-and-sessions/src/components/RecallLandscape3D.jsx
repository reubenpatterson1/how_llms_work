import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { C } from '../lib/theme.js'

// props:
//   samples: array of { position: 0..1, y: 0..1 } OR 2D array of shape [rows][cols] (y-values)
//   width, depth: geometry size (default 4 x 2)
//   colorFn(y) => hex (optional)
//   needlePosition:
//     null (no needle)
//     OR scalar 0..1 (X-axis only, centered on depth — backward compatible)
//     OR { x: 0..1, z: 0..1, y: 0..1 } (x = column/position, z = row/window, y = surface height)
export default function RecallLandscape3D({
  samples,
  width = 4,
  depth = 2,
  height = 1.2,
  colorFn,
  needlePosition = null,
}) {
  const geometry = useMemo(() => {
    let grid
    if (Array.isArray(samples[0])) {
      grid = samples
    } else {
      // 1D — render as a single strip
      grid = [samples.map((s) => s.y), samples.map((s) => s.y)]
    }
    const rows = grid.length
    const cols = grid[0].length
    const geom = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1)
    const pos = geom.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const y = grid[row][col]
      pos.setZ(i, y * height)
      const color = new THREE.Color(
        colorFn ? colorFn(y) : interpolateColor(y)
      )
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geom.computeVertexNormals()
    return geom
  }, [samples, width, depth, height, colorFn])

  // Normalize needlePosition into { x, z, y } where x,z ∈ [0,1] over the surface and y ∈ [0,1] height fraction.
  let needleCoords = null
  if (needlePosition !== null && needlePosition !== undefined) {
    if (typeof needlePosition === 'number') {
      needleCoords = { x: needlePosition, z: 0.5, y: null }
    } else if (typeof needlePosition === 'object') {
      needleCoords = {
        x: typeof needlePosition.x === 'number' ? needlePosition.x : 0.5,
        z: typeof needlePosition.z === 'number' ? needlePosition.z : 0.5,
        y: typeof needlePosition.y === 'number' ? needlePosition.y : null,
      }
    }
  }

  const needleWorldX = needleCoords !== null ? (needleCoords.x - 0.5) * width : null
  // Map z=0 -> back (+depth/2), z=1 -> front (-depth/2). Picked so larger window indices sit behind.
  const needleWorldZ = needleCoords !== null ? (0.5 - needleCoords.z) * depth : null
  const surfaceY = needleCoords !== null && needleCoords.y !== null ? needleCoords.y * height : null
  // When we know the surface height, sit the cone base on the surface; otherwise float above.
  const coneBaseY = surfaceY !== null ? surfaceY : height * 1.2
  const coneHeight = 0.3
  const coneCenterY = coneBaseY + coneHeight / 2

  return (
    <Canvas camera={{ position: [0, 3, 4], fov: 45 }} style={{ background: C.bg }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {needleCoords !== null && (
        <>
          {/* Vertical drop line from surface (or cone base) down to y=0 so the (x,z) is unmistakable */}
          <mesh position={[needleWorldX, coneBaseY / 2, needleWorldZ]}>
            <cylinderGeometry args={[0.015, 0.015, coneBaseY, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
          </mesh>
          {/* Cone marker at the surface height */}
          <mesh position={[needleWorldX, coneCenterY, needleWorldZ]}>
            <coneGeometry args={[0.08, coneHeight, 12]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
      <AxisLabel text="position" position={[0, -0.1, depth / 2 + 0.3]} />
      <OrbitControls enablePan={false} />
    </Canvas>
  )
}

function AxisLabel({ text, position }) {
  return <Text position={position} fontSize={0.15} color="#64748B">{text}</Text>
}

function interpolateColor(y) {
  // y ∈ [0,1]; red (cold/low) → yellow → green (hot/high)
  if (y < 0.5) {
    const t = y / 0.5
    return new THREE.Color().setRGB(1.0, 0.25 + 0.75 * t, 0.25).getHex()
  }
  const t = (y - 0.5) / 0.5
  return new THREE.Color().setRGB(1.0 - t * 0.8, 1.0, 0.25 + 0.5 * t).getHex()
}
