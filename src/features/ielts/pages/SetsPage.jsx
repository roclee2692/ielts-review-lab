import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadReviewSummaries } from '../storage.js'
import {
  buildBandTrend,
  buildSetMarkdownReport,
  buildTestSetReports,
  formatDuration,
} from '../domain/testSets.js'
import { downloadTextFile } from '../download.js'
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, SectionTitle, StatTile } from '../components/ui.jsx'

const MODULE_LABEL = { reading: '阅读', listening: '听力' }

export default function SetsPage() {
  const reports = useMemo(() => buildTestSetReports(loadReviewSummaries()), [])
  const trend = useMemo(() => buildBandTrend(reports), [reports])
  const [selectedId, setSelectedId] = useState(() => reports[0]?.id || '')
  const selected = reports.find(report => report.id === selectedId) || reports[0] || null
  const markdown = selected ? buildSetMarkdownReport(selected, trend.length > 1 ? trend : []) : ''

  const exportReport = () => {
    if (!selected) return
    const safeName = selected.title.replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '')
    downloadTextFile(`ielts-set-report-${safeName || 'report'}.md`, markdown, 'text/markdown;charset=utf-8')
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          eyebrow="FULL TEST VIEW"
          title="同一套题 · 整套复盘"
          description="阅读按三篇 Passage、听力按四个 Part，以来源标签归成一套。缺失部分不会补造数据；只有完整且达到 37 题时才给估算 Band。"
          actions={<Button variant="subtle" onClick={exportReport} disabled={!selected}>导出 Markdown</Button>}
        />
      </div>

      {reports.length === 0 ? (
        <EmptyState icon="≡" title="还没有可归套的复盘记录" action={<Link to="/ielts/reading" className="btn-primary text-xs">开始阅读复盘</Link>}>
          来源标签中建议包含 Passage/Part 编号，例如“剑 18 Test 2 Passage 1”和“剑 18 Test 2 Part 1”。同一套只按标签归组，不会猜测题目来源。
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[310px_1fr]">
          <aside className="space-y-4 print:hidden">
            <Panel>
              <SectionTitle title="套题列表" hint={`${reports.filter(item => item.completed).length} 套完整`} />
              <div className="space-y-2">
                {reports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedId(report.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selected?.id === report.id ? 'border-accent-border bg-accent-soft' : 'border-border-soft bg-surface hover:border-border-strong'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-fg">{MODULE_LABEL[report.module]}</span>
                      <Badge tone={report.completed ? 'success' : 'warning'}>{report.completed ? '完整' : `缺 ${report.missingParts.length}`}</Badge>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-fg-muted">{report.title}</p>
                    <p className="mt-1 text-[10px] text-fg-faint">对 {report.correct}/{report.total} · {formatDuration(report.elapsedSeconds)}</p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionTitle title="整套估算变化" hint="仅完整套题 · 非官方成绩" />
              {trend.length < 2 ? <p className="text-xs leading-5 text-fg-muted">完成至少两套后显示趋势，避免用单点编造“进步”。</p> : (
                <div className="flex h-36 items-end gap-2 border-b border-border-soft pb-2" role="img" aria-label="整套估算分数趋势">
                  {trend.map(item => (
                    <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${item.title}: Band ${item.band.toFixed(1)}`}>
                      <span className="font-mono text-[9px] text-fg-muted">{item.band.toFixed(1)}</span>
                      <div className={`w-full rounded-t-md ${item.module === 'reading' ? 'bg-accent' : 'bg-info'}`} style={{ height: `${Math.max(10, item.band / 9 * 110)}px` }} />
                      <span className="max-w-full truncate text-[8px] text-fg-faint">{item.module === 'reading' ? 'R' : 'L'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </aside>

          {selected && (
            <article id="set-report" className="space-y-4 print:space-y-3">
              <Panel className="print:border-0 print:bg-white print:p-0 print:shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="section-eyebrow print:text-black">IELTS {MODULE_LABEL[selected.module]}整套</p>
                    <h1 className="mt-1 text-xl font-extrabold text-fg print:text-black">{selected.title}</h1>
                    <p className="mt-1 text-xs text-fg-muted print:text-black">来源标签：{selected.source}</p>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <Button variant="subtle" onClick={exportReport}>导出 Markdown</Button>
                    <Button onClick={() => window.print()}>打印报告</Button>
                  </div>
                </div>
                {!selected.completed && <div className="mt-3 print:hidden"><Notice tone="warning">整套尚未完成，缺少：{selected.missingParts.map(part => `Part ${part}`).join('、')}。不生成估算分数。</Notice></div>}
                {selected.completed && <p className="mt-3 hidden text-xs text-black print:block">状态：完整</p>}

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
                  <StatTile label="整套用时" value={formatDuration(selected.elapsedSeconds)} hint={`${selected.timedParts}/${selected.parts.length} 个部分记录时间`} />
                  <StatTile label="总正确率" value={`${(selected.accuracy * 100).toFixed(1)}%`} tone="success" hint={`${selected.correct}/${selected.total}`} />
                  <StatTile label="估算 Band" value={selected.estimate ? selected.estimate.band.toFixed(1) : '—'} tone="warning" hint={selected.estimate ? '估算，非官方成绩' : '数据不足或未完整'} />
                  <StatTile label="完成部分" value={`${selected.parts.length}/${selected.required}`} tone="info" hint={selected.missingParts.length ? `缺 ${selected.missingParts.join('、')}` : '整套已收齐'} />
                </div>
              </Panel>

              <Panel className="print:border print:border-gray-300 print:bg-white print:p-4 print:shadow-none">
                <SectionTitle title="各部分正确率" hint="按 Part/Passage 编号排序，重复复盘取最近一次" />
                <div className="space-y-3">
                  {selected.parts.map(part => (
                    <div key={part.reviewId}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-fg print:text-black">Part {part.partNumber} · {part.source}</span>
                        <span className="font-mono text-fg-muted print:text-black">{(part.accuracy * 100).toFixed(1)}% · 对 {part.correct}/{part.total} · {formatDuration(part.elapsedSeconds)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-strong print:bg-gray-200"><div className="h-full rounded-full bg-success print:bg-gray-700" style={{ width: `${part.accuracy * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                <Panel className="print:border print:border-gray-300 print:bg-white print:p-4 print:shadow-none">
                  <SectionTitle title="错因摘要" hint="来自各 Part 的已记录错因" />
                  {selected.causeShares.length === 0 ? <p className="text-xs text-fg-faint print:text-black">暂无错因记录。</p> : <div className="space-y-2">{selected.causeShares.map(item => <div key={item.cause}><div className="flex justify-between gap-2 text-[11px] text-fg-muted print:text-black"><span>{item.cause}</span><span>{item.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-strong print:bg-gray-200"><div className="h-full rounded-full bg-warning print:bg-gray-600" style={{ width: `${item.share * 100}%` }} /></div></div>)}</div>}
                </Panel>
                <Panel className="print:border print:border-gray-300 print:bg-white print:p-4 print:shadow-none">
                  <SectionTitle title="分数边界" />
                  <p className="text-xs leading-6 text-fg-muted print:text-black">估算按公开换算锚点近似计算，不是官方成绩。完整套题不足 37 题、`elapsedSeconds` 未记录或缺少任一 Part/Passage 时，不补造数据。</p>
                  {trend.length > 1 && <p className="mt-2 text-xs text-fg-muted print:text-black">趋势覆盖已完成的 {trend.length} 套：{trend.map(item => `${item.title} ${item.band.toFixed(1)}`).join('；')}。</p>}
                </Panel>
              </div>

              <div className="hidden print:block print:break-before-page">
                <h2 className="text-lg font-bold text-black">复盘报告</h2>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-black">{markdown}</pre>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  )
}
