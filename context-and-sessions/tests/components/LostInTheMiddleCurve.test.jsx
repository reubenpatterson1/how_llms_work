import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import LostInTheMiddleCurve from '../../src/components/LostInTheMiddleCurve.jsx'

describe('LostInTheMiddleCurve', () => {
  it('renders', () => {
    render(<LostInTheMiddleCurve />)
    expect(screen.getByText(/Lost-in-the-Middle/)).toBeInTheDocument()
  })

  it('moving needle updates readout', () => {
    render(<LostInTheMiddleCurve />)
    const before = screen.getByTestId('needle-recall').textContent
    fireEvent.change(screen.getByTestId('needle-slider'), { target: { value: '0.1' } })
    const after = screen.getByTestId('needle-recall').textContent
    expect(after).not.toBe(before)
  })

  it('human toggle does not crash', () => {
    render(<LostInTheMiddleCurve />)
    fireEvent.click(screen.getByTestId('human-toggle'))
    expect(screen.getByTestId('human-toggle')).toBeChecked()
  })
})
