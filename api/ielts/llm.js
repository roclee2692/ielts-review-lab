import {
  getTemplate,
  validateSchema,
} from '../../src/features/ielts/ai/templates.js'

const MAX_BODY_BYTES = 100_000
const MAX_VARIABLE_CHARS = 30_000
const MAX_TOTAL_CHARS = 80_000
const TIMEOUT_MS = 14_000

function json(res, status, payload) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function safeBaseUrl(raw) {
  const url = new URL(String(raw || ''))
  if (url.protocol !== 'https:') throw new Error('baseUrl must use https')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) throw new Error('baseUrl host is not allowed')
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) throw new Error('baseUrl host is not allowed')
  const second = Number(host.split('.')[1])
  if (/^172\./.test(host) && second >= 16 && second <= 31) throw new Error('baseUrl host is not allowed')
  return url.toString().replace(/\/$/, '')
}

function validateVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new Error('variables must be an object')
  let total = 0
  for (const [key, value] of Object.entries(variables)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (text.length > MAX_VARIABLE_CHARS) throw new Error(`variable ${key} is too long`)
    total += text.length
  }
  if (total > MAX_TOTAL_CHARS) throw new Error('request content is too long')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  let body
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(res, 413, { error: 'payload_too_large' })
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return json(res, 400, { error: 'invalid_json' })
  }

  try {
    const template = getTemplate(body?.templateId)
    if (!template) return json(res, 400, { error: 'unknown_template' })
    if (!body.apiKey) return json(res, 401, { error: 'missing_api_key' })
    validateVariables(body.variables)
    const missing = template.variables.filter(variable => body.variables[variable] === undefined || body.variables[variable] === null)
    if (missing.length) return json(res, 400, { error: 'missing_variables', missing })
    if (!['deepseek', 'openai', 'custom'].includes(body.provider)) return json(res, 400, { error: 'unsupported_provider' })
    if (!body.model || String(body.model).length > 120) return json(res, 400, { error: 'invalid_model' })

    const endpoint = `${safeBaseUrl(body.baseUrl)}/chat/completions`
    let lastErrors = []
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const messages = template.buildMessages(body.variables)
      if (attempt > 0) {
        messages.push({ role: 'user', content: `上次输出未通过结构校验：${lastErrors.slice(0, 6).join('; ')}。请重新只输出合规 JSON。` })
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      let upstream
      try {
        upstream = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.apiKey}` },
          body: JSON.stringify({
            model: body.model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (!upstream.ok) return json(res, 502, { error: 'provider_error', status: upstream.status })
      const payload = await upstream.json()
      const content = payload?.choices?.[0]?.message?.content
      if (!content) {
        lastErrors = ['empty provider response']
        continue
      }
      let data
      try { data = typeof content === 'object' ? content : JSON.parse(content) } catch {
        lastErrors = ['invalid JSON']
        continue
      }
      lastErrors = validateSchema(data, template.outputSchema)
      if (lastErrors.length === 0) {
        return json(res, 200, { data, meta: { templateId: template.id, version: template.version } })
      }
    }
    return json(res, 502, { error: 'invalid_provider_schema' })
  } catch (error) {
    // Deliberately do not log the request, key or source text.
    const code = error?.name === 'AbortError' ? 'timeout' : 'upstream_request_failed'
    return json(res, 502, { error: code })
  }
}
