import { describe, it, expect } from 'vitest'
import { tokenAnalog, tokenAnalogShort } from './token-analogs.js'

describe('tokenAnalog', () => {
  it('returns a human label for small token counts', () => {
    expect(tokenAnalog(500)).toMatch(/tweet|blog/)
  })
  it('returns a novella-ish label around 40k', () => {
    expect(tokenAnalog(40000)).toMatch(/novella|academic/i)
  })
  it('returns a novel label around 120k', () => {
    expect(tokenAnalog(120000)).toMatch(/Gatsby|novel/i)
  })
  it('returns a thick-novel label at 200k', () => {
    expect(tokenAnalog(200000)).toMatch(/thick novel|Pride/i)
  })
  it('handles edge cases', () => {
    expect(tokenAnalog(0)).toBe('')
    expect(tokenAnalog(-5)).toBe('')
    expect(tokenAnalog(NaN)).toBe('')
  })
  it('short form prefixes ≈', () => {
    const s = tokenAnalogShort(100000)
    expect(s.startsWith('≈')).toBe(true)
  })
})
