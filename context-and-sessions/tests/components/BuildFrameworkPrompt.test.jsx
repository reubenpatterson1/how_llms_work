import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BuildFrameworkPrompt from '../../src/components/BuildFrameworkPrompt.jsx'

describe('BuildFrameworkPrompt', () => {
  it('renders title, copy button, code block, and annotations', () => {
    render(<BuildFrameworkPrompt />)
    expect(screen.getByText(/Your Turn/)).toBeInTheDocument()
    expect(screen.getByTestId('copy-btn')).toBeInTheDocument()
    expect(screen.getByTestId('framework-code').textContent).toMatch(/Wave 0 — Interfaces/)
    // "One concern per session" appears both in the markdown body and as an
    // annotation title — assert at least one renders.
    expect(screen.getAllByText(/One concern per session/).length).toBeGreaterThan(0)
  })

  it('copy button flashes "Copied" on click', async () => {
    // Provide a minimal clipboard stub for jsdom.
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } })
    render(<BuildFrameworkPrompt />)
    const btn = screen.getByTestId('copy-btn')
    fireEvent.click(btn)
    // The state change is async (awaited Promise), use findByText.
    expect(await screen.findByText(/Copied/)).toBeInTheDocument()
  })
})
