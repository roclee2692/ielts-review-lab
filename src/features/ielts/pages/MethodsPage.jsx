import { useMemo, useState } from 'react'
import { parseStepsText, stepsToText } from '../data/methods.js'
import { deleteMethod, getActiveMethod, loadMethods, loadReviewSummaries, saveMethod, setActiveMethod } from '../storage.js'
import { Badge, Button, Field, Notice, PageHeader, Panel, SectionTitle, TextArea, TextInput } from '../components/ui.jsx'

const MODULES = [{ id: 'reading', label: '阅读' }, { id: 'listening', label: '听力' }]

/** @param {any} method */
function toForm(method) {
  return {
    id: method.id,
    module: method.module,
    title: method.title,
    summary: method.summary,
    stepsText: stepsToText(method.steps),
    fixesText: method.fixes.map(fix => `${fix.before} => ${fix.after}`).join('\n'),
    principlesText: method.principles.join('\n'),
    metricsText: method.metrics.map(metric => `${metric.label} | ${metric.hint}`).join('\n'),
    metrics: method.metrics,
  }
}

/** @param {ReturnType<typeof toForm>} form */
function fromForm(form) {
  const lines = (/** @type {string} */ text) => text.split('\n').map(line => line.trim()).filter(Boolean)
  return {
    id: form.id,
    module: form.module,
    title: form.title,
    summary: form.summary,
    steps: parseStepsText(form.stepsText),
    fixes: lines(form.fixesText).map(line => {
      const [before, after = ''] = line.split(/\s*(?:=>|→)\s*/)
      return { before, after }
    }),
    principles: lines(form.principlesText),
    metrics: lines(form.metricsText).map((line, index) => {
      const [label, hint = ''] = line.split(/\s*\|\s*/)
      // Keep ids (and their tag links) of metrics that already existed, so old records stay comparable.
      const existing = form.metrics.find(metric => metric.label === label)
      return existing ? { ...existing, hint } : { id: `metric-${index}-${label}`, label, hint }
    }),
  }
}

/** 做题方法：开始刷题前先看懂方法，复盘时按方法记指标，用数据一起改进方法。 */
export default function MethodsPage() {
  const [version, setVersion] = useState(0)
  const methods = useMemo(() => loadMethods(), [version]) // eslint-disable-line react-hooks/exhaustive-deps
  const active = useMemo(() => Object.fromEntries(MODULES.map(module => [module.id, getActiveMethod(module.id)?.id || ''])), [version]) // eslint-disable-line react-hooks/exhaustive-deps
  const reviews = useMemo(() => loadReviewSummaries(), [])
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const refresh = () => setVersion(value => value + 1)

  const startNew = module => setEditing(toForm({ id: `custom-${Date.now()}`, module, title: '', summary: '', steps: [], fixes: [], principles: [], metrics: [] }))

  const save = () => {
    try {
      saveMethod(fromForm(editing))
      setEditing(null)
      setMessage('已保存。下次复盘时就按这个版本讲题。')
      refresh()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="METHODS"
        title="做题方法"
        description="先看懂方法再刷题。复盘时系统按你选的方法讲“下次在哪一步怎么做”，并记下方法的执行指标；分析页看这些指标有没有变好。方法可以改，也可以写你自己的。"
      />
      {message && <Notice tone="success">{message}</Notice>}

      {editing ? (
        <Panel>
          <SectionTitle title={editing.title ? `编辑：${editing.title}` : '新方法'} hint="步骤用“## 标题”开头，下面每行一条要点。" />
          <div className="grid gap-3">
            <Field label="方法名"><TextInput aria-label="方法名" value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></Field>
            <Field label="一句话说清这个方法解决什么"><TextArea rows={3} aria-label="方法简介" value={editing.summary} onChange={event => setEditing({ ...editing, summary: event.target.value })} /></Field>
            <Field label="步骤"><TextArea rows={10} aria-label="步骤" className="font-mono" value={editing.stepsText} onChange={event => setEditing({ ...editing, stepsText: event.target.value })} placeholder={'## ① 预处理题目\n- 填空、判断：提取首个定位词\n## ② 单向推进\n- …'} /></Field>
            <Field label="之前做错了什么 => 现在怎么改（每行一条）"><TextArea rows={4} aria-label="之前与现在" value={editing.fixesText} onChange={event => setEditing({ ...editing, fixesText: event.target.value })} placeholder="找到相关段落就立即选 Heading => 读完整段后再判断" /></Field>
            <Field label="原则（每行一条，讲题时模型会照着说）"><TextArea rows={4} aria-label="原则" value={editing.principlesText} onChange={event => setEditing({ ...editing, principlesText: event.target.value })} /></Field>
            <Field label="执行指标（每行：名称 | 说明），复盘时记数" hint="例如：无效回读次数 | 往回翻但没找到新证据的次数"><TextArea rows={3} aria-label="执行指标" value={editing.metricsText} onChange={event => setEditing({ ...editing, metricsText: event.target.value })} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save}>保存</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>取消</Button>
          </div>
        </Panel>
      ) : (
        MODULES.map(module => (
          <section key={module.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-fg">{module.label}</h2>
              <Button variant="subtle" className="text-xs" onClick={() => startNew(module.id)}>＋ 写我自己的{module.label}方法</Button>
            </div>
            {methods.filter(method => method.module === module.id).length === 0 && <p className="text-xs text-fg-faint">还没有{module.label}方法。</p>}
            {methods.filter(method => method.module === module.id).map(method => {
              const used = reviews.filter(review => review.methodId === method.id)
              return (
                <Panel key={method.id} className={active[module.id] === method.id ? 'border-accent-border' : ''}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-fg">{method.title}</h3>
                      {active[module.id] === method.id && <Badge tone="accent">当前使用</Badge>}
                      {method.builtin && <Badge>{method.edited ? '内置 · 你改过' : '内置'}</Badge>}
                      <Badge tone="info">用过 {used.length} 篇</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {active[module.id] !== method.id && <Button className="text-xs" onClick={() => { setActiveMethod(module.id, method.id); refresh() }}>用这个方法</Button>}
                      <Button variant="ghost" className="text-xs" onClick={() => setEditing(toForm(method))}>编辑</Button>
                      {(!method.builtin || method.edited) && (
                        <Button variant="ghost" className="text-xs" onClick={() => {
                          if (!window.confirm(method.builtin ? '恢复成内置的原始版本？你的改动会丢掉。' : '删除这个方法？已有复盘记录不受影响。')) return
                          deleteMethod(method.id)
                          refresh()
                        }}>{method.builtin ? '恢复原版' : '删除'}</Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-fg-muted">{method.summary}</p>
                  <ol className="mt-3 grid gap-2 md:grid-cols-2">
                    {method.steps.map(step => (
                      <li key={step.title} className="rounded-xl border border-border-soft bg-surface p-3">
                        <p className="text-xs font-bold text-fg">{step.title}</p>
                        <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-fg-muted">{step.points.map(point => <li key={point}>· {point}</li>)}</ul>
                      </li>
                    ))}
                  </ol>
                  {method.fixes.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="text-[10px] text-fg-faint"><tr><th className="py-1.5 pr-3">之前的做法</th><th className="py-1.5">现在修正</th></tr></thead>
                        <tbody>{method.fixes.map(fix => <tr key={fix.before} className="border-t border-border-soft text-fg-muted"><td className="py-2 pr-3">{fix.before}</td><td className="py-2 text-fg">{fix.after}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  {method.principles.length > 0 && <ul className="mt-3 space-y-1 text-[11px] leading-5 text-fg-muted">{method.principles.map(item => <li key={item}>◆ {item}</li>)}</ul>}
                  {method.metrics.length > 0 && <p className="mt-3 text-[11px] text-fg-faint">执行指标：{method.metrics.map(metric => metric.label).join('、')}</p>}
                </Panel>
              )
            })}
          </section>
        ))
      )}
    </div>
  )
}
