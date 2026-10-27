import {
  IELTS_KEYS,
  loadIeltsValue,
  saveIeltsValue,
} from '../../services/storage/IeltsStore.js'
import { extractPartNumber } from './domain/testSets.js'

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
export function saveMaterial({ module, source, passage, questions }) {
  const label = String(source || '').trim()
  if (!label) throw new Error('保存到题集库需要来源标签，例如“剑 19 Test 2 Passage 1”。')
  const id = materialId(module, label)
  const entry = {
    id,
    module,
    source: label,
    passage: String(passage || ''),
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
