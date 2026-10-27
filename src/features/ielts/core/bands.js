const LISTENING_ANCHORS = Object.freeze([
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  [2, 2], [1, 1], [0, 0],
])

const ACADEMIC_READING_ANCHORS = Object.freeze([
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  [2, 2], [1, 1], [0, 0],
])

const GENERAL_READING_ANCHORS = Object.freeze([
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6],
  [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5],
  [4, 2], [2, 1.5], [1, 1], [0, 0],
])

/** @param {number} value */
function roundHalfBand(value) {
  return Math.round((value + Number.EPSILON) * 2) / 2
}
/** @param {unknown} value @param {string} label */
function assertBand(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9) {
    throw new RangeError(`${label} must be a number from 0 to 9`)
  }
}

/**
 * Convert a raw score (0–40) to a half-band estimate. The tables are teaching
 * estimates anchored to the ranges published by IELTS; see RULES.md.
 * @param {'listening'|'reading-academic'|'reading-general'} module
 * @param {number} raw
 * @returns {number}
 */
export function rawToBand(module, raw) {
  if (!Number.isInteger(raw) || raw < 0 || raw > 40) throw new RangeError('raw must be an integer from 0 to 40')
  /** @type {readonly (readonly number[])[]} */
  let anchors
  if (module === 'listening') anchors = LISTENING_ANCHORS
  else if (module === 'reading-academic') anchors = ACADEMIC_READING_ANCHORS
  else if (module === 'reading-general') anchors = GENERAL_READING_ANCHORS
  else throw new RangeError(`Unknown module: ${String(module)}`)
  const found = anchors.find(([minimum]) => raw >= minimum)
  return found ? found[1] : 0
}

/**
 * Overall band: mean of four components rounded to the nearest half band.
 * @param {{ listening: number, reading: number, writing: number, speaking: number }} scores
 * @returns {number}
 */
export function overallBand({ listening, reading, writing, speaking }) {
  for (const [label, value] of Object.entries({ listening, reading, writing, speaking })) {
    assertBand(value, label)
  }
  return roundHalfBand((listening + reading + writing + speaking) / 4)
}

/** @param {{ ta: number, cc: number, lr: number, gra: number }} task1 @param {{ tr: number, cc: number, lr: number, gra: number }} task2 */
function writingTaskBand(task1, task2) {
  const t1 = [task1?.ta, task1?.cc, task1?.lr, task1?.gra]
  const t2 = [task2?.tr, task2?.cc, task2?.lr, task2?.gra]
  for (const [index, value] of t1.entries()) assertBand(value, `task1 criterion ${index + 1}`)
  for (const [index, value] of t2.entries()) assertBand(value, `task2 criterion ${index + 1}`)
  const task1Band = t1.reduce((sum, value) => sum + value, 0) / 4
  const task2Band = t2.reduce((sum, value) => sum + value, 0) / 4
  return roundHalfBand((task1Band + task2Band * 2) / 3)
}

/**
 * Writing aggregate. Task 2 has twice the weight of Task 1.
 * @param {{ task1: { ta: number, cc: number, lr: number, gra: number }, task2: { tr: number, cc: number, lr: number, gra: number } }} scores
 * @returns {number}
 */
export function writingBand({ task1, task2 }) {
  return writingTaskBand(task1, task2)
}

/**
 * Speaking aggregate when all four criteria, including pronunciation, exist.
 * The UI must not call this with a placeholder pronunciation score.
 * @param {{ fc: number, lr: number, gra: number, p: number }} scores
 * @returns {number}
 */
export function speakingBand({ fc, lr, gra, p }) {
  for (const [label, value] of Object.entries({ fc, lr, gra, p })) assertBand(value, label)
  return roundHalfBand((fc + lr + gra + p) / 4)
}
