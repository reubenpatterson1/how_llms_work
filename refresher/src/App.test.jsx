import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from './App'
import bank from './data/refresher-questions.json'
let spies
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); spies = ['getItem', 'setItem', 'removeItem'].map((m) => vi.spyOn(Storage.prototype, m)) })
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
const current = () => {
  const o = bank.questions.find((q) => q.q === screen.getByTestId('question-text').textContent)
  const opts = [0, 1, 2, 3].map((k) => screen.getByTestId(`opt-${k}`))
  return { o, opts, right: o.options[o.answer] }
}
it('reveal-btn is absent before selection; aria-pressed follows the latest selection', () => {
  render(<App />); fireEvent.click(screen.getByTestId('start-btn'))
  expect(screen.queryByTestId('reveal-btn')).toBeNull()
  const { opts } = current()
  opts.forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'false'))
  fireEvent.click(opts[0]); fireEvent.click(opts[2])
  expect(opts.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false'])
  expect(screen.getByTestId('reveal-btn')).toBeInTheDocument()
})
it('final grading uses the last selection made before reveal', () => {
  render(<App />); fireEvent.click(screen.getByTestId('start-btn'))
  for (let i = 0; i < 24; i++) {
    const { opts, right } = current()
    fireEvent.click(opts.find((x) => x.textContent !== right))
    fireEvent.click(opts.find((x) => x.textContent === right))
    fireEvent.click(screen.getByTestId('reveal-btn')); fireEvent.click(screen.getByTestId('next-btn'))
  }
  expect(screen.getByTestId('score')).toHaveTextContent('Score: 24/24 (100%)')
})
it('next label is Next until the last question, then See results', () => {
  render(<App />); fireEvent.click(screen.getByTestId('start-btn'))
  for (let i = 0; i < 24; i++) {
    fireEvent.click(current().opts[0]); fireEvent.click(screen.getByTestId('reveal-btn'))
    expect(screen.getByTestId('next-btn')).toHaveTextContent(i === 23 ? 'See results' : /^Next$/)
    fireEvent.click(screen.getByTestId('next-btn'))
  }
})
it('after reveal: options disabled, markers shown, explanation focused and labelled; next focuses question', () => {
  render(<App />); fireEvent.click(screen.getByTestId('start-btn'))
  const { opts, right } = current()
  const wrong = opts.find((x) => x.textContent !== right)
  fireEvent.click(wrong); fireEvent.click(screen.getByTestId('reveal-btn'))
  opts.forEach((b) => expect(b).toBeDisabled())
  expect(opts.find((x) => x.textContent.includes(right))).toHaveTextContent('Correct')
  expect(wrong).toHaveTextContent('Your answer')
  const ex = screen.getByTestId('explanation')
  expect(ex).toHaveTextContent(/^Incorrect/)
  expect(ex).toHaveAttribute('role', 'status')
  expect(document.activeElement).toBe(ex)
  fireEvent.click(screen.getByTestId('next-btn'))
  expect(document.activeElement).toBe(screen.getByTestId('question-text'))
})
it('right answer shows combined marker and Correct explanation prefix', () => {
  render(<App />); fireEvent.click(screen.getByTestId('start-btn'))
  const { opts, right } = current()
  const good = opts.find((x) => x.textContent === right)
  fireEvent.click(good); fireEvent.click(screen.getByTestId('reveal-btn'))
  expect(good).toHaveTextContent('Your answer · Correct')
  expect(screen.getByTestId('explanation')).toHaveTextContent(/^Correct/)
})
