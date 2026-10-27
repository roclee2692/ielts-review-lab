import { useEffect, useRef, useState } from 'react'
import { Button } from './ui.jsx'

function format(seconds) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}
/** Countdown that only warns. It never locks the exercise. */
export default function PracticeTimer({ minutes = 20, label = '建议用时', onEnd }) {
  const total = Math.max(1, Number(minutes) || 20) * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => {
      setRemaining(value => {
        if (value <= 1) {
          clearInterval(timer)
          setRunning(false)
          setFinished(true)
          queueMicrotask(() => onEndRef.current?.())
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [running])

  const reset = () => {
    setRunning(false)
    setFinished(false)
    setRemaining(total)
  }

  return (
    <div className="rounded-xl border border-border-soft bg-surface-mid px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-fg-faint">{label} · {minutes} 分钟</p>
          <p className={`mt-0.5 font-mono text-2xl font-bold tabular-nums ${finished ? 'text-warning' : 'text-fg'}`} aria-live="polite">
            {format(remaining)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => setRunning(value => !value)} className="text-xs">
            {running ? '暂停' : remaining === 0 ? '已结束' : '开始'}
          </Button>
          <Button variant="subtle" onClick={reset} className="text-xs">重置</Button>
        </div>
      </div>
      {finished && <p className="mt-2 text-[11px] font-semibold text-warning">时间到。这里只提醒，不锁定作答，建议先收尾再复盘。</p>}
    </div>
  )
}
