import { collapseWhitespace, normalizeText } from './text.js'

/**
 * Require every quoted sentence to occur verbatim (after whitespace/case
 * normalization) in the user-supplied source. This is deliberately stricter
 * than fuzzy matching: unreliable evidence must be visible as such.
 * @param {string} passage
 * @param {string|string[]} quotes
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function verifyEvidence(passage, quotes) {
  const normalizedPassage = normalizeText(passage)
  const list = Array.isArray(quotes) ? quotes : [quotes]
  const missing = []
  for (const quote of list) {
    const raw = collapseWhitespace(quote)
    const normalized = normalizeText(quote)
    if (!normalized || !normalizedPassage.includes(normalized)) missing.push(raw)
  }
  return { ok: missing.length === 0, missing }
}
