import {
  assertTemplateVariables,
  getTemplate,
  validateSchema,
} from './templates.js'
import { auditVariableMetrics } from './auditLog.js'

export class IeltsModelError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'IeltsModelError'
    this.code = code
    this.details = details
  }
}

/** Strip a Markdown code fence without accepting arbitrary prose. @param {string} content */
export function parseJsonContent(content) {
  const text = String(content || '').trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced ? fenced[1].trim() : text
  try {
    return JSON.parse(candidate)
  } catch {
    throw new IeltsModelError('INVALID_OUTPUT', '模型没有返回合法 JSON')
  }
}

/** @param {string} templateId @param {Record<string, unknown>} variables @param {object} settings */
export function buildRequestPreview(templateId, variables, settings) {
  const template = assertTemplateVariables(templateId, variables)
  return {
    templateId,
    templateVersion: template.version,
    purpose: template.purpose,
    provider: settings.provider,
    model: settings.model,
    transport: settings.transport,
    messages: template.buildMessages(variables),
    characterCount: template.buildMessages(variables).reduce((sum, message) => sum + message.content.length, 0),
  }
}

/** @param {object} settings */
function endpoint(settings) {
  if (settings.transport === 'proxy') return '/api/ielts/llm'
  return `${String(settings.baseUrl || 'https://api.deepseek.com/v1').replace(/\/$/, '')}/chat/completions`
}

/** @param {object} settings @param {object} payload */
function requestInit(settings, payload) {
  if (settings.transport === 'proxy') {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: payload.templateId,
        variables: payload.variables,
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
      }),
    }
  }
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: payload.messages,
    }),
  }
}

/**
 * Invoke one centrally registered template with one validation retry.
 * Secrets and source text are never logged by this module.
 * @param {string} templateId
 * @param {Record<string, unknown>} variables
 * @param {{ settings: object, fetchImpl?: typeof fetch, timeoutMs?: number, onAudit?: Function }} options
 */
export async function invokeTemplate(templateId, variables, { settings, fetchImpl = globalThis.fetch, timeoutMs = 45_000, onAudit = () => null }) {
  const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const inputMetrics = auditVariableMetrics(variables)
  const emitAudit = event => {
    try {
      return onAudit({
        ...event,
        callId,
        templateId,
        templateVersion: event.templateVersion || getTemplate(templateId)?.version || 'unknown',
        provider: settings?.provider,
        model: settings?.model,
        transport: settings?.transport,
        inputMetrics,
      })
    } catch {
      return null
    }
  }
  let template
  try {
    template = assertTemplateVariables(templateId, variables)
  } catch (error) {
    emitAudit({ status: 'invalid_request', attempt: 0, validationErrors: [error.message], errorCode: 'INVALID_REQUEST' })
    throw error
  }
  if (!settings?.apiKey) {
    emitAudit({ status: 'no_key', attempt: 0, errorCode: 'NO_KEY' })
    throw new IeltsModelError('NO_KEY', '需要先在 IELTS 设置中配置模型 API key')
  }
  if (typeof fetchImpl !== 'function') {
    emitAudit({ status: 'network_error', attempt: 0, errorCode: 'NETWORK' })
    throw new IeltsModelError('NETWORK', '当前环境不支持网络请求')
  }

  let lastErrors = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = template.buildMessages(variables)
    if (attempt > 0) {
      messages.push({
        role: 'user',
        content: `上一次输出未通过结构校验：${lastErrors.slice(0, 6).join('; ')}。请重新只输出符合结构的 JSON。`,
      })
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()
    let response
    try {
      response = await fetchImpl(endpoint(settings), {
        ...requestInit(settings, { templateId, variables, messages }),
        signal: controller.signal,
      })
    } catch (error) {
      const timeout = error?.name === 'AbortError'
      emitAudit({ status: timeout ? 'timeout' : 'network_error', attempt: attempt + 1, durationMs: Date.now() - startedAt, errorCode: timeout ? 'TIMEOUT' : 'NETWORK' })
      throw timeout ? new IeltsModelError('TIMEOUT', '模型请求超时') : new IeltsModelError('NETWORK', '无法连接模型服务')
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) {
      emitAudit({ status: 'provider_error', attempt: attempt + 1, durationMs: Date.now() - startedAt, httpStatus: response.status, errorCode: 'PROVIDER' })
      throw new IeltsModelError('PROVIDER', `模型服务返回 HTTP ${response.status}`, { status: response.status })
    }
    let body
    try {
      body = await response.json()
    } catch {
      emitAudit({ status: 'invalid_output', attempt: attempt + 1, durationMs: Date.now() - startedAt, validationErrors: ['provider response is not JSON'], errorCode: 'INVALID_OUTPUT' })
      lastErrors = ['provider response is not JSON']
      continue
    }
    const content = settings.transport === 'proxy'
      ? body?.data
      : body?.choices?.[0]?.message?.content
    let parsed
    try {
      parsed = content && typeof content === 'object' ? content : parseJsonContent(content)
    } catch (error) {
      emitAudit({
        status: 'invalid_output', attempt: attempt + 1, durationMs: Date.now() - startedAt,
        output: { rawContent: String(content || '').slice(0, 600) },
        validationErrors: [error.message], errorCode: 'INVALID_OUTPUT',
      })
      lastErrors = [error.message]
      continue
    }
    lastErrors = validateSchema(parsed, template.outputSchema)
    const auditId = emitAudit({
      status: lastErrors.length ? 'invalid_output' : 'success',
      attempt: attempt + 1,
      durationMs: Date.now() - startedAt,
      output: parsed,
      validationErrors: lastErrors,
      errorCode: lastErrors.length ? 'INVALID_OUTPUT' : null,
    })
    if (lastErrors.length === 0) {
      return {
        data: parsed,
        meta: { mock: false, templateId, version: template.version, attempt: attempt + 1, auditId },
      }
    }
  }
  throw new IeltsModelError('INVALID_OUTPUT', '模型连续两次返回不合规结构，已停止本次讲解', { errors: lastErrors })
}

/** @param {string} baseUrl @param {string} model */
export async function testProviderConnection({ baseUrl, model, apiKey, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new IeltsModelError('NO_KEY', '请先填写 API key')
  const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throw new IeltsModelError('PROVIDER', `连接失败：HTTP ${response.status}`)
  return { ok: true, model }
}
