import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIelts } from './context/IeltsContext.jsx'
import { Badge } from './components/ui.jsx'

const NAV_ITEMS = [
  { href: '/ielts', label: '总览', icon: '◎' },
  { href: '/ielts/reading', label: '阅读复盘', icon: 'R' },
  { href: '/ielts/listening', label: '听力复盘', icon: 'L' },
  { href: '/ielts/mistakes', label: '错题与弱点', icon: '✕' },
  { href: '/ielts/sets', label: '整套复盘', icon: '≡' },
  { href: '/ielts/review', label: '今日复习', icon: '↻' },
  { href: '/ielts/writing', label: '写作训练', icon: 'W' },
  { href: '/ielts/speaking', label: '口语训练', icon: 'S' },
  { href: '/ielts/vocab', label: '词块库', icon: 'V' },
  { href: '/ielts/settings', label: '设置与数据', icon: '⚙' },
]

export default function IeltsShell({ children }) {
  const { pathname } = useLocation()
  const { hasKey } = useIelts()
  const [theme, setTheme] = useState(() => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark')
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('ielts-theme', next) } catch { /* private mode: theme just won't persist */ }
    setTheme(next)
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="border-b border-border-soft bg-bg-elev/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/ielts" className="flex items-center gap-2.5 no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent-border bg-accent-soft font-mono text-sm font-black text-accent">I</span>
              <span>
                <span className="block text-sm font-extrabold tracking-tight text-fg">IELTS Lab</span>
                <span className="block text-[10px] font-medium text-fg-faint">复盘 · 归因 · 刻意练习</span>
              </span>
            </Link>
            <Badge tone="warning" title="所有材料和数据均只保存在当前浏览器">本地优先</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge tone={hasKey ? 'success' : 'neutral'}>{hasKey ? '模型已配置' : '未配置模型 · 可用模拟反馈'}</Badge>
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'} title={theme === 'dark' ? '切换到浅色' : '切换到深色'}>{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-border-soft bg-bg-elev/45 print:hidden lg:min-h-[calc(100vh-58px)] lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:p-4" aria-label="雅思模块导航">
            {NAV_ITEMS.map(item => {
              const active = item.href === '/ielts' ? pathname === '/ielts' || pathname === '/ielts/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold no-underline transition ${active ? 'border border-accent-border bg-accent-soft text-accent' : 'border border-transparent text-fg-muted hover:bg-surface hover:text-fg'}`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-strong font-mono text-[10px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
          <div className="hidden px-4 pb-4 lg:block">
            <p className="rounded-xl border border-border-soft bg-surface-mid p-3 text-[10px] leading-5 text-fg-faint">
              只使用你有权使用的材料。原文与文稿默认不入错题库；发送模型前会逐次展示内容。
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 print:p-0 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
