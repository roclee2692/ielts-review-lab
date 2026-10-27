import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEMPLATE_LIST } from '../src/features/ielts/ai/templates.js'
import { getWritingLadder } from '../src/features/ielts/core/writingPath.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist-harness/ielts')

const COMMANDS = [
  { name: '/ielts', description: '显示可用模式与下一步', mode: 'help', templateId: null },
  { name: '/ielts-reading', description: '进入阅读复盘：原文、题目、答案册、用户答案', mode: 'reading', templateId: 'ielts.reading.explain' },
  { name: '/ielts-listening', description: '进入听力复盘：文稿、题目、答案册、用户答案、反思', mode: 'listening', templateId: 'ielts.listening.explain' },
  { name: '/ielts-sets', description: '查看按来源标签归并的整套用时、正确率、估算趋势与报告', mode: 'sets', templateId: null },
  { name: '/ielts-review', description: '打开今日错因复练、替换库与收藏词块的间隔复习队列', mode: 'review', templateId: null },
  { name: '/ielts-writing', description: '进入分步写作训练，检查锁定路径', mode: 'writing', templateId: 'ielts.writing.feedback' },
  { name: '/ielts-speaking', description: '进入口语训练，按 Part 1/2/3 回答', mode: 'speaking', templateId: 'ielts.speaking.feedback' },
  { name: '/ielts-vocab', description: '打开四类词块与我的替换库', mode: 'vocab', templateId: null },
  { name: '/ielts-reset', description: '清除当前会话上下文（不删除浏览器本地数据）', mode: 'reset', templateId: null },
]

export function buildHarnessExport() {
  const ladder = getWritingLadder()
  const commands = {
    version: 1,
    source: {
      templates: 'src/features/ielts/ai/templates.js',
      writingPath: 'src/features/ielts/core/writingPath.js',
    },
    commands: COMMANDS,
    writingPath: ladder.map(item => ({ id: item.id, title: item.title, requires: item.requires })),
  }
  const templateSections = TEMPLATE_LIST.map(template => [
    `### ${template.id} · v${template.version}`,
    '',
    template.purpose,
    '',
    `变量：${template.variables.join(', ')}`,
    '',
    '输出结构：',
    '```json',
    JSON.stringify(template.outputSchema, null, 2),
    '```',
    '',
    '不可移除约束：',
    ...template.constraints.map(constraint => `- ${constraint}`),
  ].join('\n')).join('\n\n')

  const systemPrompt = `# IELTS Review & Deliberate Practice Harness\n\n` +
    `This file is generated from \`src/features/ielts/ai/templates.js\` and \`src/features/ielts/core/writingPath.js\`.\n` +
    `Do not edit it directly; run \`npm run ielts:export-harness\`.\n\n` +
    `## 总则\n\n` +
    `- 判题必须使用确定性规则；模型只解释“为什么答案册正确、用户为什么错”。\n` +
    `- 只依据用户提供的原文/文稿与答案册，不得用常识补事实，不得重新做题或推翻答案册。\n` +
    `- 每一条原文引用都会用 verifyEvidence 校验；失败时明确标注“讲解不可靠”。\n` +
    `- 写作和口语是训练，不是代写。最多指出三个写作问题；口语反馈先给自然词块，不评价发音分。\n` +
    `- 模拟反馈必须醒目标注。估算分数不是官方成绩。\n` +
    `- API key 只属于用户浏览器/客户端；不得要求用户把 key 写进对话。\n\n` +
    `## 命令\n\n${COMMANDS.map(command => `- \`${command.name}\`：${command.description}`).join('\n')}\n\n` +
    `## 写作解锁路径\n\n${ladder.map(item => `- \`${item.id}\`：${item.title}${item.requires.length ? `（前置：${item.requires.join(', ')}）` : '（可开始）'}`).join('\n')}\n\n` +
    `## 模板定义\n\n${templateSections}\n`

  return { commands, systemPrompt }
}
export async function writeHarnessExport() {
  const { commands, systemPrompt } = buildHarnessExport()
  await mkdir(OUT, { recursive: true })
  await writeFile(join(OUT, 'commands.json'), `${JSON.stringify(commands, null, 2)}\n`, 'utf8')
  await writeFile(join(OUT, 'system-prompt.md'), systemPrompt, 'utf8')
  return OUT
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = await writeHarnessExport()
  process.stdout.write(`Exported IELTS harness to ${out}\n`)
}
