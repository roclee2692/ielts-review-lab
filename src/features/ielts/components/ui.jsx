import { useState } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({ eyebrow = 'IELTS LAB', title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="section-eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
export function Panel({ children, className = '', as: Tag = 'section' }) {
  return <Tag className={`glass-card p-4 sm:p-5 ${className}`}>{children}</Tag>
}

export function SectionTitle({ title, hint, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-fg sm:text-base">{title}</h2>
        {hint && <p className="mt-1 text-xs leading-5 text-fg-faint">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  subtle: 'border border-border-soft bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15',
}

export function Button({ children, variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-fg-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-5 text-fg-faint">{hint}</span>}
    </label>
  )
}

export function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm text-fg outline-none transition focus:border-accent-border focus:ring-2 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}

export function TextArea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full resize-y rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm leading-6 text-fg outline-none transition placeholder:text-fg-faint focus:border-accent-border focus:ring-2 focus:ring-accent-soft ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm text-fg outline-none transition focus:border-accent-border ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Badge({ children, tone = 'neutral', title }) {
  const tones = {
    neutral: 'border-border-soft bg-surface text-fg-muted',
    success: 'border-success/30 bg-success/10 text-success',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    accent: 'border-accent-border bg-accent-soft text-accent',
    info: 'border-info/30 bg-info/10 text-info',
  }
  return (
    <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

export function Notice({ children, tone = 'info', title }) {
  const tones = {
    info: 'border-info/25 bg-info/10 text-fg',
    warning: 'border-warning/30 bg-warning/10 text-fg',
    danger: 'border-danger/30 bg-danger/10 text-fg',
    success: 'border-success/30 bg-success/10 text-fg',
  }
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-xs leading-5 ${tones[tone] || tones.info}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <p className="mb-1 font-bold">{title}</p>}
      {children}
    </div>
  )
}

export function Modal({ open, title, children, onClose, footer, width = 'max-w-2xl' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[92vh] w-full ${width} overflow-hidden rounded-t-2xl border border-border-strong bg-bg-elev shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-border-soft px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-bold text-fg">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border-soft px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  )
}

export function StatTile({ label, value, hint, tone = 'accent' }) {
  const colors = { accent: 'text-accent', danger: 'text-danger', success: 'text-success', info: 'text-info' }
  return (
    <div className="rounded-xl border border-border-soft bg-surface-mid p-3.5">
      <p className="text-[11px] font-semibold text-fg-faint">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${colors[tone] || colors.accent}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-fg-faint">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon = '＋', title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-border-soft bg-surface-mid px-5 py-9 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-lg text-accent">{icon}</div>
      <p className="text-sm font-bold text-fg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-lg text-xs leading-5 text-fg-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function SettingsLink() {
  return <Link to="/ielts/settings" className="btn-ghost text-xs">配置模型</Link>
}

export function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border-soft bg-surface-mid">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-xs font-semibold text-fg" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        {title}<span className="text-fg-faint">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="border-t border-border-soft px-3.5 py-3 text-xs leading-6 text-fg-muted">{children}</div>}
    </div>
  )
}
