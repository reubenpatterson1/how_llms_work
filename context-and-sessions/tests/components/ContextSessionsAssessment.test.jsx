import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import ContextSessionsAssessment from '../../src/components/ContextSessionsAssessment.jsx'

describe('ContextSessionsAssessment', () => {
  it('renders the Intro screen with name input', () => {
    render(<ContextSessionsAssessment />)
    expect(screen.getByText(/Context & Sessions Assessment/i)).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByTestId('begin-btn')).toBeInTheDocument()
  })

  it('cannot begin the assessment without a name', () => {
    render(<ContextSessionsAssessment />)
    const begin = screen.getByTestId('begin-btn')
    expect(begin).toBeDisabled()
    // Clicking still does nothing — no name input has been provided
    fireEvent.click(begin)
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
  })

  it('typing a name enables Begin and advances to the first section header', () => {
    render(<ContextSessionsAssessment />)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Ada Lovelace' } })
    const begin = screen.getByTestId('begin-btn')
    expect(begin).not.toBeDisabled()
    fireEvent.click(begin)
    // First section header: Attention & Lost-in-the-Middle
    expect(screen.getByText(/Section:/i)).toBeInTheDocument()
    expect(screen.getByTestId('start-section-btn')).toBeInTheDocument()
  })

  it('can answer, reveal, and advance through a question', () => {
    render(<ContextSessionsAssessment />)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByTestId('begin-btn'))
    fireEvent.click(screen.getByTestId('start-section-btn'))

    // Now on first question; options 0..n exist
    expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('opt-0'))
    fireEvent.click(screen.getByTestId('reveal-btn'))
    // After reveal, a Next button appears
    fireEvent.click(screen.getByTestId('next-btn'))
    // Either a new question or the next section header has rendered
    const hasQuestion = screen.queryByText(/Question 2 of 15/)
    const hasSection = screen.queryByText(/Section:/i)
    expect(hasQuestion || hasSection).toBeTruthy()
  })
})
