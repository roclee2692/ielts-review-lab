import {
  IELTS_KEYS,
  loadIeltsValue,
  saveIeltsValue,
} from '../../services/storage/IeltsStore.js'
import { extractPartNumber } from './domain/testSets.js'
import { BUILTIN_METHODS, normalizeMethod } from './data/methods.js'

export function loadReviewSummaries() {
  const value = loadIeltsValue(IELTS_KEYS.reviews, [])
  return Array.isArray(value) ? value : []
}
/** @param {object} review */
export function saveReviewSummary(review) {
  const reviews = loadReviewSummaries()
  const summary = {
    id: review.id,
    module: review.module,
    source: review.source || '未标注来源',
    title: review.title || '',
    total: review.total,
    correct: review.correct,
    wrong: review.wrong,
    causeShares: review.causeShares || [],
    elapsedSeconds: review.elapsedSeconds || 0,
    createdAt: review.createdAt || Date.now(),
    partNumber: Number(review.partNumber) || extractPartNumber(review.source),
    fullSource: review.saveFullSource ? String(review.fullSource || '') : '',
    methodId: review.methodId || '',
    methodMetrics: review.methodMetrics && typeof review.methodMetrics === 'object' ? { ...review.methodMetrics } : {},
  }
  const index = reviews.findIndex(item => item.id === summary.id)
  if (index >= 0) reviews[index] = summary
  else reviews.unshift(summary)
  saveIeltsValue(IELTS_KEYS.reviews, reviews.slice(0, 100))
  return summary
}

/** @param {string} id */
export function deleteSavedFullSource(id) {
  const reviews = loadReviewSummaries()
  const next = reviews.map(review => review.id === id ? { ...review, fullSource: '' } : review)
  saveIeltsValue(IELTS_KEYS.reviews, next)
  return next
}

export function loadWritingProgress() {
  const value = loadIeltsValue(IELTS_KEYS.writing, { completed: [], submissions: {} })
  return {
    completed: Array.isArray(value?.completed) ? value.completed : [],
    submissions: value?.submissions && typeof value.submissions === 'object' ? value.submissions : {},
  }
}

/** @param {object} progress */
export function saveWritingProgress(progress) {
  saveIeltsValue(IELTS_KEYS.writing, progress)
  return progress
}

export function loadSpeakingHistory() {
  const value = loadIeltsValue(IELTS_KEYS.speaking, [])
  return Array.isArray(value) ? value : []
}

/** @param {object} practice */
export function saveSpeakingPractice(practice) {
  const history = loadSpeakingHistory()
  const next = [{ ...practice, id: practice.id || `speaking-${Date.now()}`, createdAt: Date.now() }, ...history].slice(0, 50)
  saveIeltsValue(IELTS_KEYS.speaking, next)
  return next
}

// ── 题集库：同一本书同一篇只录一次原文、题目和答案册，以后重做只填自己的答案 ──

/** @param {string} module @param {string} source */
export function materialId(module, source) {
  return `${module}:${String(source || '').trim().replace(/\s+/g, ' ').toLowerCase()}`
}

export function loadMaterials() {
  const value = loadIeltsValue(IELTS_KEYS.materials, [])
  return Array.isArray(value) ? value : []
}

/**
 * Save or replace the passage/transcript, questions and answer key under its
 * source label. The learner's own answers are never stored here.
 * @param {{ module: 'reading'|'listening', source: string, passage: string, questions: object[] }} material
 */
export function saveMaterial({ module, source, passage, questions, questionsText = '' }) {
  const label = String(source || '').trim()
  if (!label) throw new Error('保存到题集库需要来源标签，例如“剑 19 Test 2 Passage 1”。')
  const id = materialId(module, label)
  const entry = {
    id,
    module,
    source: label,
    passage: String(passage || ''),
    questionsText: String(questionsText || ''),
    questions: (questions || []).map(question => {
      const copy = { ...question }
      delete copy.userAnswer
      return copy
    }),
    updatedAt: Date.now(),
  }
  const next = [entry, ...loadMaterials().filter(item => item.id !== id)].slice(0, 200)
  saveIeltsValue(IELTS_KEYS.materials, next)
  return entry
}

/** @param {string} id */
export function deleteMaterial(id) {
  const next = loadMaterials().filter(item => item.id !== id)
  saveIeltsValue(IELTS_KEYS.materials, next)
  return next
}

// ── 做题方法：内置方法可改（改动存为覆盖），也能新建；每个模块一个“当前方法” ──

function loadMethodState() {
  const value = loadIeltsValue(IELTS_KEYS.methods, { active: {}, items: {} })
  return {
    active: value?.active && typeof value.active === 'object' ? value.active : {},
    items: value?.items && typeof value.items === 'object' ? value.items : {},
    introSeen: value?.introSeen && typeof value.introSeen === 'object' ? value.introSeen : {},
  }
}

/** @returns {import('./data/methods.js').StudyMethod[]} */
export function loadMethods() {
  const state = loadMethodState()
  const builtins = BUILTIN_METHODS.map(method => {
    const edited = normalizeMethod(state.items[method.id])
    return edited ? { ...edited, id: method.id, builtin: true, edited: true } : { ...method }
  })
  const custom = Object.values(state.items).map(normalizeMethod).filter(method => method && !BUILTIN_METHODS.some(builtin => builtin.id === method.id))
  return [...builtins, ...custom]
}

/** @param {'reading'|'listening'} module */
export function getActiveMethod(module) {
  const methods = loadMethods().filter(method => method.module === module)
  const state = loadMethodState()
  if (state.active[module] === 'none') return null
  return methods.find(method => method.id === state.active[module]) || methods[0] || null
}

/** @param {'reading'|'listening'} module @param {string} id  'none' turns methods off for the module */
export function setActiveMethod(module, id) {
  const state = loadMethodState()
  saveIeltsValue(IELTS_KEYS.methods, { ...state, active: { ...state.active, [module]: id } })
}

/** @param {object} method */
export function saveMethod(method) {
  const normalized = normalizeMethod(method)
  if (!normalized) throw new Error('方法需要一个标题。')
  const state = loadMethodState()
  saveIeltsValue(IELTS_KEYS.methods, { ...state, items: { ...state.items, [normalized.id]: normalized } })
  return normalized
}

/** Built-in methods go back to the original text; custom ones are removed. @param {string} id */
export function deleteMethod(id) {
  const state = loadMethodState()
  const items = { ...state.items }
  delete items[id]
  saveIeltsValue(IELTS_KEYS.methods, { ...state, items })
}

/** @param {'reading'|'listening'} module */
export function methodIntroSeen(module) {
  return !!loadMethodState().introSeen[module]
}

/** @param {'reading'|'listening'} module */
export function markMethodIntroSeen(module) {
  const state = loadMethodState()
  saveIeltsValue(IELTS_KEYS.methods, { ...state, introSeen: { ...state.introSeen, [module]: true } })
}
