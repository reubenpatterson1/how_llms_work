export const PASS_RULES = { overall: 80, diagnostic: 75 }

export function gradeMCQ(answers, key) {
  const total = Object.keys(key).length
  let correct = 0
  for (const q of Object.keys(key)) {
    if (answers[q] === key[q]) correct++
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100)
  return { correct, total, percent }
}

export function gradeDiagnostic(submission, key) {
  const breakdown = { diagnosis: 0, fix: 0, recall: 0, rationale: 0 }
  if (submission.diagnosisChoice === key.diagnosis) breakdown.diagnosis = 30
  if (submission.fixChoice === key.fix)             breakdown.fix = 30
  if ((submission.recallAchieved ?? 0) >= key.recallTarget) breakdown.recall = 30
  if ((submission.rationale ?? '').trim().length > 0)       breakdown.rationale = 10
  const total = breakdown.diagnosis + breakdown.fix + breakdown.recall + breakdown.rationale
  return { breakdown, total }
}

export function overallResult({ mcqPercent, diagnosticAvg }) {
  const overallPercent = 0.6 * mcqPercent + 0.4 * diagnosticAvg
  const passed = mcqPercent >= PASS_RULES.overall && diagnosticAvg >= PASS_RULES.diagnostic
  return { overallPercent, passed, mcqPercent, diagnosticAvg }
}
