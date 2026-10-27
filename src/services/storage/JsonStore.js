// JSON-backed local storage primitives shared by single-device features.
// This module owns direct Storage access so feature code never needs to.

/** @param {string} key @param {unknown} fallback @returns {any} */
export function readJson(key, fallback = null) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}
/** @param {string} key @param {unknown} value */
export function writeJson(key, value) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** @param {string} key */
export function removeKey(key) {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

/** @param {string} key */
export function hasKey(key) {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(key) !== null } catch { return false }
}
