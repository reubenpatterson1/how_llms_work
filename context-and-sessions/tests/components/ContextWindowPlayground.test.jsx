import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock @react-three/fiber Canvas to avoid WebGL in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Text: ({ children }) => <span>{children}</span>,
}))
vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import ContextWindowPlayground from '../../src/components/ContextWindowPlayground.jsx'

describe('ContextWindowPlayground', () => {
  it('renders', () => {
    render(<ContextWindowPlayground />)
    expect(screen.getByText(/Context Window Playground/i)).toBeInTheDocument()
  })

  it('moving the window slider changes the needle recall readout', () => {
    render(<ContextWindowPlayground />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('window-slider'), { target: { value: '7' } })  // 200k
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })

  it('changing model changes the readout', () => {
    render(<ContextWindowPlayground />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('model-select'), { target: { value: 'generic-short' } })
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })
})
