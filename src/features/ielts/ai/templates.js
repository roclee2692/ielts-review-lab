// Central model-template registry. Every browser/provider/proxy call must use
// one of these ids. The harness exporter imports this same object.

import { EVIDENCE_STATUS, LISTENING_CAUSES as LISTENING_CAUSE_LIST, READING_CAUSES as READING_CAUSE_LIST, SYNONYM_MECHANISMS } from '../data/causes.js'

const READING_CAUSES = [...READING_CAUSE_LIST]
const LISTENING_CAUSES = [...LISTENING_CAUSE_LIST]

const SOURCE_RULES = [
  '只依据用户提供的原文/听力文稿与答案册。',
  '不得重新做题，不得用常识补充事实，不得推翻答案册。',
  '所有 locationQuote/evidenceQuote 必须逐字摘自给定原文；找不到就留空并说明无法可靠定位。',
  '只解释为什么答案册的答案正确、用户答案为什么错误。',
]

const WRITING_RULES = [
  '先评价任务回应、构思和衔接，再看语言。',
  '最多指出 3 处最值得改的问题，每处给原句、改法和原因。',
  '给 1–2 个考场自然可用的表达。',
  '绝不整篇重写或代写，不输出一篇完整范文。',
  '任何分数都必须标为估算，不得表述为官方成绩。',
]

const SPEAKING_RULES = [
  '反馈像人和人聊天，优先肯定可迁移的表达。',
  '先给 3–5 个关键词或地道词块，再给 1–2 句口语化示范。',
  '语法只改影响理解或明显错误，最多 2 处，每处一句话说明原因。',
  '评价是否直接回应、自然展开、句间衔接。',
  '仅凭文字不能评估发音、连读和语调；不得给发音分或总分。',
]

function responseSchema(properties) {
  return {
    type: 'object',
    required: Object.keys(properties),
    properties,
  }
}

function stringSchema(maxLength = 1200) {
  return { type: 'string', maxLength }
}

function stringArraySchema(maxItems = 8, maxLength = 400) {
  return { type: 'array', maxItems, items: { type: 'string', maxLength } }
}

const readingExplanationSchema = responseSchema({
  locationQuote: stringSchema(1600),
  locationHint: stringSchema(300),
  synonymPairs: {
    type: 'array', maxItems: 8,
    items: responseSchema({
      question: stringSchema(160), passage: stringSchema(160),
    }),
  },
  whyKeyCorrect: stringSchema(),
  whyUserWrong: stringSchema(),
  cause: { type: 'string', enum: READING_CAUSES },
  causeBasis: { type: 'string', enum: ['rule', 'model'] },
})

const readingExplanationSchemaV1 = {
  ...readingExplanationSchema,
  required: readingExplanationSchema.required.filter(field => field !== 'causeBasis'),
  properties: Object.fromEntries(Object.entries(readingExplanationSchema.properties).filter(([field]) => field !== 'causeBasis')),
}

// v1.1.0: kept for history/regression only.
const readingExplanationSchemaV11 = readingExplanationSchema

const readingExplanationSchemaV2 = responseSchema({
  stemReading: stringSchema(600),
  locateRoute: stringSchema(800),
  locationQuote: stringSchema(1600),
  locationHint: stringSchema(300),
  sentenceBreakdown: {
    type: 'array', maxItems: 10,
    items: responseSchema({ chunk: stringSchema(240), meaning: stringSchema(240) }),
  },
  synonymPairs: {
    type: 'array', maxItems: 8,
    items: responseSchema({
      question: stringSchema(200),
      passage: stringSchema(300),
      mechanism: { type: 'string', enum: [...SYNONYM_MECHANISMS] },
      evidence: { type: 'string', enum: [...EVIDENCE_STATUS] },
      note: stringSchema(300),
    }),
  },
  whyKeyCorrect: stringSchema(),
  whyUserWrong: stringSchema(),
  fromYourView: stringSchema(1000),
  uncertainty: stringSchema(600),
  vocab: {
    type: 'array', maxItems: 10,
    items: responseSchema({ en: stringSchema(80), zh: stringSchema(80), priority: { type: 'string', enum: ['高价值', '认识即可'] } }),
  },
  methodTip: stringSchema(400),
  askUser: stringSchema(300),
  cause: { type: 'string', enum: READING_CAUSES },
  causeBasis: { type: 'string', enum: ['rule', 'model'] },
})

const READING_PERSPECTIVE_RULES = [
  '站在用户做这道题时的视角讲：先说题干在问什么，再说原文在哪、怎么从定位词找过去，再拆原文句子，最后结合用户自述的处境说他为什么会那样答。',
  '证据不足时在 uncertainty 里直说，并把相应替换的 evidence 标为“证据不完整”；不要为了圆答案册硬造推理。',
  '同义替换必须保留原句的信息关系和限定；话题相近不等于题干的每个限定都成立。',
  '没有原文时 locationQuote 留空、sentenceBreakdown 为空数组，并在 uncertainty 说明讲解无法逐字校验。',
  'vocab 只收高价值、可复用的词块；低频专业词标“认识即可”。',
  '用户给了做题方法时，methodTip 用他的方法的步骤名来说下次在哪一步怎么做；没给方法就给一条通用做法。',
  '需要用户补充信息才能讲准时，在 askUser 里问一个具体问题；不需要就留空。',
]

const listeningExplanationSchema = responseSchema({
  locationQuote: stringSchema(1600),
  locationHint: stringSchema(300),
  signals: stringArraySchema(8, 120),
  distraction: stringSchema(800),
  whyKeyCorrect: stringSchema(),
  whyUserWrong: stringSchema(),
  cause: { type: 'string', enum: LISTENING_CAUSES },
  causeBasis: { type: 'string', enum: ['rule', 'model', 'inference'] },
  inferenceNote: stringSchema(500),
  advice: stringSchema(500),
})

const reviewSummarySchema = responseSchema({
  overview: stringSchema(1000),
  causeShares: {
    type: 'array', maxItems: 10,
    items: responseSchema({
      cause: stringSchema(100), count: { type: 'number' }, share: { type: 'number' },
    }),
  },
  exposedProblems: stringArraySchema(4, 300),
  nextActions: stringArraySchema(2, 300),
})

const writingFeedbackSchema = responseSchema({
  taskResponse: stringSchema(1000),
  coherence: stringSchema(800),
  language: stringSchema(800),
  issues: {
    type: 'array', maxItems: 3,
    items: responseSchema({
      original: stringSchema(500), revision: stringSchema(500), reason: stringSchema(500),
    }),
  },
  expressions: stringArraySchema(2, 300),
  estimatedBand: { type: 'number' },
  wordCountWarning: stringSchema(500),
  disclaimer: stringSchema(300),
})

const speakingFeedbackSchema = responseSchema({
  chunks: stringArraySchema(5, 160),
  demonstrations: stringArraySchema(2, 500),
  grammarCorrections: {
    type: 'array', maxItems: 2,
    items: responseSchema({
      original: stringSchema(300), revision: stringSchema(300), reason: stringSchema(300),
    }),
  },
  interaction: stringSchema(800),
  fluencyCoherence: stringSchema(500),
  lexicalResource: stringSchema(500),
  grammaticalRange: stringSchema(500),
  pronunciationNote: stringSchema(300),
})

function json(value) {
  return JSON.stringify(value, null, 2)
}

function baseMessages(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** @type {Record<string, object>} */
export const TEMPLATES = {
  'ielts.reading.explain': {
    id: 'ielts.reading.explain',
    version: '2.0.0',
    purpose: '站在用户做题时的视角讲一道阅读题：题干理解、原文在哪怎么找、句子拆解、同义替换机制与证据强度、用户为什么会错、难词，并给出可核对证据。',
    variables: ['passage', 'question', 'answerKey', 'userAnswer', 'questionType', 'instruction', 'ruleErrors', 'strictness', 'situation', 'method'],
    outputSchema: readingExplanationSchemaV2,
    versionHistory: [
      { version: '1.0.0', outputSchema: readingExplanationSchemaV1, constraints: SOURCE_RULES },
      { version: '1.1.0', outputSchema: readingExplanationSchemaV11, constraints: [...SOURCE_RULES, '判断题必须说明 FALSE 与 NOT GIVEN 的差别落在哪里。'] },
    ],
    constraints: [...SOURCE_RULES, ...READING_PERSPECTIVE_RULES, '判断题必须说明 FALSE 与 NOT GIVEN 的差别落在哪里。'],
    buildMessages(vars) {
      const passage = String(vars.passage || '').trim()
      return baseMessages(
        `你是雅思阅读复盘教练，像坐在用户旁边一起看这道题。${SOURCE_RULES.join(' ')} ${READING_PERSPECTIVE_RULES.join(' ')} 反馈严格度：${vars.strictness || 'standard'}。只输出 JSON。`,
        `【原文】\n${passage || '（用户没有提供原文。不要编造引用。）'}\n\n【题目】${vars.question || '（用户没有提供题干）'}\n题型：${vars.questionType}\n字数要求：${vars.instruction || '未提供'}\n【答案册】${vars.answerKey}\n【用户答案】${vars.userAnswer}\n规则判定的错误：${(vars.ruleErrors || []).join(', ') || '无'}\n【用户做题时的处境】${vars.situation || '用户没有说明'}\n【用户的做题方法】\n${vars.method || '未提供'}\n\n请输出：stemReading, locateRoute, locationQuote, locationHint, sentenceBreakdown, synonymPairs(question, passage, mechanism, evidence, note), whyKeyCorrect, whyUserWrong, fromYourView, uncertainty, vocab(en, zh, priority), methodTip, askUser, cause, causeBasis。`,
      )
    },
  },
  'ielts.listening.explain': {
    id: 'ielts.listening.explain',
    version: '1.0.0',
    purpose: '依据听力文稿、答案册与用户反思定位答案、信号词和干扰信息。',
    variables: ['transcript', 'question', 'answerKey', 'userAnswer', 'instruction', 'reflection', 'ruleErrors', 'strictness'],
    outputSchema: listeningExplanationSchema,
    constraints: [
      ...SOURCE_RULES,
      '从用户反思推断的错因必须将 causeBasis 设为 inference 并写清推断依据。',
      '建议必须是一两句可直接执行的方法。',
    ],
    buildMessages(vars) {
      return baseMessages(
        `你是雅思听力复盘教练。${SOURCE_RULES.join(' ')} 反馈严格度：${vars.strictness || 'standard'}。只输出 JSON。`,
        `【听力文稿】\n${vars.transcript}\n\n【题目】${vars.question}\n字数要求：${vars.instruction || '未提供'}\n【答案册】${vars.answerKey}\n【用户答案】${vars.userAnswer}\n【用户反思】${vars.reflection || '未提供'}\n规则判定的错误：${(vars.ruleErrors || []).join(', ') || '无'}\n\n请输出：locationQuote, locationHint, signals, distraction, whyKeyCorrect, whyUserWrong, cause, causeBasis, inferenceNote, advice。`,
      )
    },
  },
  'ielts.review.summary': {
    id: 'ielts.review.summary',
    version: '1.0.0',
    purpose: '根据已完成的一篇阅读或一个听力 Part 生成数据驱动小结。',
    variables: ['module', 'source', 'results', 'strictness'],
    outputSchema: reviewSummarySchema,
    constraints: [
      '只使用给定结果，不虚构错因或题号。',
      'nextActions 最多两条，必须是下一次可直接执行的动作。',
      '不写空泛鼓励。',
    ],
    buildMessages(vars) {
      return baseMessages(
        `你是雅思复盘教练。只依据给定答题结果生成简短小结，严格度 ${vars.strictness || 'standard'}，只输出 JSON。`,
        `模块：${vars.module}\n来源：${vars.source || '未填写'}\n逐题结果：\n${json(vars.results)}\n\n请输出 overview, causeShares, exposedProblems, nextActions。`,
      )
    },
  },
  'ielts.reading.followup': {
    id: 'ielts.reading.followup',
    version: '2.0.0',
    purpose: '就一道阅读题和用户多轮对话：接着他的问题和他做题时的想法讲，仍只依据原文。',
    variables: ['passage', 'question', 'answerKey', 'userAnswer', 'history', 'situation', 'messages', 'followup'],
    outputSchema: responseSchema({
      answer: stringSchema(1500),
      evidenceQuotes: stringArraySchema(5, 1000),
      uncertain: { type: 'boolean' },
      askUser: stringSchema(300),
    }),
    versionHistory: [
      {
        version: '1.0.0',
        outputSchema: responseSchema({ answer: stringSchema(1500), evidenceQuotes: stringArraySchema(5, 1000), uncertain: { type: 'boolean' } }),
        constraints: [...SOURCE_RULES, '证据不足时把 uncertain 设为 true，并明确说明不能从原文确认。'],
      },
    ],
    constraints: [
      ...SOURCE_RULES,
      '证据不足时把 uncertain 设为 true，并明确说明不能从原文确认。',
      '接着对话往下讲，不重复已经讲过的内容；用户说的是他当时的想法时，先回应这个想法对在哪、偏在哪。',
    ],
    buildMessages(vars) {
      const turns = (Array.isArray(vars.messages) ? vars.messages : []).slice(-8)
        .map(turn => `${turn.role === 'user' ? '用户' : '教练'}：${turn.text}`).join('\n')
      return baseMessages(
        `你是雅思阅读复盘教练，正在和用户就一道题来回讨论。${SOURCE_RULES.join(' ')} 只输出 JSON。`,
        `【原文】\n${vars.passage || '（用户没有提供原文。不要编造引用。）'}\n【题目】${vars.question}\n【答案册】${vars.answerKey}\n【用户答案】${vars.userAnswer}\n【用户做题时的处境】${vars.situation || '未说明'}\n【已有讲解】\n${json(vars.history)}\n【之前的对话】\n${turns || '（无）'}\n【用户这次说】${vars.followup}\n\n输出 answer, evidenceQuotes, uncertain, askUser。`,
      )
    },
  },
  'ielts.writing.feedback': {
    id: 'ielts.writing.feedback',
    version: '1.0.0',
    purpose: '对写作训练步骤给少而准的反馈，不代写。',
    variables: ['stepId', 'taskPrompt', 'submission', 'wordTarget', 'strictness', 'targetBand', 'knowledgeNotes'],
    outputSchema: writingFeedbackSchema,
    constraints: WRITING_RULES,
    buildMessages(vars) {
      return baseMessages(
        `你是雅思写作训练教练。${WRITING_RULES.join(' ')} 反馈严格度：${vars.strictness || 'standard'}。${vars.stepId === 't2-outline' ? '本步骤只检查逻辑链条与是否切题，不修改语言。' : ''}只输出 JSON。`,
        `训练步骤：${vars.stepId}\n题目：${vars.taskPrompt}\n目标分：${vars.targetBand}\n字数目标：${vars.wordTarget}\n用户提交：\n${vars.submission}\n用户知识笔记（只用于理解其表达偏好，不要求照搬）：\n${vars.knowledgeNotes || '无'}\n\n输出 taskResponse, coherence, language, issues（≤3）, expressions（1–2）, estimatedBand, wordCountWarning, disclaimer。`,
      )
    },
  },
  'ielts.speaking.feedback': {
    id: 'ielts.speaking.feedback',
    version: '1.0.0',
    purpose: '对文字化口语回答给自然的交流反馈，不给发音分或总分。',
    variables: ['topic', 'part', 'questions', 'answer', 'strictness', 'targetBand'],
    outputSchema: speakingFeedbackSchema,
    constraints: SPEAKING_RULES,
    buildMessages(vars) {
      return baseMessages(
        `你是雅思口语陪练。${SPEAKING_RULES.join(' ')} 反馈严格度：${vars.strictness || 'standard'}。只输出 JSON。`,
        `话题：${vars.topic}\nPart ${vars.part}\n问题：\n${json(vars.questions)}\n目标分：${vars.targetBand}\n用户文字回答：\n${vars.answer}\n\n输出 chunks, demonstrations, grammarCorrections（≤2）, interaction, fluencyCoherence, lexicalResource, grammaticalRange, pronunciationNote（固定说明仅凭文字无法评估）。`,
      )
    },
  },
  'ielts.writing.translation': {
    id: 'ielts.writing.translation',
    version: '1.0.0',
    purpose: '生成中译英句型练习或针对用户译文给出结构纠错。',
    variables: ['mode', 'sentence', 'translation', 'strictness'],
    outputSchema: responseSchema({
      chineseSentence: stringSchema(500),
      focus: stringSchema(300),
      feedback: stringSchema(1000),
      revision: stringSchema(500),
    }),
    constraints: [
      '一次只练一个句子，侧重从句、介词搭配或常用句型。',
      '纠错只给一个最值得改的点，不代写整段。',
      '输出只含一个原创中文句子，不复用受版权保护的试题。',
    ],
    buildMessages(vars) {
      return baseMessages(
        `你是雅思句型教练。${this.constraints.join(' ')} 严格度 ${vars.strictness || 'standard'}。只输出 JSON。`,
        vars.mode === 'feedback'
          ? `用户译文：${vars.translation}\n请输出 chineseSentence, focus, feedback, revision。`
          : `请生成下一句练习，输出 chineseSentence, focus, feedback（留空）, revision（留空）。`,
      )
    },
  },
  'ielts.speaking.questions': {
    id: 'ielts.speaking.questions',
    version: '1.0.0',
    purpose: '从用户导入的本季话题清单生成本次 Part 1/2/3 题目，Part 3 必须延续 Part 2 话题。',
    variables: ['topic', 'customTopics', 'part'],
    outputSchema: responseSchema({
      part1: stringArraySchema(4, 300),
      part2: stringSchema(600),
      part2Cues: stringArraySchema(4, 200),
      part3: stringArraySchema(5, 300),
    }),
    constraints: [
      '只使用给定话题，不引入本季题库之外的猜测。',
      'Part 3 必须逐题承接 Part 2 的主题与细节。',
      '题目必须原创，不得复制雅思官方或剑桥真题。',
    ],
    buildMessages(vars) {
      return baseMessages(
        '你是雅思口语话题教练。只输出 JSON；题目必须原创，Part 3 必须承接 Part 2 话题。',
        `本季话题：${vars.topic}\n用户导入清单：\n${json(vars.customTopics || [])}\n当前 Part：${vars.part}\n输出 part1, part2, part2Cues, part3。`,
      )
    },
  },
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

for (const template of Object.values(TEMPLATES)) {
  deepFreeze(template.variables)
  deepFreeze(template.constraints)
  deepFreeze(template.outputSchema)
  deepFreeze(template.versionHistory)
  Object.freeze(template)
}
Object.freeze(TEMPLATES)

export const TEMPLATE_LIST = Object.freeze(Object.values(TEMPLATES))

/** @param {string} id */
export function getTemplate(id) {
  return TEMPLATES[id] || null
}

/** @param {string} id */
export function getTemplateVersions(id) {
  const template = getTemplate(id)
  if (!template) return []
  return [
    ...(template.versionHistory || []).map(history => ({ version: history.version, outputSchema: history.outputSchema, constraints: history.constraints })),
    { version: template.version, outputSchema: template.outputSchema, constraints: template.constraints },
  ]
}

/** @param {string} id @param {Record<string, unknown>} variables */
export function assertTemplateVariables(id, variables) {
  const template = getTemplate(id)
  if (!template) throw new Error(`Unknown template: ${id}`)
  const missing = template.variables.filter(variable => variables[variable] === undefined || variables[variable] === null)
  if (missing.length) throw new Error(`Missing template variables for ${id}: ${missing.join(', ')}`)
  return template
}

/** @param {unknown} value @param {object} schema @param {string} [path] @returns {string[]} */
export function validateSchema(value, schema, path = '$') {
  if (!schema || typeof schema !== 'object') return []
  const errors = []
  const type = schema.type
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path} must be an object`]
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`)
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validateSchema(value[key], child, `${path}.${key}`))
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be an array`]
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} allows at most ${schema.maxItems} items`)
    value.forEach((item, index) => errors.push(...validateSchema(item, schema.items || {}, `${path}[${index}]`)))
  } else if (type === 'string') {
    if (typeof value !== 'string') return [`${path} must be a string`]
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} exceeds ${schema.maxLength} characters`)
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return [`${path} must be a number`]
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') return [`${path} must be a boolean`]
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(', ')}`)
  return errors
}
