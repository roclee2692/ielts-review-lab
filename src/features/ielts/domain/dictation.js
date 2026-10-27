// 拼写听写：从错题里挑出“听到了但写错”的词，集中重写。
// 只取答案册的第一种写法作为朗读和判分目标（"colour/color" 读 colour，两种写法都判对）。

import { expandAcceptedAnswers } from '../core/judge.js'

/** 这些错因说明问题在“写”，适合听写练。 */
export const DICTATION_CAUSES = Object.freeze(['拼写或格式', '单复数', '数字时间日期', '超字数'])

/**
 * @param {any[]} records unified mistake records
 * @param {{ words?: Record<string, { streak: number }> }} [history]
 * @returns {{ id: string, say: string, key: string, source: string, cause: string, streak: number }[]}
 */
export function buildDictationList(records, history = {}) {
  const byWord = new Map()
  for (const record of records) {
    if (record?.domain !== 'ielts') continue
    const cause = record.ruleCause || record.errorCause || ''
    if (!DICTATION_CAUSES.includes(cause)) continue
    const key = String(record.correctAnswer || '').trim()
    const say = expandAcceptedAnswers(key)[0] || key
    if (!say || say.split(' ').length > 4) continue
    const id = say.toLowerCase()
    if (byWord.has(id)) continue
    byWord.set(id, { id, say, key, source: record.source || '', cause, streak: history.words?.[id]?.streak || 0 })
  }
  // Least-practised first; three right in a row counts as learned and goes last.
  return [...byWord.values()].sort((a, b) => (a.streak >= 3 ? 1 : 0) - (b.streak >= 3 ? 1 : 0) || a.streak - b.streak)
}

/**
 * @param {{ words?: Record<string, any> }} history
 * @param {string} id
 * @param {boolean} correct
 */
export function recordDictation(history, id, correct) {
  const words = { ...(history?.words || {}) }
  const previous = words[id] || { attempts: 0, correct: 0, streak: 0 }
  words[id] = {
    attempts: previous.attempts + 1,
    correct: previous.correct + (correct ? 1 : 0),
    streak: correct ? previous.streak + 1 : 0,
    lastAt: Date.now(),
  }
  return { version: 1, words }
}

/** Custom words typed by the learner, one per line or comma-separated. @param {string} text */
export function parseCustomWords(text) {
  return [...new Set(String(text || '').split(/[\n,，;；]+/).map(word => word.trim()).filter(Boolean))]
    .map(say => ({ id: say.toLowerCase(), say, key: say, source: '自己加的', cause: '', streak: 0 }))
}
