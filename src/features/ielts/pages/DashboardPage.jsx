import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useIelts } from '../context/IeltsContext.jsx'
import { getWritingLadder } from '../core/index.js'
import { buildWeaknessProfile } from '../domain/review.js'
import { loadReviewSummaries, loadSpeakingHistory, loadWritingProgress } from '../storage.js'
import { buildReviewQueue } from '../domain/spacedRepetition.js'
import { Badge, EmptyState, Notice, PageHeader, Panel, SectionTitle, StatTile } from '../components/ui.jsx'

const MODULE_LABEL = { reading: '阅读', listening: '听力' }

export default function DashboardPage() {
  const { records, settings, replacements, vocabState, reviewSchedule } = useIelts()
  const reviews = loadReviewSummaries()
  const writing = loadWritingProgress()
  const speaking = loadSpeakingHistory()
  const profile = buildWeaknessProfile(records)
  const ladder = getWritingLadder()
  const lastSpeaking = speaking[0]
  const todayQueue = useMemo(() => buildReviewQueue({ records, replacements, vocabulary: vocabState, schedule: reviewSchedule }), [records, replacements, vocabState, reviewSchedule])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="IELTS REVIEW LAB"
        title="做完题之后，真正开始学习"
        description="判题确定、讲解可核对、错因能累积。这里不代替刷题，而是把每一次错误变成下一次可执行的练习。"
        actions={<Link to="/ielts/reading" className="btn-primary text-xs">开始阅读复盘</Link>}
      />

      <Notice tone="warning" title="素材与成绩边界">
        内置内容均为原创示例，不是真题。分数换算只是估算，不代表官方成绩。原文/文稿默认只保留定位片段，只有你主动勾选才保存全文。
      </Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="已完成复盘" value={reviews.length} hint="阅读文章 + 听力 Part" />
        <StatTile label="错题记录" value={profile.total} tone="danger" hint="可筛选、可复练" />
        <StatTile label="写作节点" value={`${writing.completed.length}/${ladder.length}`} tone="info" hint="拿到反馈后才解锁下一步" />
        <StatTile label="目标分" value={settings.targetBand} tone="success" hint={`严格度：${settings.strictness === 'gentle' ? '温和' : settings.strictness === 'strict' ? '严格' : '标准'}`} />
        <StatTile label="今日复习" value={todayQueue.totalDue} tone={todayQueue.totalDue ? 'danger' : 'success'} hint={`错题 ${todayQueue.counts.mistake} · 替换 ${todayQueue.counts.replacement} · 词块 ${todayQueue.counts.vocab}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Panel>
          <SectionTitle title="最近复盘" hint="复盘摘要只保存在本机" action={<Link to="/ielts/sets" className="text-xs text-accent no-underline">整套视图 →</Link>} />
          {reviews.length === 0 ? (
            <EmptyState icon="R" title="还没有复盘记录" action={<Link to="/ielts/reading" className="btn-primary text-xs">录入第一篇阅读</Link>}>
              从纸质真题或你有权使用的材料录入原文、题目、答案和作答，规则会先完成确定判题。
            </EmptyState>
          ) : (
            <div className="divide-y divide-border-soft">
              {reviews.slice(0, 5).map(review => (
                <Link key={review.id} to="/ielts/mistakes" className="flex items-center gap-3 py-3 no-underline first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-mono text-xs font-bold text-accent">{MODULE_LABEL[review.module] || 'R'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-fg">{review.source}</span>
                    <span className="mt-0.5 block text-[11px] text-fg-faint">{new Date(review.createdAt).toLocaleDateString('zh-CN')} · 对 {review.correct}/{review.total}</span>
                  </span>
                  <Badge tone={review.wrong ? 'warning' : 'success'}>{review.wrong ? `错 ${review.wrong}` : '全对'}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle title="弱点画像摘要" hint="只按已记录的数据统计" action={<Link to="/ielts/mistakes" className="text-xs text-accent no-underline">完整画像 →</Link>} />
          {profile.total === 0 ? (
            <p className="text-xs leading-6 text-fg-muted">积累第一道错题后，这里会显示错因分布和最常错的题型，而不是空泛鼓励。</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-danger/25 bg-danger/10 p-3">
                <p className="text-[10px] font-semibold text-fg-faint">当前最集中错因</p>
                <p className="mt-1 text-sm font-bold text-fg">{profile.topCause || '尚未归类'}</p>
              </div>
              {profile.byCause.slice(0, 4).map(([cause, count]) => (
                <div key={cause}>
                  <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate text-fg-muted">{cause}</span><span className="font-mono text-fg-faint">{count}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong"><div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(8, count / profile.total * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <SectionTitle title="今天该复习" hint={`${todayQueue.totalDue} 项到期`} />
          {todayQueue.totalDue === 0 ? <p className="text-xs leading-6 text-fg-muted">今天没有到期项。新收藏的词块、替换或新错题会自动进入今天队列。</p> : (
            <div className="space-y-2">{todayQueue.due.slice(0, 3).map(item => <div key={item.key} className="rounded-lg bg-surface px-2.5 py-2 text-xs"><Badge tone={item.kind === 'mistake' ? 'danger' : item.kind === 'replacement' ? 'accent' : 'info'}>{item.kind === 'mistake' ? '错题' : item.kind === 'replacement' ? '替换' : '词块'}</Badge><p className="mt-1 truncate text-fg-muted">{item.title}</p></div>)}</div>
          )}
          <Link to="/ielts/review" className="btn-primary mt-3 inline-flex text-xs">开始今日复习</Link>
        </Panel>
        <Panel>
          <SectionTitle title="写作训练" hint="解锁路径" />
          <p className="text-2xl font-extrabold text-fg">{writing.completed.length}<span className="text-sm text-fg-faint"> / {ladder.length}</span></p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">{writing.completed.length === 0 ? '从 Task 1 开头改写开始。' : `最近完成的节点：${writing.completed[writing.completed.length - 1]}`}</p>
          <Link to="/ielts/writing" className="btn-ghost mt-3 inline-flex text-xs">进入写作训练</Link>
        </Panel>
        <Panel>
          <SectionTitle title="口语最近练习" hint="文字化作答" />
          {lastSpeaking ? (
            <div>
              <p className="text-sm font-bold text-fg">{lastSpeaking.topic}</p>
              <p className="mt-1 text-xs text-fg-muted">Part {lastSpeaking.part} · {new Date(lastSpeaking.createdAt).toLocaleDateString('zh-CN')}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-fg-faint">{lastSpeaking.answer}</p>
            </div>
          ) : <p className="text-xs leading-6 text-fg-muted">还没有口语记录。用输入法语音转文字，再按“像聊天”的规则复盘。</p>}
          <Link to="/ielts/speaking" className="btn-ghost mt-3 inline-flex text-xs">开始口语练习</Link>
        </Panel>
        <Panel>
          <SectionTitle title="下一步" hint="从当前数据出发" />
          <div className="space-y-2 text-xs">
            <Link to="/ielts/review" className="block rounded-lg border border-border-soft bg-surface px-3 py-2 text-fg-muted no-underline hover:text-fg">今日复习与错因复练</Link>
            <Link to="/ielts/sets" className="block rounded-lg border border-border-soft bg-surface px-3 py-2 text-fg-muted no-underline hover:text-fg">整套正确率与估算趋势</Link>
            <Link to="/ielts/vocab" className="block rounded-lg border border-border-soft bg-surface px-3 py-2 text-fg-muted no-underline hover:text-fg">词块：Task 1 / Task 2 / 同义替换 / 信号词</Link>
            <Link to="/ielts/settings" className="block rounded-lg border border-border-soft bg-surface px-3 py-2 text-fg-muted no-underline hover:text-fg">{settings.apiKey ? '检查模型与数据设置' : '配置自己的模型 key（可选）'}</Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
