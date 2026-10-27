/**
 * Shorthand answer entry: "1 TRUE 2 NG 3 car park 4 B" → one answer per
 * question number. A number token starts a new answer only when it is the
 * next expected question number and the current answer already has content,
 * so numeric answers ("5 320 6 B") and answers equal to the next number
 * ("5 6 6 B" → 5:"6", 6:"B") stay intact.
 *
 * Label abbreviations (T/F/NG/Y/N) are expanded because the learner typed
 * the shorthand on purpose here; the judge itself never accepts them.
 */

/** @typedef {{ number: number, answer: string }} LineAnswer */
/** @typedef {{ answers: LineAnswer[], warnings: string[] }} AnswerLineResult */

const LABELS = Object.freeze({
  t: 'TRUE',
  f: 'FALSE',
  ng: 'NOT GIVEN',
  y: 'YES',
  n: 'NO',
  true: 'TRUE',
  false: 'FALSE',
  yes: 'YES',
  no: 'NO',
  'not given': 'NOT GIVEN',
  notgiven: 'NOT GIVEN',
})

/**
 * Expand a judgement-label abbreviation; other answers come back unchanged.
 * Expansion only happens when `labelSet` says the question is a judgement
 * question, so "n" in a gap question is not turned into "NO".
 * @param {string} answer
 * @param {'tfng'|'ynng'|''} [labelSet]
 */
export function expandLabel(answer, labelSet = '') {
  const value = String(answer ?? '').trim()
  if (!labelSet) return value
  const expanded = LABELS[value.toLowerCase().replace(/\s+/g, ' ')]
  if (!expanded) return value
  if (labelSet === 'tfng' && (value.toLowerCase() === 'y' || value.toLowerCase() === 'n')) return value
  if (labelSet === 'ynng' && (value.toLowerCase() === 't' || value.toLowerCase() === 'f')) return value
  return expanded
}

/** @param {string} token */
function numberPrefix(token) {
  // "3." / "3)" / "3:museum" carry the answer after the punctuation; a bare
  // "320" or "15th" is never a question number.
  const match = token.match(/^(\d{1,2})(?:[.)、:：](.*))?$/u)
  if (!match) return null
  return { number: Number(match[1]), rest: match[2] || '' }
}

/**
 * @param {string} line
 * @param {{ first?: number, types?: Record<number, string> }} [options]
 *   `first`: the first question number when the line does not start with one;
 *   `types`: question number → type, used to expand T/F/NG style shorthand.
 * @returns {AnswerLineResult}
 */
export function parseAnswerLine(line, options = {}) {
  const text = String(line ?? '').replace(/[，,;；\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  /** @type {AnswerLineResult} */
  const result = { answers: [], warnings: [] }
  if (!text) return result

  const tokens = text.split(' ')
  /** @type {{ number: number, parts: string[] } | null} */
  let current = null
  const finish = () => {
    if (!current) return
    const raw = current.parts.join(' ').trim()
    const type = options.types?.[current.number]
    const labelSet = type === 'tfng' || type === 'ynng' ? type : ''
    if (!raw) result.warnings.push(`第 ${current.number} 题没有答案`)
    result.answers.push({ number: current.number, answer: expandLabel(raw, labelSet) })
  }

  for (const token of tokens) {
    const prefix = numberPrefix(token)
    const expected = current ? current.number + 1 : null
    const startsNew = prefix && (
      current === null ||
      (prefix.number === expected && current.parts.length > 0)
    )
    if (startsNew && prefix) {
      finish()
      current = { number: prefix.number, parts: prefix.rest ? [prefix.rest] : [] }
      continue
    }
    if (!current) current = { number: Number(options.first) || 1, parts: [] }
    current.parts.push(token)
  }
  finish()

  const seen = new Set()
  for (const { number } of result.answers) {
    if (seen.has(number)) result.warnings.push(`第 ${number} 题出现了两次`)
    seen.add(number)
  }
  return result
}
