import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AttentionBudgetAllocator from '../../src/components/AttentionBudgetAllocator.jsx'

describe('AttentionBudgetAllocator', () => {
  it('renders without crashing', () => {
    render(<AttentionBudgetAllocator />)
    expect(screen.getByText(/Attention Budget Allocator/i)).toBeInTheDocument()
  })

  it('shows an initial critical-token percentage', () => {
    render(<AttentionBudgetAllocator />)
    const val = screen.getByTestId('critical-pct').textContent
    const pct = parseFloat(val)
    expect(pct).toBeGreaterThan(0)
  })

  it('adding a tool output lowers attention per critical token', () => {
    render(<AttentionBudgetAllocator />)
    const before = parseFloat(screen.getByTestId('critical-pct').textContent)
    fireEvent.click(screen.getByTestId('add-tool'))
    const after = parseFloat(screen.getByTestId('critical-pct').textContent)
    expect(after).toBeLessThan(before)
  })
})
