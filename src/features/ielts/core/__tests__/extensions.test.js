import { describe, expect, test } from 'vitest'
import { causeRecurrence, judgeAnswer, parseAnswerLine, validateAnswerFormat } from '../index.js'

describe('validateAnswerFormat: numbers written in words', () => {
  test.each([
    ['three hundred and twenty', 'A NUMBER', true],
    ['twenty-five', 'A NUMBER', true],
    ['cat', 'A NUMBER', false],
    ['10 20', 'A NUMBER', false],
    ['apple 10 20', 'ONE WORD AND/OR A NUMBER', false],
    ['fifteen March', 'NO MORE THAN TWO WORDS AND/OR A NUMBER', true],
    // "and" alone is a word, not part of a number
    ['bread and butter', 'NO MORE THAN TWO WORDS', false],
    ['one and', 'A NUMBER', false],
  ])('%s · %s → %s', (answer, instruction, ok) => {
    expect(validateAnswerFormat(answer, instruction).ok).toBe(ok)
  })

  test('judge uses the same format rules', () => {
    expect(judgeAnswer({ type: 'gap', key: '320/three hundred and twenty', instruction: 'A NUMBER' }, 'three hundred and twenty').correct).toBe(true)
    expect(judgeAnswer({ type: 'gap', key: '320', instruction: 'A NUMBER' }, '10 20').errors).toEqual(['WORD_LIMIT'])
  })
})

describe('parseAnswerLine', () => {
  const answers = (/** @type {string} */ line, options = {}) =>
    Object.fromEntries(parseAnswerLine(line, options).answers.map(item => [item.number, item.answer]))

  test('splits a plain line into numbered answers', () => {
    expect(answers('1 TRUE 2 NOT GIVEN 3 museum')).toEqual({ 1: 'TRUE', 2: 'NOT GIVEN', 3: 'museum' })
  })

  test('keeps multi-word and numeric answers together', () => {
    expect(answers('14 car park 15 320 16 B')).toEqual({ 14: 'car park', 15: '320', 16: 'B' })
  })

  test('an answer equal to the next number does not start a new question', () => {
    expect(answers('5 6 6 B')).toEqual({ 5: '6', 6: 'B' })
  })

  test('accepts punctuation after numbers and commas between answers', () => {
    expect(answers('1. TRUE, 2) FALSE；3:museum')).toEqual({ 1: 'TRUE', 2: 'FALSE', 3: 'museum' })
  })

  test('expands T/F/NG only for judgement questions', () => {
    const types = { 1: 'tfng', 2: 'tfng', 3: 'gap', 4: 'ynng' }
    expect(answers('1 T 2 NG 3 n 4 N', { types })).toEqual({ 1: 'TRUE', 2: 'NOT GIVEN', 3: 'n', 4: 'NO' })
  })

  test('does not cross label sets (Y in a TFNG question stays Y and is judged as such)', () => {
    expect(answers('1 Y', { types: { 1: 'tfng' } })).toEqual({ 1: 'Y' })
  })

  test('a line without a leading number starts at options.first', () => {
    expect(answers('TRUE 2 FALSE', { first: 1 })).toEqual({ 1: 'TRUE', 2: 'FALSE' })
  })

  test('a number right after an empty question number is that question\'s answer', () => {
    // q2 has no content yet, so "3" is read as q2's answer, not as q3
    expect(answers('1 TRUE 2 3 FALSE')).toEqual({ 1: 'TRUE', 2: '3 FALSE' })
  })

  test('warns about duplicates and empty answers', () => {
    expect(parseAnswerLine('1 A 2').warnings).toContain('第 2 题没有答案')
    expect(parseAnswerLine('1 A 1 B', { first: 1 }).answers).toHaveLength(1)
  })

  test('empty input returns no answers', () => {
    expect(parseAnswerLine('   ')).toEqual({ answers: [], warnings: [] })
  })
})

describe('causeRecurrence', () => {
  const sessions = [
    { id: 'r1', module: 'reading', createdAt: 1 },
    { id: 'r2', module: 'reading', createdAt: 2 },
    { id: 'l1', module: 'listening', createdAt: 3 },
    { id: 'r3', module: 'reading', createdAt: 4 },
    { id: 'r4', module: 'reading', createdAt: 5 },
  ]

  test('counts later sessions of the same module, including clean ones', () => {
    const mistakes = [
      { reviewId: 'r1', module: 'reading', cause: '同义替换没识别' },
      { reviewId: 'r1', module: 'reading', cause: '同义替换没识别' },
      { reviewId: 'r3', module: 'reading', cause: '同义替换没识别' },
      { reviewId: 'l1', module: 'listening', cause: '漏听' },
    ]
    const rows = causeRecurrence(sessions, mistakes)
    const synonym = rows.find(row => row.cause === '同义替换没识别')
    expect(synonym).toMatchObject({ module: 'reading', sessionsAfter: 3, recurred: 1 })
    expect(synonym?.rate).toBeCloseTo(1 / 3)
    const missed = rows.find(row => row.cause === '漏听')
    expect(missed).toMatchObject({ sessionsAfter: 0, rate: null })
  })

  test('recentRate only looks at the last few sessions', () => {
    const mistakes = [
      { reviewId: 'r1', module: 'reading', cause: '定位失败' },
      { reviewId: 'r2', module: 'reading', cause: '定位失败' },
    ]
    const [row] = causeRecurrence(sessions, mistakes, { recent: 2 })
    expect(row.rate).toBeCloseTo(1 / 3)
    expect(row.recentRate).toBe(0)
  })

  test('ignores unclassified causes and unknown sessions', () => {
    const rows = causeRecurrence(sessions, [
      { reviewId: 'r1', module: 'reading', cause: '待归类' },
      { reviewId: 'zz', module: 'reading', cause: '定位失败' },
    ])
    expect(rows).toEqual([])
  })
})
