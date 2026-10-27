// Unified mistake records for algorithm quizzes and IELTS review.
// Legacy keys remain read-only inputs to an idempotent migration and are kept
// intact (and mirrored on algorithm writes) so an older tab cannot lose data.

import { readJson, writeJson, removeKey } from './JsonStore.js'

export const MISTAKE_KEYS = Object.freeze({
  legacyWrong: 'algoviz-wrong-questions',
  legacyScores: 'algoviz-quiz-scores',
  unified: 'irl-mistake-records',
  migration: 'irl-mistake-migration-v2',
})

const EMPTY_STORE = Object.freeze({
  version: 2,
  records: [],
  algorithmScores: {},
  migratedAt: 0,
})

/** @param {unknown} object */
function isObject(object) {
  return !!object && typeof object === 'object' && !Array.isArray(object)
}

/** @param {unknown} value */
function normalizedStore(value) {
  if (!isObject(value)) return { ...EMPTY_STORE, records: [] }
  return {
    version: 2,
    records: Array.isArray(value.records) ? value.records.filter(isObject) : [],
    algorithmScores: isObject(value.algorithmScores) ? { ...value.algorithmScores } : {},
    migratedAt: Number(value.migratedAt) || 0,
  }
}

/** @param {string} slug @param {number} questionIndex @param {number} at */
function legacyRecord(slug, questionIndex, at) {
  return {
    id: `algorithm:${slug}:${questionIndex}`,
    domain: 'algorithm',
    module: 'algorithm',
    type: 'quiz',
    source: '算法课后题',
    questionSummary: `${slug} · 第 ${questionIndex + 1} 题`,
    userAnswer: '',
    correctAnswer: '',
    errorCause: '待复习',
    evidence: '',
    explanationSummary: '由旧版错题记录迁移，题干和解析可在原算法页重做。',
    reflection: '',
    createdAt: at,
    updatedAt: at,
    metadata: { slug, questionIndex, legacy: true },
  }
}

function readLegacy() {
  const wrong = readJson(MISTAKE_KEYS.legacyWrong, {})
  const scores = readJson(MISTAKE_KEYS.legacyScores, {})
  return { wrong: isObject(wrong) ? wrong : {}, scores: isObject(scores) ? scores : {} }
}

/**
 * Merge legacy algorithm mistakes and scores into the unified store. Safe to
 * call repeatedly; records are deduplicated by their stable id.
 * @param {ReturnType<typeof loadMistakeStore>} [base]
 */
export function migrateLegacyMistakes(base = loadMistakeStore({ migrate: false })) {
  const store = normalizedStore(base)
  const { wrong, scores } = readLegacy()
  const byId = new Map(store.records.map(record => [record.id, record]))

  for (const [slug, indices] of Object.entries(wrong)) {
    if (!Array.isArray(indices)) continue
    const at = Number(scores[slug]?.lastAt) || Date.now()
    for (const rawIndex of indices) {
      const index = Number(rawIndex)
      if (!Number.isInteger(index) || index < 0) continue
      const record = legacyRecord(slug, index, at)
      if (!byId.has(record.id)) byId.set(record.id, record)
    }
  }

  for (const [slug, score] of Object.entries(scores)) {
    if (!isObject(score)) continue
    const current = store.algorithmScores[slug]
    if (!current || (Number(score.lastAt) || 0) >= (Number(current.lastAt) || 0)) {
      store.algorithmScores[slug] = { ...score }
    }
  }

  const migrated = {
    ...store,
    records: [...byId.values()],
    migratedAt: Date.now(),
  }
  writeJson(MISTAKE_KEYS.unified, migrated)
  writeJson(MISTAKE_KEYS.migration, { version: 2, at: migrated.migratedAt })
  return migrated
}

/**
 * Read the unified store, merging any unresolved legacy additions first.
 * @param {{ migrate?: boolean }} [options]
 */
export function loadMistakeStore({ migrate = true } = {}) {
  const raw = normalizedStore(readJson(MISTAKE_KEYS.unified, EMPTY_STORE))
  return migrate ? migrateLegacyMistakes(raw) : raw
}

/** @param {ReturnType<typeof loadMistakeStore>} store */
function saveMistakeStore(store) {
  const normalized = normalizedStore(store)
  writeJson(MISTAKE_KEYS.unified, normalized)
  return normalized
}

/**
 * @param {object[]} records
 * @param {{ replaceIds?: string[] }} [options]
 */
export function addMistakeRecords(records, { replaceIds = [] } = {}) {
  const store = loadMistakeStore()
  const replaced = new Set(replaceIds)
  const byId = new Map(store.records.filter(record => !replaced.has(record.id)).map(record => [record.id, record]))
  for (const record of records) {
    if (!isObject(record)) continue
    const id = String(record.id || `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`)
    const now = Date.now()
    byId.set(id, {
      ...record,
      id,
      createdAt: record.createdAt || now,
      updatedAt: now,
    })
  }
  return saveMistakeStore({ ...store, records: [...byId.values()] })
}

/** @param {string} id @param {object} patch */
export function updateMistakeRecord(id, patch) {
  const store = loadMistakeStore()
  const records = store.records.map(record => (
    record.id === id ? { ...record, ...patch, id, updatedAt: Date.now() } : record
  ))
  return saveMistakeStore({ ...store, records })
}

/** @param {string} id */
export function deleteMistakeRecord(id) {
  const store = loadMistakeStore()
  const target = store.records.find(record => record.id === id)
  if (target?.domain === 'algorithm' && target.metadata?.slug) {
    const mirror = loadWrongQuestions()
    const slug = target.metadata.slug
    const index = Number(target.metadata.questionIndex)
    if (Array.isArray(mirror[slug])) {
      const nextIndices = mirror[slug].filter(value => Number(value) !== index)
      if (nextIndices.length) mirror[slug] = nextIndices
      else delete mirror[slug]
      writeJson(MISTAKE_KEYS.legacyWrong, mirror)
    }
  }
  return saveMistakeStore({ ...store, records: store.records.filter(record => record.id !== id) })
}

/** @param {{ module?: string, type?: string, errorCause?: string, source?: string, from?: number, to?: number }} [filters] */
export function filterMistakeRecords(filters = {}) {
  return loadMistakeStore().records.filter(record => {
    if (filters.module && record.module !== filters.module) return false
    if (filters.type && record.type !== filters.type) return false
    if (filters.errorCause && record.errorCause !== filters.errorCause) return false
    if (filters.source && !String(record.source || '').toLowerCase().includes(filters.source.toLowerCase())) return false
    if (filters.from && Number(record.createdAt) < filters.from) return false
    if (filters.to && Number(record.createdAt) > filters.to) return false
    return true
  })
}

/** @returns {Record<string, number[]>} */
export function loadWrongQuestions() {
  const wrong = readJson(MISTAKE_KEYS.legacyWrong, {})
  const result = isObject(wrong)
    ? Object.fromEntries(Object.entries(wrong).map(([slug, indices]) => [slug, Array.isArray(indices) ? [...indices] : []]))
    : {}
  const unified = normalizedStore(readJson(MISTAKE_KEYS.unified, EMPTY_STORE))
  for (const record of unified.records) {
    if (record.domain !== 'algorithm') continue
    const slug = record.metadata?.slug
    const index = Number(record.metadata?.questionIndex)
    if (!slug || !Number.isInteger(index)) continue
    if (!result[slug]) result[slug] = []
    if (!result[slug].includes(index)) result[slug].push(index)
  }
  for (const slug of Object.keys(result)) result[slug].sort((a, b) => a - b)
  return result
}

/**
 * Compatibility API used by Quiz/profile: replace this slug's algorithm mistake
 * indices in both the unified store and the legacy mirror.
 * @param {string} slug
 * @param {number[]} wrongIndices
 */
export function saveWrongForSlug(slug, wrongIndices) {
  const store = loadMistakeStore()
  const oldIds = store.records
    .filter(record => record.domain === 'algorithm' && record.metadata?.slug === slug)
    .map(record => record.id)
  const at = Date.now()
  const records = wrongIndices.map(index => legacyRecord(slug, Number(index), at))
  addMistakeRecords(records, { replaceIds: oldIds })

  const mirror = loadWrongQuestions()
  if (wrongIndices.length === 0) delete mirror[slug]
  else mirror[slug] = wrongIndices.map(Number).sort((a, b) => a - b)
  writeJson(MISTAKE_KEYS.legacyWrong, mirror)
}

/** @param {{ records?: object[], algorithmScores?: object, migratedAt?: number }} [value] */
export function replaceMistakeStore(value) {
  return saveMistakeStore(normalizedStore(value))
}

export function clearMistakeStore() {
  removeKey(MISTAKE_KEYS.unified)
  removeKey(MISTAKE_KEYS.migration)
}
