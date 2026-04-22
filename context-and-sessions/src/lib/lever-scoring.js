export const BASE_SCORE = 35
export const MAX_SCORE = 98

export const PROMPT_LEVERS = [
  { key: 'xml_structure',     label: 'XML structure',          delta: 7  },
  { key: 'role_prime',        label: 'Role prime',             delta: 4  },
  { key: 'explicit_constraints', label: 'Explicit constraints', delta: 8 },
  { key: 'few_shot',          label: 'Few-shot examples',      delta: 6  },
  { key: 'chain_of_thought',  label: 'Chain-of-thought',       delta: 5  },
  { key: 'output_format',     label: 'Output format spec',     delta: 6  },
]

export const CONTEXT_LEVERS = [
  { key: 'front_tail_load',   label: 'Front/tail-load critical', delta: 9 },
  { key: 'summarize_history', label: 'Summarize history',        delta: 7 },
  { key: 'pin_invariants',    label: 'Pin invariants',           delta: 6 },
  { key: 'prune_tool_outputs',label: 'Prune tool outputs',       delta: 8 },
  { key: 'scope_session',     label: 'Scope session',            delta: 6 },
  { key: 'external_memory',   label: 'External memory',          delta: 7 },
]

const SYNERGIES = [
  { keys: ['summarize_history', 'prune_tool_outputs'], bonus: 5 },
  { keys: ['front_tail_load', 'pin_invariants'],       bonus: 4 },
  { keys: ['explicit_constraints', 'output_format'],   bonus: 3 },
]

const DELTA = new Map()
for (const l of [...PROMPT_LEVERS, ...CONTEXT_LEVERS]) DELTA.set(l.key, l.delta)

export function scoreLeverSet(active) {
  let score = BASE_SCORE
  for (const key of active) score += DELTA.get(key) ?? 0
  for (const syn of SYNERGIES) {
    if (syn.keys.every((k) => active.has(k))) score += syn.bonus
  }
  return Math.min(MAX_SCORE, score)
}
