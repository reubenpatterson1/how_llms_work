export const CURRENT_VERSION = 2
const KEY = 'llm_course_progress'

export function migrateProgressV1toV2(storage = globalThis.localStorage) {
  const raw = storage.getItem(KEY)
  if (raw === null) return

  let p
  try {
    p = JSON.parse(raw)
  } catch {
    storage.removeItem(KEY)
    return
  }

  if (!p || typeof p !== 'object') return
  if (p.__v === CURRENT_VERSION) return

  const next = { __v: CURRENT_VERSION }
  if (p.part1) next.part1 = p.part1
  if (p.part2) next.part2 = p.part2
  // no part3 carryover — Context & Sessions is a new module
  if (p.part3) next.part4 = p.part3
  if (p.part4) next.part5 = p.part4
  if (p.part5) next.part6 = p.part5
  if (p.part6) next.part7 = p.part6

  storage.setItem(KEY, JSON.stringify(next))
}
