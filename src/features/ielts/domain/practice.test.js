import { beforeEach, describe, expect, test } from 'vitest'
import { buildDictationList, parseCustomWords, recordDictation } from './dictation.js'
import { buildWeaknessProfile, methodTrend } from './review.js'
import { getActiveMethod, loadMethods, saveMethod, setActiveMethod, deleteMethod } from '../storage.js'

const record = (correctAnswer, cause, extra = {}) => ({ id: `ielts:${correctAnswer}`, domain: 'ielts', correctAnswer, errorCause: cause, ruleCause: cause, source: 's', ...extra })

describe('dictation', () => {
  test('only write-side causes, first accepted spelling, deduplicated, learned words last', () => {
    const list = buildDictationList([
      record('colour/color', '拼写或格式'),
      record('slot', '单复数'),
      record('slot', '单复数', { id: 'dup' }),
      record('river', '同义替换没识别'),
      record('a very long answer of many words', '拼写或格式'),
    ], { words: { colour: { streak: 3 } } })
    expect(list.map(item => item.say)).toEqual(['slot', 'colour'])
  })

  test('history counts attempts and resets the streak on a miss', () => {
    let history = recordDictation({}, 'slot', true)
    history = recordDictation(history, 'slot', true)
    expect(history.words.slot).toMatchObject({ attempts: 2, correct: 2, streak: 2 })
    history = recordDictation(history, 'slot', false)
    expect(history.words.slot.streak).toBe(0)
  })

  test('custom words split on lines and commas', () => {
    expect(parseCustomWords('accommodation, Wednesday\nWednesday').map(item => item.say)).toEqual(['accommodation', 'Wednesday'])
  })
})

describe('method trend', () => {
  const method = { id: 'parallel-reading', metrics: [{ id: 'rereads', label: '无效回读次数' }] }
  test('compares the first and the last five reviews that used the method', () => {
    const reviews = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`, methodId: 'parallel-reading', source: `P${i}`, createdAt: i, total: 13, correct: 6 + i % 2 + (i >= 5 ? 3 : 0), methodMetrics: { rereads: i >= 5 ? 1 : 4 },
    }))
    reviews.push({ id: 'other', methodId: 'x', total: 13, correct: 0, createdAt: 99 })
    const trend = methodTrend(reviews, method)
    expect(trend.rows).toHaveLength(10)
    const [accuracy, rereads] = trend.compare
    expect(accuracy.recent).toBeGreaterThan(accuracy.early)
    expect(rereads).toMatchObject({ early: 4, recent: 1 })
  })
  test('no comparison until there are more than five reviews', () => {
    expect(methodTrend([{ id: 'a', methodId: 'parallel-reading', total: 10, correct: 5, createdAt: 1 }], method).compare[0].recent).toBeNull()
  })
})

describe('weakness profile', () => {
  test('“待归类” is never the top cause', () => {
    const profile = buildWeaknessProfile([
      record('a', '待归类'), record('b', '待归类'), record('c', '单复数'),
    ].map(item => ({ ...item, createdAt: 1 })))
    expect(profile.topCause).toBe('单复数')
    expect(profile.unclassified).toBe(2)
  })
})

describe('methods store', () => {
  beforeEach(() => localStorage.clear())
  test('built-in parallel reading is active by default; edits override, delete restores', () => {
    expect(getActiveMethod('reading')?.title).toBe('平行阅读法')
    const original = loadMethods().find(method => method.id === 'parallel-reading')
    saveMethod({ ...original, title: '平行阅读法（我的版本）' })
    expect(getActiveMethod('reading')?.title).toBe('平行阅读法（我的版本）')
    expect(loadMethods().find(method => method.id === 'parallel-reading')).toMatchObject({ builtin: true, edited: true })
    deleteMethod('parallel-reading')
    expect(getActiveMethod('reading')?.title).toBe('平行阅读法')
  })
  test('own methods can be added and switched to; listening has none by default', () => {
    saveMethod({ id: 'mine', module: 'reading', title: '先做人名', steps: [] })
    setActiveMethod('reading', 'mine')
    expect(getActiveMethod('reading')?.id).toBe('mine')
    expect(getActiveMethod('listening')).toBeNull()
  })
})
