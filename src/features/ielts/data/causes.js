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
