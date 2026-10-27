/**
 * Deterministic answer-error codes shared by the IELTS UI and exported tests.
 * Values intentionally equal their keys so persisted and exported records stay
 * readable even if the module is loaded in a different runtime.
 */
export const ERROR_CODES = Object.freeze({
  EMPTY: 'EMPTY',
  WORD_LIMIT: 'WORD_LIMIT',
  PLURAL: 'PLURAL',
  SPELLING: 'SPELLING',
  WRONG_LABEL_SET: 'WRONG_LABEL_SET',
  MISMATCH: 'MISMATCH',
})

/** @typedef {'EMPTY'|'WORD_LIMIT'|'PLURAL'|'SPELLING'|'WRONG_LABEL_SET'|'MISMATCH'} ErrorCode */

export const QUESTION_TYPES = Object.freeze([
  'gap',
  'tfng',
  'ynng',
  'mcq',
  'mcq-multi',
  'matching',
])
