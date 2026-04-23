import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LeverComparisonTool from '../../src/components/LeverComparisonTool.jsx'

describe('LeverComparisonTool', () => {
  it('renders both panes', () => {
    render(<LeverComparisonTool />)
    expect(screen.getByText(/Prompt Engineering/)).toBeInTheDocument()
    expect(screen.getByText(/Context Engineering/)).toBeInTheDocument()
  })

  it('toggling a prompt lever raises the prompt score', () => {
    render(<LeverComparisonTool />)
    const before = parseInt(screen.getByTestId('prompt-score').textContent, 10)
    fireEvent.click(screen.getByTestId('prompt-xml_structure'))
    const after = parseInt(screen.getByTestId('prompt-score').textContent, 10)
    expect(after).toBeGreaterThan(before)
  })

  it('prompt and context scores are independent', () => {
    render(<LeverComparisonTool />)
    const cBefore = parseInt(screen.getByTestId('context-score').textContent, 10)
    fireEvent.click(screen.getByTestId('prompt-xml_structure'))
    const cAfter = parseInt(screen.getByTestId('context-score').textContent, 10)
    expect(cAfter).toBe(cBefore)
  })
})
