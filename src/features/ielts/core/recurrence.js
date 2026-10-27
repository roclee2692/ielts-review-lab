/**
 * North-star metric: how often a cause shows up again after it first appeared.
 *
 * For each (module, cause), take every review session of that module that came
 * after the first session containing the cause. The recurrence rate is the
 * share of those later sessions that contain the cause again. Sessions with no
 * mistakes count as "did not recur" — that is the point of the metric — so the
 * caller must pass every session, not only the ones that produced mistakes.
 *
 * `recentRate` uses only the last `recent` later sessions, so a falling rate
 * shows up before the lifetime number moves.
 */

/** @typedef {{ id: string, module: string, createdAt: number }} RecurrenceSession */
/** @typedef {{ reviewId: string, module: string, cause: string }} RecurrenceMistake */
/**
 * @typedef {{
 *   module: string, cause: string, firstSeen: number,
 *   sessionsAfter: number, recurred: number, rate: number|null,
 *   recentSessions: number, recentRate: number|null,
 * }} RecurrenceRow
 */

const UNCLASSIFIED = new Set(['', '待归类'])

/**
 * @param {RecurrenceSession[]} sessions
 * @param {RecurrenceMistake[]} mistakes
 * @param {{ recent?: number }} [options]
 * @returns {RecurrenceRow[]}
 */
export function causeRecurrence(sessions, mistakes, options = {}) {
  const span = Math.max(1, Number(options.recent) || 5)
  const ordered = [...(sessions || [])]
    .filter(session => session && session.id)
    .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0))
  const index = new Map(ordered.map((session, i) => [session.id, i]))

  /** @type {Map<string, Set<string>>} session id → causes in it */
  const causesBySession = new Map()
  for (const mistake of mistakes || []) {
    const cause = String(mistake?.cause ?? '').trim()
    if (UNCLASSIFIED.has(cause) || !index.has(mistake.reviewId)) continue
    if (!causesBySession.has(mistake.reviewId)) causesBySession.set(mistake.reviewId, new Set())
    causesBySession.get(mistake.reviewId).add(cause)
  }

  /** @type {Map<string, { module: string, cause: string, first: number }>} */
  const firsts = new Map()
  ordered.forEach((session, i) => {
    for (const cause of causesBySession.get(session.id) || []) {
      const key = `${session.module}\u0000${cause}`
      if (!firsts.has(key)) firsts.set(key, { module: session.module, cause, first: i })
    }
  })

  /** @type {RecurrenceRow[]} */
  const rows = []
  for (const { module, cause, first } of firsts.values()) {
    const later = ordered.slice(first + 1).filter(session => session.module === module)
    const hits = later.map(session => causesBySession.get(session.id)?.has(cause) ? 1 : 0)
    const recent = hits.slice(-span)
    const sum = (/** @type {number[]} */ values) => values.reduce((total, value) => total + value, 0)
    rows.push({
      module,
      cause,
      firstSeen: Number(ordered[first].createdAt) || 0,
      sessionsAfter: later.length,
      recurred: sum(hits),
      rate: later.length ? sum(hits) / later.length : null,
      recentSessions: recent.length,
      recentRate: recent.length ? sum(recent) / recent.length : null,
    })
  }
  return rows.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.recurred - a.recurred)
}
