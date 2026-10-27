import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIelts } from '../context/IeltsContext.jsx'
import { buildReviewQueue } from '../domain/spacedRepetition.js'
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, SectionTitle, StatTile } from '../components/ui.jsx'

const KIND_LABEL = { mistake: '错题', replacement: '替换', vocab: '词块' }
const KIND_TONE = { mistake: 'danger', replacement: 'accent', vocab: 'info' }
const GRADE_LABEL = { again: '忘了', hard: '模糊', good: '记住', easy: '很熟' }

export default function ReviewPage() {
  const { records, replacements, vocabState, reviewSchedule, gradeReviewItem } = useIelts()
  const [params] = useSearchParams()
  const [causeFilter, setCauseFilter] = useState(() => params.get('cause') || '')
  const [revealed, setRevealed] = useState({})
  const [message, setMessage] = useState('')
  const queue = useMemo(() => buildReviewQueue({
    records,
    replacements,
    vocabulary: vocabState,
    schedule: reviewSchedule,
  }), [records, replacements, vocabState, reviewSchedule])

  const visibleDue = causeFilter
    ? queue.due.filter(item => item.kind !== 'mistake' ? false : item.cause === causeFilter)
    : queue.due

  const grade = (item, value) => {
    gradeReviewItem(item, value)
    setMessage(`已记录“${item.title}”：${GRADE_LABEL[value]}。下次到期日已写入本地计划。`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="SPACED REVIEW"
        title="今日复习"
        description="错题按错因进入复练计划；收藏词块和我的替换库按 1、3、7、14、30 天间隔复习。先回忆，再显示答案。"
        actions={<Link to="/ielts/mistakes" className="btn-ghost text-xs">查看错题库</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="今天到期" value={queue.totalDue} tone={queue.totalDue ? 'danger' : 'success'} />
        <StatTile label="错题" value={queue.counts.mistake} tone="danger" hint="按错因分组" />
        <StatTile label="替换对" value={queue.counts.replacement} tone="accent" />
        <StatTile label="收藏词块" value={queue.counts.vocab} tone="info" />
      </div>

      {message && <Notice tone="success">{message}</Notice>}

      {queue.mistakeGroups.length > 0 && (
        <Panel>
          <SectionTitle title="错因复练计划" hint="今天到期的错题，按错因聚合" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCauseFilter('')} className={`rounded-full border px-3 py-1.5 text-xs ${!causeFilter ? 'border-accent-border bg-accent-soft text-accent' : 'border-border-soft bg-surface text-fg-muted'}`}>全部错因</button>
            {queue.mistakeGroups.map(group => (
              <button key={group.cause} onClick={() => setCauseFilter(group.cause)} className={`rounded-full border px-3 py-1.5 text-xs ${causeFilter === group.cause ? 'border-danger/50 bg-danger/10 text-danger' : 'border-border-soft bg-surface text-fg-muted'}`}>
                {group.cause} · {group.count}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {visibleDue.length === 0 ? (
        <EmptyState icon="✓" title="今天没有到期内容" action={<><Link to="/ielts/mistakes" className="btn-ghost text-xs">去错题库</Link><Link to="/ielts/vocab" className="btn-primary text-xs">收藏词块</Link></>}>
          收藏词块、收入替换库或产生错题后，会自动进入今天的复习队列。
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {visibleDue.map(item => (
            <Panel key={item.key}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2"><Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>{item.cause && <Badge tone="warning">{item.cause}</Badge>}<span className="self-center text-[10px] text-fg-faint">{item.context}</span></div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-fg">{item.prompt}</p>
                  {!revealed[item.key] && <Button variant="subtle" className="mt-3 text-xs" onClick={() => setRevealed(previous => ({ ...previous, [item.key]: true }))}>先回忆，显示答案</Button>}
                  {revealed[item.key] && (
                    <div className="mt-3 rounded-xl border border-success/25 bg-success/5 p-3">
                      <p className="text-[10px] font-bold text-success">答案 / 复习要点</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-fg-muted">{item.answer || '未保存答案'}</p>
                      {item.reflection && <p className="mt-2 border-t border-border-soft pt-2 text-[11px] leading-5 text-fg-faint">上次反思：{item.reflection}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(GRADE_LABEL).map(([value, label]) => <Button key={value} variant={value === 'good' ? 'primary' : 'subtle'} className="text-xs" onClick={() => grade(item, value)}>{label}</Button>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel>
        <SectionTitle title="接下来" hint={`${queue.upcoming.length} 项已安排`} />
        {queue.upcoming.length === 0 ? <p className="text-xs text-fg-faint">还没有未来复习项。</p> : (
          <div className="space-y-1.5">
            {queue.upcoming.slice(0, 12).map(item => (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-fg-muted"><Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge> {item.title}</span>
                <span className="font-mono text-[10px] text-fg-faint">{item.schedule.dueDate}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
