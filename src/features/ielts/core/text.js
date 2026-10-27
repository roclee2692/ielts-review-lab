/** @typedef {{ ok: boolean, words: number, numbers: number, violations: string[] }} FormatResult */

const NUMBER_TOKEN = /^[+−-]?(?:\d+(?:[.,:/-]\d+)*|\d+(?:st|nd|rd|th))$/i

/** Collapse all Unicode whitespace and trim. @param {unknown} value */
export function collapseWhitespace(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim()
}

/** Normalize typography that commonly differs between copied sources. @param {unknown} value */
export function normalizeText(value) {
  return collapseWhitespace(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
}

/** @param {string} token */
function isNumberToken(token) {
  return NUMBER_TOKEN.test(token.replace(/^[("'[{]+|[)"'\]}.,;:!?]+$/gu, ''))
}

/**
 * Count words and number tokens independently. Hyphenated words count as one
 * word, matching the answer-sheet convention documented in RULES.md. With
 * `mergeNumberWords`, a spelled-out number ("three hundred and twenty") counts
 * as one number instead of several words.
 * @param {unknown} answer
 * @param {{ mergeNumberWords?: boolean }} [options]
 * @returns {{ words: number, numbers: number }}
 */
export function countAnswerTokens(answer, { mergeNumberWords = false } = {}) {
  const tokens = collapseWhitespace(answer).split(' ').filter(Boolean)
  let words = 0
  let numbers = 0
  for (let i = 0; i < tokens.length; i++) {
    if (isNumberToken(tokens[i])) { numbers++; continue }
    const end = mergeNumberWords ? numberWordRunEnd(tokens, i) : i
    if (end > i) { numbers++; i = end - 1; continue }
    words++
  }
  return { words, numbers }
}

const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion',
])

/** @param {string} token */
function isNumberWord(token) {
  const bare = token.toLowerCase().replace(/^[("'[{]+|[)"'\]}.,;:!?]+$/gu, '')
  return bare.length > 0 && bare.split('-').every(part => NUMBER_WORDS.has(part))
}

/**
 * A spelled-out number such as "three hundred and twenty" is one number, not
 * four words. "and" only joins two number words; a run never starts or ends
 * with it. Returns the exclusive end index of the run starting at `start`, or
 * `start` when there is none.
 * @param {string[]} tokens
 * @param {number} start
 */
function numberWordRunEnd(tokens, start) {
  if (!isNumberWord(tokens[start])) return start
  let end = start + 1
  while (end < tokens.length) {
    if (isNumberWord(tokens[end])) { end++; continue }
    if (tokens[end].toLowerCase() === 'and' && end + 1 < tokens.length && isNumberWord(tokens[end + 1])) {
      end += 2
      continue
    }
    break
  }
  return end
}

/**
 * @param {string} instruction
 * @returns {{ maxWords: number, maxNumbers: number, constrained: boolean }}
 */
function instructionLimits(instruction) {
  const text = collapseWhitespace(instruction).toUpperCase()
  if (!text) return { maxWords: Infinity, maxNumbers: Infinity, constrained: false }
  if (/^A NUMBER\b/.test(text)) return { maxWords: 0, maxNumbers: 1, constrained: true }
  if (/^ONE WORD AND\/OR A NUMBER\b/.test(text)) {
    return { maxWords: 1, maxNumbers: 1, constrained: true }
  }
  if (/^ONE WORD ONLY\b/.test(text)) return { maxWords: 1, maxNumbers: 0, constrained: true }

  const match = text.match(/^NO MORE THAN (ONE|TWO|THREE) WORDS?( AND\/OR A NUMBER)?\b/)
  if (match) {
    /** @type {Record<string, number>} */
    const limits = { ONE: 1, TWO: 2, THREE: 3 }
    return {
      maxWords: limits[match[1]],
      maxNumbers: match[2] ? 1 : 0,
      constrained: true,
    }
  }
  return { maxWords: Infinity, maxNumbers: Infinity, constrained: false }
}

/**
 * Validate the answer-sheet instruction, independent of whether the answer is
 * semantically correct.
 * @param {unknown} answer
 * @param {string} instruction
 * @returns {FormatResult}
 */
export function validateAnswerFormat(answer, instruction) {
  const asWords = countAnswerTokens(answer)
  if (!collapseWhitespace(answer)) {
    return { ok: false, ...asWords, violations: ['EMPTY'] }
  }

  const limits = instructionLimits(instruction)
  if (!limits.constrained) return { ok: true, ...asWords, violations: [] }
  const fits = (/** @type {{ words: number, numbers: number }} */ count) =>
    count.words <= limits.maxWords && count.numbers <= limits.maxNumbers
  // A spelled-out number can be read two ways: "one two" is two words under
  // NO MORE THAN TWO WORDS, while "three hundred and twenty" is one number
  // under A NUMBER. Accept the answer if either reading fits the instruction.
  if (fits(asWords)) return { ok: true, ...asWords, violations: [] }
  const asNumber = countAnswerTokens(answer, { mergeNumberWords: true })
  if (fits(asNumber)) return { ok: true, ...asNumber, violations: [] }
  return { ok: false, ...asWords, violations: ['WORD_LIMIT'] }
}

/**
 * Levenshtein distance with an early exit once the row minimum exceeds `limit`.
 * @param {string} a
 * @param {string} b
 * @param {number} [limit]
 */
export function editDistance(a, b, limit = Infinity) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}
