import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import bank from './refresher-questions.json'
const SRC = { 1: '../../../presentation/src/App.jsx', 2: '../../../working-with-llms/src/App.jsx', 3: '../../../context-and-sessions/src/slides.jsx' }
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const Q = bank.questions
it('version 1, 24 questions, 8 per Part', () => {
  expect(bank.version).toBe(1); expect(Q).toHaveLength(24)
  expect([1, 2, 3].map((p) => Q.filter((q) => q.part === p).length)).toEqual([8, 8, 8])
})
it('ids match P<part>-<1..8> and are unique; q unique', () => {
  expect(Q.every((q) => new RegExp(`^P${q.part}-[1-8]$`).test(q.id))).toBe(true)
  expect(new Set(Q.map((q) => q.id)).size).toBe(24); expect(new Set(Q.map((q) => q.q)).size).toBe(24)
})
it('4 distinct options, answer in range, explanation ≤ 40 words', () => {
  for (const q of Q) {
    expect(new Set(q.options).size).toBe(4); expect(q.answer >= 0 && q.answer <= 3).toBe(true)
    expect(q.explanation.trim().split(/\s+/).length).toBeLessThanOrEqual(40)
  }
})
it('review.slideNumber is a positive integer and slideTitle exists in that Part source', () => {
  const src = { 1: read(SRC[1]), 2: read(SRC[2]), 3: read(SRC[3]) }
  expect(Q.filter((q) => !(Number.isInteger(q.review.slideNumber) && q.review.slideNumber > 0)).map((q) => q.id)).toEqual([])
  expect(Q.filter((q) => !src[q.part].includes(q.review.slideTitle)).map((q) => q.id)).toEqual([])
})
