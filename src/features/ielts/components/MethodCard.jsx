import { useState } from 'react'
import { Link } from 'react-router-dom'
import { markMethodIntroSeen, methodIntroSeen } from '../storage.js'
import { Badge, Button, Panel } from './ui.jsx'

/**
 * 开始复盘前先看到自己的做题方法。第一次打开时展开，看过以后默认折叠成一行。
 */
export default function MethodCard({ module, method }) {
  const [open, setOpen] = useState(() => !methodIntroSeen(module))
  if (!method) {
    return (
      <Panel className="flex flex-wrap items-center justify-between gap-2 py-3">
        <p className="text-xs text-fg-muted">还没有选做题方法。选一个方法，讲题时会按你的方法说下次怎么做。</p>
        <Link to="/ielts/methods" className="btn-ghost text-xs">选择方法</Link>
      </Panel>
    )
  }
  const close = () => {
    markMethodIntroSeen(module)
    setOpen(false)
  }
  return (
    <Panel className="border-accent-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone="accent">做题方法</Badge>
          <p className="truncate text-sm font-bold text-fg">{method.title}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="text-xs" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open}>{open ? '收起' : '展开看步骤'}</Button>
          <Link to="/ielts/methods" className="btn-ghost text-xs">编辑 / 换方法</Link>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-6 text-fg-muted">{method.summary}</p>
          <ol className="grid gap-2 md:grid-cols-2">
            {method.steps.map(step => (
              <li key={step.title} className="rounded-xl border border-border-soft bg-surface p-3">
                <p className="text-xs font-bold text-fg">{step.title}</p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-fg-muted">
                  {step.points.map(point => <li key={point}>· {point}</li>)}
                </ul>
              </li>
            ))}
          </ol>
          {method.metrics.length > 0 && (
            <p className="text-[11px] leading-5 text-fg-faint">复盘时会记：{method.metrics.map(metric => metric.label).join('、')}。分析页看这些数字的趋势，判断方法是否执行熟练。</p>
          )}
          <Button className="text-xs" onClick={close}>我了解了，开始复盘</Button>
        </div>
      )}
    </Panel>
  )
}
