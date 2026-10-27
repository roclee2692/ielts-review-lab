// 三个框的录入：原文（可选）、题目（可选）、答案（答案册 + 我的答案，一个框）。
// 题目框里的“Questions 1–5 / Do the following statements agree… / Write NO MORE
// THAN TWO WORDS”这类说明行会自动带给后面的题，不用逐题设题型和字数要求。

import { inferTypeFromKey, parseAnswerSheet } from '../core/answerSheet.js'
import { inferQuestionType } from './parse.js'

const INSTRUCTION = /(ONE WORD ONLY|ONE WORD AND\/OR A NUMBER|NO MORE THAN (?:ONE|TWO|THREE) WORDS?(?: AND\/OR A NUMBER)?|\bA NUMBER\b)/i
const NUMBERED = /^\s*(\d{1,2})\s*[.)、．:：]?\s+(.*)$|^\s*(\d{1,2})\s*[.)、．]\s*(.*)$/u
const OPTION = /^\s*([A-H]|i{1,3}|iv|vi{0,3}|ix|x)\s*[.)、:：]\s*\S/i
// Books often print options as "A  to grow food" with no punctuation; only
// trust that form under a "Choose the correct letter" header.
const BARE_OPTION = /^\s*[A-H]\s+\S/

/** @param {string} line */
function headerContext(line) {
  const text = line.toUpperCase()
  /** @type {{ type?: string, instruction?: string, reset?: boolean }} */
  const context = {}
  if (/^\s*QUESTIONS?\s+\d/.test(text)) context.reset = true
  if (/TRUE\W+FALSE\W+(?:OR\W+)?NOT\s+GIVEN/.test(text)) context.type = 'tfng'
  else if (/YES\W+NO\W+(?:OR\W+)?NOT\s+GIVEN/.test(text)) context.type = 'ynng'
  else if (/CHOOSE\s+(?:TWO|THREE|FOUR)\s+LETTERS?|SELECT\s+(?:TWO|THREE)/.test(text)) context.type = 'mcq-multi'
  else if (/CHOOSE\s+THE\s+CORRECT\s+LETTER/.test(text)) context.type = 'mcq'
  else if (/HEADING|WHICH\s+PARAGRAPH|PARAGRAPH\s+CONTAINS|MATCH\s+EACH|LIST\s+OF\s+(?:PEOPLE|RESEARCHERS|NAMES)/.test(text)) context.type = 'matching'
  else if (/COMPLETE\s+THE\s+(?:SENTENCES?|SUMMARY|NOTES?|TABLE|FLOW|DIAGRAM)/.test(text)) context.type = 'gap'
  const instruction = line.match(INSTRUCTION)
  if (instruction) context.instruction = instruction[1].toUpperCase().replace(/\s+/g, ' ')
  return context
}

/**
 * @param {string} text the questions as pasted from the book or a screenshot
 * @returns {{ number: number, type: string, prompt: string, options: string[], instruction: string }[]}
 */
export function parseQuestionBlock(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  /** @type {{ type: string, instruction: string }} */
  let context = { type: '', instruction: '' }
  /** @type {any[]} */
  const questions = []
  let current = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const numbered = line.match(NUMBERED)
    const number = numbered ? Number(numbered[1] || numbered[3]) : NaN
    const body = numbered ? (numbered[2] ?? numbered[4] ?? '') : ''
    // "Questions 1-5" and similar headers are not questions even though they contain numbers.
    const header = headerContext(line)
    if (header.reset || (!numbered && (header.type || header.instruction))) {
      context = { type: header.type || (header.reset ? '' : context.type), instruction: header.instruction || (header.reset ? '' : context.instruction) }
      current = null
      continue
    }
    if (numbered && Number.isInteger(number) && number >= 1 && number <= 40) {
      current = { number, type: context.type, fromHeader: !!context.type, prompt: body.trim(), options: [], instruction: context.instruction }
      questions.push(current)
      continue
    }
    const choice = current?.type === 'mcq' || current?.type === 'mcq-multi'
    if (current && (choice || !current.type) && (OPTION.test(line) || (choice && BARE_OPTION.test(line)))) {
      current.options.push(line)
      continue
    }
    if (current) current.prompt = `${current.prompt}${current.prompt ? ' ' : ''}${line}`
  }
  for (const question of questions) {
    if (!question.type) question.type = inferQuestionType(question.prompt, question.options)
  }
  return questions
}

/**
 * A TRUE/FALSE/NOT GIVEN key beats a guessed "gap" (no header said otherwise),
 * so the wrong-label-set check still works when the learner pasted bare questions.
 * @param {any} question @param {string} key @param {string|null} mine
 */
function resolveType(question, key, mine) {
  const fromKey = inferTypeFromKey(key)
  const judgement = fromKey === 'tfng' || fromKey === 'ynng'
  if (!question) return fromKey
  if (judgement && question.type === 'gap' && !question.fromHeader) {
    // NOT GIVEN alone fits both sets; the learner's own YES/NO tells us which.
    return /^(yes|no|y|n)$/i.test(String(mine || '')) ? 'ynng' : fromKey
  }
  if ((fromKey === 'mcq' || fromKey === 'mcq-multi') && question.type === 'gap' && !question.fromHeader && question.options.length) return fromKey
  return question.type
}

/**
 * Merge the three boxes into editable questions.
 * @param {{ questionsText?: string, answersText: string, idPrefix?: string }} input
 * @returns {{ questions: any[], warnings: string[], missingMine: number[] }}
 */
export function buildQuestionsFromBoxes({ questionsText = '', answersText, idPrefix = `q-${Date.now()}` }) {
  const parsed = parseQuestionBlock(questionsText)
  const types = Object.fromEntries(parsed.map(question => [question.number, question.type]))
  const sheet = parseAnswerSheet(answersText, { types })
  const warnings = [...sheet.warnings]
  const byNumber = new Map(sheet.entries.map(entry => [entry.number, entry]))
  const numbers = [...new Set([...parsed.map(question => question.number), ...sheet.entries.map(entry => entry.number)])].sort((a, b) => a - b)

  const questions = numbers.map(number => {
    const question = parsed.find(item => item.number === number)
    const entry = byNumber.get(number)
    if (question && !entry) warnings.push(`第 ${number} 题在题目里有，但答案框里没有答案`)
    const key = entry?.key || ''
    return {
      id: `${idPrefix}-${number}`,
      number: String(number),
      type: resolveType(question, key, entry?.mine ?? null),
      prompt: question?.prompt || '',
      options: question?.options || [],
      instruction: question?.instruction || '',
      key,
      userAnswer: entry?.mine ?? '',
      mineUnknown: !entry || entry.mine === null,
    }
  })
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i - 1] + 1) warnings.push(`题号从 ${numbers[i - 1]} 跳到了 ${numbers[i]}，中间的题漏了吗？`)
  }
  const missingMine = questions.filter(question => question.mineUnknown && question.key).map(question => Number(question.number))
  return { questions, warnings, missingMine }
}
