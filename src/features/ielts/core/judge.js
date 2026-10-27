import { ERROR_CODES } from './constants.js'
import { collapseWhitespace, editDistance, normalizeText, validateAnswerFormat } from './text.js'

/** @typedef {{ type: string, key: string|string[], instruction?: string }} JudgeQuestion */

/**
 * Expand slash alternatives and parenthesized optional fragments without
 * assuming a full IELTS grammar. `(the) museum` accepts both `the museum` and
 * `museum`; `colour/color` accepts either spelling.
 * @param {string} raw
 * @returns {string[]}
 */
export function expandAcceptedAnswers(raw) {
  const source = collapseWhitespace(raw)
  if (!source) return []

  /** @param {string} value @returns {string[]} */
  function expand(value) {
    const open = value.indexOf('(')
    if (open >= 0) {
      let depth = 0
      let close = -1
      for (let i = open; i < value.length; i++) {
        if (value[i] === '(') depth++
        else if (value[i] === ')') {
          depth--
          if (depth === 0) { close = i; break }
        }
      }
      if (close > open) {
        const before = value.slice(0, open)
        const inside = value.slice(open + 1, close)
        const after = value.slice(close + 1)
        const withPart = `${before}${inside}${after}`
        const withoutPart = `${before}${after}`
        return [...expand(withPart), ...expand(withoutPart)]
      }
    }

    const parts = splitTopLevelSlash(value)
    if (parts.length > 1) return parts.flatMap(expand)
    return [collapseWhitespace(value)]
  }

  return [...new Set(expand(source).filter(Boolean))]
}

/** @param {string} value @returns {string[]} */
function splitTopLevelSlash(value) {
  const result = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth = Math.max(0, depth - 1)
    else if (value[i] === '/' && depth === 0) {
      result.push(value.slice(start, i))
      start = i + 1
    }
  }
  result.push(value.slice(start))
  return result
}

/** @param {unknown} key */
function keyList(key) {
  if (Array.isArray(key)) return key.flatMap(value => expandAcceptedAnswers(String(value ?? '')))
  return expandAcceptedAnswers(String(key ?? ''))
}

/** @param {string} value */
function canonical(value) {
  return normalizeText(value)
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
    .replace(/\s*([,;:])\s*/g, '$1')
}

/** @param {string} value */
function canonicalChoice(value) {
  return canonical(value)
    .replace(/^[([{]+|[)\]}]+$/g, '')
    .replace(/[.!。]+$/g, '')
    .trim()
}

/** @param {string} answer @param {string[]} accepted */
function pluralMatches(answer, accepted) {
  const variants = new Set()
  const add = (/** @type {string} */ word) => {
    if (!word) return
    variants.add(word)
    if (word.endsWith('ies')) variants.add(`${word.slice(0, -3)}y`)
    if (word.endsWith('es')) variants.add(word.slice(0, -2))
    if (word.endsWith('s')) variants.add(word.slice(0, -1))
    if (word.endsWith('y')) variants.add(`${word.slice(0, -1)}ies`)
    variants.add(`${word}s`)
    variants.add(`${word}es`)
  }
  add(answer)
  return accepted.some(candidate => {
    if (!candidate) return false
    const candidateVariants = new Set()
    const collect = (/** @type {string} */ word) => {
      if (!word) return
      candidateVariants.add(word)
      if (word.endsWith('ies')) candidateVariants.add(`${word.slice(0, -3)}y`)
      if (word.endsWith('es')) candidateVariants.add(word.slice(0, -2))
      if (word.endsWith('s')) candidateVariants.add(word.slice(0, -1))
      if (word.endsWith('y')) candidateVariants.add(`${word.slice(0, -1)}ies`)
      candidateVariants.add(`${word}s`)
      candidateVariants.add(`${word}es`)
    }
    collect(candidate)
    return [...variants].some(word => word !== candidate && candidateVariants.has(word))
  })
}

const WRONG_FOR_TFNG = new Set(['yes', 'no'])
const WRONG_FOR_YNNG = new Set(['true', 'false'])

/** @param {string[]} values */
function choiceSet(values) {
  return new Set(values.flatMap(value => {
    const text = canonicalChoice(value)
    if (!text) return []
    if (/^[a-z](?:\s*[,;/]\s*[a-z])+$/i.test(text)) {
      return text.split(/\s*[,;/]\s*/).filter(Boolean)
    }
    if (/^[a-z]{2,4}$/i.test(text)) return text.split('')
    return [text]
  }))
}

/**
 * Deterministically compare one answer with the answer key.
 * @param {JudgeQuestion} question
 * @param {unknown} userAnswer
 * @returns {{ correct: boolean, errors: string[] }}
 */
export function judgeAnswer(question, userAnswer) {
  const rawAnswer = Array.isArray(userAnswer) ? userAnswer.join(', ') : String(userAnswer ?? '')
  if (!collapseWhitespace(rawAnswer)) return { correct: false, errors: [ERROR_CODES.EMPTY] }

  const type = String(question?.type || 'gap').toLowerCase()
  const accepted = keyList(question?.key)
  const answer = type === 'mcq' || type === 'mcq-multi' ? canonicalChoice(rawAnswer) : canonical(rawAnswer)

  if (type === 'tfng' || type === 'ynng') {
    const wrongSet = type === 'tfng' ? WRONG_FOR_TFNG : WRONG_FOR_YNNG
    const answerLabel = canonical(answer).replace(/-/g, ' ')
    if (wrongSet.has(answerLabel)) return { correct: false, errors: [ERROR_CODES.WRONG_LABEL_SET] }
    const acceptedLabels = accepted.map(value => canonical(value).replace(/-/g, ' '))
    if (acceptedLabels.some(value => value === answerLabel)) return { correct: true, errors: [] }
    return { correct: false, errors: [ERROR_CODES.MISMATCH] }
  }

  if (type === 'mcq-multi') {
    const expected = choiceSet(accepted)
    const actual = choiceSet([rawAnswer])
    const same = expected.size === actual.size && [...expected].every(value => actual.has(value))
    return { correct: same, errors: same ? [] : [ERROR_CODES.MISMATCH] }
  }

  if (type === 'mcq') {
    const actual = canonicalChoice(answer)
    const match = accepted.some(value => canonicalChoice(value) === actual)
    return { correct: match, errors: match ? [] : [ERROR_CODES.MISMATCH] }
  }

  const format = validateInstruction(question?.instruction, rawAnswer)
  if (!format) return { correct: false, errors: [ERROR_CODES.WORD_LIMIT] }

  const canonicalAccepted = accepted.map(canonical).filter(Boolean)
  if (canonicalAccepted.includes(answer)) return { correct: true, errors: [] }
  if (pluralMatches(answer, canonicalAccepted)) {
    return { correct: false, errors: [ERROR_CODES.PLURAL] }
  }
  if (canonicalAccepted.some(value => {
    const distance = editDistance(answer, value, 2)
    return distance >= 1 && distance <= 2
  })) {
    return { correct: false, errors: [ERROR_CODES.SPELLING] }
  }
  return { correct: false, errors: [ERROR_CODES.MISMATCH] }
}

/** @param {string|undefined} instruction @param {string} answer */
function validateInstruction(instruction, answer) {
  return validateAnswerFormat(answer, String(instruction ?? '')).ok
}
