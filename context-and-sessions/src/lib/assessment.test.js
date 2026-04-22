import { describe, it, expect } from 'vitest'
import { gradeMCQ, gradeDiagnostic, overallResult, PASS_RULES } from './assessment.js'

describe('gradeMCQ', () => {
  it('100% when all correct', () => {
    const answers = { q1: 2, q2: 0, q3: 1 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 3, total: 3, percent: 100 })
  })

  it('0% when all wrong', () => {
    const answers = { q1: 0, q2: 1, q3: 0 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 0, total: 3, percent: 0 })
  })

  it('unanswered counts as wrong', () => {
    const answers = { q1: 2 }
    const key = { q1: 2, q2: 0, q3: 1 }
    expect(gradeMCQ(answers, key)).toEqual({ correct: 1, total: 3, percent: Math.round(100 / 3) })
  })
})

describe('gradeDiagnostic', () => {
  it('awards 0 when nothing correct', () => {
    const submission = { diagnosisChoice: 1, fixChoice: 1, recallAchieved: 0.4, rationale: '' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    expect(gradeDiagnostic(submission, key).total).toBe(0)
  })

  it('awards 100 when everything correct and recall ≥ target', () => {
    const submission = { diagnosisChoice: 0, fixChoice: 0, recallAchieved: 0.95, rationale: 'ok' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    expect(gradeDiagnostic(submission, key).total).toBe(100)
  })

  it('breaks down into diagnosis / fix / recall / rationale parts', () => {
    const submission = { diagnosisChoice: 0, fixChoice: 1, recallAchieved: 0.85, rationale: 'ok' }
    const key = { diagnosis: 0, fix: 0, recallTarget: 0.9 }
    const r = gradeDiagnostic(submission, key)
    expect(r.breakdown.diagnosis).toBe(30)
    expect(r.breakdown.fix).toBe(0)
    expect(r.breakdown.recall).toBe(0)
    expect(r.breakdown.rationale).toBe(10)
    expect(r.total).toBe(40)
  })
})

describe('overallResult', () => {
  it('passes at exactly 80% overall AND 75% diagnostics', () => {
    const r = overallResult({ mcqPercent: 80, diagnosticAvg: 75 })
    expect(r.passed).toBe(true)
  })

  it('fails when overall < 80%', () => {
    const r = overallResult({ mcqPercent: 70, diagnosticAvg: 80 })
    expect(r.passed).toBe(false)
  })

  it('fails when diagnostic < 75% even if MCQ is 100%', () => {
    const r = overallResult({ mcqPercent: 100, diagnosticAvg: 60 })
    expect(r.passed).toBe(false)
  })

  it('computes overall as weighted avg (15 MCQ ~60% weight, 4 diag ~40% weight)', () => {
    const r = overallResult({ mcqPercent: 80, diagnosticAvg: 90 })
    expect(r.overallPercent).toBeCloseTo(0.6 * 80 + 0.4 * 90, 1)
  })
})

describe('PASS_RULES', () => {
  it('exports thresholds', () => {
    expect(PASS_RULES.overall).toBe(80)
    expect(PASS_RULES.diagnostic).toBe(75)
  })
})
