import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/RecallLandscape3D.jsx', () => ({
  default: () => <div data-testid="landscape-3d" />,
}))

import SessionHygieneSimulator from '../../src/components/SessionHygieneSimulator.jsx'

describe('SessionHygieneSimulator', () => {
  it('renders', () => {
    render(<SessionHygieneSimulator />)
    expect(screen.getByTestId('recall-readout')).toBeInTheDocument()
  })

  it('starting recall is below 90%', () => {
    render(<SessionHygieneSimulator />)
    const recall = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(recall).toBeLessThan(90)
  })

  it('toggling pin_invariants raises recall', () => {
    render(<SessionHygieneSimulator />)
    const before = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    fireEvent.click(screen.getByTestId('iv-pin_invariants'))
    const after = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(after).toBeGreaterThan(before)
  })

  it('enabling all interventions pushes recall ≥ 90%', () => {
    render(<SessionHygieneSimulator />)
    for (const id of ['iv-front_tail_load', 'iv-summarize_history', 'iv-pin_invariants',
                      'iv-prune_tool_outputs', 'iv-scope_session', 'iv-watch_effective',
                      'iv-external_memory', 'iv-nuclear_restart']) {
      fireEvent.click(screen.getByTestId(id))
    }
    const recall = parseInt(screen.getByTestId('recall-readout').textContent, 10)
    expect(recall).toBeGreaterThanOrEqual(90)
  })
})
