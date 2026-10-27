import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import handler from '../../../../api/ielts/llm.js'

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this },
    setHeader(key, value) { this.headers[key] = value },
    end(value) { this.body = value },
  }
}

describe('Vercel production routing', () => {
  test('keeps /api ahead of the SPA catch-all and configures the function timeout', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'))
    expect(config.rewrites[0].source).toBe('/api/(.*)')
    expect(config.rewrites.at(-1).destination).toBe('/index.html')
    expect(config.functions['api/ielts/llm.js'].maxDuration).toBeGreaterThanOrEqual(30)
  })

  test('proxy source contains no request logging or secret persistence', () => {
    const source = readFileSync(join(process.cwd(), 'api/ielts/llm.js'), 'utf8')
    expect(source).not.toMatch(/console\.(log|info|debug|warn|error)/)
    expect(source).not.toMatch(/writeFile|setItem|localStorage/)
  })
})
describe('serverless template boundary', () => {
  test('unknown template id is rejected before any provider request', async () => {
    const originalFetch = globalThis.fetch
    let called = false
    globalThis.fetch = async () => { called = true; throw new Error('must not run') }
    try {
      const res = mockResponse()
      await handler({ method: 'POST', body: { templateId: 'not-registered', apiKey: 'x', variables: {} } }, res)
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body)).toEqual({ error: 'unknown_template' })
      expect(called).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('missing variables are explicit', async () => {
    const res = mockResponse()
    await handler({
      method: 'POST',
      body: {
        templateId: 'ielts.reading.explain', apiKey: 'x', provider: 'deepseek', model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1', variables: { passage: 'x' },
      },
    }, res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('missing_variables')
  })
})
