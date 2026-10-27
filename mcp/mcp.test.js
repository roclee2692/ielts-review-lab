// @vitest-environment node
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import { createStore } from './store.js'
import { handleMessage } from './server.js'
import { callTool, ToolError } from './tools.js'

// Original sample, not exam material.
const PASSAGE = 'The community garden opened in 2019. Volunteers meet every Saturday morning to plant vegetables. The project was funded by local residents rather than by the city council.'
const QUESTIONS = [
  { number: 1, type: 'tfng', prompt: 'The garden opened before 2020.', key: 'TRUE' },
  { number: 2, type: 'tfng', prompt: 'The city council paid for the project.', key: 'FALSE' },
  { number: 3, type: 'gap', prompt: 'Volunteers meet every Saturday ______.', key: 'morning', instruction: 'ONE WORD ONLY' },
]

/** @type {ReturnType<typeof createStore>} */
let store
beforeEach(() => { store = createStore(mkdtempSync(join(tmpdir(), 'irl-mcp-'))) })

function ingest(extra = {}) {
  return callTool(store, 'ingest_passage', { module: 'reading', source: 'Sample Passage A', passage: PASSAGE, questions: QUESTIONS, answer_line: '1 T 2 NG 3 mornings', ...extra })
}

describe('ingest_passage', () => {
  test('rejects gaps in numbering, bad labels and missing keys with a list of problems', () => {
    let error
    try {
      callTool(store, 'ingest_passage', {
        module: 'reading', source: 'x', passage: PASSAGE,
        questions: [{ number: 1, type: 'tfng', key: 'YES' }, { number: 3, type: 'gap', key: '' }],
      })
    } catch (caught) { error = caught }
    expect(error).toBeInstanceOf(ToolError)
    const problems = /** @type {ToolError} */ (error).problems.join('\n')
    expect(problems).toContain('不连续')
    expect(problems).toContain('不是 TRUE / FALSE / NOT GIVEN')
    expect(problems).toContain('第 3 题没有答案册答案')
  })

  test('stores the set once and lets a retake reuse it with answers only', () => {
    const first = ingest()
    expect(first.data.question_count).toBe(3)
    const retake = callTool(store, 'ingest_passage', { module: 'reading', set_id: first.data.set_id, user_answers: { 1: 'TRUE', 2: 'FALSE', 3: 'morning' } })
    expect(retake.data.set_id).toBe(first.data.set_id)
    expect(store.listSets()).toHaveLength(1)
    expect(store.listReviews()).toHaveLength(2)
  })

  test('rejects answers for question numbers that do not exist', () => {
    expect(() => ingest({ answer_line: '', user_answers: { 9: 'x' } })).toThrow('对不上')
  })
})

describe('judge → explain → cause', () => {
  test('full review flow keeps the engine in charge', () => {
    const { data: { review_id } } = ingest()
    const judged = callTool(store, 'judge_set', { review_id })
    expect(judged.data.correct).toBe(1)
    const byNumber = Object.fromEntries(judged.data.results.map(result => [result.number, result]))
    expect(byNumber[1].correct).toBe(true) // T expanded to TRUE by the answer line
    expect(byNumber[3]).toMatchObject({ correct: false, rule_errors: ['PLURAL'], cause: '单复数', cause_basis: 'rule' })

    // quote not in the passage → rejected
    expect(() => callTool(store, 'submit_explanation', {
      review_id, number: 2, location_quote: 'The council paid for everything.',
      why_key_correct: 'x', why_user_wrong: 'y', cause: '判断题规则混淆（FALSE 与 NOT GIVEN）', confidence: 'high',
    })).toThrow('引擎校验')

    // cause outside the fixed table → rejected
    expect(() => callTool(store, 'submit_explanation', {
      review_id, number: 2, location_quote: 'funded by local residents rather than by the city council',
      why_key_correct: 'x', why_user_wrong: 'y', cause: '粗心', confidence: 'high',
    })).toThrow('引擎校验')

    const ok = callTool(store, 'submit_explanation', {
      review_id, number: 2, location_quote: 'The project was funded by local residents rather than by the city council.',
      synonym_pairs: [{ question: 'paid for', passage: 'funded by' }],
      why_key_correct: '原文明确说不是市议会出资，与题干矛盾，所以是 FALSE。', why_user_wrong: '原文给了相反信息，不是没提到。',
      cause: '判断题规则混淆（FALSE 与 NOT GIVEN）', confidence: 'high',
    })
    expect(ok.data.cause_basis).toBe('model')

    callTool(store, 'set_cause', { review_id, number: 2, cause: '同义替换没识别' })
    // a later model explanation must not overwrite the user's choice
    const again = callTool(store, 'submit_explanation', {
      review_id, number: 2, location_quote: 'rather than by the city council',
      why_key_correct: 'x', why_user_wrong: 'y', cause: '定位失败', confidence: 'low',
    })
    expect(again.data).toMatchObject({ cause: '同义替换没识别', cause_basis: 'user' })
    // a rule cause is never overwritten either
    const rule = callTool(store, 'submit_explanation', {
      review_id, number: 3, location_quote: 'every Saturday morning', why_key_correct: 'x', why_user_wrong: 'y', cause: '定位失败', confidence: 'medium',
    })
    expect(rule.data).toMatchObject({ cause: '单复数', cause_basis: 'rule' })
  })

  test('set_cause refuses correct questions and unknown causes', () => {
    const { data: { review_id } } = ingest()
    callTool(store, 'judge_set', { review_id })
    expect(() => callTool(store, 'set_cause', { review_id, number: 1, cause: '定位失败' })).toThrow('是对的')
    expect(() => callTool(store, 'set_cause', { review_id, number: 2, cause: '运气不好' })).toThrow('不在错因表')
  })
})

describe('weakness and today', () => {
  test('recurrence counts clean later sessions', () => {
    const first = ingest()
    callTool(store, 'judge_set', { review_id: first.data.review_id })
    const clean = callTool(store, 'ingest_passage', { module: 'reading', set_id: first.data.set_id, answer_line: '1 TRUE 2 FALSE 3 morning' })
    callTool(store, 'judge_set', { review_id: clean.data.review_id })
    const report = callTool(store, 'weakness', {})
    const plural = report.data.recurrence.find(row => row.cause === '单复数')
    expect(plural).toMatchObject({ sessionsAfter: 1, recurred: 0, rate: 0 })
  })

  test('wrong answers are scheduled for tomorrow, then graded', () => {
    const { data: { review_id } } = ingest()
    callTool(store, 'judge_set', { review_id })
    expect(callTool(store, 'today', {}).data.due_count).toBe(0)
    const schedule = store.getSchedule()
    const keys = Object.keys(schedule.items)
    expect(keys).toHaveLength(2)
    // pretend tomorrow arrived
    for (const key of keys) schedule.items[key].dueDate = '2000-01-01'
    store.putSchedule(schedule)
    const today = callTool(store, 'today', {})
    expect(today.data.due_count).toBe(2)
    expect(today.data.items[0]).not.toHaveProperty('answer_key')
    const graded = callTool(store, 'mark_reviewed', { key: today.data.items[0].key, grade: 'good' })
    expect(graded.data.stage).toBe(1)
  })
})

describe('JSON-RPC surface', () => {
  test('initialize negotiates a supported version and lists tools', () => {
    const init = handleMessage(store, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
    expect(init.result.protocolVersion).toBe('2025-06-18')
    const fallback = handleMessage(store, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
    expect(fallback.result.protocolVersion).toBe('2025-11-25')
    expect(handleMessage(store, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    const list = handleMessage(store, { jsonrpc: '2.0', id: 3, method: 'tools/list' })
    expect(list.result.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['ingest_passage', 'judge_set', 'submit_explanation', 'weakness', 'today']))
  })

  test('validation failures come back as isError results, unknown tools as protocol errors', () => {
    const bad = handleMessage(store, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'judge_set', arguments: { review_id: 'nope' } } })
    expect(bad.result.isError).toBe(true)
    expect(bad.result.content[0].text).toContain('找不到')
    const unknown = handleMessage(store, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'rm_rf', arguments: {} } })
    expect(unknown.error.code).toBe(-32602)
  })

  test('data folder holds plain JSON files only', () => {
    ingest()
    expect(readdirSync(join(store.dir, 'sets')).every(name => name.endsWith('.json'))).toBe(true)
  })
})
