import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import ContextSessionsAssessment from '../../src/components/ContextSessionsAssessment.jsx'

describe('ContextSessionsAssessment', () => {
  it('renders MCQ phase first', () => {
    render(<ContextSessionsAssessment />)
    expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument()
  })

  it('select option + reveal + next advances', () => {
    render(<ContextSessionsAssessment />)
    fireEvent.click(screen.getByTestId('mcq-A1-opt-0'))
    fireEvent.click(screen.getByTestId('reveal-btn'))
    fireEvent.click(screen.getByTestId('next-btn'))
    expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument()
  })
})
