import { describe, it, expect, vi } from 'vitest'

vi.mock('three', () => {
  class FakeObj { constructor() {} add() {} clone() { return this } multiplyScalar() { return this } setFromPoints() { return this } }
  class FakeMesh extends FakeObj { constructor() { super(); this.position = { set: () => {} }; this.rotation = { set: () => {} } } }
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
    CanvasTexture: class {},
    SpriteMaterial: class {},
    Sprite: FakeMesh,
    DoubleSide: 0,
    LinearFilter: 0,
  }
})

import { render, screen, fireEvent } from '@testing-library/react'
import ContextAnatomyBars3D from '../../src/components/ContextAnatomyBars3D.jsx'

describe('ContextAnatomyBars3D', () => {
  it('renders without crashing', () => {
    render(<ContextAnatomyBars3D />)
    expect(screen.getByTestId('prompt-btn-t1')).toBeInTheDocument()
    expect(screen.getByTestId('prompt-btn-t2')).toBeInTheDocument()
    expect(screen.getByTestId('prompt-btn-t10')).toBeInTheDocument()
    expect(screen.getByTestId('prompt-btn-t20')).toBeInTheDocument()
  })

  it('toggling a prompt button does not throw', () => {
    render(<ContextAnatomyBars3D />)
    fireEvent.click(screen.getByTestId('prompt-btn-t10'))
    fireEvent.click(screen.getByTestId('prompt-btn-t20'))
    // No assertion — just verifying no errors.
  })
})
