import { describe, it, expect } from 'vitest'
import {
  INTERVENTIONS, recallOfCritical, applyInterventions, DEFAULT_SESSION_STATE
} from './simulator-rules.js'
import session from '../data/simulator-session.json'

describe('simulator-rules', () => {
  it('exports 8 interventions', () => {
    expect(INTERVENTIONS).toHaveLength(8)
  })

  it('every intervention has key, label, effect', () => {
    for (const i of INTERVENTIONS) {
      expect(typeof i.key).toBe('string')
      expect(typeof i.label).toBe('string')
      expect(typeof i.apply).toBe('function')
    }
  })

  it('base session has low recall on the critical turn', () => {
    const state = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    const recall = recallOfCritical(state)
    expect(recall).toBeLessThan(0.3)
  })

  it('applying all interventions lifts recall above 0.9', () => {
    const all = new Set(INTERVENTIONS.map((i) => i.key))
    const state = applyInterventions(session, all, DEFAULT_SESSION_STATE)
    const recall = recallOfCritical(state)
    expect(recall).toBeGreaterThanOrEqual(0.9)
  })

  it('pin_invariants alone improves recall', () => {
    const withPin = applyInterventions(session, new Set(['pin_invariants']), DEFAULT_SESSION_STATE)
    const without = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(recallOfCritical(withPin)).toBeGreaterThan(recallOfCritical(without))
  })

  it('prune_tool_outputs reduces token count', () => {
    const pruned = applyInterventions(session, new Set(['prune_tool_outputs']), DEFAULT_SESSION_STATE)
    const raw = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(pruned.totalTokens).toBeLessThan(raw.totalTokens)
  })

  it('nuclear_restart drops token count dramatically', () => {
    const nuke = applyInterventions(session, new Set(['nuclear_restart']), DEFAULT_SESSION_STATE)
    const raw = applyInterventions(session, new Set(), DEFAULT_SESSION_STATE)
    expect(nuke.totalTokens).toBeLessThan(raw.totalTokens * 0.2)
  })
})
