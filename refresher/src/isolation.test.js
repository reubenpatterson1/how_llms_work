import { it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const SRC = dirname(fileURLToPath(import.meta.url))
const FORBIDDEN = ['llm_course_progress', 'flow-through', '__LLM_MODULE_ID__']
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
it('refresher src and index.html never reference progress or gate plumbing', () => {
  const files = [...walk(SRC).filter((p) => !p.endsWith('isolation.test.js')), join(SRC, '..', 'index.html')]
  const hits = files.flatMap((f) => FORBIDDEN.filter((s) => readFileSync(f, 'utf8').includes(s)).map((s) => `${f}: ${s}`))
  expect(hits).toEqual([])
})
