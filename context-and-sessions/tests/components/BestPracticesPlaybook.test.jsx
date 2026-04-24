import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BestPracticesPlaybook from '../../src/components/BestPracticesPlaybook.jsx'

describe('BestPracticesPlaybook', () => {
  it('renders the title and 10 practice cards', () => {
    render(<BestPracticesPlaybook />)
    expect(screen.getByText(/The Playbook/)).toBeInTheDocument()
    expect(screen.getByTestId('card-tools-over-reasoning')).toBeInTheDocument()
    expect(screen.getByTestId('card-cite-grounding')).toBeInTheDocument()
  })

  it('clicking a filter narrows the visible cards', () => {
    render(<BestPracticesPlaybook />)
    fireEvent.click(screen.getByTestId('filter-btn-RAG'))
    expect(screen.getByTestId('card-rag-for-canonicals')).toBeInTheDocument()
    expect(screen.queryByTestId('card-tools-over-reasoning')).not.toBeInTheDocument()
  })

  it('clicking a card expands it with BEFORE/AFTER blocks', () => {
    render(<BestPracticesPlaybook />)
    fireEvent.click(screen.getByTestId('card-memory-files'))
    expect(screen.getByText(/BEFORE/)).toBeInTheDocument()
    expect(screen.getByText(/AFTER/)).toBeInTheDocument()
    expect(screen.getByText(/90-day retention/)).toBeInTheDocument()
  })
})
