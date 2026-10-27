import { IELTS_KEYS } from '../../../services/storage/IeltsStore.js'
import { readJson, writeJson, removeKey } from '../../../services/storage/JsonStore.js'
import { getTemplate, getTemplateVersions, TEMPLATE_LIST } from './templates.js'
import { verifyEvidence } from '../core/index.js'

export const MAX_AUDIT_ENTRIES = 100

function auditId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `audit-${crypto.randomUUID()}`
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** @param {unknown} value @param {number} [maxLength] */
function safeText(value, maxLength = 600) {
  return String(value ?? '')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-key]')
    .slice(0, maxLength)
}

/**
 * Keep structure useful for debugging while bounding size and masking secret-like strings.
 * @param {unknown} value
 * @param {number} [depth]
 */
export function sanitizeAuditValue(value, depth = 0) {
  if (depth > 5) return '[depth-limit]'
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return safeText(value)
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeAuditValue(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, child]) => [
      /^(?:api[-_]?key|key|secret|token|authorization|ttsApiKey)$/i.test(key) ? 'redactedField' : key,
      sanitizeAuditValue(child, depth + 1),
    ]))
  }
  return safeText(value)
}

/** @param {Record<string, unknown>} variables */
export function auditVariableMetrics(variables = {}) {
  const byVariable = {}
  let totalChars = 0
  for (const [key, value] of Object.entries(variables)) {
    const length = typeof value === 'string' ? value.length : JSON.stringify(value ?? '').length
    byVariable[key] = length
    totalChars += length
  }
  return { byVariable, totalChars }
}

export function loadModelAudit() {
  const entries = readJson(IELTS_KEYS.modelAudit, [])
  return Array.isArray(entries) ? entries : []
}

/**
 * Append one sanitized audit entry. The caller supplies only template metadata,
 * provider/model metadata, sanitized output, validation/evidence results and
 * variable lengths; raw prompts and API keys are never accepted here.
 */
export function appendModelAudit(event) {
  const now = new Date()
  const entry = {
    id: auditId(),
    at: now.toISOString(),
    callId: safeText(event.callId, 120),
    templateId: safeText(event.templateId, 100),
    templateVersion: safeText(event.templateVersion, 30),
    provider: safeText(event.provider, 60),
    model: safeText(event.model, 120),
    transport: safeText(event.transport, 20),
    attempt: Number(event.attempt) || 0,
    status: safeText(event.status, 40),
    durationMs: Math.max(0, Number(event.durationMs) || 0),
    output: event.output === undefined ? null : sanitizeAuditValue(event.output),
    validationErrors: Array.isArray(event.validationErrors) ? event.validationErrors.slice(0, 10).map(value => safeText(value, 300)) : [],
    errorCode: event.errorCode ? safeText(event.errorCode, 40) : null,
    httpStatus: Number(event.httpStatus) || null,
    inputMetrics: event.inputMetrics ? sanitizeAuditValue(event.inputMetrics) : null,
    evidenceVerification: event.evidenceVerification || null,
  }
  const entries = [entry, ...loadModelAudit()].slice(0, MAX_AUDIT_ENTRIES)
  writeJson(IELTS_KEYS.modelAudit, entries)
  return entry.id
}

/** @param {string} id @param {{ ok: boolean, missingCount: number } | null} verification */
export function updateAuditEvidence(id, verification) {
  if (!id) return
  const entries = loadModelAudit()
  const next = entries.map(entry => entry.id === id
    ? { ...entry, evidenceVerification: verification ? { ok: !!verification.ok, missingCount: Number(verification.missingCount) || 0 } : null }
    : entry)
  writeJson(IELTS_KEYS.modelAudit, next)
}

export function clearModelAudit() {
  removeKey(IELTS_KEYS.modelAudit)
}

/**
 * Compute evidence verification for templates that quote source text.
 * Only counts are persisted in the audit log; quotes themselves stay in the
 * normal explanation state and user-exported mistake records.
 */
export function verifyTemplateEvidence(templateId, variables, output) {
  let source
  let quotes
  if (templateId === 'ielts.reading.explain') {
    source = variables.passage || ''
    quotes = [output?.locationQuote, ...(output?.synonymPairs || []).map(pair => pair.passage)]
  } else if (templateId === 'ielts.listening.explain') {
    source = variables.transcript || ''
    quotes = [output?.locationQuote, ...(output?.signals || [])]
  } else if (templateId === 'ielts.reading.followup') {
    source = variables.passage || ''
    quotes = Array.isArray(output?.evidenceQuotes) ? output.evidenceQuotes : []
  } else {
    return null
  }
  const result = verifyEvidence(source, quotes.filter(value => value !== undefined && value !== null))
  return { ok: result.ok, missingCount: result.missing.length }
}

/** @param {object[]} [entries] */
export function buildReproductionBundle(entries = loadModelAudit()) {
  const requested = [...new Set(entries.map(entry => `${entry.templateId || ''}@${entry.templateVersion || ''}`))]
  const templates = requested.map(key => {
    const split = key.lastIndexOf('@')
    const id = key.slice(0, split)
    const requestedVersion = key.slice(split + 1)
    const current = getTemplate(id)
    const version = getTemplateVersions(id).find(candidate => candidate.version === requestedVersion)
    if (!current) return { id, version: requestedVersion, available: false }
    const template = version || current
    return {
      id,
      version: template.version,
      purpose: current.purpose,
      variables: [...current.variables],
      constraints: [...(template.constraints || current.constraints)],
      outputSchema: template.outputSchema,
      available: !!version || template.version === requestedVersion,
    }
  })
  return {
    format: 'irl-ielts-reproduction',
    version: 1,
    exportedAt: new Date().toISOString(),
    privacy: {
      apiKeysIncluded: false,
      sourceTextIncluded: false,
      note: 'Audit entries contain output snippets and variable lengths only. Re-run with your own test fixture and the listed template version.',
    },
    templates,
    entries: entries.map(sanitizeAuditValue),
    currentTemplateVersions: Object.fromEntries(TEMPLATE_LIST.map(template => [template.id, template.version])),
  }
}
