import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  ERROR_CODES,
  canStart,
  getWritingLadder,
  judgeAnswer,
  overallBand,
  rawToBand,
  speakingBand,
  validateAnswerFormat,
  verifyEvidence,
  writingBand,
} from '../index.js'

describe('validateAnswerFormat', () => {
  test.each([
    ['museum', 'ONE WORD ONLY', true],
    ['too many words', 'one word only', false],
    ['2024', 'ONE WORD ONLY', false],
    ['2024', 'A NUMBER', true],
    // A spelled-out number is one number (official answer-sheet guidance); see RULES.md.
    ['twenty four', 'A NUMBER', true],
    ['the 2024', 'ONE WORD AND/OR A NUMBER', true],
    ['one two three', 'NO MORE THAN TWO WORDS', false],
    ['one two', 'no more than two words', true],
    ['one 2 3', 'NO MORE THAN TWO WORDS AND/OR A NUMBER', false],
    ['one 2', 'NO MORE THAN TWO WORDS AND/OR A NUMBER', true],
    ['one two three', 'NO MORE THAN THREE WORDS', true],
    ['one two 2', 'NO MORE THAN THREE WORDS AND/OR A NUMBER', true],
    ['state-of-the-art', 'ONE WORD ONLY', true],
  ])('%s with %s => %s', (answer, instruction, ok) => {
    expect(validateAnswerFormat(answer, instruction).ok).toBe(ok)
  })

  test('empty answer is reported explicitly', () => {
    expect(validateAnswerFormat('   ', 'ONE WORD ONLY')).toEqual({
      ok: false, words: 0, numbers: 0, violations: [ERROR_CODES.EMPTY],
    })
  })

  test('word-limit violation contains only the stable code', () => {
    expect(validateAnswerFormat('a b c', 'NO MORE THAN TWO WORDS')).toEqual({
      ok: false, words: 3, numbers: 0, violations: [ERROR_CODES.WORD_LIMIT],
    })
  })
})

describe('judgeAnswer', () => {
  test('empty', () => {
    expect(judgeAnswer({ type: 'gap', key: 'museum', instruction: 'ONE WORD ONLY' }, '')).toEqual({
      correct: false, errors: [ERROR_CODES.EMPTY],
    })
  })

  test('word limit beats an otherwise matching answer', () => {
    expect(judgeAnswer({ type: 'gap', key: 'the museum', instruction: 'ONE WORD ONLY' }, 'the museum')).toEqual({
      correct: false, errors: [ERROR_CODES.WORD_LIMIT],
    })
  })

  test('accepts alternatives and optional parenthesized words', () => {
    expect(judgeAnswer({ type: 'gap', key: 'colour/color' }, 'Color').correct).toBe(true)
    expect(judgeAnswer({ type: 'gap', key: '(the) museum' }, 'museum').correct).toBe(true)
    expect(judgeAnswer({ type: 'gap', key: '(the) museum' }, 'the museum').correct).toBe(true)
    expect(judgeAnswer({ type: 'matching', key: ['ii', 'iv'] }, 'IV').correct).toBe(true)
  })

  test('detects plural alterations', () => {
    expect(judgeAnswer({ type: 'gap', key: 'city' }, 'cities')).toEqual({
      correct: false, errors: [ERROR_CODES.PLURAL],
    })
    expect(judgeAnswer({ type: 'gap', key: 'cats' }, 'cat')).toEqual({
      correct: false, errors: [ERROR_CODES.PLURAL],
    })
  })

  test('detects a one- or two-character spelling error', () => {
    expect(judgeAnswer({ type: 'gap', key: 'museum' }, 'mueseum')).toEqual({
      correct: false, errors: [ERROR_CODES.SPELLING],
    })
  })

  test('rejects a spelling error farther than two edits', () => {
    expect(judgeAnswer({ type: 'gap', key: 'environment' }, 'enviromentx')).toEqual({
      correct: false, errors: [ERROR_CODES.SPELLING],
    })
    expect(judgeAnswer({ type: 'gap', key: 'environment' }, 'completely')).toEqual({
      correct: false, errors: [ERROR_CODES.MISMATCH],
    })
  })

  test('TRUE/FALSE/NOT GIVEN is case-insensitive and uses its own label set', () => {
    expect(judgeAnswer({ type: 'tfng', key: 'NOT GIVEN' }, 'not given').correct).toBe(true)
    expect(judgeAnswer({ type: 'tfng', key: 'TRUE' }, 'YES')).toEqual({
      correct: false, errors: [ERROR_CODES.WRONG_LABEL_SET],
    })
    expect(judgeAnswer({ type: 'tfng', key: 'FALSE' }, 'F').errors).toEqual([ERROR_CODES.MISMATCH])
  })

  test('YES/NO/NOT GIVEN is case-insensitive and uses its own label set', () => {
    expect(judgeAnswer({ type: 'ynng', key: 'NO' }, 'no').correct).toBe(true)
    expect(judgeAnswer({ type: 'ynng', key: 'YES' }, 'TRUE')).toEqual({
      correct: false, errors: [ERROR_CODES.WRONG_LABEL_SET],
    })
  })

  test('single and multiple choice answers', () => {
    expect(judgeAnswer({ type: 'mcq', key: 'B' }, 'b').correct).toBe(true)
    expect(judgeAnswer({ type: 'mcq-multi', key: ['A', 'C'] }, 'C, A').correct).toBe(true)
    expect(judgeAnswer({ type: 'mcq-multi', key: ['A', 'C'] }, 'A B').errors).toEqual([ERROR_CODES.MISMATCH])
  })
})

describe('band conversion and aggregation', () => {
  test.each([
    ['listening', 40, 9], ['listening', 39, 9], ['listening', 38, 8.5], ['listening', 30, 7],
    ['listening', 23, 6], ['listening', 16, 5], ['listening', 1, 1], ['listening', 0, 0],
    ['reading-academic', 39, 9], ['reading-academic', 35, 8], ['reading-academic', 27, 6.5],
    ['reading-academic', 19, 5.5], ['reading-academic', 10, 4],
    ['reading-general', 40, 9], ['reading-general', 39, 8.5], ['reading-general', 36, 7.5],
    ['reading-general', 30, 6], ['reading-general', 23, 5], ['reading-general', 15, 4],
  ])('%s raw %i => %s', (module, raw, band) => {
    expect(rawToBand(module, raw)).toBe(band)
  })

  test('invalid raw scores and modules are rejected', () => {
    expect(() => rawToBand('listening', 41)).toThrow(RangeError)
    expect(() => rawToBand('listening', 1.5)).toThrow(RangeError)
    expect(() => rawToBand('other', 10)).toThrow(RangeError)
  })

  test('overall average rounds to the nearest half band', () => {
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6, speaking: 6 })).toBe(6.5)
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 6 })).toBe(6.5)
    expect(overallBand({ listening: 7, reading: 7, writing: 7, speaking: 6 })).toBe(7)
  })

  test('writing gives Task 2 twice the weight and rounds to a half band', () => {
    expect(writingBand({
      task1: { ta: 6, cc: 6, lr: 6, gra: 6 },
      task2: { tr: 7, cc: 7, lr: 7, gra: 7 },
    })).toBe(6.5)
    expect(writingBand({
      task1: { ta: 5, cc: 5, lr: 5, gra: 5 },
      task2: { tr: 5, cc: 5, lr: 5, gra: 5 },
    })).toBe(5)
  })

  test('speaking requires all four criteria', () => {
    expect(speakingBand({ fc: 7, lr: 6, gra: 6, p: 7 })).toBe(6.5)
    expect(() => speakingBand({ fc: 7, lr: 6, gra: 6 })).toThrow(RangeError)
  })
})

describe('verifyEvidence', () => {
  test('ignores case and collapsed whitespace', () => {
    expect(verifyEvidence('The Museum   opens at nine.\nIt closes late.', ['the museum opens at nine'])).toEqual({
      ok: true, missing: [],
    })
  })

  test('lists every quote that is not verbatim', () => {
    expect(verifyEvidence('The museum opens at nine.', ['The museum opens at nine.', 'It closes late'])).toEqual({
      ok: false, missing: ['It closes late'],
    })
  })

  test('empty evidence is not accepted', () => {
    expect(verifyEvidence('anything', '')).toEqual({ ok: false, missing: [''] })
  })
})

describe('writing ladder', () => {
  test('exposes every fixed item id', () => {
    expect(getWritingLadder().map(item => item.id)).toEqual([
      't1-intro', 't1-overview', 't1-body', 'mock-t1', 't2-intro', 't2-conclusion',
      't2-outline', 't2-body', 'mock-t2', 'mock-full', 'translation',
    ])
  })

  test('enforces sequential unlocks and the two Task 2 branches', () => {
    expect(canStart({ completed: [] }, 't1-intro')).toBe(true)
    expect(canStart({ completed: [] }, 't1-overview')).toBe(false)
    expect(canStart({ completed: ['t1-intro'] }, 't1-overview')).toBe(true)
    expect(canStart({ completed: ['t2-intro'] }, 't2-outline')).toBe(false)
    expect(canStart({ completed: ['t2-intro', 't2-conclusion'] }, 't2-outline')).toBe(true)
    expect(canStart({ completed: ['mock-t1'] }, 'mock-full')).toBe(false)
    expect(canStart({ completed: ['mock-t1', 'mock-t2'] }, 'mock-full')).toBe(true)
    expect(canStart({ completed: [] }, 'translation')).toBe(true)
    expect(canStart({ completed: [] }, 'does-not-exist')).toBe(false)
  })
})

describe('framework independence', () => {
  test('core imports stay inside the core directory and never touch browser/network APIs', () => {
    const root = join(process.cwd(), 'src/features/ielts/core')
    const files = readdirSync(root).filter(name => name.endsWith('.js'))
    for (const file of files.filter(name => !name.endsWith('.test.js'))) {
      expect(statSync(join(root, file)).isFile()).toBe(true)
      const source = readFileSync(join(root, file), 'utf8')
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1])
      for (const specifier of imports) {
        expect(specifier.startsWith('./'), `${file} imports ${specifier}`).toBe(true)
      }
      expect(source).not.toMatch(/\b(?:react|localStorage|sessionStorage|document|window|fetch|XMLHttpRequest)\b/i)
    }
  })
})
