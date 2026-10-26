import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from './App'
import bank from './data/refresher-questions.json'
let spies
beforeEach(() => { spies = ['getItem', 'setItem', 'removeItem'].map((m) => vi.spyOn(Storage.prototype, m)) })
afterEach(() => vi.restoreAllMocks())
function runThrough(wrongIds) {
  fireEvent.click(screen.getByTestId('start-btn'))
  for (let i = 0; i < 24; i++) {
    expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 24`)
    const o = bank.questions.find((q) => q.q === screen.getByTestId('question-text').textContent)
    const right = o.options[o.answer]
    const opts = [0, 1, 2, 3].map((k) => screen.getByTestId(`opt-${k}`))
    fireEvent.click(wrongIds === 'all' || wrongIds.includes(o.id) ? opts.find((x) => x.textContent !== right) : opts.find((x) => x.textContent === right))
    fireEvent.click(screen.getByTestId('reveal-btn'))
    expect(screen.getByTestId('explanation')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('next-btn'))
  }
}
it('one miss per Part: ready, rows 7/8, missed list and links match, no storage access', () => {
  render(<App />); runThrough(['P1-1', 'P2-1', 'P3-1'])
  expect(screen.getByTestId('score')).toHaveTextContent('Score: 21/24 (88%)')
  expect(screen.getByTestId('verdict')).toHaveTextContent('Ready for Parts 4 & 5')
  ;[1, 2, 3].forEach((p) => { const r = screen.getByTestId(`part-row-${p}`); expect(r).toHaveTextContent('7/8'); expect(r).not.toHaveTextContent('Review') })
  const items = within(screen.getByTestId('missed-list')).getAllByTestId(/^missed-item-/)
  expect(items.map((el) => el.getAttribute('data-testid'))).toEqual(['missed-item-P1-1', 'missed-item-P2-1', 'missed-item-P3-1'])
  expect(items.map((el) => within(el).getByRole('link').getAttribute('href'))).toEqual(['/part1/', '/part2/', '/part3/'])
  items.forEach((el) => expect(el).toHaveTextContent('(requires Part'))
  spies.forEach((s) => expect(s).not.toHaveBeenCalled())
})
it('all wrong: review recommended, every row flagged, 24 missed', () => {
  render(<App />); runThrough('all')
  expect(screen.getByTestId('verdict')).toHaveTextContent('Review recommended')
  ;[1, 2, 3].forEach((p) => expect(screen.getByTestId(`part-row-${p}`)).toHaveTextContent(/0\/8.*Review/))
  expect(within(screen.getByTestId('missed-list')).getAllByTestId(/^missed-item-/)).toHaveLength(24)
})
it('retake resets to question 1 with no results', () => {
  render(<App />); runThrough([])
  expect(screen.queryByTestId('missed-list')).toBeNull()
  fireEvent.click(screen.getByTestId('retake-btn'))
  expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 24')
  expect(screen.queryByTestId('score')).toBeNull()
})
