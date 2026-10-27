import { beforeEach, describe, expect, test } from 'vitest'
import {
  IELTS_KEYS,
  clearIeltsData,
  exportIeltsData,
  loadIeltsSettings,
  saveIeltsSettings,
  saveIeltsValue,
} from './IeltsStore.js'

beforeEach(() => localStorage.clear())

describe('IELTS local settings and export', () => {
  test('settings default to DeepSeek and merge partial updates', () => {
    expect(loadIeltsSettings()).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat', transport: 'direct' })
    saveIeltsSettings({ targetBand: '7.0+', strictness: 'strict' })
    expect(loadIeltsSettings()).toMatchObject({ targetBand: '7.0+', strictness: 'strict', provider: 'deepseek' })
  })

  test('export includes learner data but never either API key', () => {
    saveIeltsSettings({ apiKey: 'sk-model-secret', ttsApiKey: 'tts-secret' })
    saveIeltsValue(IELTS_KEYS.reviews, [{ id: 'review-1', source: '原创示例' }])
    saveIeltsValue(IELTS_KEYS.reviewSchedule, { version: 1, items: { 'vocab:v1': { dueDate: '2026-10-24' } } })
    saveIeltsValue(IELTS_KEYS.modelAudit, [{ id: 'audit-1', templateId: 'ielts.reading.explain' }])
    const exported = exportIeltsData()
    const serialized = JSON.stringify(exported)
    expect(serialized).toContain('review-1')
    expect(serialized).toContain('vocab:v1')
    expect(serialized).toContain('audit-1')
    expect(serialized).not.toContain('sk-model-secret')
    expect(serialized).not.toContain('tts-secret')
  })

  test('clear removes settings, reviews, notes and imported lists', () => {
    saveIeltsSettings({ apiKey: 'secret' })
    saveIeltsValue(IELTS_KEYS.reviews, [{ id: 'r' }])
    saveIeltsValue(IELTS_KEYS.knowledge, { notes: [{ title: 'n' }], edited: {} })
    clearIeltsData()
    for (const key of Object.values(IELTS_KEYS)) expect(localStorage.getItem(key)).toBeNull()
  })
})
