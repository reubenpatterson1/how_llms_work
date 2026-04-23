function clamp(x, lo, hi) {
  if (x < lo) return lo
  if (x > hi) return hi
  return x
}

function findBracket(arr, value) {
  if (value <= arr[0]) return [0, 0, 0]
  if (value >= arr[arr.length - 1]) return [arr.length - 1, arr.length - 1, 0]
  for (let i = 0; i < arr.length - 1; i++) {
    if (value >= arr[i] && value <= arr[i + 1]) {
      const span = arr[i + 1] - arr[i]
      const t = span === 0 ? 0 : (value - arr[i]) / span
      return [i, i + 1, t]
    }
  }
  return [arr.length - 1, arr.length - 1, 0]
}

function lerp(a, b, t) { return a + (b - a) * t }

export function createRecallLookup(tableData) {
  const { grid, table } = tableData
  const { window_sizes, noise_levels, position_steps } = grid

  return function recallLookup({ model, window_size, position, noise_level }) {
    if (!(model in table)) throw new Error(`unknown model: ${model}`)

    const p = clamp(position, 0, 1)
    const n = clamp(noise_level, 0, 1)
    const w = clamp(window_size, window_sizes[0], window_sizes[window_sizes.length - 1])

    const [wLo, wHi, wt] = findBracket(window_sizes, w)
    const [nLo, nHi, nt] = findBracket(noise_levels, n)

    const posIdxFloat = p * (position_steps - 1)
    const pLo = Math.floor(posIdxFloat)
    const pHi = Math.min(pLo + 1, position_steps - 1)
    const pt = posIdxFloat - pLo

    const modelTable = table[model]

    function at(wi, ni, pi) {
      return modelTable[window_sizes[wi]][noise_levels[ni]][pi]
    }

    const c000 = at(wLo, nLo, pLo)
    const c001 = at(wLo, nLo, pHi)
    const c010 = at(wLo, nHi, pLo)
    const c011 = at(wLo, nHi, pHi)
    const c100 = at(wHi, nLo, pLo)
    const c101 = at(wHi, nLo, pHi)
    const c110 = at(wHi, nHi, pLo)
    const c111 = at(wHi, nHi, pHi)

    const c00 = lerp(c000, c001, pt)
    const c01 = lerp(c010, c011, pt)
    const c10 = lerp(c100, c101, pt)
    const c11 = lerp(c110, c111, pt)

    const c0 = lerp(c00, c01, nt)
    const c1 = lerp(c10, c11, nt)

    return lerp(c0, c1, wt)
  }
}
