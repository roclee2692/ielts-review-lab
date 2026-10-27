import { describe, expect, test } from 'vitest'
import {
  buildBandTrend,
  buildSetMarkdownReport,
  buildTestSetReports,
  extractPartNumber,
  formatDuration,
  setDisplayName,
} from './testSets.js'

function review(id, module, source, partNumber, correct, total, elapsedSeconds, createdAt, cause = '同义替换没识别') {
  return {
    id, module, source, partNumber, correct, total, wrong: total - correct,
    elapsedSeconds, createdAt, causeShares: wrongCauseCount(total - correct, cause),
  }
}

function wrongCauseCount(count, cause) {
  return count ? [{ cause, count, share: 1 }] : []
}

const READING = [
  review('r2', 'reading', '剑 18 Test 2 Passage 2', 2, 12, 13, 1200, 300),
  review('r1-old', 'reading', '剑 18 Test 2 Passage 1', 1, 8, 13, 1100, 100),
  review('r1-new', 'reading', '剑 18 Test 2 Passage 1', 1, 11, 13, 1050, 900),
  review('r3', 'reading', '剑 18 Test 2 Passage 3', 3, 10, 14, 1300, 1200),
  review('r-other', 'reading', '剑 18 Test 3 Passage 1', 1, 9, 13, 1000, 2000),
]

describe('source grouping', () => {
  test('extracts Part/Passage numbers and strips them from set titles', () => {
    expect(extractPartNumber('剑 18 Test 2 Passage 3')).toBe(3)
    expect(extractPartNumber('Cambridge 19 Part 4')).toBe(4)
    expect(extractPartNumber('原创示例，非真题')).toBeNull()
    expect(setDisplayName('剑 18 Test 2 Passage 3')).toBe('剑 18 Test 2')
  })

  test('formats durations without inventing missing time', () => {
    expect(formatDuration(0)).toBe('未记录')
    expect(formatDuration(65)).toBe('1 分 5 秒')
    expect(formatDuration(3720)).toBe('1 小时 2 分钟')
  })
})

describe('whole-set reports', () => {
  test('groups 3 readings, keeps the latest attempt and sums recorded time', () => {
    const reports = buildTestSetReports(READING)
    const set = reports.find(report => report.source.includes('Test 2'))
    expect(set.completed).toBe(true)
    expect(set.missingParts).toEqual([])
    expect(set.parts.map(part => part.reviewId)).toEqual(['r1-new', 'r2', 'r3'])
    expect(set.total).toBe(40)
    expect(set.correct).toBe(33)
    expect(set.elapsedSeconds).toBe(3550)
    expect(set.accuracy).toBeCloseTo(0.825)
    expect(set.estimate).toMatchObject({ raw: 33, total: 40, band: 7.5 })
  })

  test('incomplete sets are shown but never estimated', () => {
    const reports = buildTestSetReports([...READING, review('l1', 'listening', 'Set B Part 1', 1, 8, 10, 300, 500)])
    const listening = reports.find(report => report.module === 'listening')
    expect(listening.completed).toBe(false)
    expect(listening.missingParts).toEqual([2, 3, 4])
    expect(listening.estimate).toBeNull()
  })

  test('band trend contains only complete sets and is chronological', () => {
    const completeListen = [1, 2, 3, 4].map(part => review(`l${part}`, 'listening', `Set C Part ${part}`, part, 9, 10, 300, 3000 + part))
    const reports = buildTestSetReports([...READING, ...completeListen])
    const trend = buildBandTrend(reports)
    expect(trend).toHaveLength(2)
    expect(trend[0].module).toBe('reading')
    expect(trend[1].module).toBe('listening')
  })

  test('Markdown report contains time, part accuracy, estimate and trend caveat', () => {
    const reports = buildTestSetReports(READING)
    const set = reports.find(report => report.source.includes('Test 2'))
    const markdown = buildSetMarkdownReport(set, buildBandTrend(reports))
    expect(markdown).toContain('# IELTS 阅读整套复盘')
    expect(markdown).toContain('59 分 10 秒')
    expect(markdown).toContain('82.5%')
    expect(markdown).toContain('估算 Band **7.5**')
    expect(markdown).toContain('不是官方成绩')
    expect(markdown).toContain('不含保存的全文')
  })
})
