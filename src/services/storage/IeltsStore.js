// Local-only persistence for the IELTS feature. The API key lives under a
// dedicated key and is never included by the generic data exporters.

import { readJson, writeJson, removeKey } from './JsonStore.js'

export const IELTS_KEYS = Object.freeze({
  settings: 'irl-ielts-settings',
  reviews: 'irl-ielts-reviews',
  writing: 'irl-ielts-writing-progress',
  speaking: 'irl-ielts-speaking',
  speakingTopics: 'irl-ielts-speaking-topics',
  knowledge: 'irl-ielts-knowledge',
  vocab: 'irl-ielts-vocabulary',
  replacements: 'irl-ielts-replacements',
  reviewSchedule: 'irl-ielts-review-schedule',
  modelAudit: 'irl-ielts-model-audit',
  materials: 'irl-ielts-materials',
  methods: 'irl-ielts-methods',
  dictation: 'irl-ielts-dictation',
})

export const DEFAULT_IELTS_SETTINGS = Object.freeze({
  targetBand: '6.5',
  strictness: 'standard',
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1',
  transport: 'direct',
  ttsProvider: 'browser',
  ttsApiKey: '',
  ttsBaseUrl: '',
})

export function loadIeltsSettings() {
  const saved = readJson(IELTS_KEYS.settings, {})
  return { ...DEFAULT_IELTS_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) }
}

/** @param {Partial<typeof DEFAULT_IELTS_SETTINGS>} patch */
export function saveIeltsSettings(patch) {
  const next = { ...loadIeltsSettings(), ...patch }
  writeJson(IELTS_KEYS.settings, next)
  return next
}

export function clearIeltsSettings() {
  removeKey(IELTS_KEYS.settings)
}

/** @param {string} key @param {any} fallback */
export function loadIeltsValue(key, fallback) {
  return readJson(key, fallback)
}

/** @param {string} key @param {any} value */
export function saveIeltsValue(key, value) {
  return writeJson(key, value)
}

export function clearIeltsData() {
  for (const key of Object.values(IELTS_KEYS)) removeKey(key)
}

/** Export learner content without the secret API key. */
export function exportIeltsData() {
  const settings = loadIeltsSettings()
  const safeSettings = { ...settings }
  delete safeSettings.apiKey
  delete safeSettings.ttsApiKey
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    settings: safeSettings,
    reviews: readJson(IELTS_KEYS.reviews, []),
    writing: readJson(IELTS_KEYS.writing, { completed: [], submissions: {} }),
    speaking: readJson(IELTS_KEYS.speaking, []),
    speakingTopics: readJson(IELTS_KEYS.speakingTopics, []),
    knowledge: readJson(IELTS_KEYS.knowledge, { notes: [], edited: {} }),
    vocabulary: readJson(IELTS_KEYS.vocab, { favorites: [], custom: [] }),
    replacements: readJson(IELTS_KEYS.replacements, []),
    reviewSchedule: readJson(IELTS_KEYS.reviewSchedule, { version: 1, items: {} }),
    modelAudit: readJson(IELTS_KEYS.modelAudit, []),
    materials: readJson(IELTS_KEYS.materials, []),
    methods: readJson(IELTS_KEYS.methods, { active: {}, items: {} }),
    dictation: readJson(IELTS_KEYS.dictation, { version: 1, words: {} }),
  }
}

const IMPORTABLE = Object.freeze({
  reviews: IELTS_KEYS.reviews,
  writing: IELTS_KEYS.writing,
  speaking: IELTS_KEYS.speaking,
  speakingTopics: IELTS_KEYS.speakingTopics,
  knowledge: IELTS_KEYS.knowledge,
  vocabulary: IELTS_KEYS.vocab,
  replacements: IELTS_KEYS.replacements,
  reviewSchedule: IELTS_KEYS.reviewSchedule,
  materials: IELTS_KEYS.materials,
  methods: IELTS_KEYS.methods,
  dictation: IELTS_KEYS.dictation,
})

/**
 * Restore a file produced by exportIeltsData. Unknown fields are ignored and
 * secrets are never read from the file, so an export from another machine
 * cannot plant an API key. Returns the restored section names.
 * @param {any} payload
 */
export function importIeltsData(payload) {
  if (!payload || typeof payload !== 'object' || payload.version !== 1) {
    throw new Error('不是本应用导出的数据文件（缺少 version: 1）。')
  }
  const restored = []
  for (const [field, key] of Object.entries(IMPORTABLE)) {
    if (payload[field] === undefined) continue
    writeJson(key, payload[field])
    restored.push(field)
  }
  if (payload.settings && typeof payload.settings === 'object') {
    const safe = { ...payload.settings }
    delete safe.apiKey
    delete safe.ttsApiKey
    saveIeltsSettings(safe)
    restored.push('settings')
  }
  return restored
}
