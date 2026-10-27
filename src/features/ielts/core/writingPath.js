/** @typedef {{ id: string, title: string, section: string, requires: string[], description: string }} LadderItem */

const LADDER = Object.freeze([
  { id: 't1-intro', title: 'Task 1 开头改写', section: 'task1', requires: [], description: '把题目改写成准确、自然的开头，不抄题。' },
  { id: 't1-overview', title: 'Task 1 Overview', section: 'task1', requires: ['t1-intro'], description: '概括最显著的总体趋势或差异。' },
  { id: 't1-body', title: 'Task 1 主体段数据描述', section: 'task1', requires: ['t1-overview'], description: '分组描述数据，并用准确表达比较。' },
  { id: 'mock-t1', title: '20 分钟小作文限时', section: 'task1', requires: ['t1-body'], description: '在 20 分钟内完成一篇 Task 1。' },
  { id: 't2-intro', title: 'Task 2 开头改写', section: 'task2', requires: [], description: '改写题目并清楚表达立场。' },
  { id: 't2-conclusion', title: 'Task 2 结尾总结', section: 'task2', requires: [], description: '总结立场与主要论点，不引入新观点。' },
  { id: 't2-outline', title: 'Task 2 构思框架', section: 'task2', requires: ['t2-intro', 't2-conclusion'], description: '在限时内搭出立场、首尾句和完整论证链。' },
  { id: 't2-body', title: 'Task 2 主体段展开', section: 'task2', requires: ['t2-outline'], description: '用举例、因果或对比展开中心论点。' },
  { id: 'mock-t2', title: '40 分钟大作文限时', section: 'task2', requires: ['t2-body'], description: '在 40 分钟内完成一篇 Task 2。' },
  { id: 'mock-full', title: '60 分钟全套', section: 'mock', requires: ['mock-t1', 'mock-t2'], description: '连续完成 Task 1 与 Task 2。' },
  { id: 'translation', title: '中译英句型', section: 'foundation', requires: [], description: '随时练习从句、介词搭配和常用句型。' },
])

/**
 * Return a defensive copy of the single writing-ladder source of truth.
 * @returns {LadderItem[]}
 */
export function getWritingLadder() {
  return LADDER.map(item => ({ ...item, requires: [...item.requires] }))
}
/**
 * @param {{ completed?: string[] }} progress
 * @param {string} itemId
 * @returns {boolean}
 */
export function canStart(progress, itemId) {
  const item = LADDER.find(candidate => candidate.id === itemId)
  if (!item) return false
  const completed = new Set(Array.isArray(progress?.completed) ? progress.completed : [])
  return item.requires.every(requirement => completed.has(requirement))
}
