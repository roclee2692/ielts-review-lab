import { rawToBand } from '../core/index.js'
import { seriesKey } from './review.js'

export const REQUIRED_PARTS = Object.freeze({ reading: 3, listening: 4 })

/** @param {string} source */
export function extractPartNumber(source) {
  const match = String(source || '').match(/\b(?:passage|part)\s*(\d{1,2})\b/i)
  return match ? Number(match[1]) : null
}

/** @param {string} source */
export function setDisplayName(source) {
  const cleaned = String(source || '')
    .replace(/\s*\b(?:passage|part)\s*\d+\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || '未标注来源'
}

/** @param {number|undefined} seconds */
export function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  if (total === 0) return '未记录'
  const minutes = Math.floor(total / 60)
  const remaining = total % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return `${hours} 小时${rest ? ` ${rest} 分钟` : ''}`
  }
  return `${minutes} 分${remaining ? ` ${remaining} 秒` : ''}`
}

function mergeCauseShares(parts) {
  const counts = new Map()
  for (const part of parts) {
    for (const item of part.causeShares || []) {
      counts.set(item.cause, (counts.get(item.cause) || 0) + Number(item.count || 0))
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  return [...counts.entries()]
    .map(([cause, count]) => ({ cause, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause, 'zh-CN'))
}

function estimateBand(module, parts) {
  const total = parts.reduce((sum, part) => sum + Number(part.total || 0), 0)
  const raw = parts.reduce((sum, part) => sum + Number(part.correct || 0), 0)
  if (total < 37 || total > 40) return null
  return {
    raw,
    total,
    band: rawToBand(module === 'listening' ? 'listening' : 'reading-academic', raw),
    module: module === 'listening' ? 'listening' : 'reading-academic',
  }
}

/**
 * Group review summaries by source series, keeping the latest attempt of each
 * expected part. Reading sets require 3 passages; listening sets require 4 parts.
 * @param {object[]} reviews
 */
export function buildTestSetReports(reviews = []) {
  const groups = new Map()
  for (const review of reviews) {
    if (!review || !REQUIRED_PARTS[review.module]) continue
    const key = seriesKey(review.source || '')
    if (!key) continue
    const groupKey = `${review.module}|${key}`
    if (!groups.has(groupKey)) groups.set(groupKey, { module: review.module, key, source: review.source, reviews: [] })
    groups.get(groupKey).reviews.push(review)
  }

  const reports = []
  for (const [id, group] of groups) {
    const required = REQUIRED_PARTS[group.module]
    const sorted = [...group.reviews].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    const byPart = new Map()
    let unlabelled = 1
    for (const review of sorted) {
      let number = Number(review.partNumber) || extractPartNumber(review.source)
      if (!number) {
        while (byPart.has(unlabelled)) unlabelled += 1
        number = unlabelled++
      }
      byPart.set(number, { ...review, partNumber: number })
    }
    const parts = []
    for (let number = 1; number <= required; number += 1) {
      const review = byPart.get(number)
      if (!review) continue
      parts.push({
        reviewId: review.id,
        partNumber: number,
        source: review.source,
        total: Number(review.total) || 0,
        correct: Number(review.correct) || 0,
        wrong: Number(review.wrong) || 0,
        accuracy: Number(review.total) ? (Number(review.correct) || 0) / Number(review.total) : 0,
        elapsedSeconds: Math.max(0, Number(review.elapsedSeconds) || 0),
        createdAt: review.createdAt || 0,
        causeShares: Array.isArray(review.causeShares) ? review.causeShares : [],
      })
    }
    const missingParts = []
    for (let number = 1; number <= required; number += 1) if (!byPart.has(number)) missingParts.push(number)
    const completed = parts.length === required
    const total = parts.reduce((sum, part) => sum + part.total, 0)
    const correct = parts.reduce((sum, part) => sum + part.correct, 0)
    const elapsedSeconds = parts.reduce((sum, part) => sum + part.elapsedSeconds, 0)
    const latestAt = Math.max(0, ...parts.map(part => part.createdAt))
    reports.push({
      id,
      module: group.module,
      source: group.source,
      title: setDisplayName(group.source),
      required,
      parts,
      missingParts,
      completed,
      total,
      correct,
      wrong: total - correct,
      accuracy: total ? correct / total : 0,
      elapsedSeconds,
      timedParts: parts.filter(part => part.elapsedSeconds > 0).length,
      latestAt,
      estimate: completed ? estimateBand(group.module, parts) : null,
      causeShares: mergeCauseShares(parts),
    })
  }

  return reports.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1
    return b.latestAt - a.latestAt
  })
}

/** @param {ReturnType<typeof buildTestSetReports>} reports */
export function buildBandTrend(reports) {
  return reports
    .filter(report => report.completed && report.estimate)
    .sort((a, b) => a.latestAt - b.latestAt)
    .map(report => ({
      id: report.id,
      module: report.module,
      title: report.title,
      band: report.estimate.band,
      raw: report.estimate.raw,
      total: report.estimate.total,
      at: report.latestAt,
    }))
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** @param {object} report @param {ReturnType<typeof buildBandTrend>} [trend] */
export function buildSetMarkdownReport(report, trend = []) {
  const moduleName = report.module === 'listening' ? '听力' : '阅读'
  const lines = [
    `# IELTS ${moduleName}整套复盘：${report.title}`,
    '',
    `- 来源标签：${report.source}`,
    `- 状态：${report.completed ? '完整' : `未完整（缺少 ${report.missingParts.join('、')}）`}`,
    `- 已记录用时：${formatDuration(report.elapsedSeconds)}${report.timedParts < report.parts.length ? `（${report.timedParts}/${report.required} 个部分记录了时间）` : ''}`,
    `- 合计：对 ${report.correct} / ${report.total}，正确率 ${(report.accuracy * 100).toFixed(1)}%`,
    '',
    '## 各部分',
    '',
    '| Part | 来源 | 正确率 | 用时 |',
    '|---|---|---:|---:|',
    ...report.parts.map(part => `| ${part.partNumber} | ${escapeCell(part.source)} | ${(part.accuracy * 100).toFixed(1)}% (${part.correct}/${part.total}) | ${formatDuration(part.elapsedSeconds)} |`),
    '',
  ]
  if (!report.completed) {
    lines.push(`> 整套尚未完成，缺少 Part ${report.missingParts.join('、')}。`, '')
  }
  if (report.estimate) {
    lines.push(`## 估算分数段`, '', `原始分 ${report.estimate.raw}/${report.estimate.total}，估算 Band **${report.estimate.band.toFixed(1)}**。`, '', '> 这是按公开锚点近似的估算，不是官方成绩。', '')
  } else {
    lines.push('## 估算分数段', '', '数据不足 37 题或未收齐整套，因此不给出分数段。', '')
  }
  if (report.causeShares.length) {
    lines.push('## 错因', '', '| 错因 | 数量 | 占比 |', '|---|---:|---:|', ...report.causeShares.map(item => `| ${escapeCell(item.cause)} | ${item.count} | ${(item.share * 100).toFixed(1)}% |`), '')
  }
  if (trend.length) {
    lines.push('## 整套估算变化', '', '| 完成时间 | 套题 | 估算 Band |', '|---|---|---:|', ...trend.map(item => `| ${new Date(item.at).toISOString().slice(0, 10)} | ${escapeCell(item.title)} | ${item.band.toFixed(1)} |`), '', '> 趋势仅用于观察自己的变化，不构成官方成绩记录。', '')
  }
  lines.push('---', '', '由 CS Hub IELTS Lab 本地生成。报告不含保存的全文、API key 或模型输入全文。', '')
  return lines.join('\n')
}
