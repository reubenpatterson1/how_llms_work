export const MODEL_PROFILES = {
  'gpt-4-turbo':    { base_rate_at_4k: 0.95, base_rate_at_200k: 0.72, middle_valley_depth: 0.35, noise_sensitivity: 0.45 },
  'claude-sonnet':  { base_rate_at_4k: 0.96, base_rate_at_200k: 0.80, middle_valley_depth: 0.28, noise_sensitivity: 0.35 },
  'gemini-1.5':     { base_rate_at_4k: 0.94, base_rate_at_200k: 0.74, middle_valley_depth: 0.32, noise_sensitivity: 0.40 },
  'generic-short':  { base_rate_at_4k: 0.92, base_rate_at_200k: 0.45, middle_valley_depth: 0.55, noise_sensitivity: 0.60 },
}

export function clip01(x) {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

// log-interpolate base rate between 4k and 200k anchors
function baseRate(profile, window_size) {
  const t = Math.log(window_size / 4000) / Math.log(200000 / 4000)
  const clamped = clip01(t)
  return profile.base_rate_at_4k + clamped * (profile.base_rate_at_200k - profile.base_rate_at_4k)
}

function gaussian(x, center, width) {
  const d = (x - center) / width
  return Math.exp(-0.5 * d * d)
}

// Returns a multiplier that approaches ~1 at the ends and dips to
// (1 - middle_valley_depth) in the middle. Primacy (at 0) + recency (at 1),
// recency slightly stronger. The outer clip01 in `recall` handles any
// overshoot at position=1 where recency peaks above 1.
function positionalMultiplier(position, profile) {
  const primacy = gaussian(position, 0, 0.12)
  const recency = 1.1 * gaussian(position, 1, 0.15)
  const edgeBoost = Math.max(primacy, recency)  // in [0, ~1.1]
  // Multiplier goes from (1 - depth) in the middle to ~1 at start and ~1 + small at end
  return (1 - profile.middle_valley_depth) + profile.middle_valley_depth * edgeBoost
}

export function recall({ position, window_size, noise_level, model }) {
  const base = baseRate(model, window_size)
  const pos = positionalMultiplier(position, model)
  const noisePenalty = 1 - noise_level * model.noise_sensitivity
  return clip01(base * pos * noisePenalty)
}
