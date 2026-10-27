// 一篇阅读复盘的三张表：错题表、同义替换表、难词短语表。
// 纯函数：输入复盘结果和讲解，输出可复制的 Markdown 和可导入表格软件的 CSV。

import { TYPE_LABELS } from '../data/causes.js'

/** @param {unknown} value */
const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
/** @param {unknown} value */
const keyText = value => (Array.isArray(value) ? value.join(', ') : String(value ?? ''))

/**
 * @param {{ source: string, createdAt?: number, elapsedSeconds?: number }} review
 * @param {any[]} results judged questions
 * @param {Record<string, any>} explanations by question id
 * @param {{ methodTitle?: string, metrics?: { label: string, value: number|string }[] }} [method]
 */
export function buildReadingReport(review, results, explanations = {}, method = {}) {
  const wrong = results.filter(result => !result.correct)
  const mistakes = wrong.map(result => {
    const explanation = explanations[result.id] || {}
    return {
      number: result.number,
      type: TYPE_LABELS[result.type] || result.type,
      mine: result.userAnswer || '（未记录）',
      key: keyText(result.key),
      cause: explanation.cause || result.ruleCause || result.cause || '待归类',
      basis: explanation.causeBasis === 'rule' || result.ruleCause ? '规则判定' : explanation.causeBasis === 'user' ? '你确认' : explanation.causeBasis === 'tag' ? '按处境' : explanation.cause ? '模型建议' : '',
      situation: explanation.situation || '',
      location: explanation.locationQuote || '',
    }
  })

  const synonyms = []
  const vocab = new Map()
  for (const result of results) {
    const explanation = explanations[result.id]
    if (!explanation) continue
    for (const pair of explanation.synonymPairs || []) {
      synonyms.push({
        number: result.number,
        question: pair.question,
        passage: pair.passage,
        mechanism: pair.mechanism || '',
        evidence: pair.evidence || '',
        note: pair.note || '',
      })
    }
    for (const item of explanation.vocab || []) {
      const key = String(item.en || '').trim().toLowerCase()
      if (key && !vocab.has(key)) vocab.set(key, { en: item.en, zh: item.zh, priority: item.priority || '' })
    }
  }
  const vocabList = [...vocab.values()].sort((a, b) => (a.priority === '高价值' ? 0 : 1) - (b.priority === '高价值' ? 0 : 1))

  const correct = results.length - wrong.length
  const minutes = review.elapsedSeconds ? Math.round(review.elapsedSeconds / 60) : 0
  const lines = [
    `# ${review.source || '阅读复盘'}`,
    '',
    `${correct}/${results.length} 正确${minutes ? ` · 用时 ${minutes} 分钟` : ''}${review.createdAt ? ` · ${new Date(review.createdAt).toLocaleDateString('zh-CN')}` : ''}`,
  ]
  if (method.methodTitle) {
    lines.push('', `做题方法：${method.methodTitle}${(method.metrics || []).length ? ` · ${method.metrics.map(metric => `${metric.label} ${metric.value}`).join(' · ')}` : ''}`)
  }
  lines.push('', '## 错题表', '')
  if (mistakes.length) {
    lines.push('| 题号 | 题型 | 我的答案 | 答案册 | 错因 | 依据 | 当时的处境 |', '|---|---|---|---|---|---|---|')
    for (const row of mistakes) lines.push(`| ${row.number} | ${cell(row.type)} | ${cell(row.mine)} | ${cell(row.key)} | ${cell(row.cause)} | ${row.basis} | ${cell(row.situation)} |`)
  } else lines.push('全对。')

  lines.push('', '## 同义替换表', '')
  if (synonyms.length) {
    lines.push('| 题号 | 题干表达 | 原文表达 | 替换机制 | 证据 | 备注 |', '|---|---|---|---|---|---|')
    for (const row of synonyms) lines.push(`| ${row.number} | ${cell(row.question)} | ${cell(row.passage)} | ${cell(row.mechanism)} | ${cell(row.evidence)} | ${cell(row.note)} |`)
  } else lines.push('还没有讲解过的题，讲完后这里会列出同义替换。')

  lines.push('', '## 难词短语表', '')
  if (vocabList.length) {
    lines.push('| 英文 | 中文 | 优先级 |', '|---|---|---|')
    for (const row of vocabList) lines.push(`| ${cell(row.en)} | ${cell(row.zh)} | ${cell(row.priority)} |`)
  } else lines.push('还没有收集到。')

  return { markdown: `${lines.join('\n')}\n`, mistakes, synonyms, vocab: vocabList }
}

/** @param {unknown} value */
const csvCell = value => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * One CSV with a "表" column, so it opens as a single sheet in Excel / Numbers.
 * Starts with a BOM so Excel reads the Chinese correctly.
 * @param {ReturnType<typeof buildReadingReport>} report
 */
export function readingReportCsv(report) {
  const rows = [['表', '题号', '列1', '列2', '列3', '列4', '列5']]
  for (const row of report.mistakes) rows.push(['错题', row.number, `我的答案：${row.mine}`, `答案册：${row.key}`, row.cause, row.basis, row.situation])
  for (const row of report.synonyms) rows.push(['同义替换', row.number, row.question, row.passage, row.mechanism, row.evidence, row.note])
  for (const row of report.vocab) rows.push(['难词短语', '', row.en, row.zh, row.priority, '', ''])
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\n')}\n`
}
