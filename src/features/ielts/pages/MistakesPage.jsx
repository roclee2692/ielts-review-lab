import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIelts } from '../context/IeltsContext.jsx'
import { LISTENING_CAUSES, MODULE_LABELS, READING_CAUSES, TYPE_LABELS } from '../data/causes.js'
import { buildWeaknessProfile } from '../domain/review.js'
import { causeRecurrence } from '../core/index.js'
import { loadReviewSummaries } from '../storage.js'
import { buildReviewQueue } from '../domain/spacedRepetition.js'
import { deleteMistakeRecord, updateMistakeRecord } from '../../../services/storage/MistakesStore.js'
import { Badge, Button, EmptyState, Field, Notice, PageHeader, Panel, SectionTitle, Select, StatTile, TextInput } from '../components/ui.jsx'

const ALL_CAUSES = [...new Set([...READING_CAUSES, ...LISTENING_CAUSES])]

export default function MistakesPage() {
  const { records, refreshRecords, replacements, vocabState, reviewSchedule } = useIelts()
  const [module, setModule] = useState('')
  const [type, setType] = useState('')
  const [cause, setCause] = useState('')
  const [source, setSource] = useState('')
  const [days, setDays] = useState('all')
  const [practiceKey, setPracticeKey] = useState(null)

  const profile = useMemo(() => buildWeaknessProfile(records), [records])
  const recurrence = useMemo(() => causeRecurrence(
    loadReviewSummaries().map(review => ({ id: review.id, module: review.module, createdAt: review.createdAt })),
    records.filter(record => record.domain === 'ielts').map(record => ({ reviewId: record.metadata?.reviewId, module: record.module, cause: record.errorCause })),
  ), [records])
  const reviewQueue = useMemo(() => buildReviewQueue({ records, replacements, vocabulary: vocabState, schedule: reviewSchedule }), [records, replacements, vocabState, reviewSchedule])
  const filtered = useMemo(() => {
    const from = days === 'all' ? 0 : Date.now() - Number(days) * 86400000
    return records.filter(record => {
      if (module && record.module !== module) return false
      if (type && record.type !== type) return false
      if (cause && record.errorCause !== cause) return false
      if (source && !String(record.source || '').toLowerCase().includes(source.toLowerCase())) return false
      if (from && Number(record.createdAt) < from) return false
      return true
    })
  }, [records, module, type, cause, source, days])

  const practiceRecords = useMemo(() => {
    if (!practiceKey) return []
    return records.filter(record => record.domain === 'ielts' && (
      practiceKey.kind === 'cause' ? record.errorCause === practiceKey.value : record.type === practiceKey.value
    ))
  }, [records, practiceKey])

  const changeCause = (id, nextCause) => {
    updateMistakeRecord(id, { errorCause: nextCause, causeSource: 'user' })
    refreshRecords()
  }

  const remove = id => {
    deleteMistakeRecord(id)
    refreshRecords()
  }

  const timeline = Object.entries(profile.byDate).sort(([a], [b]) => a.localeCompare(b)).slice(-12)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="MISTAKE ARCHIVE"
        title="错题库与弱点画像"
        description="每道错题都来自一次具体的作答。统计只描述已经发生的数据；你可以修正错因，也可以按错因或题型生成复练清单。"
        actions={<><Link to="/ielts/review" className="btn-ghost text-xs">今日复习 {reviewQueue.totalDue}</Link><Link to="/ielts/reading" className="btn-ghost text-xs">继续复盘</Link></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="IELTS 错题" value={profile.total} tone="danger" />
        <StatTile label="最常错题型" value={profile.topType ? TYPE_LABELS[profile.topType] || profile.topType : '暂无'} tone="info" />
        <StatTile label="最集中错因" value={profile.topCause || '暂无'} tone="warning" />
        <StatTile label="反复替换" value={profile.repeatedSynonyms.length} tone="accent" hint="出现两次及以上" />
      </div>

      <Panel>
        <SectionTitle title="同类错误复发率" hint="某个错因第一次出现后，之后同模块的每次复盘里它还出现的比例。全对的复盘也算“没复发”。越低越好。" />
        {recurrence.length === 0 ? <p className="text-xs text-fg-faint">复盘两次以上、并给错题定了错因后才有数据。</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-fg-faint">
                <tr><th className="py-1.5 pr-2">错因</th><th className="py-1.5 pr-2">模块</th><th className="py-1.5 pr-2">复发率</th><th className="py-1.5 pr-2">最近 5 次</th><th className="py-1.5">之后复盘</th></tr>
              </thead>
              <tbody>
                {recurrence.map(row => (
                  <tr key={`${row.module}-${row.cause}`} className="border-t border-border-soft text-fg-muted">
                    <td className="py-2 pr-2 text-fg">{row.cause}</td>
                    <td className="py-2 pr-2">{MODULE_LABELS[row.module] || row.module}</td>
                    <td className="py-2 pr-2 font-mono">{row.rate === null ? '—' : `${Math.round(row.rate * 100)}%`}</td>
                    <td className="py-2 pr-2 font-mono">{row.recentRate === null ? '—' : `${Math.round(row.recentRate * 100)}%`}</td>
                    <td className="py-2 font-mono">{row.recurred}/{row.sessionsAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle title="错因与题型分布" hint="点击错因查看快速复练；间隔计划在“今日复习”" />
          {profile.byCause.length === 0 ? <p className="text-xs text-fg-faint">暂无数据。</p> : (
            <div className="space-y-2.5">
              {profile.byCause.map(([name, count]) => (
                <button key={name} className="w-full text-left" onClick={() => setPracticeKey({ kind: 'cause', value: name })}>
                  <div className="flex justify-between gap-2 text-[11px]"><span className="text-fg-muted">{name}</span><span className="font-mono text-fg-faint">{count}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-strong"><div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(4, count / profile.total * 100)}%` }} /></div>
                </button>
              ))}
              {profile.byType.length > 0 && (
                <div className="mt-4 border-t border-border-soft pt-3">
                  <p className="mb-2 text-[10px] font-semibold text-fg-faint">按题型</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.byType.map(([name, count]) => (
                      <button key={name} onClick={() => setPracticeKey({ kind: 'type', value: name })} className="rounded-full border border-border-soft bg-surface px-2.5 py-1 text-[10px] text-fg-muted hover:border-accent-border hover:text-accent">
                        {TYPE_LABELS[name] || name} · {count}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
        <Panel>
          <SectionTitle title="错因随时间变化" hint="按有记录的日期统计" />
          {timeline.length === 0 ? <p className="text-xs text-fg-faint">暂无时间数据。</p> : (
            <div className="space-y-2">
              {timeline.map(([date, causes]) => {
                const count = Object.values(causes).reduce((sum, value) => sum + value, 0)
                const maxCount = Math.max(...timeline.map(([, values]) => Object.values(values).reduce((sum, value) => sum + value, 0)))
                return <div key={date} className="flex items-center gap-3 text-[11px]"><span className="w-20 shrink-0 font-mono text-fg-faint">{date}</span><div className="h-2 flex-1 rounded-full bg-surface-strong"><div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(8, count / maxCount * 100)}%` }} /></div><span className="w-5 text-right font-mono text-fg-muted">{count}</span></div>
              })}
            </div>
          )}
        </Panel>
      </div>

      {practiceKey && (
        <PracticePanel
          practiceKey={practiceKey}
          records={practiceRecords}
          onClose={() => setPracticeKey(null)}
        />
      )}

      <Panel>
        <SectionTitle title="筛选错题" hint={`共 ${filtered.length} 条`} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="模块"><Select value={module} onChange={event => setModule(event.target.value)}><option value="">全部</option><option value="reading">阅读</option><option value="listening">听力</option><option value="algorithm">算法课后题</option></Select></Field>
          <Field label="题型"><Select value={type} onChange={event => setType(event.target.value)}><option value="">全部</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="错因"><Select value={cause} onChange={event => setCause(event.target.value)}><option value="">全部</option>{ALL_CAUSES.map(item => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="来源包含"><TextInput value={source} onChange={event => setSource(event.target.value)} placeholder="如 Test 2" /></Field>
          <Field label="时间"><Select value={days} onChange={event => setDays(event.target.value)}><option value="all">全部</option><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="90">最近 90 天</option></Select></Field>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState icon="✕" title="没有符合条件的错题" action={<Link to="/ielts/reading" className="btn-primary text-xs">录入阅读复盘</Link>}>
          完成一次复盘后，错误答案会连同题型、错因、定位片段进入这里。原文全文不会自动保存。
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <Panel key={record.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={record.module === 'listening' ? 'info' : record.module === 'algorithm' ? 'neutral' : 'accent'}>{MODULE_LABELS[record.module] || record.module}</Badge>
                    <Badge>{TYPE_LABELS[record.type] || record.type}</Badge>
                    <Badge tone={record.causeSource === 'rule' ? 'success' : record.causeSource === 'user' ? 'accent' : 'warning'}>{record.causeSource === 'rule' ? '规则判定' : record.causeSource === 'user' ? '用户修正' : '模型/迁移建议'}</Badge>
                    <span className="text-[10px] text-fg-faint">{new Date(record.createdAt).toLocaleString('zh-CN')} · {record.source}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-fg">{record.questionSummary}</p>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-surface px-3 py-2 text-fg-muted">你的答案：<strong className="text-danger">{record.userAnswer || '未作答'}</strong></div>
                    <div className="rounded-lg bg-surface px-3 py-2 text-fg-muted">答案册：<strong className="text-success">{record.correctAnswer || '—'}</strong></div>
                  </div>
                  {record.reflection && <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-5 text-fg-muted">我的反思：{record.reflection}</p>}
                  {record.explanationSummary && <p className="mt-2 text-xs leading-5 text-fg-faint">讲解摘要：{record.explanationSummary}</p>}
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-end gap-2 sm:w-auto">
                  <Field label="错因（可修改）" className="min-w-48 flex-1 sm:w-56">
                    <Select value={record.errorCause} onChange={event => changeCause(record.id, event.target.value)}>
                      {!ALL_CAUSES.includes(record.errorCause) && <option>{record.errorCause}</option>}
                      {ALL_CAUSES.map(item => <option key={item}>{item}</option>)}
                    </Select>
                  </Field>
                  <Button variant="danger" className="text-xs" onClick={() => remove(record.id)}>删除</Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {profile.repeatedSynonyms.length > 0 && (
        <Panel>
          <SectionTitle title="反复出现的同义替换" hint="来自已收进错题记录的替换对" />
          <div className="flex flex-wrap gap-2">{profile.repeatedSynonyms.map(([pair, count]) => <Badge key={pair} tone="accent">{pair} · {count} 次</Badge>)}</div>
        </Panel>
      )}
    </div>
  )
}

function PracticePanel({ practiceKey, records, onClose }) {
  const [answers, setAnswers] = useState({})
  const [revealed, setRevealed] = useState({})
  return (
    <Panel className="border-accent-border">
      <SectionTitle
        title={`复练清单：${practiceKey.kind === 'cause' ? practiceKey.value : TYPE_LABELS[practiceKey.value] || practiceKey.value}`}
        hint={`${records.length} 道题 · 先只给题目和定位范围，答案在作答后揭示`}
        action={<Button variant="ghost" onClick={onClose}>关闭复练</Button>}
      />
      {records.length === 0 ? <Notice tone="warning">该条件下还没有可用错题。</Notice> : (
        <div className="space-y-3">
          {records.map(record => (
            <div key={record.id} className="rounded-xl border border-border-soft bg-surface p-3">
              <p className="text-sm font-semibold leading-6 text-fg">{record.questionSummary}</p>
              <p className="mt-1 text-[11px] text-fg-faint">{record.source} · 定位范围：{record.locationHint || record.metadata?.instruction || '未记录；请回到原题重新定位'}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <TextInput value={answers[record.id] || ''} onChange={event => setAnswers(previous => ({ ...previous, [record.id]: event.target.value }))} placeholder="先写下你的新答案" disabled={revealed[record.id]} />
                <Button variant="subtle" className="shrink-0 text-xs" onClick={() => setRevealed(previous => ({ ...previous, [record.id]: true }))}>提交并揭示</Button>
              </div>
              {revealed[record.id] && (
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg bg-success/10 px-3 py-2 text-success">答案册：{record.correctAnswer}</div>
                  <div className={`rounded-lg px-3 py-2 ${String(answers[record.id]).trim().toLowerCase() === String(record.correctAnswer).toLowerCase() ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>你的新答案：{answers[record.id] || '未作答'}</div>
                  {record.evidence && <div className="sm:col-span-2 rounded-lg bg-bg px-3 py-2 leading-5 text-fg-muted">定位句：{record.evidence}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
