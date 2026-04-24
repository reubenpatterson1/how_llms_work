export const MODEL_PROFILES = {
  'gpt-4-turbo':    { base_rate_at_4k: 0.95, base_rate_at_200k: 0.72, middle_valley_depth_base: 0.10, window_depth_scale: 0.30, noise_depth_scale: 0.25, noise_sensitivity: 0.25 },
  'claude-sonnet':  { base_rate_at_4k: 0.96, base_rate_at_200k: 0.80, middle_valley_depth_base: 0.08, window_depth_scale: 0.22, noise_depth_scale: 0.20, noise_sensitivity: 0.18 },
  'gemini-1.5':     { base_rate_at_4k: 0.94, base_rate_at_200k: 0.74, middle_valley_depth_base: 0.10, window_depth_scale: 0.28, noise_depth_scale: 0.22, noise_sensitivity: 0.22 },
  'generic-short':  { base_rate_at_4k: 0.92, base_rate_at_200k: 0.45, middle_valley_depth_base: 0.20, window_depth_scale: 0.45, noise_depth_scale: 0.40, noise_sensitivity: 0.40 },
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
// (1 - effectiveDepth) in the middle. The valley deepens with window size
// and with absolute noise volume (noise_level * window_size), matching
// Liu et al. 2023's observation that lost-in-the-middle worsens as context
// grows and as distractor volume grows. Primacy (at 0) + recency (at 1),
// recency slightly stronger. The outer clip01 in `recall` handles any
// overshoot at position=1 where recency peaks above 1.
function positionalMultiplier(position, profile, window_size, noise_level) {
  const effectiveWindow = Math.max(window_size, 4000)
  const windowGrowth = Math.log(effectiveWindow / 4000) / Math.log(200000 / 4000)  // 0..1
  const absoluteNoise = (noise_level * effectiveWindow) / 200000                   // 0..1
  const effectiveDepth = clip01(
    profile.middle_valley_depth_base
    + profile.window_depth_scale * windowGrowth
    + profile.noise_depth_scale * absoluteNoise
  )
  const primacy = gaussian(position, 0, 0.12)
  const recency = 1.1 * gaussian(position, 1, 0.15)
  const edgeBoost = Math.max(primacy, recency)  // in [0, ~1.1]
  // Multiplier goes from (1 - effectiveDepth) in the middle to ~1 at start and ~1 + small at end
  return (1 - effectiveDepth) + effectiveDepth * edgeBoost
}

export function recall({ position, window_size, noise_level, model }) {
  const base = baseRate(model, window_size)
  const pos = positionalMultiplier(position, model, window_size, noise_level)
  const noisePenalty = 1 - noise_level * model.noise_sensitivity
  return clip01(base * pos * noisePenalty)
}
