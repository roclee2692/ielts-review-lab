import { ALL_VOCAB } from '../data/vocab.js'

export const REVIEW_INTERVALS_DAYS = Object.freeze([1, 3, 7, 14, 30])
export const REVIEW_GRADES = Object.freeze(['again', 'hard', 'good', 'easy'])

/** @param {Date|number|string} [value] */
export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** @param {string} key @param {number} days */
export function addDaysToKey(key, days) {
  const date = new Date(`${key}T00:00:00`)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/** @param {string} kind @param {string} sourceId */
export function reviewKey(kind, sourceId) {
  return `${kind}:${sourceId}`
}

export function emptyReviewSchedule() {
  return { version: 1, items: {} }
}

/** @param {unknown} value */
export function normalizeReviewSchedule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyReviewSchedule()
  return {
    version: 1,
    items: value.items && typeof value.items === 'object' && !Array.isArray(value.items) ? { ...value.items } : {},
  }
}

/** @param {'mistake'|'replacement'|'vocab'} kind @param {string} sourceId @param {Date|number|string} [now] */
export function createScheduleEntry(kind, sourceId, now = new Date()) {
  return {
    key: reviewKey(kind, sourceId),
    kind,
    sourceId: String(sourceId),
    stage: 0,
    dueDate: dateKey(now),
    lastReviewedAt: null,
    lastGrade: null,
    lapses: 0,
    history: [],
  }
}

/** @param {object|null|undefined} entry @param {Date|number|string} [now] */
export function isReviewDue(entry, now = new Date()) {
  return !entry?.dueDate || entry.dueDate <= dateKey(now)
}

/**
 * Deterministic interval rule used by both the UI and tests.
 * again: reset to stage 0, +1 day; hard: keep stage; good: +1 stage; easy: +2.
 * The due date is always calculated from the review date, never from the old due date.
 * @param {object} entry
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {Date|number|string} [now]
 */
export function gradeScheduleEntry(entry, grade, now = new Date()) {
  if (!REVIEW_GRADES.includes(grade)) throw new Error(`Unknown review grade: ${grade}`)
  const current = entry?.key ? entry : createScheduleEntry(entry?.kind || 'mistake', entry?.sourceId || 'unknown', now)
  let stage = Number(current.stage) || 0
  let lapses = Number(current.lapses) || 0
  if (grade === 'again') {
    stage = 0
    lapses += 1
  } else if (grade === 'good') {
    stage = Math.min(stage + 1, REVIEW_INTERVALS_DAYS.length)
  } else if (grade === 'easy') {
    stage = Math.min(stage + 2, REVIEW_INTERVALS_DAYS.length)
  }
  const intervalIndex = stage === 0 ? 0 : Math.min(stage - 1, REVIEW_INTERVALS_DAYS.length - 1)
  const interval = REVIEW_INTERVALS_DAYS[intervalIndex]
  const at = new Date(now).toISOString()
  return {
    ...current,
    stage,
    lapses,
    lastGrade: grade,
    lastReviewedAt: at,
    dueDate: addDaysToKey(dateKey(now), interval),
    history: [...(Array.isArray(current.history) ? current.history : []), { at, grade }].slice(-20),
  }
}

/** @param {object} schedule @param {object} item @param {'again'|'hard'|'good'|'easy'} grade @param {Date|number|string} [now] */
export function applyReviewGrade(schedule, item, grade, now = new Date()) {
  const normalized = normalizeReviewSchedule(schedule)
  const entry = normalized.items[item.key] || createScheduleEntry(item.kind, item.sourceId, now)
  return {
    ...normalized,
    items: { ...normalized.items, [item.key]: gradeScheduleEntry(entry, grade, now) },
  }
}

/**
 * Build due and upcoming items from mistakes, replacements and favorite vocabulary.
 * New sources are due immediately; source text is only carried into the review item,
 * not into the persisted schedule.
 */
export function buildReviewQueue({
  records = [],
  replacements = [],
  vocabulary = { favorites: [], custom: [] },
  schedule = emptyReviewSchedule(),
  now = new Date(),
} = {}) {
  const normalized = normalizeReviewSchedule(schedule)
  const favorites = new Set(Array.isArray(vocabulary?.favorites) ? vocabulary.favorites : [])
  const custom = Array.isArray(vocabulary?.custom) ? vocabulary.custom : []
  const vocabById = new Map([...ALL_VOCAB, ...custom.map(item => ({ ...item, custom: true }))].map(item => [item.id, item]))
  const items = []

  for (const record of records.filter(item => item.domain === 'ielts')) {
    const key = reviewKey('mistake', record.id)
    const entry = normalized.items[key] || createScheduleEntry('mistake', record.id, now)
    items.push({
      key,
      kind: 'mistake',
      sourceId: record.id,
      title: record.questionSummary,
      prompt: record.questionSummary,
      answer: record.correctAnswer,
      cause: record.errorCause || '待归类',
      context: [record.module === 'listening' ? '听力' : '阅读', record.source, record.locationHint].filter(Boolean).join(' · '),
      reflection: record.reflection || '',
      schedule: entry,
      due: isReviewDue(entry, now),
    })
  }

  for (const pair of replacements) {
    const sourceId = pair.id || `${pair.question}→${pair.passage}`
    const key = reviewKey('replacement', sourceId)
    const entry = normalized.items[key] || createScheduleEntry('replacement', sourceId, now)
    items.push({
      key,
      kind: 'replacement',
      sourceId,
      title: pair.question,
      prompt: `“${pair.question}” 在原文中常被替换成什么？`,
      answer: pair.passage,
      cause: '同义替换',
      context: '我的替换库',
      schedule: entry,
      due: isReviewDue(entry, now),
    })
  }

  for (const id of favorites) {
    const vocab = vocabById.get(id)
    if (!vocab) continue
    const key = reviewKey('vocab', id)
    const entry = normalized.items[key] || createScheduleEntry('vocab', id, now)
    items.push({
      key,
      kind: 'vocab',
      sourceId: id,
      title: vocab.expression,
      prompt: `“${vocab.expression}” 的中文意思和典型搭配是什么？`,
      answer: `${vocab.meaning} · ${vocab.collocation || '无搭配说明'}${vocab.example ? `\n${vocab.example}` : ''}`,
      cause: '词块',
      context: vocab.categoryTitle || vocab.categoryId,
      schedule: entry,
      due: isReviewDue(entry, now),
    })
  }

  const sortItems = list => list.sort((a, b) => (
    a.schedule.dueDate.localeCompare(b.schedule.dueDate)
    || a.kind.localeCompare(b.kind)
    || a.title.localeCompare(b.title, 'zh-CN')
  ))
  const due = sortItems(items.filter(item => item.due))
  const upcoming = sortItems(items.filter(item => !item.due))
  const mistakeGroups = []
  const groups = new Map()
  for (const item of due.filter(entry => entry.kind === 'mistake')) {
    if (!groups.has(item.cause)) groups.set(item.cause, [])
    groups.get(item.cause).push(item)
  }
  for (const [cause, groupItems] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    mistakeGroups.push({ cause, count: groupItems.length, items: groupItems })
  }

  const counts = { mistake: 0, replacement: 0, vocab: 0 }
  for (const item of due) counts[item.kind] += 1
  return { items, due, upcoming, mistakeGroups, counts, totalDue: due.length }
}
