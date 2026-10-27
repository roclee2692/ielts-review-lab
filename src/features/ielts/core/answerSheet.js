import { expandLabel, parseAnswerLine } from './answerLine.js'

/**
 * One box for both the answer key and the learner's answers, because people
 * usually mark their sheet against the key and paste the two together.
 *
 * Each entry is "number + key [+ the learner's answer]":
 *   1 FALSE NG              two judgement labels → key FALSE, mine NOT GIVEN
 *   2 two weeks | two week  explicit separator: | ｜ tab → -> 我: 我选 mine:
 *   3 B ✓                   ✓ √ 对 → mine equals the key
 *   4 C ✗ A                 ✗ × 错 followed by the learner's answer
 *   5 museum（我：musium）  answer in brackets after 我
 *   6 car park              key only; the learner's answer stays unknown
 * Entries may be on separate lines or all on one line ("1 TRUE 2 NG 3 B");
 * columns copied from a spreadsheet (tab-separated) also work.
 */

/** @typedef {{ number: number, key: string, mine: string|null, marked: 'right'|'wrong'|null }} SheetEntry */

const LABEL_TOKEN = /^(true|false|not\s+given|notgiven|ng|yes|no|t|f|y|n)$/i
const RIGHT_MARK = /^(?:✓|√|✔|对|对了|correct)$/i
const WRONG_MARK = /^(?:✗|×|✘|x|错|错了|wrong)$/i
const SEPARATOR = /\s*(?:\||｜|\t|→|->|=>|我[:：]|我选[:：]?|我写[:：]?|mine[:：])\s*/i
const BRACKET_MINE = /[（(]\s*(?:我|mine)\s*[:：]?\s*([^）)]*)[）)]/i

/** @param {string} value */
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()

/** Split "FALSE NOT GIVEN" / "NG TRUE" into two labels, or return null. @param {string} text */
function twoLabels(text) {
  const tokens = clean(text).split(' ')
  // NOT GIVEN is two tokens, so try every split point and require both sides to be labels.
  for (let cut = 1; cut < tokens.length; cut++) {
    const left = tokens.slice(0, cut).join(' ')
    const right = tokens.slice(cut).join(' ')
    if (LABEL_TOKEN.test(left) && LABEL_TOKEN.test(right)) return [left, right]
  }
  return null
}

/**
 * @param {string} rest text after the question number
 * @returns {{ key: string, mine: string|null, marked: 'right'|'wrong'|null }}
 */
export function splitKeyAndMine(rest) {
  const text = clean(rest).replace(/^(?:\||｜)\s*/, '')
  const bracket = text.match(BRACKET_MINE)
  if (bracket) return { key: clean(text.replace(BRACKET_MINE, '')), mine: clean(bracket[1]), marked: null }

  const separated = text.split(SEPARATOR)
  if (separated.length >= 2) return { key: clean(separated[0]), mine: clean(separated.slice(1).join(' ')), marked: null }

  const tokens = text.split(' ')
  const markIndex = tokens.findIndex(token => RIGHT_MARK.test(token) || WRONG_MARK.test(token))
  if (markIndex > 0) {
    const key = tokens.slice(0, markIndex).join(' ')
    const after = tokens.slice(markIndex + 1).join(' ')
    if (RIGHT_MARK.test(tokens[markIndex])) return { key, mine: key, marked: 'right' }
    return { key, mine: after ? after : null, marked: 'wrong' }
  }

  const labels = twoLabels(text)
  if (labels) return { key: labels[0], mine: labels[1], marked: null }
  return { key: text, mine: null, marked: null }
}

/**
 * @param {string} text
 * @param {{ types?: Record<number, string> }} [options] question types, to expand T/F/NG shorthand
 * @returns {{ entries: SheetEntry[], warnings: string[] }}
 */
export function parseAnswerSheet(text, options = {}) {
  // Tabs (columns copied from a spreadsheet) become the explicit separator.
  const source = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\t+/g, ' | ')
  const lines = source.split('\n').map(clean).filter(Boolean)
  // One entry (or several) per numbered line: split each line on its own, so a
  // gap in numbering ("1 …" then "4 …") still starts a new question. Otherwise
  // treat everything as one shorthand line cut on the next expected number.
  const perLine = lines.length > 1 && lines.every(line => /^\d{1,2}(?:[.)、:：]|\s|$)/u.test(line))
  const raw = (perLine ? lines : [lines.join(' ')])
    .flatMap(line => parseAnswerLine(line).answers)
    .map(item => ({ number: item.number, rest: item.answer }))

  const warnings = []
  /** @type {SheetEntry[]} */
  const entries = []
  const seen = new Set()
  for (const { number, rest } of raw) {
    if (seen.has(number)) { warnings.push(`第 ${number} 题出现了两次，只保留第一次`); continue }
    seen.add(number)
    const split = splitKeyAndMine(rest)
    const type = options.types?.[number]
    const labelSet = type === 'tfng' || type === 'ynng' ? type : inferLabelSet(split.key, split.mine)
    const key = expandLabel(split.key, labelSet)
    const mine = split.mine === null ? null : expandLabel(split.mine, labelSet)
    if (!key) warnings.push(`第 ${number} 题没有答案册答案`)
    entries.push({ number, key, mine, marked: split.marked })
  }
  entries.sort((a, b) => a.number - b.number)
  return { entries, warnings }
}

/** @param {string} key @param {string|null} mine */
function inferLabelSet(key, mine) {
  const values = [clean(key).toUpperCase(), clean(mine).toUpperCase()]
  if (values.some(value => ['TRUE', 'FALSE', 'T', 'F'].includes(value))) return 'tfng'
  if (values.some(value => ['YES', 'NO', 'Y', 'N'].includes(value))) return 'ynng'
  // NOT GIVEN alone fits both sets; it expands the same either way.
  if (values.some(value => ['NG', 'NOT GIVEN', 'NOTGIVEN'].includes(value))) return 'tfng'
  return ''
}

/**
 * Best guess of the question type from an answer key alone, for when the
 * learner did not paste the questions. They can still change it.
 * @param {string} key
 * @returns {'tfng'|'ynng'|'mcq'|'mcq-multi'|'gap'}
 */
export function inferTypeFromKey(key) {
  const value = clean(key).toUpperCase()
  if (['TRUE', 'FALSE', 'NOT GIVEN'].includes(value)) return 'tfng'
  if (['YES', 'NO'].includes(value)) return 'ynng'
  if (/^[A-H]$/.test(value) || /^[IVX]+$/.test(value)) return 'mcq'
  if (/^[A-H](?:\s*[,，、&/ ]\s*[A-H])+$/.test(value)) return 'mcq-multi'
  return 'gap'
}
