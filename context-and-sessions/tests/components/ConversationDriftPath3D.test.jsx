import { describe, it, expect, vi } from 'vitest'

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    constructor() { this.target = { set: () => {} } }
    update() {}
    dispose() {}
  },
}))

vi.mock('three', () => {
  class FakeObj {
    add() {}
    clone() { return this }
    multiplyScalar() { return this }
    setFromPoints() { return this }
  }
  class FakeMesh extends FakeObj {
    constructor() {
      super()
      this.position = { set: () => {}, copy: () => {}, x: 0, y: 0, z: 0 }
      this.rotation = { set: () => {}, x: 0, y: 0, z: 0 }
      this.scale = { set: () => {}, y: 1 }
      this.material = { map: null, needsUpdate: false, opacity: 1, transparent: true, dispose: () => {} }
      this.geometry = { dispose: () => {}, setFromPoints: () => {} }
      this.visible = true
    }
  }
  class FakeVec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this }
    clone() { return new FakeVec3(this.x, this.y, this.z) }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this }
    length() { return Math.hypot(this.x, this.y, this.z) }
  }
  class FakeBufferGeometry {
    setFromPoints() { return this }
    dispose() {}
  }
  return {
    Scene: class extends FakeObj {},
    PerspectiveCamera: class extends FakeObj {
      constructor() { super(); this.position = { set: () => {} }; this.lookAt = () => {} }
    },
    WebGLRenderer: class {
      constructor() {}
      setSize() {}
      setPixelRatio() {}
      render() {}
      get domElement() { return document.createElement('canvas') }
      dispose() {}
    },
    AmbientLight: class extends FakeObj {},
    DirectionalLight: class extends FakeObj {
      constructor() { super(); this.position = { set: () => {} } }
    },
    BoxGeometry: class {},
    SphereGeometry: class {},
    PlaneGeometry: class {},
    BufferGeometry: FakeBufferGeometry,
    MeshPhongMaterial: class {},
    LineBasicMaterial: class {},
    MeshStandardMaterial: class {},
    MeshBasicMaterial: class {},
    LineDashedMaterial: class {},
    Mesh: FakeMesh,
    Line: FakeMesh,
    LineSegments: FakeMesh,
    Vector3: FakeVec3,
    Color: class { constructor() {} clone() { return this } multiplyScalar() { return this } },
    CanvasTexture: class { constructor() { this.minFilter = 0 } dispose() {} },
    SpriteMaterial: class {
      constructor(opts) { Object.assign(this, opts || {}); this.map = (opts && opts.map) || null; this.needsUpdate = false }
      dispose() {}
    },
    Sprite: FakeMesh,
    DoubleSide: 0,
    BackSide: 0,
    AdditiveBlending: 0,
    LinearFilter: 0,
  }
})

import { render, screen, fireEvent } from '@testing-library/react'
import ConversationDriftPath3D from '../../src/components/ConversationDriftPath3D.jsx'

describe('ConversationDriftPath3D', () => {
  it('renders the title, slider, and toggle', () => {
    render(<ConversationDriftPath3D />)
    expect(screen.getByTestId('turn-slider')).toBeInTheDocument()
    expect(screen.getByTestId('summarize-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('nuke-btn')).toBeInTheDocument()
  })
  it('moving the turn slider does not throw', () => {
    render(<ConversationDriftPath3D />)
    fireEvent.change(screen.getByTestId('turn-slider'), { target: { value: '15' } })
    expect(screen.getByTestId('turn-slider')).toHaveValue('15')
  })
  it('clicking nuke does not throw', () => {
    render(<ConversationDriftPath3D />)
    fireEvent.change(screen.getByTestId('turn-slider'), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('nuke-btn'))
  })
  it('toggling summarize does not throw', () => {
    render(<ConversationDriftPath3D />)
    fireEvent.click(screen.getByTestId('summarize-toggle'))
  })
})
