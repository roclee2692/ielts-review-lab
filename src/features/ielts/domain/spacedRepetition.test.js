import { describe, expect, test } from 'vitest'
import {
  REVIEW_INTERVALS_DAYS,
  applyReviewGrade,
  buildReviewQueue,
  createScheduleEntry,
  dateKey,
  gradeScheduleEntry,
  isReviewDue,
  reviewKey,
} from './spacedRepetition.js'

const NOW = new Date('2026-10-23T09:30:00Z')

describe('spaced repetition schedule', () => {
  test('intervals are deterministic and grade transitions follow the documented rule', () => {
    expect(REVIEW_INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30])
    const initial = createScheduleEntry('mistake', 'm1', NOW)
    expect(initial).toMatchObject({ stage: 0, dueDate: '2026-10-23', lapses: 0 })
    expect(isReviewDue(initial, NOW)).toBe(true)

    const good = gradeScheduleEntry(initial, 'good', NOW)
    expect(good).toMatchObject({ stage: 1, dueDate: '2026-10-24', lastGrade: 'good' })
    const again = gradeScheduleEntry(good, 'again', NOW)
    expect(again).toMatchObject({ stage: 0, dueDate: '2026-10-24', lapses: 1 })
    const hard = gradeScheduleEntry(good, 'hard', NOW)
    expect(hard).toMatchObject({ stage: 1, dueDate: '2026-10-24' })
    const easy = gradeScheduleEntry(initial, 'easy', NOW)
    expect(easy).toMatchObject({ stage: 2, dueDate: '2026-10-26' })
    const mature = [1, 2, 3, 4, 5].reduce(entry => gradeScheduleEntry(entry, 'good', NOW), initial)
    expect(mature).toMatchObject({ stage: 5, dueDate: '2026-11-22' })
    expect(() => gradeScheduleEntry(initial, 'unknown')).toThrow()
  })

  test('review dates roll over correctly across a month boundary', () => {
    const entry = gradeScheduleEntry(createScheduleEntry('vocab', 'v1', new Date('2026-10-30T10:00:00Z')), 'good', new Date('2026-10-30T10:00:00Z'))
    expect(entry.dueDate).toBe('2026-10-31')
    const next = gradeScheduleEntry(entry, 'good', new Date('2026-10-31T10:00:00Z'))
    expect(next.dueDate).toBe('2026-11-03')
  })

  test('persisting a grade updates only the matching schedule key', () => {
    const item = { key: reviewKey('vocab', 'v1'), kind: 'vocab', sourceId: 'v1' }
    const next = applyReviewGrade({ version: 1, items: { other: { stage: 2 } } }, item, 'good', NOW)
    expect(next.items.other).toEqual({ stage: 2 })
    expect(next.items[item.key]).toMatchObject({ stage: 1, sourceId: 'v1' })
  })
})

describe('today review queue', () => {
  const records = [
    { id: 'r1', domain: 'ielts', module: 'reading', source: 'Set A Passage 1', questionSummary: 'Q1', correctAnswer: 'TRUE', errorCause: '定位失败', locationHint: 'Paragraph A' },
    { id: 'l1', domain: 'ielts', module: 'listening', source: 'Set A Part 1', questionSummary: 'Q2', correctAnswer: 'nine', errorCause: '数字时间日期', reflection: '听成 eight' },
    { id: 'a1', domain: 'algorithm', questionSummary: 'not IELTS' },
  ]
  const replacements = [{ id: 'purchase→buy', question: 'purchase', passage: 'buy' }]
  const vocabulary = { favorites: ['t1-01'], custom: [] }

  test('new items are due today and grouped by cause; non-favorites and algorithm records are excluded', () => {
    const queue = buildReviewQueue({ records, replacements, vocabulary, now: NOW })
    expect(queue.totalDue).toBe(4)
    expect(queue.counts).toEqual({ mistake: 2, replacement: 1, vocab: 1 })
    expect(queue.mistakeGroups.map(group => group.cause)).toEqual(['定位失败', '数字时间日期'])
    expect(queue.items.some(item => item.sourceId === 'a1')).toBe(false)
  })

  test('graded items move to upcoming with a persisted next date', () => {
    const first = buildReviewQueue({ records, replacements, vocabulary, now: NOW })
    const target = first.due.find(item => item.sourceId === 'r1')
    const schedule = applyReviewGrade({ version: 1, items: {} }, target, 'good', NOW)
    const second = buildReviewQueue({ records, replacements, vocabulary, schedule, now: NOW })
    expect(second.due.some(item => item.sourceId === 'r1')).toBe(false)
    expect(second.upcoming.find(item => item.sourceId === 'r1').schedule.dueDate).toBe('2026-10-24')
  })

  test('dateKey uses local calendar dates', () => {
    expect(dateKey(new Date('2026-01-02T23:59:00Z'))).toMatch(/^2026-01-0[23]$/)
  })
})
