import { normalizeText } from '../core/text.js'

const READING_RULE_CAUSES = {
  WORD_LIMIT: '超字数',
  PLURAL: '单复数',
  SPELLING: '拼写或格式',
  WRONG_LABEL_SET: '判断题规则混淆（FALSE 与 NOT GIVEN）',
  MISMATCH: '同义替换没识别',
}

/** @param {string} passage */
function firstEvidence(passage) {
  const normalized = String(passage || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return { quote: '', hint: '原文为空，无法定位' }
  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized]
  const quote = sentences.map(sentence => sentence.trim()).find(Boolean) || normalized
  return { quote, hint: `模拟反馈选取原文第 1 句（共 ${sentences.length} 句）` }
}

function ruleCause(vars) {
  const first = Array.isArray(vars.ruleErrors) ? vars.ruleErrors[0] : ''
  return READING_RULE_CAUSES[first] || '同义替换没识别'
}

function listeningCause(vars) {
  const reflection = String(vars.reflection || '')
  if (/听成|数字|时间|日期|fifteen|fifty/i.test(reflection)) return '数字时间日期'
  if (/改口|干扰|但是|其实|actually|wait/i.test(reflection)) return '被干扰或改口误导'
  if (/不认识|生词|词汇/i.test(reflection)) return '词汇不认识'
  if (/连读|弱读|吞音/i.test(reflection)) return '连读弱读（推断）'
  if (/没听到|漏听|走神/i.test(reflection)) return '漏听'
  return ruleCause(vars)
}

function mockReading(vars) {
  const evidence = firstEvidence(vars.passage)
  const cause = ruleCause(vars)
  return {
    locationQuote: evidence.quote,
    locationHint: evidence.hint,
    synonymPairs: [],
    whyKeyCorrect: `模拟反馈：答案册给出“${vars.answerKey}”。请在配置模型后获得基于原文的逐句解释。`,
    whyUserWrong: `你的答案“${vars.userAnswer || '未作答'}”与答案册不一致；当前为明确标注的模拟反馈。`,
    cause,
    causeBasis: Array.isArray(vars.ruleErrors) && vars.ruleErrors.length ? 'rule' : 'model',
  }
}

function mockListening(vars) {
  const evidence = firstEvidence(vars.transcript)
  const cause = listeningCause(vars)
  const hasRule = Array.isArray(vars.ruleErrors) && vars.ruleErrors.length > 0
  const inferredFromReflection = !hasRule && !!String(vars.reflection || '').trim()
  return {
    locationQuote: evidence.quote,
    locationHint: evidence.hint,
    signals: [],
    distraction: '模拟反馈不推测未在文稿中确认的干扰项。',
    whyKeyCorrect: `模拟反馈：答案册给出“${vars.answerKey}”。配置模型后可核对文稿中的信号词与改口。`,
    whyUserWrong: `你的答案“${vars.userAnswer || '未作答'}”与答案册不一致；这条反馈用于演示流程，不是真实讲解。`,
    cause,
    causeBasis: inferredFromReflection || cause === '连读弱读（推断）' ? 'inference' : (hasRule ? 'rule' : 'model'),
    inferenceNote: inferredFromReflection ? '模拟推断：错因来自你填写的中文反思，仍需以真实音频与文稿进一步确认。' : '',
    advice: '模拟练习建议：复盘时把答案前后的转折词和重读信息一起圈出，再口头复述一遍。',
  }
}

function mockSummary(vars) {
  const results = Array.isArray(vars.results) ? vars.results : []
  const wrong = results.filter(result => !result.correct)
  const counts = {}
  for (const result of wrong) counts[result.cause || '未归类'] = (counts[result.cause || '未归类'] || 0) + 1
  const causeShares = Object.entries(counts).map(([cause, count]) => ({
    cause, count, share: wrong.length ? count / wrong.length : 0,
  }))
  const top = causeShares.sort((a, b) => b.count - a.count)[0]
  return {
    overview: `模拟小结：共 ${results.length} 题，答对 ${results.length - wrong.length} 题，答错 ${wrong.length} 题。`,
    causeShares,
    exposedProblems: top ? [`当前最集中的错因是“${top.cause}”（${top.count} 题）。`] : ['本次没有错题，样本不足以形成弱点结论。'],
    nextActions: top ? [`下次复盘优先标注可能导致“${top.cause}”的题，并写出判断依据。`] : ['换一篇材料继续积累样本，确认稳定性。'],
  }
}

function mockWriting(vars) {
  const text = String(vars.submission || '')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const target = Number(vars.wordTarget) || 0
  const first = text.split(/(?<=[.!?])\s+/).find(Boolean) || '（尚未提交句子）'
  const outline = vars.stepId === 't2-outline'
  return {
    taskResponse: outline ? '模拟反馈：检查立场、首尾句和两个主体段是否直接回应题目。' : '模拟反馈：先确认是否完整回应题目，再检查每个主体段是否只有一个中心。配置模型后会逐项分析。',
    coherence: outline ? '模拟反馈：检查每个中心论点下两个分论点是否写出了举例、因果或对比的论证动作。' : '模拟反馈：检查段与段之间是否有清楚的方向，而不只是堆连接词。',
    language: outline ? '本步骤不改语言。' : '模拟反馈：优先处理影响理解的句子结构，暂不追求高级词。',
    issues: text.trim() ? [{
      original: first.slice(0, 220),
      revision: '（配置模型后显示针对这一句的最小改动）',
      reason: '模拟反馈只演示反馈格式，不提供真实纠错。',
    }] : [],
    expressions: ['This trend is particularly marked in…', 'A closer look at the figures reveals…'],
    estimatedBand: 0,
    wordCountWarning: target && words < target ? `当前约 ${words} 词，低于 ${target} 词目标。` : '',
    disclaimer: '模拟反馈，不是真实评分；estimatedBand=0 表示未估分。',
  }
}

function mockSpeaking(vars) {
  return {
    chunks: ['to be honest', 'what stands out to me', 'off the top of my head', 'in the long run'],
    demonstrations: [
      'To be honest, I hadn’t thought about it that way before, but I’d say it matters quite a lot.',
      'What stands out to me is how quickly things changed once people got used to it.',
    ],
    grammarCorrections: [],
    interaction: '模拟反馈：先检查有没有直接回答题目，再补一个具体例子让回答自然展开。',
    fluencyCoherence: '模拟估算：如果每个观点都能接一个原因或例子，连贯性会更稳定。',
    lexicalResource: '模拟估算：优先复用上面的自然词块，不需要堆砌大词。',
    grammaticalRange: '模拟估算：先保证时态和主谓一致，再尝试从句。',
    pronunciationNote: '仅凭文字无法评估发音、连读或语调。',
    _topic: vars.topic,
  }
}

function mockQuestions(vars) {
  const topic = String(vars.topic || 'a skill you learned')
  return {
    part1: [`What comes to mind when you hear “${topic}”?`, 'How often do you encounter it?', 'Did you like it as a child?', 'Would you recommend it to a friend?'],
    part2: `Describe an experience connected to ${topic}.`,
    part2Cues: ['what happened', 'who was involved', 'why it mattered', 'how you felt about it'],
    part3: [
      `Why do people value ${topic} differently?`,
      `How has ${topic} changed in recent years?`,
      `Should schools pay more attention to ${topic}?`,
      `What could make ${topic} more accessible?`,
      `Do you think its importance will grow?`,
    ],
  }
}

function mockTranslation(vars = {}) {
  if (vars.mode === 'feedback') {
    return {
      chineseSentence: vars.sentence || '正是那些愿意在反馈后立刻重做一次的人，最终把短时理解变成了长期能力。',
      focus: '先判断主句，再检查从句与介词搭配',
      feedback: '模拟反馈：先确认主谓和从句连接词；配置模型后会针对这句译文给出一处最小改动。',
      revision: '',
    }
  }
  return {
    chineseSentence: '正是那些愿意在反馈后立刻重做一次的人，最终把短时理解变成了长期能力。',
    focus: '强调句 + 定语从句 + 比较级结构',
    feedback: '',
    revision: '',
  }
}

/** Deterministic, unmistakably labelled demo output. */
export function buildMockOutput(templateId, variables) {
  const template = getTemplate(templateId)
  if (!template) throw new Error(`Unknown template: ${templateId}`)
  let data
  if (templateId === 'ielts.reading.explain') data = mockReading(variables)
  else if (templateId === 'ielts.listening.explain') data = mockListening(variables)
  else if (templateId === 'ielts.review.summary') data = mockSummary(variables)
  else if (templateId === 'ielts.reading.followup') {
    data = {
      answer: '模拟回答：配置模型后，这里只会依据原文与答案册解释这道题。',
      evidenceQuotes: firstEvidence(variables.passage).quote ? [firstEvidence(variables.passage).quote] : [],
      uncertain: true,
    }
  } else if (templateId === 'ielts.writing.feedback') data = mockWriting(variables)
  else if (templateId === 'ielts.speaking.feedback') data = mockSpeaking(variables)
  else if (templateId === 'ielts.writing.translation') data = mockTranslation(variables)
  else if (templateId === 'ielts.speaking.questions') data = mockQuestions(variables)
  else data = {}

  const errors = validateSchema(data, template.outputSchema)
  if (errors.length) throw new Error(`Mock output is invalid: ${errors.join('; ')}`)
  return {
    data,
    meta: { mock: true, templateId, version: template.version, label: '模拟反馈（未调用模型）' },
  }
}

import { getTemplate, validateSchema } from './templates.js'

/** Return true only when a quote is safe to present as verified evidence. */
export function looksVerbatim(passage, quote) {
  const source = normalizeText(passage)
  const target = normalizeText(quote)
  return !!target && source.includes(target)
}
