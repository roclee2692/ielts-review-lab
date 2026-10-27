import { useState } from 'react'
import { downloadTextFile } from '../download.js'
import { readingReportCsv } from '../domain/readingReport.js'
import { Badge, Button, Panel, SectionTitle } from './ui.jsx'

/** @param {string} text */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const TABLES = [
  { id: 'mistakes', label: '错题表', heading: '## 错题表' },
  { id: 'synonyms', label: '同义替换表', heading: '## 同义替换表' },
  { id: 'vocab', label: '难词短语表', heading: '## 难词短语表' },
]

/** Cut one "## heading" section out of the report Markdown. @param {string} markdown @param {string} heading */
function section(markdown, heading) {
  const start = markdown.indexOf(heading)
  if (start < 0) return ''
  const next = markdown.indexOf('\n## ', start + heading.length)
  return markdown.slice(start, next < 0 ? undefined : next).trim()
}

/** 复盘报告：三张表，可整体或单表复制，可下载 Markdown / CSV。 */
export default function ReportPanel({ report, filename }) {
  const [status, setStatus] = useState('')
  const flash = (/** @type {boolean} */ ok, /** @type {string} */ what) => {
    setStatus(ok ? `已复制${what}` : '浏览器不允许直接复制，请在下面的文本框里手动全选复制')
    setTimeout(() => setStatus(''), 2500)
  }
  return (
    <Panel>
      <SectionTitle
        title="复盘报告"
        hint="错题表 · 同义替换表 · 难词短语表。讲过的题越多，表越完整。可以粘贴到笔记软件，或导出 CSV 用表格软件打开。"
        action={<Badge>{report.mistakes.length} 错 · {report.synonyms.length} 对替换 · {report.vocab.length} 个词</Badge>}
      />
      <div className="flex flex-wrap gap-2">
        <Button className="text-xs" onClick={async () => flash(await copy(report.markdown), '整份报告（Markdown）')}>复制整份</Button>
        {TABLES.map(table => (
          <Button key={table.id} variant="subtle" className="text-xs" onClick={async () => flash(await copy(section(report.markdown, table.heading)), table.label)}>复制{table.label}</Button>
        ))}
        <Button variant="ghost" className="text-xs" onClick={() => downloadTextFile(`${filename}.md`, report.markdown, 'text/markdown;charset=utf-8')}>下载 .md</Button>
        <Button variant="ghost" className="text-xs" onClick={() => downloadTextFile(`${filename}.csv`, readingReportCsv(report), 'text/csv;charset=utf-8')}>下载 .csv</Button>
      </div>
      {status && <p className="mt-2 text-[11px] text-success" role="status">{status}</p>}
      <textarea readOnly aria-label="复盘报告 Markdown" value={report.markdown} rows={10} className="mt-3 w-full rounded-xl border border-border-soft bg-bg p-3 font-mono text-[11px] leading-5 text-fg-muted" />
    </Panel>
  )
}
