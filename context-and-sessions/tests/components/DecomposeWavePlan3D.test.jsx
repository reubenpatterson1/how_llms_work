import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DecomposeWavePlan3D from '../../src/components/DecomposeWavePlan3D.jsx'

describe('DecomposeWavePlan3D', () => {
  it('renders title, principles, and embedded iframe', () => {
    render(<DecomposeWavePlan3D />)
    expect(screen.getByText(/Decomposition Agent/i)).toBeInTheDocument()
    expect(screen.getByText(/confabulation firewall/i)).toBeInTheDocument()
    expect(screen.getByText(/Parallelize Smartly/i)).toBeInTheDocument()
    expect(screen.getByText(/80× better/i)).toBeInTheDocument()
    expect(screen.getByTestId('decompose-iframe')).toBeInTheDocument()
  })

  it('iframe src points at the decompose tool', () => {
    render(<DecomposeWavePlan3D />)
    const iframe = screen.getByTestId('decompose-iframe')
    expect(iframe.getAttribute('src')).toMatch(/\/architect\/decompose$/)
  })
})
