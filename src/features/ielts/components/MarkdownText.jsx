// Tiny, dependency-free renderer for the learner-authored Markdown notes.
// It intentionally escapes HTML rather than supporting raw markup.
export default function MarkdownText({ text }) {
  const lines = String(text || '').split(/\n/)
  return (
    <div className="space-y-1 text-xs leading-6 text-fg-muted">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />
        if (line.startsWith('### ')) return <h4 key={index} className="pt-1 text-xs font-bold text-fg">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={index} className="pt-1 text-sm font-bold text-fg">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={index} className="pt-1 text-base font-bold text-fg">{line.slice(2)}</h2>
        if (/^\s*[-*]\s/.test(line)) return <p key={index} className="pl-3">• {line.replace(/^\s*[-*]\s/, '')}</p>
        return <p key={index}>{line}</p>
      })}
    </div>
  )
}
