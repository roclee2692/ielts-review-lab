// Public rule-source register. Keep links, access dates and applicability in
// sync with docs/ielts/RULES.md. Core functions are deliberately pure and do
// not import this file; the documentation mirrors their behaviour.

export const ACCESSED_ON = '2026-10-23'

export const RULE_SOURCES = Object.freeze([
  {
    id: 'ielts-scoring',
    publisher: 'IELTS',
    title: 'IELTS scoring in detail',
    url: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail',
    accessedOn: ACCESSED_ON,
    appliesTo: ['总分四舍五入', '四项分值范围', '写作 Task 2 权重'],
  },
  {
    id: 'ielts-how-scored',
    publisher: 'IELTS',
    title: 'How IELTS is scored',
    url: 'https://ielts.org/take-a-test/your-results/how-ielts-is-scored',
    accessedOn: ACCESSED_ON,
    appliesTo: ['0.5 分档', '总分取整规则', '四项评分维度'],
  },
  {
    id: 'ielts-academic-format',
    publisher: 'IELTS',
    title: 'IELTS Academic test format',
    url: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-test-format',
    accessedOn: ACCESSED_ON,
    appliesTo: ['阅读题型与 20 分钟建议', '听力四个 Part', '写作 150/250 词与 20/40 分钟'],
  },
  {
    id: 'british-council-scores',
    publisher: 'British Council',
    title: 'Understanding IELTS scores',
    url: 'https://takeielts.britishcouncil.org/take-ielts/prepare/understanding-scores',
    accessedOn: ACCESSED_ON,
    appliesTo: ['Band 描述与总分解释', '分数不是官方成绩的提示'],
  },
  {
    id: 'cambridge-ielts',
    publisher: 'Cambridge English',
    title: 'IELTS exams and tests',
    url: 'https://www.cambridgeenglish.org/exams-and-tests/ielts/',
    accessedOn: ACCESSED_ON,
    appliesTo: ['考试结构交叉核对', '版权边界：不内置真题'],
  },
])
export const ANSWER_RULE_NOTES = Object.freeze([
  {
    id: 'gap-word-count',
    rule: 'Hyphenated words count as one token; pure numeric tokens are counted separately from words.',
    source: 'Product implementation; aligns with answer-sheet word-limit instructions.',
  },
  {
    id: 'and-or-a-number',
    rule: 'ONE WORD AND/OR A NUMBER permits at most one word, at most one number, and may contain both.',
    source: 'Product implementation of the official instruction wording.',
    assumption: true,
  },
  {
    id: 'label-abbreviations',
    rule: 'TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN are accepted in full and case-insensitively. T/F/NG, Y/N/NG and single-letter abbreviations are not accepted.',
    source: 'No explicit public statement confirming abbreviations was found; the strict reading is used.',
    assumption: true,
  },
  {
    id: 'spelling-distance',
    rule: 'A non-plural edit distance of 1–2 is classified as SPELLING, not as correct.',
    source: 'Product diagnostic policy, not an official marking rule.',
    assumption: true,
  },
  {
    id: 'plural-detection',
    rule: 'Only common s/es and y/ies transformations are classified as PLURAL; irregular plurals may fall through to MISMATCH/SPELLING.',
    source: 'Product diagnostic policy, not an official marking rule.',
    assumption: true,
  },
])

export const NON_OFFICIAL_ASSUMPTIONS = Object.freeze([
  {
    id: 'raw-conversion-table',
    rule: 'The complete 0–40 → 0.5-band conversion intervals are project estimates. Only reported anchor ranges should be treated as publicly sourced guidance; the full table is not described as official.',
    appliesTo: ['rawToBand'],
  },
  {
    id: 'writing-task-rounding',
    rule: 'Each task is the equal average of its four criteria; the final score is (Task 1 + 2×Task 2)/3, rounded to the nearest half band. These intermediate rounding details are not all publicly specified.',
    appliesTo: ['writingBand'],
  },
  {
    id: 'speaking-rounding',
    rule: 'Speaking is the equal average of four criteria rounded to the nearest half band. The UI never calls this without a pronunciation score and never fabricates a speaking total from text.',
    appliesTo: ['speakingBand'],
  },
  {
    id: 'strictness',
    rule: 'Feedback strictness changes wording and detail only, never deterministic judging or band tables.',
    appliesTo: ['model templates', 'UI settings'],
  },
])
