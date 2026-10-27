import { describe, expect, test } from 'vitest'
import { judgeAnswer } from '../core/index.js'
import { parseReviewPaste, splitNumberedEntries } from './parse.js'
import { buildWeaknessProfile, evaluateQuestions, reviewStats } from './review.js'

describe('review paste parsing', () => {
  test('splits numbered entries and glued option lines', () => {
    expect(splitNumberedEntries('1. Alpha\nline two\n2) Beta')).toEqual([
      { number: '1', text: 'Alpha\nline two' },
      { number: '2', text: 'Beta' },
    ])
  })

  test('maps separate question, answer and user-answer pastes', () => {
    const rows = parseReviewPaste(
      '1. TRUE / FALSE / NOT GIVEN: The museum is closed.\n2. Choose ONE answer: Which day?\nA. Monday\nB. Tuesday\n3. Complete: ______',
      '1. FALSE\n2. B\n3. Tuesday',
      '1. NOT GIVEN\n2. A\n3. tuesdayy',
    )
    expect(rows.map(row => row.type)).toEqual(['tfng', 'mcq', 'gap'])
    expect(rows.map(row => row.key)).toEqual(['FALSE', 'B', 'Tuesday'])
    expect(rows[1].options).toEqual(['A. Monday', 'B. Tuesday'])
  })
})

describe('review evaluation', () => {
  test('exposes rule causes and keeps deterministic answers untouched', () => {
    const questions = [
      { id: 'q1', number: 1, type: 'tfng', key: 'TRUE', prompt: 'x' },
      { id: 'q2', number: 2, type: 'gap', key: 'cat', instruction: 'ONE WORD ONLY', prompt: 'y' },
    ]
    const results = evaluateQuestions(questions, { q1: 'YES', q2: 'cats' })
    expect(judgeAnswer({ type: 'tfng', key: 'TRUE' }, 'YES').errors).toEqual(['WRONG_LABEL_SET'])
    expect(results.map(result => result.cause)).toEqual(['判断题规则混淆（FALSE 与 NOT GIVEN）', '单复数'])
    expect(reviewStats(results)).toMatchObject({ total: 2, correct: 0, wrong: 2 })
  })

  test('empty answers are not mislabelled as a time-management cause', () => {
    const [result] = evaluateQuestions([{ id: 'q', number: 1, type: 'gap', key: 'x', prompt: 'x' }], { q: '' })
    expect(result.errors).toEqual(['EMPTY'])
    expect(result.cause).toBe('')
  })
})

test('weakness profile is data driven', () => {
  const profile = buildWeaknessProfile([
    {
      domain: 'ielts', errorCause: '同义替换没识别', type: 'gap', createdAt: Date.UTC(2026, 0, 1),
      synonyms: [{ question: 'purchase', passage: 'buy' }],
    },
    {
      domain: 'ielts', errorCause: '同义替换没识别', type: 'gap', createdAt: Date.UTC(2026, 0, 2),
      synonyms: [{ question: 'purchase', passage: 'buy' }],
    },
    { domain: 'algorithm', errorCause: '待复习' },
  ])
  expect(profile.total).toBe(2)
  expect(profile.topCause).toBe('同义替换没识别')
  expect(profile.topType).toBe('gap')
  expect(profile.repeatedSynonyms[0][1]).toBe(2)
})
