// 做题方法库。内置方法来自作者自己的备考实践（不是官方材料），用户可以改、
// 可以新建自己的方法。每个方法带“执行指标”：复盘时记一笔，分析页看趋势，
// 用数据判断这个方法到底执行熟了没有，而不是只记理论。

/**
 * @typedef {{ id: string, label: string, hint: string, fromTag?: string }} MethodMetric
 * @typedef {{
 *   id: string, module: 'reading'|'listening', title: string, summary: string,
 *   steps: { title: string, points: string[] }[],
 *   fixes: { before: string, after: string }[],
 *   principles: string[],
 *   metrics: MethodMetric[],
 *   builtin?: boolean,
 * }} StudyMethod
 */

/** @type {readonly StudyMethod[]} */
export const BUILTIN_METHODS = Object.freeze([
  {
    id: 'parallel-reading',
    module: 'reading',
    builtin: true,
    title: '平行阅读法',
    summary: '先把所有题预处理一遍，再从第一段到最后一段单向读一次，读的过程中并行解决各类题；每读完一段做一次段落结算。解决的是“反复搜索全文”，不是“经过答案却认不出来”——后者靠英语理解。两者缺一不可。',
    steps: [
      {
        title: '① 预处理题目（3–5 分钟）',
        points: [
          '填空、判断：理解题干，提取首个定位词。',
          '单选、多选、Summary：看选项差别，能确定范围就标出。',
          '人名匹配：标记人名首次出现的位置，之后再出现仍要留意。',
          '信息匹配：把所有题干压缩成简短的信息标签。',
          'Heading：这时不做，等读完段落。',
        ],
      },
      {
        title: '② 从第一段到最后一段，单向推进',
        points: [
          '遇到细节题的定位词就停下，理解证据并答题。',
          '做完一道顺序细节题，立刻看下一题的定位词，然后继续往前读。',
          '读到预先标记的范围，就在那里处理相关题目。',
        ],
      },
      {
        title: '③ 每读完一段，做一次段落结算',
        points: [
          '处理这一段可能对应的 Heading、段落信息匹配、需要综合全段理解的单选。',
          '检查还有没有遗漏的线索，再进入下一段。',
        ],
      },
      {
        title: '④ 文章结束，处理遗留题',
        points: [
          '只针对标记过的疑难位置补查，不重新从头搜索全文。',
          '到时间检查点仍然没有证据，就暂猜，切换下一篇。',
        ],
      },
    ],
    fixes: [
      { before: '先做人名，再做填空，最后做段落匹配', after: '所有题型先预处理，一次阅读并行解决' },
      { before: '找到相关段落就立即选 Heading 或信息匹配', after: '读完整段后再综合判断' },
      { before: '匹配题找不到，就反复搜索全文', after: '第一次经过每段时就检查匹配题，遗漏再局部回查' },
      { before: '阅读时只盯当前题目，容易错过其他答案', after: '当前细节题 + 下一题定位词，同时保留其他题型的信息标签' },
    ],
    principles: [
      '同义替换必须保留原来的信息关系，不能因为两句话话题相近，就认为所有限定都成立。',
      '每对替换标明：原文直接对应、需要逻辑推导、还是证据暂时不完整。不把老师给出的正确答案当作推理前提。',
      '训练重点：识别词块 → 还原句子关系 → 识别同义替换 → 验证题干完整含义。',
      '低频专业词只要求看见能认，原文自带解释的直接借用，不增加无谓记忆负担。',
    ],
    metrics: [
      { id: 'first-pass-miss', label: '首次经过答案句却没认出', hint: '第一遍读时已经经过答案位置，但没认出来的题数。越少说明英语理解跟上了。', fromTag: 'passed-unseen' },
      { id: 'rereads', label: '无效回读次数', hint: '为找答案往回翻、但没找到新证据的次数。越少说明平行推进执行到位。', fromTag: 'reread' },
    ],
  },
])

/** @param {any} value @returns {StudyMethod|null} */
export function normalizeMethod(value) {
  if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null
  const list = (/** @type {any} */ items) => (Array.isArray(items) ? items : [])
  return {
    id: String(value.id || `custom-${Date.now()}`),
    module: value.module === 'listening' ? 'listening' : 'reading',
    title: String(value.title).trim(),
    summary: String(value.summary || ''),
    steps: list(value.steps).map(step => ({ title: String(step?.title || ''), points: list(step?.points).map(String).filter(Boolean) })).filter(step => step.title || step.points.length),
    fixes: list(value.fixes).map(fix => ({ before: String(fix?.before || ''), after: String(fix?.after || '') })).filter(fix => fix.before || fix.after),
    principles: list(value.principles).map(String).filter(Boolean),
    metrics: list(value.metrics).map(metric => ({ id: String(metric?.id || ''), label: String(metric?.label || ''), hint: String(metric?.hint || ''), ...(metric?.fromTag ? { fromTag: String(metric.fromTag) } : {}) })).filter(metric => metric.id && metric.label),
    builtin: false,
  }
}

/**
 * Turn the editable text form ("## step" headings, "- point" lines) into steps.
 * @param {string} text
 */
export function parseStepsText(text) {
  const steps = []
  let current = null
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/^#{1,3}\s+/.test(line)) {
      current = { title: line.replace(/^#{1,3}\s+/, ''), points: [] }
      steps.push(current)
    } else {
      if (!current) { current = { title: '步骤', points: [] }; steps.push(current) }
      current.points.push(line.replace(/^[-*•]\s*/, ''))
    }
  }
  return steps
}

/** @param {{ title: string, points: string[] }[]} steps */
export function stepsToText(steps) {
  return steps.map(step => [`## ${step.title}`, ...step.points.map(point => `- ${point}`)].join('\n')).join('\n\n')
}

/** Short plain-text version handed to the model so it coaches in the learner's own method. @param {StudyMethod|null} method */
export function methodBrief(method) {
  if (!method) return ''
  return [
    `方法：${method.title}`,
    method.summary,
    ...method.steps.map(step => `${step.title}：${step.points.join(' ')}`),
    ...(method.principles.length ? [`原则：${method.principles.join(' ')}`] : []),
  ].join('\n').slice(0, 2500)
}
