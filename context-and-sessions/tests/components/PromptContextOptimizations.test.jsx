import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PromptContextOptimizations from '../../src/components/PromptContextOptimizations.jsx'

const readPct = () => {
  const txt = screen.getByTestId('attended-readout').textContent || ''
  const m = txt.match(/(\d+)%/)
  return m ? parseInt(m[1], 10) : NaN
}

describe('PromptContextOptimizations', () => {
  it('renders both panes and the attention bar', () => {
    render(<PromptContextOptimizations />)
    expect(screen.getByText(/Prompt Optimizations/)).toBeInTheDocument()
    expect(screen.getByText(/Context Optimizations/)).toBeInTheDocument()
    expect(screen.getByTestId('attended-readout')).toBeInTheDocument()
  })

  it('toggling a prompt technique increases attended %', () => {
    render(<PromptContextOptimizations />)
    const before = readPct()
    fireEvent.click(screen.getByTestId('prompt-tech-must_lists'))
    const after = readPct()
    expect(after).toBeGreaterThan(before)
  })

  it('toggling a context technique increases attended %', () => {
    render(<PromptContextOptimizations />)
    const before = readPct()
    fireEvent.click(screen.getByTestId('context-tech-compact'))
    const after = readPct()
    expect(after).toBeGreaterThan(before)
  })

  it('synergy fires when MUST lists + format spec are both on', () => {
    render(<PromptContextOptimizations />)
    fireEvent.click(screen.getByTestId('prompt-tech-must_lists'))
    fireEvent.click(screen.getByTestId('prompt-tech-format'))
    expect(screen.getByText(/structural enforcement/i)).toBeInTheDocument()
  })
})
