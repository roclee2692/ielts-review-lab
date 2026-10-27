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
    // “待归类”不是错因，不能当成最集中的问题。
    topCause: sortCounts(byCause).find(([cause]) => cause !== '待归类')?.[0] || '',
    unclassified: byCause['待归类'] || 0,
    topType: sortCounts(byType)[0]?.[0] || '',
    byDate,
    repeatedSynonyms: sortCounts(synonyms).filter(([, count]) => count > 1),
  }
}

/**
 * 方法执行趋势：每篇用了某个方法的复盘，记下的指标和得分率，按时间排。
 * 再比较“最早几篇”和“最近几篇”的平均值，看方法是不是越用越熟。
 * @param {object[]} reviews review summaries
 * @param {{ id: string, metrics: { id: string, label: string }[] }} method
 * @param {number} [span]
 */
export function methodTrend(reviews, method, span = 5) {
  const rows = reviews
    .filter(review => review.methodId === method.id && review.total > 0)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(review => ({
      id: review.id,
      source: review.source,
      createdAt: review.createdAt,
      accuracy: review.correct / review.total,
      minutes: review.elapsedSeconds ? Math.round(review.elapsedSeconds / 60) : 0,
      metrics: Object.fromEntries(method.metrics.map(metric => [metric.id, Number(review.methodMetrics?.[metric.id]) || 0])),
    }))
  const average = (list, pick) => (list.length ? list.reduce((sum, row) => sum + pick(row), 0) / list.length : null)
  const early = rows.slice(0, span)
  const recent = rows.length > span ? rows.slice(-span) : []
  return {
    rows,
    compare: [
      { id: 'accuracy', label: '得分率', better: 'up', early: average(early, row => row.accuracy), recent: average(recent, row => row.accuracy) },
      ...method.metrics.map(metric => ({
        id: metric.id, label: metric.label, better: 'down',
        early: average(early, row => row.metrics[metric.id]), recent: average(recent, row => row.metrics[metric.id]),
      })),
    ],
  }
}

/** 同义替换没认出时，替换机制的分布：决定专项练什么。 @param {object[]} records */
export function synonymMechanismProfile(records) {
  const counts = {}
  const evidence = {}
  for (const record of records.filter(item => item.domain === 'ielts')) {
    for (const pair of record.synonyms || []) {
      if (pair.mechanism) counts[pair.mechanism] = (counts[pair.mechanism] || 0) + 1
      if (pair.evidence) evidence[pair.evidence] = (evidence[pair.evidence] || 0) + 1
    }
  }
  const sort = object => Object.entries(object).sort((a, b) => b[1] - a[1])
  return { mechanisms: sort(counts), evidence: sort(evidence) }
}
