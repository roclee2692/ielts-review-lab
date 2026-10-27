// MCP tools. The host model calls these; the engine owns every deterministic
// decision (validation, judging, evidence checks, cause vocabulary, limits).
// Rules live here, not in prompts: a tool call that breaks them is rejected
// with a list of problems the model can fix and resubmit.

import {
  QUESTION_TYPES,
  causeRecurrence,
  judgeAnswer,
  parseAnswerLine,
  verifyEvidence,
} from '../src/features/ielts/core/index.js'
import { EVIDENCE_STATUS, LISTENING_CAUSES, READING_CAUSES, SYNONYM_MECHANISMS, causeFromErrors } from '../src/features/ielts/data/causes.js'
import { BUILTIN_METHODS, methodBrief, normalizeMethod } from '../src/features/ielts/data/methods.js'
import { buildQuestionsFromBoxes } from '../src/features/ielts/domain/entry.js'
import { buildReadingReport } from '../src/features/ielts/domain/readingReport.js'
import { createScheduleEntry, dateKey, gradeScheduleEntry, isReviewDue } from '../src/features/ielts/domain/spacedRepetition.js'
import { safeId } from './store.js'

export class ToolError extends Error {
  /** @param {string} message @param {string[]} [problems] */
  constructor(message, problems = []) {
    super(message)
    this.problems = problems
  }
}

const MODULES = ['reading', 'listening']
/** @param {string} module */
const causesFor = module => (module === 'listening' ? LISTENING_CAUSES : READING_CAUSES)
const CONFIDENCE = ['high', 'medium', 'low']

/** @param {unknown} value */
const text = value => String(value ?? '').trim()

/** @param {any} review */
function publicResults(review) {
  return review.results.map((/** @type {any} */ result) => ({
    number: result.number,
    type: result.type,
    correct: result.correct,
    user_answer: result.userAnswer,
    answer_key: result.key,
    rule_errors: result.errors,
    cause: result.cause || '',
    cause_basis: result.causeBasis || '',
    explained: !!result.explanation,
  }))
}

/**
 * Validate the structure the host model recognised from a paste or a photo.
 * Returns problems instead of guessing, so a bad recognition is re-done, not
 * silently judged.
 * @param {any[]} questions
 */
function validateQuestions(questions) {
  const problems = []
  if (!Array.isArray(questions) || questions.length === 0) return ['questions 不能为空']
  const numbers = questions.map(question => Number(question?.number))
  numbers.forEach((number, i) => {
    if (!Number.isInteger(number) || number < 1 || number > 40) problems.push(`第 ${i + 1} 项的题号 ${questions[i]?.number} 不是 1–40 的整数`)
  })
  const sorted = [...numbers].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) problems.push(`题号 ${sorted[i]} 重复`)
    else if (sorted[i] !== sorted[i - 1] + 1) problems.push(`题号不连续：${sorted[i - 1]} 之后是 ${sorted[i]}，中间的题漏识别了吗？`)
  }
  for (const question of questions) {
    if (!QUESTION_TYPES.includes(question?.type)) problems.push(`第 ${question?.number} 题的 type「${question?.type}」不在 ${QUESTION_TYPES.join(' / ')} 里`)
    const key = Array.isArray(question?.key) ? question.key.join('') : text(question?.key)
    if (!key) problems.push(`第 ${question?.number} 题没有答案册答案`)
    if ((question?.type === 'tfng' || question?.type === 'ynng') && key) {
      const labels = question.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
      if (!labels.includes(key.toUpperCase())) problems.push(`第 ${question.number} 题是 ${question.type}，答案册「${key}」不是 ${labels.join(' / ')} 之一`)
    }
  }
  return problems
}

/** @param {ReturnType<import('./store.js').createStore>} store @param {string} reviewId */
function loadReview(store, reviewId) {
  const review = store.getReview(text(reviewId))
  if (!review) throw new ToolError(`找不到复盘 ${reviewId}`)
  return review
}

/** @param {any} review @param {unknown} number */
function findResult(review, number) {
  const result = review.results?.find((/** @type {any} */ item) => item.number === Number(number))
  if (!result) throw new ToolError(`复盘 ${review.id} 里没有第 ${number} 题${review.results ? '' : '（还没判题，先调用 judge_set）'}`)
  return result
}

/** @type {Record<string, { description: string, inputSchema: object, handler: (store: any, args: any) => any }>} */
export const TOOLS = {
  ingest_passage: {
    description: '录入一篇阅读或一个听力 Part。最省事的给法：source + answer_sheet（答案册和用户答案写在一起，如 "1 FALSE NG\n2 two weeks | two week\n3 B ✓"），可再加 questions_text（整段题目）和 passage。用户没给原文/答案时，你可以按来源联网找，并把 passage_origin / key_origin 设为 web。也可以给结构化的 questions。可以只给 set_id 复用录过的同一篇。引擎检查题号连续、标签合法、答案对得上，有问题会退回。不判题。',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', enum: MODULES },
        source: { type: 'string', description: '来源标签，例如“剑 19 Test 2 Passage 1”。同一来源会作为题集复用。' },
        set_id: { type: 'string', description: '复用已录题集（list_sets 返回的 id）。给了它就不用再传 passage/questions。' },
        passage: { type: 'string', description: '英文原文或听力文稿，逐字。可以为空（讲解会标为无法校验）。' },
        passage_origin: { type: 'string', enum: ['user', 'web'], description: '原文来自用户（默认）还是你联网找到的' },
        key_origin: { type: 'string', enum: ['user', 'web'], description: '答案册来自用户（默认）还是你联网找到的；web 的会在判题结果里标“未核对答案册”' },
        answer_sheet: { type: 'string', description: '答案册 + 用户答案，一行一题：题号 答案册 [用户答案]。支持 "|"、✓、✗、"(我: x)"、两个判断标签连写。' },
        questions_text: { type: 'string', description: '整段题目原文，说明行里的题型和字数要求会自动带给后面的题。' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              number: { type: 'integer' },
              type: { type: 'string', enum: [...QUESTION_TYPES] },
              prompt: { type: 'string' },
              key: { description: '答案册。"/" 分隔可接受写法，圆括号表示可省略。', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
              instruction: { type: 'string', description: '例如 NO MORE THAN TWO WORDS' },
              options: { type: 'array', items: { type: 'string' } },
            },
            required: ['number', 'type', 'key'],
          },
        },
        user_answers: { type: 'object', description: '题号 → 用户答案，例如 {"1":"TRUE"}', additionalProperties: { type: 'string' } },
        answer_line: { type: 'string', description: '用户答案速记，例如 "1 TRUE 2 NG 3 museum"。和 user_answers 二选一。' },
        reflections: { type: 'object', description: '题号 → 用户做这题时的处境或反思（可中文），例如“首次经过答案句没认出”', additionalProperties: { type: 'string' } },
        elapsed_minutes: { type: 'number' },
      },
      required: ['module'],
    },
    handler(store, input) {
      let args = input
      const module = text(args.module)
      if (!MODULES.includes(module)) throw new ToolError('module 只能是 reading 或 listening')
      let set = args.set_id ? store.getSet(args.set_id) : null
      if (args.set_id && !set) throw new ToolError(`没有题集 ${args.set_id}，先用 list_sets 查看`)
      if (!set) {
        const problems = []
        if (!text(args.source)) problems.push('需要 source（来源标签），用来以后复用这篇')
        let questions = args.questions
        /** @type {Record<string, string>} */
        let sheetAnswers = {}
        if (!Array.isArray(questions) || questions.length === 0) {
          if (!text(args.answer_sheet)) problems.push('需要 answer_sheet（答案册 + 用户答案）或结构化的 questions')
          else {
            const built = buildQuestionsFromBoxes({ questionsText: args.questions_text || '', answersText: args.answer_sheet, idPrefix: 'mcp' })
            questions = built.questions.map(question => ({ number: Number(question.number), type: question.type, prompt: question.prompt, key: question.key, instruction: question.instruction, options: question.options }))
            sheetAnswers = Object.fromEntries(built.questions.filter(question => !question.mineUnknown).map(question => [question.number, question.userAnswer]))
          }
        }
        if (questions) problems.push(...validateQuestions(questions))
        if (problems.length) throw new ToolError('录入内容有问题，请核对后重新提交', problems)
        set = {
          id: safeId(`${module}-${args.source}`),
          module,
          source: text(args.source),
          passage: String(args.passage || ''),
          passageOrigin: args.passage_origin === 'web' ? 'web' : 'user',
          keyOrigin: args.key_origin === 'web' ? 'web' : 'user',
          questions: questions.map((/** @type {any} */ question) => ({
            number: Number(question.number),
            type: question.type,
            prompt: text(question.prompt),
            key: question.key,
            instruction: text(question.instruction),
            options: Array.isArray(question.options) ? question.options.map(String) : [],
          })).sort((/** @type {any} */ a, /** @type {any} */ b) => a.number - b.number),
          updatedAt: Date.now(),
        }
        store.putSet(set)
        if (!text(args.answer_line) && !args.user_answers && Object.keys(sheetAnswers).length) args = { ...args, user_answers: sheetAnswers }
      }
      if (set.module !== module) throw new ToolError(`题集 ${set.id} 是 ${set.module}，不是 ${module}`)

      /** @type {Record<string, string>} */
      let answers = {}
      const warnings = []
      if (text(args.answer_line)) {
        const types = Object.fromEntries(set.questions.map((/** @type {any} */ question) => [question.number, question.type]))
        const parsed = parseAnswerLine(args.answer_line, { first: set.questions[0].number, types })
        warnings.push(...parsed.warnings)
        answers = Object.fromEntries(parsed.answers.map(item => [String(item.number), item.answer]))
      } else if (args.user_answers && typeof args.user_answers === 'object') {
        answers = Object.fromEntries(Object.entries(args.user_answers).map(([key, value]) => [String(Number(key)), String(value ?? '')]))
      }
      const numbers = new Set(set.questions.map((/** @type {any} */ question) => String(question.number)))
      const extra = Object.keys(answers).filter(number => !numbers.has(number))
      if (extra.length) throw new ToolError('用户答案的题号和题目对不上', [`这些题号不在题目里：${extra.join('、')}`])
      const blank = [...numbers].filter(number => !text(answers[number]))
      if (blank.length) warnings.push(`第 ${blank.join('、')} 题没有用户答案，会按“未作答”判`)

      const createdAt = Date.now()
      const review = {
        // Timestamp first so a long source label can never truncate it away.
        id: safeId(`${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 6)}-${set.id.slice(0, 50)}`),
        setId: set.id,
        module,
        source: set.source,
        createdAt,
        elapsedSeconds: Number(args.elapsed_minutes) > 0 ? Math.round(Number(args.elapsed_minutes) * 60) : 0,
        answers,
        reflections: args.reflections && typeof args.reflections === 'object'
          ? Object.fromEntries(Object.entries(args.reflections).map(([key, value]) => [String(Number(key)), String(value ?? '')]))
          : {},
        results: null,
        methodId: (resolveMethods(store).find(method => method.id === store.getMethods().active?.[module]) || resolveMethods(store).find(method => method.module === module))?.id || '',
      }
      store.putReview(review)
      return {
        text: `已录入「${set.source}」${set.questions.length} 题，复盘 id：${review.id}。下一步调用 judge_set。${warnings.length ? `\n注意：${warnings.join('；')}` : ''}`,
        data: { review_id: review.id, set_id: set.id, question_count: set.questions.length, warnings },
      }
    },
  },

  judge_set: {
    description: '按确定性规则判一整篇（字数、单复数、拼写、判断题标签体系）。对错只能由这里判，不要自己判。返回每题结果和规则能确定的错因。',
    inputSchema: { type: 'object', properties: { review_id: { type: 'string' } }, required: ['review_id'] },
    handler(store, args) {
      const review = loadReview(store, args.review_id)
      const set = store.getSet(review.setId)
      if (!set) throw new ToolError(`复盘引用的题集 ${review.setId} 不见了`)
      review.results = set.questions.map((/** @type {any} */ question) => {
        const userAnswer = review.answers[String(question.number)] || ''
        const verdict = judgeAnswer({ type: question.type, key: question.key, instruction: question.instruction }, userAnswer)
        const ruleCause = verdict.correct ? '' : causeFromErrors(verdict.errors)
        const previous = review.results?.find((/** @type {any} */ item) => item.number === question.number)
        return {
          number: question.number,
          type: question.type,
          key: question.key,
          userAnswer,
          ...verdict,
          ruleCause,
          cause: ruleCause || previous?.cause || '',
          causeBasis: ruleCause ? 'rule' : previous?.causeBasis || '',
          explanation: previous?.explanation || null,
        }
      })
      store.putReview(review)
      ensureScheduled(store, review)
      const correct = review.results.filter((/** @type {any} */ result) => result.correct).length
      const wrong = review.results.filter((/** @type {any} */ result) => !result.correct)
      return {
        text: `${set.keyOrigin === 'web' ? '⚠ 答案册来自网络，未经用户的答案册核对；讲解时要提醒用户。\n' : ''}${set.passage ? '' : '⚠ 没有原文：讲解的引用无法逐字校验。\n'}${review.source}：${correct}/${review.results.length} 正确。错题：${wrong.map((/** @type {any} */ result) => `${result.number}${result.ruleCause ? `（规则判定：${result.ruleCause}）` : ''}`).join('、') || '无'}。\n错题请逐题调用 submit_explanation，错因从 causes 里选。`,
        data: { review_id: review.id, correct, total: review.results.length, results: publicResults(review), causes: causesFor(review.module) },
      }
    },
  },

  submit_explanation: {
    description: '提交一道题的讲解。站在用户做题时的视角：题干在问什么 → 原文在哪、怎么从定位词找过去 → 原文句子怎么拆 → 用户为什么会那样答。引擎逐字校验定位句和同义替换的原文一侧，不在原文里就退回；同义替换要标替换机制和证据强度，证据不够时必须写 uncertainty，不许硬圆。讲解不能推翻答案册；错因必须从固定错因表里选。规则判定和用户确认的错因不会被覆盖。',
    inputSchema: {
      type: 'object',
      properties: {
        review_id: { type: 'string' },
        number: { type: 'integer' },
        stem_reading: { type: 'string', description: '题干在问什么、有哪些限定' },
        locate_route: { type: 'string', description: '从哪个定位词出发、在原文哪一段、怎么找过去' },
        location_quote: { type: 'string', description: '原文里逐字的定位句；没有原文时留空' },
        sentence_breakdown: { type: 'array', items: { type: 'object', properties: { chunk: { type: 'string' }, meaning: { type: 'string' } }, required: ['chunk', 'meaning'] } },
        synonym_pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              passage: { type: 'string' },
              mechanism: { type: 'string', enum: [...SYNONYM_MECHANISMS] },
              evidence: { type: 'string', enum: [...EVIDENCE_STATUS] },
              note: { type: 'string' },
            },
            required: ['question', 'passage', 'mechanism', 'evidence'],
          },
        },
        from_your_view: { type: 'string', description: '结合用户说的处境：他当时为什么会这样答、卡在哪' },
        uncertainty: { type: 'string', description: '证据不足 / 不确定的地方；有“证据不完整”的替换时必填' },
        vocab: { type: 'array', items: { type: 'object', properties: { en: { type: 'string' }, zh: { type: 'string' }, priority: { type: 'string', enum: ['高价值', '认识即可'] } }, required: ['en', 'zh', 'priority'] } },
        method_tip: { type: 'string', description: '按用户的做题方法（method 工具），下次在哪一步怎么做' },
        why_key_correct: { type: 'string' },
        why_user_wrong: { type: 'string' },
        cause: { type: 'string', description: '从 judge_set 返回的 causes 里选一个' },
        confidence: { type: 'string', enum: CONFIDENCE },
        advice: { type: 'string', description: '一两句下次可执行的建议' },
      },
      required: ['review_id', 'number', 'why_key_correct', 'cause', 'confidence'],
    },
    handler(store, args) {
      const review = loadReview(store, args.review_id)
      const result = findResult(review, args.number)
      const set = store.getSet(review.setId)
      const problems = []
      const pairs = Array.isArray(args.synonym_pairs) ? args.synonym_pairs : []
      const hasPassage = !!text(set?.passage)
      if (hasPassage) {
        if (!text(args.location_quote)) problems.push('有原文时需要 location_quote（原文里逐字的定位句）')
        const quotes = [text(args.location_quote), ...pairs.map((/** @type {any} */ pair) => text(pair?.passage))].filter(Boolean)
        const evidence = verifyEvidence(set.passage, quotes)
        for (const missing of evidence.missing) problems.push(`这句不在原文里（必须逐字引用）：「${missing}」`)
      } else if (text(args.location_quote)) {
        problems.push('没有原文，不能给 location_quote：引用无法校验。把定位思路写进 locate_route，并在 uncertainty 说明。')
      }
      for (const pair of pairs) {
        if (!SYNONYM_MECHANISMS.includes(text(pair?.mechanism))) problems.push(`同义替换「${pair?.question} ↔ ${pair?.passage}」的 mechanism 只能是：${SYNONYM_MECHANISMS.join(' / ')}`)
        if (!EVIDENCE_STATUS.includes(text(pair?.evidence))) problems.push(`同义替换「${pair?.question}」的 evidence 只能是：${EVIDENCE_STATUS.join(' / ')}`)
      }
      const incomplete = pairs.some((/** @type {any} */ pair) => text(pair?.evidence) === '证据不完整')
      if ((incomplete || !hasPassage) && !text(args.uncertainty)) problems.push(incomplete ? '有“证据不完整”的替换，必须在 uncertainty 写明缺了什么，不能当作已证明' : '没有原文时必须在 uncertainty 说明讲解无法校验')
      const causes = causesFor(review.module)
      if (!causes.includes(text(args.cause))) problems.push(`错因「${args.cause}」不在错因表里，只能选：${causes.join(' / ')}`)
      if (!CONFIDENCE.includes(text(args.confidence))) problems.push('confidence 只能是 high / medium / low')
      if (!text(args.why_key_correct)) problems.push('why_key_correct 不能为空')
      if (!result.correct && !text(args.why_user_wrong)) problems.push('错题需要 why_user_wrong')
      if (problems.length) throw new ToolError('讲解没有通过引擎校验，请改正后重新提交', problems)

      result.explanation = {
        stemReading: text(args.stem_reading),
        locateRoute: text(args.locate_route),
        locationQuote: text(args.location_quote),
        sentenceBreakdown: (Array.isArray(args.sentence_breakdown) ? args.sentence_breakdown : []).map((/** @type {any} */ item) => ({ chunk: text(item?.chunk), meaning: text(item?.meaning) })),
        synonymPairs: pairs.map((/** @type {any} */ pair) => ({ question: text(pair.question), passage: text(pair.passage), mechanism: text(pair.mechanism), evidence: text(pair.evidence), note: text(pair.note) })),
        fromYourView: text(args.from_your_view),
        uncertainty: text(args.uncertainty),
        vocab: (Array.isArray(args.vocab) ? args.vocab : []).map((/** @type {any} */ item) => ({ en: text(item?.en), zh: text(item?.zh), priority: item?.priority === '认识即可' ? '认识即可' : '高价值' })),
        methodTip: text(args.method_tip),
        verified: hasPassage,
        whyKeyCorrect: text(args.why_key_correct),
        whyUserWrong: text(args.why_user_wrong),
        advice: text(args.advice),
        modelCause: text(args.cause),
        confidence: text(args.confidence),
        submittedAt: Date.now(),
      }
      let causeNote = ''
      if (!result.correct) {
        if (result.causeBasis === 'rule' || result.causeBasis === 'user') {
          causeNote = result.cause === text(args.cause) ? '' : `（保留${result.causeBasis === 'rule' ? '规则判定' : '用户确认'}的错因「${result.cause}」，你的建议已记录）`
        } else {
          result.cause = text(args.cause)
          result.causeBasis = 'model'
        }
      }
      store.putReview(review)
      return {
        text: `第 ${result.number} 题讲解已通过引用校验并保存${causeNote}。请把讲解给用户看，并请用户确认错因（set_cause）。`,
        data: { review_id: review.id, number: result.number, cause: result.cause, cause_basis: result.causeBasis, confidence: result.explanation.confidence },
      }
    },
  },

  set_cause: {
    description: '用户确认或修改一道错题的错因。用户的选择优先于模型建议，以后的模型讲解不会覆盖它。',
    inputSchema: {
      type: 'object',
      properties: { review_id: { type: 'string' }, number: { type: 'integer' }, cause: { type: 'string' }, reflection: { type: 'string' } },
      required: ['review_id', 'number', 'cause'],
    },
    handler(store, args) {
      const review = loadReview(store, args.review_id)
      const result = findResult(review, args.number)
      if (result.correct) throw new ToolError(`第 ${result.number} 题是对的，不需要错因`)
      const causes = causesFor(review.module)
      if (!causes.includes(text(args.cause))) throw new ToolError(`错因「${args.cause}」不在错因表里`, [`可选：${causes.join(' / ')}`])
      result.cause = text(args.cause)
      result.causeBasis = 'user'
      if (text(args.reflection)) review.reflections[String(result.number)] = text(args.reflection)
      store.putReview(review)
      return { text: `第 ${result.number} 题错因已设为「${result.cause}」（用户确认）。`, data: { review_id: review.id, number: result.number, cause: result.cause } }
    },
  },

  weakness: {
    description: '弱点画像：各错因数量、最常错题型，以及北极星指标“同类错误复发率”（某个错因第一次出现后，之后的复盘里再出现的比例）。按数据说话。',
    inputSchema: { type: 'object', properties: { module: { type: 'string', enum: MODULES } } },
    handler(store, args) {
      const reviews = store.listReviews().filter((/** @type {any} */ review) => review.results && (!args.module || review.module === args.module))
      /** @type {Record<string, number>} */ const byCause = {}
      /** @type {Record<string, number>} */ const byType = {}
      const mistakes = []
      for (const review of reviews) {
        for (const result of review.results.filter((/** @type {any} */ item) => !item.correct)) {
          const cause = result.cause || '待归类'
          byCause[cause] = (byCause[cause] || 0) + 1
          byType[result.type] = (byType[result.type] || 0) + 1
          mistakes.push({ reviewId: review.id, module: review.module, cause })
        }
      }
      const sessions = reviews.map((/** @type {any} */ review) => ({ id: review.id, module: review.module, createdAt: review.createdAt }))
      const recurrence = causeRecurrence(sessions, mistakes)
      const sort = (/** @type {Record<string, number>} */ object) => Object.entries(object).sort((a, b) => b[1] - a[1])
      const pct = (/** @type {number|null} */ value) => (value === null ? '—' : `${Math.round(value * 100)}%`)
      const lines = [
        `${reviews.length} 次复盘，${mistakes.length} 道错题。`,
        `错因：${sort(byCause).map(([cause, count]) => `${cause} ${count}`).join('，') || '无'}`,
        `题型：${sort(byType).map(([type, count]) => `${type} ${count}`).join('，') || '无'}`,
        '复发率（之后的复盘里再出现的比例 · 最近 5 次）：',
        ...recurrence.map(row => `- [${row.module}] ${row.cause}：${pct(row.rate)}（${row.recurred}/${row.sessionsAfter}）· 最近 ${pct(row.recentRate)}`),
      ]
      return { text: lines.join('\n'), data: { reviews: reviews.length, mistakes: mistakes.length, by_cause: sort(byCause), by_type: sort(byType), recurrence } }
    },
  },

  today: {
    description: '今天最值得复练什么：按 1/3/7/14/30 天间隔到期的错题（重做时先只给题目和定位范围，不给答案），以及复发率最高的错因对应的专项练法。',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } } },
    handler(store, args) {
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10))
      const schedule = store.getSchedule()
      const now = new Date()
      const due = []
      for (const review of store.listReviews().filter((/** @type {any} */ item) => item.results)) {
        const set = store.getSet(review.setId)
        for (const result of review.results.filter((/** @type {any} */ item) => !item.correct)) {
          const key = `mistake:${review.id}:${result.number}`
          const entry = schedule.items[key]
          if (!entry || !isReviewDue(entry, now)) continue
          const question = set?.questions.find((/** @type {any} */ item) => item.number === result.number)
          due.push({
            key,
            review_id: review.id,
            number: result.number,
            source: review.source,
            prompt: question?.prompt || '',
            instruction: question?.instruction || '',
            cause: result.cause || '待归类',
            stage: entry.stage,
            due_date: entry.dueDate,
          })
        }
      }
      due.sort((a, b) => a.due_date.localeCompare(b.due_date))
      const picked = due.slice(0, limit)
      return {
        text: picked.length
          ? `今天到期 ${due.length} 题（列出 ${picked.length} 题）。先只给用户看题目和错因，让他说出定位范围和答案，再用 mark_reviewed 记录结果：\n${picked.map(item => `- ${item.source} 第 ${item.number} 题 · ${item.cause}`).join('\n')}`
          : '今天没有到期的错题。',
        data: { due_count: due.length, items: picked, today: dateKey(now) },
      }
    },
  },

  mark_reviewed: {
    description: '记录一道到期错题的重做结果：again（又错了）/ hard / good / easy，引擎据此排下一次复习日期。',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string', description: 'today 返回的 key' }, grade: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] } },
      required: ['key', 'grade'],
    },
    handler(store, args) {
      const schedule = store.getSchedule()
      const entry = schedule.items[text(args.key)]
      if (!entry) throw new ToolError(`没有复习项 ${args.key}`)
      const next = gradeScheduleEntry(entry, args.grade)
      schedule.items[entry.key] = next
      store.putSchedule(schedule)
      return { text: `已记录 ${args.grade}，下次复习：${next.dueDate}。`, data: { key: entry.key, due_date: next.dueDate, stage: next.stage } }
    },
  },

  report: {
    description: '一篇阅读复盘的三张表（错题表、同义替换表、难词短语表），Markdown 格式，用户可以直接复制。讲解提交得越完整，表越全。',
    inputSchema: { type: 'object', properties: { review_id: { type: 'string' } }, required: ['review_id'] },
    handler(store, args) {
      const review = loadReview(store, args.review_id)
      if (!review.results) throw new ToolError('还没判题，先调用 judge_set')
      const set = store.getSet(review.setId)
      const results = review.results.map((/** @type {any} */ result) => {
        const question = set?.questions.find((/** @type {any} */ item) => item.number === result.number)
        return { ...result, id: String(result.number), prompt: question?.prompt || '', ruleCause: result.ruleCause }
      })
      const explanations = Object.fromEntries(review.results.map((/** @type {any} */ result) => [String(result.number), {
        ...(result.explanation || {}),
        cause: result.cause,
        causeBasis: result.causeBasis,
        situation: review.reflections?.[String(result.number)] || '',
      }]))
      const methods = resolveMethods(store)
      const method = methods.find(item => item.id === review.methodId)
      const report = buildReadingReport({ source: review.source, createdAt: review.createdAt, elapsedSeconds: review.elapsedSeconds }, results, explanations, method ? { methodTitle: method.title } : {})
      return { text: report.markdown, data: { markdown: report.markdown, mistakes: report.mistakes.length, synonyms: report.synonyms.length, vocab: report.vocab.length } }
    },
  },

  method: {
    description: '用户的做题方法（例如平行阅读法）。复盘前先读一遍，讲题时按他的方法说“下次在哪一步怎么做”。可以查看、设为当前、或保存用户改过的版本。',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', enum: MODULES },
        action: { type: 'string', enum: ['get', 'list', 'use', 'save'] },
        method_id: { type: 'string' },
        method: { type: 'object', description: 'save 时传：{ id, module, title, summary, steps:[{title, points[]}], fixes:[{before, after}], principles[], metrics:[{id, label, hint}] }' },
      },
    },
    handler(store, args) {
      const module = args.module === 'listening' ? 'listening' : 'reading'
      const action = args.action || 'get'
      const state = store.getMethods()
      if (action === 'save') {
        const method = normalizeMethod(args.method)
        if (!method) throw new ToolError('method 需要 title')
        store.putMethods({ ...state, items: { ...state.items, [method.id]: method } })
        return { text: `已保存方法「${method.title}」。`, data: { id: method.id } }
      }
      const methods = resolveMethods(store).filter(method => method.module === module)
      if (action === 'list') return { text: methods.map(method => `- ${method.id}：${method.title}${state.active[module] === method.id ? '（当前）' : ''}`).join('\n') || '没有方法', data: { methods: methods.map(method => ({ id: method.id, title: method.title })) } }
      if (action === 'use') {
        if (!methods.some(method => method.id === args.method_id)) throw new ToolError(`没有方法 ${args.method_id}`)
        store.putMethods({ ...state, active: { ...state.active, [module]: args.method_id } })
        return { text: `${module} 的当前方法改为 ${args.method_id}。`, data: { id: args.method_id } }
      }
      const active = methods.find(method => method.id === state.active[module]) || methods[0]
      return { text: active ? methodBrief(active) : '没有设置做题方法。', data: { method: active || null } }
    },
  },

  list_sets: {
    description: '列出已录过的题集（同一本书同一篇只录一次），重做时把 set_id 传给 ingest_passage，只填这次的答案。',
    inputSchema: { type: 'object', properties: { module: { type: 'string', enum: MODULES } } },
    handler(store, args) {
      const sets = store.listSets()
        .filter((/** @type {any} */ set) => !args.module || set.module === args.module)
        .map((/** @type {any} */ set) => ({ id: set.id, module: set.module, source: set.source, questions: set.questions.length }))
      return { text: sets.length ? sets.map((/** @type {any} */ set) => `- ${set.id}：${set.source}（${set.questions} 题）`).join('\n') : '还没有题集。', data: { sets } }
    },
  },
}

/** Built-in methods (possibly edited) plus the learner's own, from the data folder. */
function resolveMethods(/** @type {any} */ store) {
  const state = store.getMethods()
  const builtins = BUILTIN_METHODS.map(method => normalizeMethod(state.items?.[method.id]) ? { ...normalizeMethod(state.items[method.id]), id: method.id } : method)
  const custom = Object.values(state.items || {}).map(normalizeMethod).filter(method => method && !BUILTIN_METHODS.some(builtin => builtin.id === method.id))
  return [...builtins, ...custom]
}

/** Wrong answers enter the schedule the first time they are judged. */
function ensureScheduled(/** @type {any} */ store, /** @type {any} */ review) {
  const schedule = store.getSchedule()
  let changed = false
  for (const result of review.results.filter((/** @type {any} */ item) => !item.correct)) {
    const key = `mistake:${review.id}:${result.number}`
    if (schedule.items[key]) continue
    // First review the day after the attempt, not the same day.
    const entry = createScheduleEntry('mistake', `${review.id}:${result.number}`)
    schedule.items[key] = { ...entry, key, dueDate: dateKey(new Date(Date.now() + 86_400_000)) }
    changed = true
  }
  if (changed) store.putSchedule(schedule)
}

/**
 * @param {ReturnType<import('./store.js').createStore>} store
 * @param {string} name
 * @param {any} args
 */
export function callTool(store, name, args = {}) {
  const tool = TOOLS[name]
  if (!tool) throw new ToolError(`未知工具：${name}`)
  return tool.handler(store, args || {})
}
