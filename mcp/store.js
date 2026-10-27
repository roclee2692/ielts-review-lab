// File-backed data folder for the MCP engine. Plain JSON, one file per set and
// per review, so the folder can live in git and every host reads the same data.
//
//   <dir>/sets/<id>.json       passage/transcript + questions + answer key
//   <dir>/reviews/<id>.json    one attempt: answers, verdicts, causes, explanations
//   <dir>/schedule.json        spaced-review entries for wrong questions

import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function defaultDataDir() {
  return process.env.IELTS_LAB_DATA || join(homedir(), '.ielts-review-lab')
}

/** Ids end up in file names, so keep them to a safe alphabet. @param {string} value */
export function safeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled'
}

/** @param {string} dir */
export function createStore(dir = defaultDataDir()) {
  const sets = join(dir, 'sets')
  const reviews = join(dir, 'reviews')
  mkdirSync(sets, { recursive: true })
  mkdirSync(reviews, { recursive: true })

  /** @param {string} file @param {unknown} value */
  const write = (file, value) => {
    const tmp = `${file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
    renameSync(tmp, file)
  }
  /** @param {string} file @param {any} fallback */
  const read = (file, fallback) => {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  /** @param {string} folder */
  const all = folder => readdirSync(folder)
    .filter(name => name.endsWith('.json'))
    .map(name => read(join(folder, name), null))
    .filter(Boolean)

  return {
    dir,
    getSet: (/** @type {string} */ id) => read(join(sets, `${safeId(id)}.json`), null),
    putSet: (/** @type {any} */ set) => write(join(sets, `${safeId(set.id)}.json`), set),
    listSets: () => all(sets),
    getReview: (/** @type {string} */ id) => read(join(reviews, `${safeId(id)}.json`), null),
    putReview: (/** @type {any} */ review) => write(join(reviews, `${safeId(review.id)}.json`), review),
    listReviews: () => all(reviews).sort((a, b) => a.createdAt - b.createdAt),
    getSchedule: () => read(join(dir, 'schedule.json'), { version: 1, items: {} }),
    putSchedule: (/** @type {any} */ schedule) => write(join(dir, 'schedule.json'), schedule),
  }
}
