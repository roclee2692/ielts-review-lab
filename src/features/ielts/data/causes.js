export const READING_CAUSES = Object.freeze([
  '定位失败',
  '同义替换没识别',
  '过度推断（用了原文没有的信息）',
  '判断题规则混淆（FALSE 与 NOT GIVEN）',
  '题型理解错误',
  '读题失误（看错题干或要求）',
  '拼写或格式',
  '单复数',
  '超字数',
  '时间不够没做',
])

export const LISTENING_CAUSES = Object.freeze([
  '拼写或格式',
  '单复数',
  '超字数',
  '漏听',
  '定位丢失（没跟上题号）',
  '读题失误（看错题干或要求）',
  '主语追踪（谁说了什么没跟上）',
  '同义改述没识别',
  '被干扰或改口误导',
  '数字时间日期',
  '连读弱读（推断）',
  '词汇不认识',
  '时间不够没做',
])

/**
 * One-tap reflection tags for listening mistakes. Tapping a tag fills the
 * reflection text and proposes a cause; the learner can still change both.
 * Structured tags make long-term statistics reliable; free text is extra.
 */
export const LISTENING_QUICK_TAGS = Object.freeze([
  { id: 'misheard', label: '听成了…', reflection: '我听成了：', cause: '漏听' },
  { id: 'missed', label: '没听到', reflection: '这里完全没听到。', cause: '漏听' },
  { id: 'unknown-word', label: '不认识这个词', reflection: '这个词我不认识。', cause: '词汇不认识' },
  { id: 'changed-mind', label: '被改口骗了', reflection: '说话人改口了，我写了改口前的信息。', cause: '被干扰或改口误导' },
  { id: 'lost-place', label: '跟丢题号', reflection: '听到后面才发现已经过了这一题。', cause: '定位丢失（没跟上题号）' },
  { id: 'who-said', label: '没跟上谁说的', reflection: '没分清是谁说的这句话。', cause: '主语追踪（谁说了什么没跟上）' },
  { id: 'no-time', label: '写不完', reflection: '听到了但来不及写完。', cause: '时间不够没做' },
  { id: 'misspelt', label: '拼错', reflection: '听对了但拼错了。', cause: '拼写或格式' },
])

/**
 * 阅读：你做这题时的处境。讲题前先点一下，模型就从你当时卡住的地方讲起，
 * 而不是从“标准答案”倒推。也作为建议错因，可以改。
 */
export const READING_QUICK_TAGS = Object.freeze([
  { id: 'no-locator', label: '没找到定位词', situation: '我没在原文里找到题干的定位词。', cause: '定位失败' },
  { id: 'passed-unseen', label: '首次经过答案句没认出', situation: '读第一遍时经过了答案句，但当时没认出它就是答案。', cause: '同义替换没识别' },
  { id: 'found-not-understood', label: '找到了但没读懂', situation: '我找到了大概位置，但没读懂那句话。', cause: '定位失败' },
  { id: 'understood-not-matched', label: '读懂了但没对上题干', situation: '原文看懂了，但没意识到它和题干说的是一回事。', cause: '同义替换没识别' },
  { id: 'false-vs-ng', label: 'FALSE / NG 犹豫', situation: '我在 FALSE 和 NOT GIVEN 之间犹豫。', cause: '判断题规则混淆（FALSE 与 NOT GIVEN）' },
  { id: 'over-inferred', label: '自己脑补了', situation: '我用了原文没直接说的信息去推。', cause: '过度推断（用了原文没有的信息）' },
  { id: 'misread-stem', label: '题干看错了', situation: '我把题干或题目要求看错了。', cause: '读题失误（看错题干或要求）' },
  { id: 'reread', label: '反复回读找不到', situation: '我来回翻了好几遍原文都没找到。', cause: '定位失败' },
  { id: 'guessed', label: '没时间蒙的', situation: '时间不够，这题是蒙的。', cause: '时间不够没做' },
])

/** 同义替换是怎么换的：决定以后练什么。 */
export const SYNONYM_MECHANISMS = Object.freeze([
  '词义替换', '短语替换', '词性转换', '整句逻辑改写', '具体→抽象', '抽象→具体', '否定/反义改写', '原词复现',
])

/** 这对替换的证据有多硬。讲题时不许把“证据不完整”说成“直接对应”。 */
export const EVIDENCE_STATUS = Object.freeze(['直接对应', '需逻辑推导', '证据不完整'])

export const CAUSE_TO_RULE = Object.freeze({
  WORD_LIMIT: '超字数',
  PLURAL: '单复数',
  SPELLING: '拼写或格式',
  WRONG_LABEL_SET: '判断题规则混淆（FALSE 与 NOT GIVEN）',
})

export const TYPE_LABELS = Object.freeze({
  gap: '填空题',
  tfng: '判断题 TRUE / FALSE / NOT GIVEN',
  ynng: '判断题 YES / NO / NOT GIVEN',
  mcq: '单选题',
  'mcq-multi': '多选题',
  matching: '匹配题',
})

export const MODULE_LABELS = Object.freeze({
  reading: '阅读',
  listening: '听力',
  algorithm: '算法课后题',
})

/** @param {string[]} errors */
export function causeFromErrors(errors) {
  return errors.map(error => CAUSE_TO_RULE[error]).find(Boolean) || ''
}
