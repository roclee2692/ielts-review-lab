import { describe, expect, test } from 'vitest'
import { parseAnswerSheet } from '../core/answerSheet.js'
import { buildQuestionsFromBoxes, parseQuestionBlock } from './entry.js'
import { buildReadingReport, readingReportCsv } from './readingReport.js'

const sheet = (/** @type {string} */ text, types = {}) =>
  Object.fromEntries(parseAnswerSheet(text, { types }).entries.map(entry => [entry.number, [entry.key, entry.mine]]))

describe('parseAnswerSheet: key and my answer in one box', () => {
  test('two judgement labels → key then mine', () => {
    expect(sheet('1 FALSE NG\n2 NOT GIVEN TRUE\n3 YES NO')).toEqual({ 1: ['FALSE', 'NOT GIVEN'], 2: ['NOT GIVEN', 'TRUE'], 3: ['YES', 'NO'] })
  })
  test('explicit separators, marks and brackets', () => {
    expect(sheet('4 two weeks | two week\n5 B ✓\n6 C ✗ A\n7 museum（我：musium）\n8 car park')).toEqual({
      4: ['two weeks', 'two week'], 5: ['B', 'B'], 6: ['C', 'A'], 7: ['museum', 'musium'], 8: ['car park', null],
    })
  })
  test('columns copied from a spreadsheet (tabs)', () => {
    expect(sheet('1\tTRUE\tFALSE\n2\tlibrary\tlibraries')).toEqual({ 1: ['TRUE', 'FALSE'], 2: ['library', 'libraries'] })
  })
  test('everything on one line', () => {
    expect(sheet('1 TRUE 2 NG 3 B ✓ 4 river | rivers')).toEqual({ 1: ['TRUE', null], 2: ['NOT GIVEN', null], 3: ['B', 'B'], 4: ['river', 'rivers'] })
  })
  test('a wrong mark without my answer keeps mine unknown', () => {
    expect(parseAnswerSheet('9 D ✗').entries[0]).toMatchObject({ key: 'D', mine: null, marked: 'wrong' })
  })
  test('shorthand expands within the right label set only', () => {
    expect(sheet('1 F NG\n2 Y N')).toEqual({ 1: ['FALSE', 'NOT GIVEN'], 2: ['YES', 'NO'] })
  })
})

describe('parseQuestionBlock', () => {
  const block = `Questions 1-3
Do the following statements agree with the information given in Reading Passage 1?
Write TRUE, FALSE or NOT GIVEN.
1 The garden opened before 2020.
2 The city council paid for the project.
3 Volunteers are paid.
Questions 4-5
Complete the sentences below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.
4 Volunteers meet every Saturday ______.
5 The project was funded by local ______.
Questions 6
Choose the correct letter, A, B, C or D.
6 What is the main purpose of the garden?
A to grow food
B to teach children
C to sell vegetables
D to attract tourists`

  test('headers carry type and word limit to the questions under them', () => {
    const questions = parseQuestionBlock(block)
    expect(questions.map(question => [question.number, question.type, question.instruction])).toEqual([
      [1, 'tfng', ''], [2, 'tfng', ''], [3, 'tfng', ''],
      [4, 'gap', 'NO MORE THAN TWO WORDS'], [5, 'gap', 'NO MORE THAN TWO WORDS'],
      [6, 'mcq', ''],
    ])
    expect(questions[5].options).toHaveLength(4)
    expect(questions[0].prompt).toBe('The garden opened before 2020.')
  })

  test('three boxes merge; answers alone still work without questions', () => {
    const merged = buildQuestionsFromBoxes({ questionsText: block, answersText: '1 TRUE ✓\n2 FALSE NG\n3 NOT GIVEN\n4 morning | mornings\n5 residents\n6 A ✓', idPrefix: 't' })
    expect(merged.questions).toHaveLength(6)
    expect(merged.questions[3]).toMatchObject({ key: 'morning', userAnswer: 'mornings', instruction: 'NO MORE THAN TWO WORDS' })
    expect(merged.missingMine).toEqual([3, 5])

    const bare = buildQuestionsFromBoxes({ answersText: '1 TRUE FALSE 2 B 3 two weeks', idPrefix: 'b' })
    expect(bare.questions.map(question => question.type)).toEqual(['tfng', 'mcq', 'gap'])
  })

  test('warns about gaps in numbering and questions without answers', () => {
    const merged = buildQuestionsFromBoxes({ questionsText: '1 a\n2 b', answersText: '1 TRUE\n4 FALSE' })
    expect(merged.warnings.join('\n')).toContain('第 2 题在题目里有')
    expect(merged.warnings.join('\n')).toContain('从 2 跳到了 4')
  })
})

describe('reading report', () => {
  test('three tables in Markdown and CSV', () => {
    const results = [
      { id: 'a', number: '1', type: 'tfng', key: 'FALSE', userAnswer: 'NOT GIVEN', correct: false, ruleCause: '' },
      { id: 'b', number: '2', type: 'gap', key: 'two weeks', userAnswer: 'two weeks', correct: true },
    ]
    const explanations = {
      a: {
        cause: '判断题规则混淆（FALSE 与 NOT GIVEN）', causeBasis: 'user', situation: '首次经过答案句没认出',
        synonymPairs: [{ question: 'paid for', passage: 'funded by', mechanism: '短语替换', evidence: '直接对应', note: '' }],
        vocab: [{ en: 'subsidy', zh: '补贴', priority: '高价值' }, { en: 'epiphytic', zh: '附生的', priority: '认识即可' }],
      },
    }
    const report = buildReadingReport({ source: 'Sample A' }, results, explanations, { methodTitle: '平行阅读法', metrics: [{ label: '无效回读', value: 2 }] })
    expect(report.markdown).toContain('| 1 | 判断题 TRUE / FALSE / NOT GIVEN | NOT GIVEN | FALSE |')
    expect(report.markdown).toContain('| 1 | paid for | funded by | 短语替换 | 直接对应 |')
    expect(report.markdown).toContain('做题方法：平行阅读法 · 无效回读 2')
    expect(report.vocab[0].en).toBe('subsidy')
    const csv = readingReportCsv(report)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('同义替换,1,paid for,funded by,短语替换,直接对应,')
  })
})
