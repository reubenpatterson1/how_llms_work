import { describe, it, expect, beforeEach } from 'vitest'
import { migrateProgressV1toV2, CURRENT_VERSION } from './migrate-progress.js'

describe('migrateProgressV1toV2', () => {
  let store
  const fakeStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }

  beforeEach(() => { store = {} })

  it('no-ops when there is no stored progress', () => {
    migrateProgressV1toV2(fakeStorage)
    expect(store).toEqual({})
  })

  it('is idempotent when already migrated', () => {
    store.llm_course_progress = JSON.stringify({ __v: 2, part4: true })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({ __v: 2, part4: true })
  })

  it('leaves part1 and part2 unchanged', () => {
    store.llm_course_progress = JSON.stringify({ part1: true, part2: true })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({ __v: 2, part1: true, part2: true })
  })

  it('shifts old part3..part6 to new part4..part7', () => {
    store.llm_course_progress = JSON.stringify({
      part1: true, part2: true, part3: true, part4: true, part5: true, part6: true,
    })
    migrateProgressV1toV2(fakeStorage)
    expect(JSON.parse(store.llm_course_progress)).toEqual({
      __v: 2, part1: true, part2: true, part4: true, part5: true, part6: true, part7: true,
    })
  })

  it('does not fabricate a part3 completion for existing users', () => {
    store.llm_course_progress = JSON.stringify({ part1: true, part3: true })
    migrateProgressV1toV2(fakeStorage)
    const out = JSON.parse(store.llm_course_progress)
    expect(out.part3).toBeUndefined()
    expect(out.part4).toBe(true)
  })

  it('clears malformed JSON and does not throw', () => {
    store.llm_course_progress = '{not valid json'
    expect(() => migrateProgressV1toV2(fakeStorage)).not.toThrow()
    expect(store.llm_course_progress).toBeUndefined()
  })

  it('exports CURRENT_VERSION = 2', () => {
    expect(CURRENT_VERSION).toBe(2)
  })
})
