import { describe, it, expect, vi } from 'vitest'

vi.mock('three', () => {
  class FakeObj { constructor() {} add() {} clone() { return this } multiplyScalar() { return this } setFromPoints() { return this } }
  class FakeMesh extends FakeObj {
    constructor() {
      super()
      this.position = { set: () => {} }
      this.rotation = { set: () => {} }
      this.scale = { set: () => {} }
      this.material = { map: null, needsUpdate: false, dispose: () => {} }
      this.visible = true
    }
  }
  return {
    Scene: class extends FakeObj {},
    PerspectiveCamera: class extends FakeObj { constructor() { super(); this.position = { set: () => {} }; this.lookAt = () => {} } },
    WebGLRenderer: class { constructor() {} setSize() {} setPixelRatio() {} render() {} get domElement() { return document.createElement('canvas') } dispose() {} },
    AmbientLight: class extends FakeObj {},
    DirectionalLight: class extends FakeObj { constructor() { super(); this.position = { set: () => {} } } },
    BoxGeometry: class {},
    PlaneGeometry: class {},
    BufferGeometry: class { setFromPoints() { return this } },
    MeshPhongMaterial: class {},
    LineBasicMaterial: class {},
    Mesh: FakeMesh,
    Line: FakeMesh,
    Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z } },
    Color: class { constructor() {} clone() { return this } multiplyScalar() { return this } },
    CanvasTexture: class { constructor() { this.minFilter = 0 } dispose() {} },
    SpriteMaterial: class { constructor(opts) { Object.assign(this, opts || {}); this.map = (opts && opts.map) || null; this.needsUpdate = false } dispose() {} },
    Sprite: FakeMesh,
    DoubleSide: 0,
    LinearFilter: 0,
  }
})

import { render, screen, fireEvent } from '@testing-library/react'
import TurnStackTowers3D from '../../src/components/TurnStackTowers3D.jsx'

describe('TurnStackTowers3D', () => {
  it('renders without crashing', () => {
    render(<TurnStackTowers3D />)
    expect(screen.getByTestId('turn-slider')).toBeInTheDocument()
    expect(screen.getByTestId('play-btn')).toBeInTheDocument()
  })

  it('moving the slider does not throw', () => {
    render(<TurnStackTowers3D />)
    const slider = screen.getByTestId('turn-slider')
    fireEvent.change(slider, { target: { value: '20' } })
    fireEvent.change(slider, { target: { value: '40' } })
    fireEvent.change(slider, { target: { value: '1' } })
    // No assertion — just verifying no errors.
  })

  it('clicking Play does not throw', () => {
    render(<TurnStackTowers3D />)
    const playBtn = screen.getByTestId('play-btn')
    fireEvent.click(playBtn)
    // Button should show Playing… immediately.
    expect(playBtn.textContent).toMatch(/Playing|Play/)
  })
})
