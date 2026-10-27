import { beforeEach, describe, expect, test } from 'vitest'
import {
  appendModelAudit,
  auditVariableMetrics,
  buildReproductionBundle,
  clearModelAudit,
  loadModelAudit,
  sanitizeAuditValue,
  updateAuditEvidence,
  verifyTemplateEvidence,
} from './auditLog.js'
import { SAMPLE_READING } from '../data/samples.js'

beforeEach(() => localStorage.clear())

describe('sanitized model audit', () => {
  test('logs metadata/output but not API keys or raw variable text', () => {
    const variables = { passage: SAMPLE_READING.passage, apiKey: 'sk-super-secret-key' }
    const id = appendModelAudit({
      callId: 'call-1', templateId: 'ielts.reading.explain', templateVersion: '1.1.0',
      provider: 'deepseek', model: 'deepseek-chat', transport: 'direct', attempt: 1,
      status: 'success', durationMs: 42,
      output: { locationQuote: 'The Riverside Library has had a tool cabinet since 2022.', apiKey: 'sk-super-secret-key' },
      validationErrors: [], inputMetrics: auditVariableMetrics(variables),
      evidenceVerification: null,
    })
    const entries = loadModelAudit()
    expect(entries[0].id).toBe(id)
    const serialized = JSON.stringify(entries)
    expect(serialized).toContain('locationQuote')
    expect(serialized).not.toContain('sk-super-secret-key')
    expect(serialized).not.toContain(SAMPLE_READING.passage)
    expect(serialized).toContain('totalChars')
  })

  test('string output is bounded and recursively sanitized', () => {
    const sanitized = sanitizeAuditValue({ deep: { text: 'x'.repeat(1000) }, values: Array.from({ length: 50 }, (_, i) => i) })
    expect(sanitized.deep.text.length).toBe(600)
    expect(sanitized.values).toHaveLength(30)
  })

  test('evidence result can be attached to a successful call', () => {
    const id = appendModelAudit({ templateId: 'ielts.reading.explain', templateVersion: '1.1.0', status: 'success', output: {} })
    updateAuditEvidence(id, { ok: false, missingCount: 2 })
    expect(loadModelAudit()[0].evidenceVerification).toEqual({ ok: false, missingCount: 2 })
  })

  test('reproduction bundle includes templates but no secrets', () => {
    appendModelAudit({ templateId: 'ielts.reading.explain', templateVersion: '1.1.0', status: 'success', output: { whyKeyCorrect: 'ok' }, inputMetrics: { totalChars: 5 } })
    const bundle = buildReproductionBundle()
    expect(bundle.templates[0]).toMatchObject({ id: 'ielts.reading.explain', version: '1.1.0' })
    expect(bundle.privacy.apiKeysIncluded).toBe(false)
    expect(JSON.stringify(bundle)).not.toContain('super-secret')
    clearModelAudit()
    expect(loadModelAudit()).toEqual([])
  })

  test('reproduction bundle can include a historical template version', () => {
    appendModelAudit({ templateId: 'ielts.reading.explain', templateVersion: '1.0.0', status: 'success', output: {} })
    const bundle = buildReproductionBundle()
    expect(bundle.templates[0]).toMatchObject({ id: 'ielts.reading.explain', version: '1.0.0', available: true })
    expect(bundle.templates[0].outputSchema.required).not.toContain('causeBasis')
  })
})

test('template evidence verification checks all quoted fields', () => {
  const output = {
    locationQuote: 'The cabinet sits beside the reading room',
    synonymPairs: [{ question: 'next to', passage: 'beside the reading room' }],
  }
  expect(verifyTemplateEvidence('ielts.reading.explain', { passage: SAMPLE_READING.passage }, output)).toEqual({ ok: true, missingCount: 0 })
  expect(verifyTemplateEvidence('ielts.reading.explain', { passage: SAMPLE_READING.passage }, {
    ...output, locationQuote: 'This sentence is invented.',
  })).toEqual({ ok: false, missingCount: 1 })
})
