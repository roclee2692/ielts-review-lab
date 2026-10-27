import { causeFromErrors } from '../data/causes.js'
import { judgeAnswer } from '../core/index.js'
import { normalizeQuestionForJudge } from './parse.js'

/** @param {object[]} questions @param {Record<string,string>} userAnswers */
export function evaluateQuestions(questions, userAnswers = {}) {
  return questions.map(question => {
    const userAnswer = userAnswers[question.id] ?? question.userAnswer ?? ''
    const normalized = normalizeQuestionForJudge(question)
    const verdict = judgeAnswer({
      type: normalized.type,
      key: normalized.key,
      instruction: normalized.instruction,
    }, userAnswer)
    return {
      ...question,
      userAnswer,
      ...verdict,
      ruleCause: causeFromErrors(verdict.errors),
      causeSource: verdict.errors.length ? 'rule' : '',
      cause: causeFromErrors(verdict.errors),
    }
  })
}

/** @param {object[]} results */
export function reviewStats(results) {
  const total = results.length
  const correct = results.filter(result => result.correct).length
  const wrong = total - correct
  const causes = {}
  for (const result of results.filter(item => !item.correct)) {
    const cause = result.cause || '待归类'
    causes[cause] = (causes[cause] || 0) + 1
  }
  const causeShares = Object.entries(causes)
    .map(([cause, count]) => ({ cause, count, share: wrong ? count / wrong : 0 }))
    .sort((a, b) => b.count - a.count)
  return { total, correct, wrong, causes, causeShares }
}

/** @param {string} source */
export function seriesKey(source) {
  return String(source || '')
    .trim()
    .replace(/\b(part|passage)\s*\d+\b/gi, '$1 #')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** @param {object[]} records @param {'reading'|'listening'} module */
export function completedSeries(records, module) {
  const groups = new Map()
  for (const record of records.filter(item => item.module === module)) {
    const key = seriesKey(record.source || '')
    if (!key || key === '原创示例，非真题') continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }
  const required = module === 'reading' ? 3 : 4
  return [...groups.entries()]
    .filter(([, items]) => new Set(items.map(item => item.metadata?.reviewId)).size >= required)
    .map(([key, items]) => ({ key, module, required, count: new Set(items.map(item => item.metadata?.reviewId)).size, items }))
}

/** @param {string} text @param {number} max */
export function truncate(text, max = 500) {
  const value = String(text || '')
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** @param {object} review @param {object} result @param {object} explanation */
export function mistakeFromResult(review, result, explanation) {
  const synonyms = Array.isArray(explanation?.synonymPairs) ? explanation.synonymPairs : []
  return {
    id: `ielts:${review.id}:${result.id || result.number}`,
    domain: 'ielts',
    module: review.module,
    type: result.type,
    source: review.source || '未标注来源',
    questionSummary: truncate(result.prompt, 800),
    userAnswer: result.userAnswer,
    correctAnswer: Array.isArray(result.key) ? result.key.join(', ') : result.key,
    errorCause: explanation?.cause || result.cause || result.ruleCause || '待归类',
    ruleCause: result.ruleCause || '',
    causeSource: explanation?.causeBasis || (result.ruleCause ? 'rule' : 'model'),
    evidence: explanation?.locationQuote || '',
    evidenceVerified: explanation?.evidenceVerified ?? null,
    explanationSummary: explanation
      ? truncate([explanation.whyKeyCorrect, explanation.whyUserWrong].filter(Boolean).join(' '), 1200)
      : '',
    reflection: review.reflections?.[result.id] || '',
    locationHint: explanation?.locationHint || '',
    synonyms,
    createdAt: review.createdAt || Date.now(),
    metadata: {
      reviewId: review.id,
      questionId: result.id,
      questionNumber: result.number,
      instruction: result.instruction,
      options: result.options || [],
      saveFullSource: !!review.saveFullSource,
    },
  }
}

/** @param {object[]} records */
export function buildWeaknessProfile(records = []) {
  const byCause = {}
  const byType = {}
  const byDate = {}
  const synonyms = {}
  for (const record of records.filter(item => item.domain === 'ielts')) {
    const cause = record.errorCause || '待归类'
    byCause[cause] = (byCause[cause] || 0) + 1
    byType[record.type || 'unknown'] = (byType[record.type || 'unknown'] || 0) + 1
    const date = new Date(record.createdAt || 0).toISOString().slice(0, 10)
    byDate[date] = byDate[date] || {}
    byDate[date][cause] = (byDate[date][cause] || 0) + 1
    for (const pair of record.synonyms || []) {
      const label = `${pair.question} ↔ ${pair.passage}`
      synonyms[label] = (synonyms[label] || 0) + 1
    }
  }
  const sortCounts = object => Object.entries(object).sort((a, b) => b[1] - a[1])
  return {
    total: records.filter(item => item.domain === 'ielts').length,
    byCause: sortCounts(byCause),
    byType: sortCounts(byType),
    topCause: sortCounts(byCause)[0]?.[0] || '',
    topType: sortCounts(byType)[0]?.[0] || '',
    byDate,
    repeatedSynonyms: sortCounts(synonyms).filter(([, count]) => count > 1),
  }
}
