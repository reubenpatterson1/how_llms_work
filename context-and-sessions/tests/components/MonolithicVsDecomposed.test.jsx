import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MonolithicVsDecomposed from '../../src/components/MonolithicVsDecomposed.jsx'

describe('MonolithicVsDecomposed', () => {
  it('renders Simple by default with both sides', () => {
    render(<MonolithicVsDecomposed />)
    expect(screen.getByTestId('side-vibe')).toBeInTheDocument()
    expect(screen.getByTestId('side-engineered')).toBeInTheDocument()
  })
  it('clicking Complex lowers vibe recall below 50%', () => {
    render(<MonolithicVsDecomposed />)
    fireEvent.click(screen.getByTestId('complexity-btn-Complex'))
    const vibeRecallText = screen.getByTestId('vibe-recall').textContent
    const pct = parseFloat(vibeRecallText)
    expect(pct).toBeLessThan(50)
  })
  it('engineered recall stays above 80% at every level', () => {
    render(<MonolithicVsDecomposed />)
    for (const lvl of ['Simple', 'Moderate', 'Complex', 'Enterprise']) {
      fireEvent.click(screen.getByTestId(`complexity-btn-${lvl}`))
      const engRecall = parseFloat(screen.getByTestId('engineered-recall').textContent)
      expect(engRecall).toBeGreaterThanOrEqual(80)
    }
  })
})
