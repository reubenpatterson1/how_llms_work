export const READY_THRESHOLD = 18
export const REVIEW_THRESHOLD = 6

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleOptions(q, rng) {
  const idx = shuffle([0, 1, 2, 3], rng)
  return {
    id: q.id,
    part: q.part,
    term: q.term,
    review: q.review,
    q: q.q,
    options: idx.map((i) => q.options[i]),
    answer: idx.indexOf(q.answer),
    explanation: q.explanation,
  }
}

export function buildSequence(questions, rng = Math.random) {
  return [1, 2, 3].flatMap((part) =>
    shuffle(questions.filter((q) => q.part === part), rng).map((q) => shuffleOptions(q, rng)),
  )
}

export function score(sequence, answers) {
  return sequence.filter((s) => answers[s.id] === s.answer).length
}

export function breakdownByPart(sequence, answers) {
  return [1, 2, 3].map((part) => {
    const items = sequence.filter((s) => s.part === part)
    const correct = items.filter((s) => answers[s.id] === s.answer).length
    return { part, correct, total: items.length, flagged: correct < REVIEW_THRESHOLD }
  })
}

export function missedQuestions(sequence, answers) {
  return sequence
    .filter((s) => answers[s.id] !== s.answer)
    .map((s) => ({
      id: s.id,
      part: s.part,
      q: s.q,
      correctAnswer: s.options[s.answer],
      review: s.review,
      href: '/part' + s.part + '/',
    }))
}

export function isReady(s) {
  return s >= READY_THRESHOLD
}
