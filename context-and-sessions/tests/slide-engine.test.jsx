import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../src/App.jsx'
import { SLIDES } from '../src/slides.jsx'

describe('SLIDES data', () => {
  it('has exactly 23 entries', () => {
    expect(SLIDES).toHaveLength(23)
  })

  it('has unique ids', () => {
    const ids = SLIDES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every slide has a valid type', () => {
    const valid = new Set(['text', 'component', 'assessment'])
    for (const s of SLIDES) expect(valid.has(s.type)).toBe(true)
  })

  it('component slides reference a component name', () => {
    for (const s of SLIDES.filter((s) => s.type === 'component')) {
      expect(typeof s.component).toBe('string')
      expect(s.component.length).toBeGreaterThan(0)
    }
  })

  it('has exactly 8 component slides', () => {
    expect(SLIDES.filter((s) => s.type === 'component')).toHaveLength(8)
  })

  it('has exactly 1 assessment slide', () => {
    expect(SLIDES.filter((s) => s.type === 'assessment')).toHaveLength(1)
  })
})

describe('App slide engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the title slide first', () => {
    render(<App />)
    expect(screen.getByText(/Context & Sessions: The Hidden Mechanic/)).toBeInTheDocument()
  })

  it('ArrowRight advances to the next slide', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/What We'll Cover/)).toBeInTheDocument()
  })

  it('ArrowLeft at slide 0 stays at slide 0', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/Context & Sessions: The Hidden Mechanic/)).toBeInTheDocument()
  })

  it('writes progress.part3 = true when reaching the last slide', () => {
    render(<App />)
    for (let i = 0; i < SLIDES.length - 1; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    }
    const stored = JSON.parse(localStorage.getItem('llm_course_progress'))
    expect(stored.part3).toBe(true)
    expect(stored.__v).toBe(2)
  })
})
