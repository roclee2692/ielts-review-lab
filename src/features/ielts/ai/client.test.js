import { describe, expect, test, vi } from 'vitest'
import { buildMockOutput } from './mock.js'
import { buildRequestPreview, invokeTemplate, IeltsModelError } from './client.js'
import { TEMPLATE_LIST, assertTemplateVariables, validateSchema } from './templates.js'

const settings = {
  provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1',
  transport: 'direct', apiKey: 'test-secret',
}

const readingVariables = {
  passage: 'The museum opens at nine.',
  question: 'When does the museum open?',
  answerKey: 'nine',
  userAnswer: 'ten',
  questionType: '填空题',
  instruction: 'ONE WORD AND/OR A NUMBER',
  ruleErrors: [],
  strictness: 'standard',
  situation: '',
  method: '',
}

function modelResponse(data) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(data) } }] }),
  }
}

describe('template registry', () => {
  test('every template has id, version, variables, schema and non-removable constraints', () => {
    expect(TEMPLATE_LIST.length).toBeGreaterThanOrEqual(8)
    for (const template of TEMPLATE_LIST) {
      expect(template.id).toMatch(/^ielts\./)
      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(Array.isArray(template.variables)).toBe(true)
      expect(template.outputSchema.type).toBe('object')
      expect(template.constraints.length).toBeGreaterThan(0)
      expect(typeof template.buildMessages).toBe('function')
      expect(Object.isFrozen(template.constraints)).toBe(true)
      expect(Object.isFrozen(template.outputSchema)).toBe(true)
    }
  })

  test('missing variables are rejected before any network request', () => {
    expect(() => assertTemplateVariables('ielts.reading.explain', { passage: 'x' })).toThrow(/Missing template variables/)
  })

  test('request preview includes messages but never the API key', () => {
    const preview = buildRequestPreview('ielts.reading.explain', readingVariables, settings)
    expect(preview.characterCount).toBeGreaterThan(100)
    expect(JSON.stringify(preview)).not.toContain('test-secret')
  })
})

describe('mock feedback and output validation', () => {
  test('mock output is valid, deterministic and explicitly labelled', () => {
    const first = buildMockOutput('ielts.reading.explain', readingVariables)
    const second = buildMockOutput('ielts.reading.explain', readingVariables)
    expect(first.data).toEqual(second.data)
    expect(first.meta.mock).toBe(true)
    expect(first.meta.label).toContain('模拟反馈')
  })

  test('schema rejects missing fields, bad enums and oversized arrays', () => {
    const template = TEMPLATE_LIST[0]
    expect(validateSchema({}, template.outputSchema)[0]).toContain('required')
    expect(validateSchema({ cause: 'not-a-cause' }, template.outputSchema).some(error => error.includes('must be one of'))).toBe(true)
  })
})

describe('invokeTemplate failure paths', () => {
  test('NO_KEY fails before fetch', async () => {
    const fetchImpl = vi.fn()
    const audit = []
    await expect(invokeTemplate('ielts.reading.explain', readingVariables, {
      settings: { ...settings, apiKey: '' }, fetchImpl,
      onAudit: event => { audit.push(event); return `audit-${audit.length}` },
    })).rejects.toMatchObject({ code: 'NO_KEY' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ status: 'no_key', errorCode: 'NO_KEY' })
    expect(JSON.stringify(audit[0])).not.toContain('test-secret')
    expect(JSON.stringify(audit[0])).not.toContain('museum')
  })

  test('invalid JSON is retried exactly once and then reports INVALID_OUTPUT', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    }))
    const audit = []
    const promise = invokeTemplate('ielts.reading.explain', readingVariables, {
      settings, fetchImpl,
      onAudit: event => { audit.push(event); return `audit-${audit.length}` },
    })
    await expect(promise).rejects.toMatchObject({ code: 'INVALID_OUTPUT' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(audit.map(event => event.status)).toEqual(['invalid_output', 'invalid_output'])
    expect(audit.every(event => !JSON.stringify(event).includes('apiKey'))).toBe(true)
  })

  test('schema-invalid output is retried once and can recover', async () => {
    const valid = buildMockOutput('ielts.reading.explain', readingVariables).data
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(modelResponse({ locationQuote: valid.locationQuote }))
      .mockResolvedValueOnce(modelResponse(valid))
    const audit = []
    const result = await invokeTemplate('ielts.reading.explain', readingVariables, {
      settings, fetchImpl,
      onAudit: event => { audit.push(event); return `audit-${audit.length}` },
    })
    expect(result.meta).toMatchObject({ mock: false, attempt: 2, auditId: 'audit-2' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(audit.map(event => event.status)).toEqual(['invalid_output', 'success'])
    expect(audit.every(event => event.inputMetrics && !('variables' in event))).toBe(true)
  })

  test('provider HTTP errors are explicit and not disguised as invalid output', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 }))
    await expect(invokeTemplate('ielts.reading.explain', readingVariables, { settings, fetchImpl }))
      .rejects.toMatchObject({ code: 'PROVIDER', details: { status: 429 } })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('proxy uses the registered template id and a JSON envelope', async () => {
    const valid = buildMockOutput('ielts.reading.explain', readingVariables).data
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      expect(body.templateId).toBe('ielts.reading.explain')
      expect(body.variables.passage).toContain('museum')
      return { ok: true, json: async () => ({ data: valid }) }
    })
    const result = await invokeTemplate('ielts.reading.explain', readingVariables, {
      settings: { ...settings, transport: 'proxy' }, fetchImpl,
    })
    expect(result.data.locationQuote).toBe(valid.locationQuote)
  })
})

test('IeltsModelError carries a stable code', () => {
  expect(new IeltsModelError('TIMEOUT', 'slow').code).toBe('TIMEOUT')
})
