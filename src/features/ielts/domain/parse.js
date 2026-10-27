import { TYPE_LABELS } from '../data/causes.js'

/**
 * Split a numbered paste into entries. Supports `1.`/`1)` starts, ranges such
 * as `21–22.` (kept on one entry) and wrapped lines. Deliberately conservative:
 * ambiguous text remains one entry for manual editing instead of guessing.
 * @param {string} text
 * @returns {{ number: string, text: string }[]}
 */
export function splitNumberedEntries(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const entries = []
  let current = null
  for (const line of lines) {
    const match = line.match(/^\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)\s*[.)、．]\s*(.*)$/u)
    if (match) {
      if (current) entries.push(current)
      current = { number: match[1].replace(/\s+/g, ''), text: match[2].trim() }
    } else if (current) {
      current.text += `${current.text ? '\n' : ''}${line.trim()}`
    } else if (line.trim()) {
      current = { number: String(entries.length + 1), text: line.trim() }
    }
  }
  if (current) entries.push(current)
  return entries.filter(entry => entry.text.trim())
}
/** @param {string} prompt @param {string[]} options */
export function inferQuestionType(prompt, options = []) {
  const text = String(prompt || '').toUpperCase()
  if (/TRUE\s*\/\s*FALSE\s*\/\s*NOT\s*GIVEN/.test(text)) return 'tfng'
  if (/YES\s*\/\s*NO\s*\/\s*NOT\s*GIVEN/.test(text)) return 'ynng'
  if (/CHOOSE\s+(?:TWO|THREE)|SELECT\s+(?:TWO|THREE)/.test(text)) return 'mcq-multi'
  if (options.length > 0) return 'mcq'
  if (/HEADING|MATCH|WHICH PARAGRAPH|WHOSE OPINION/i.test(text)) return 'matching'
  return 'gap'
}

/** @param {string} body @returns {{ prompt: string, options: string[] }} */
function splitOptions(body) {
  const lines = String(body || '').split('\n')
  const optionLines = []
  const promptLines = []
  for (const line of lines) {
    if (/^\s*[A-H]\s*[.)、:：]\s+/i.test(line)) optionLines.push(line.trim())
    else if (optionLines.length) optionLines.push(line.trim())
    else promptLines.push(line.trim())
  }
  return { prompt: promptLines.join(' ').trim(), options: optionLines.filter(Boolean) }
}

/** @param {string} questionPaste @param {string} answerPaste @param {string} userPaste */
export function parseReviewPaste(questionPaste, answerPaste = '', userPaste = '') {
  const entries = splitNumberedEntries(questionPaste)
  const answers = Object.fromEntries(splitNumberedEntries(answerPaste).map(entry => [entry.number, entry.text.trim()]))
  const users = Object.fromEntries(splitNumberedEntries(userPaste).map(entry => [entry.number, entry.text.trim()]))
  return entries.map((entry, index) => {
    const { prompt, options } = splitOptions(entry.text)
    return {
      id: `q-${Date.now()}-${index}`,
      number: entry.number,
      type: inferQuestionType(prompt, options),
      prompt,
      options,
      key: answers[entry.number] || '',
      userAnswer: users[entry.number] || '',
      instruction: '',
    }
  })
}

/** @param {object[]} questions @returns {object[]} */
export function parseAnswerLines(questions, answerPaste) {
  const answers = Object.fromEntries(splitNumberedEntries(answerPaste).map(entry => [entry.number, entry.text.trim()]))
  return questions.map(question => ({ ...question, key: answers[String(question.number)] ?? question.key ?? '' }))
}

/** @param {object} question */
export function questionTypeLabel(question) {
  return TYPE_LABELS[question.type] || question.type
}

/** @param {string} value */
export function parseMultiKey(value) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .split(/[,;/\s]+/)
    .map(part => part.trim())
    .filter(Boolean)
}

/** Convert line breaks used by the editable answer key field to arrays. */
export function normalizeQuestionForJudge(question) {
  if (question.type === 'mcq-multi') {
    return { ...question, key: parseMultiKey(question.key) }
  }
  return question
}
