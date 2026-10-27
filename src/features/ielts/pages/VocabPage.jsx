import { useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { ALL_VOCAB, VOCAB_CATEGORIES } from '../data/vocab.js'
import { buildReviewQueue, createScheduleEntry, isReviewDue, reviewKey } from '../domain/spacedRepetition.js'
import { Badge, Button, Field, Modal, Notice, PageHeader, Panel, SectionTitle, Select, TextArea, TextInput } from '../components/ui.jsx'
import { Link } from 'react-router-dom'

function parseVocabImport(text, format) {
  if (format === 'json') {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : parsed.items
    if (!Array.isArray(list)) throw new Error('JSON 需要是数组，或包含 items 数组')
    return list.map((item, index) => ({
      id: `custom-${Date.now()}-${index}`,
      expression: String(item.expression || item.en || '').trim(),
      meaning: String(item.meaning || item.zh || '').trim(),
      example: String(item.example || '').trim(),
      collocation: String(item.collocation || '').trim(),
      categoryId: String(item.categoryId || item.category || 'task1'),
    })).filter(item => item.expression && item.meaning)
  }
  return String(text || '').split('\n').map((line, index) => {
    const cleaned = line.replace(/^\s*[-*]\s*/, '').trim()
    if (!cleaned) return null
    const [expression, meaning, example, collocation] = cleaned.split('|').map(part => part.trim())
    return { id: `custom-${Date.now()}-${index}`, expression, meaning, example: example || '', collocation: collocation || '', categoryId: 'task1' }
  }).filter(item => item?.expression && item?.meaning)
}

export default function VocabPage() {
  const { vocabState, updateVocab, replacements, records, reviewSchedule } = useIelts()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState('markdown')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ expression: '', meaning: '', example: '', collocation: '', categoryId: 'task1' })

  const custom = useMemo(() => Array.isArray(vocabState.custom) ? vocabState.custom : [], [vocabState.custom])
  const favorites = useMemo(() => Array.isArray(vocabState.favorites) ? vocabState.favorites : [], [vocabState.favorites])
  const reviewQueue = useMemo(() => buildReviewQueue({ records, replacements, vocabulary: vocabState, schedule: reviewSchedule }), [records, replacements, vocabState, reviewSchedule])
  const allItems = useMemo(() => [...ALL_VOCAB, ...custom.map(item => ({
    ...item,
    custom: true,
    categoryTitle: VOCAB_CATEGORIES.find(cat => cat.id === item.categoryId)?.title || '自定义',
  }))], [custom])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allItems.filter(item => {
      if (category !== 'all' && item.categoryId !== category) return false
      if (favoritesOnly && !favorites.includes(item.id)) return false
      if (!needle) return true
      return [item.expression, item.meaning, item.example, item.collocation].some(value => String(value).toLowerCase().includes(needle))
    })
  }, [allItems, category, favoritesOnly, favorites, query])

  const toggleFavorite = id => {
    updateVocab({ favorites: favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id] })
  }

  const reviewState = (kind, id) => {
    const key = reviewKey(kind, id)
    const entry = reviewSchedule.items[key] || createScheduleEntry(kind, id)
    return { due: isReviewDue(entry), dueDate: entry.dueDate }
  }

  const addCustom = () => {
    if (!draft.expression.trim() || !draft.meaning.trim()) {
      setError('表达和中文释义为必填项。')
      return
    }
    updateVocab({ custom: [{ ...draft, id: `custom-${Date.now()}` }, ...custom] })
    setDraft({ expression: '', meaning: '', example: '', collocation: '', categoryId: 'task1' })
    setAddOpen(false)
    setError('')
  }

  const importItems = () => {
    try {
      const items = parseVocabImport(importText, importFormat)
      if (!items.length) throw new Error('没有识别到有效词块')
      updateVocab({ custom: [...items, ...custom] })
      setImportText('')
      setImportOpen(false)
      setError('')
    } catch (importError) {
      setError(importError.message)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="PHRASE BANK"
        title="词块库"
        description="四类原创表达、阅读同义替换、听力信号词与干扰词。词块不是模板，最终要嵌进自己的句子。"
        actions={<><Link to="/ielts/review" className="btn-ghost text-xs">今日复习 {reviewQueue.totalDue}</Link><Button variant="subtle" onClick={() => setImportOpen(true)}>导入</Button><Button onClick={() => setAddOpen(true)}>＋ 自定义</Button></>}
      />

      <Panel>
        <div className="grid gap-2 sm:grid-cols-[1fr_210px_auto]">
          <TextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索英文表达、中文释义、例句或搭配" aria-label="搜索词块" />
          <Select value={category} onChange={event => setCategory(event.target.value)} aria-label="词块分类">
            <option value="all">全部分类</option>
            {VOCAB_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.title}（{item.items.length}）</option>)}
          </Select>
          <Button variant={favoritesOnly ? 'primary' : 'subtle'} onClick={() => setFavoritesOnly(value => !value)}>{favoritesOnly ? '只看收藏' : '收藏夹'}</Button>
        </div>
      </Panel>

      {category === 'all' && !favoritesOnly && !query && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {VOCAB_CATEGORIES.map(item => <button key={item.id} onClick={() => setCategory(item.id)} className="rounded-xl border border-border-soft bg-surface p-3 text-left hover:border-border-strong"><p className="text-xs font-bold text-fg">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-fg-faint">{item.description}</p><p className="mt-2 text-[10px] text-accent">{item.items.length} 条</p></button>)}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(item => (
          <Panel key={item.id} className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-base font-extrabold text-fg">{item.expression}</h3><p className="mt-1 text-xs font-semibold text-accent">{item.meaning}</p></div>
              <button className="text-lg" onClick={() => toggleFavorite(item.id)} aria-label={favorites.includes(item.id) ? '取消收藏' : '收藏'} aria-pressed={favorites.includes(item.id)}>{favorites.includes(item.id) ? '★' : '☆'}</button>
            </div>
            {item.example && <p className="mt-3 flex-1 rounded-lg bg-surface px-3 py-2 text-xs italic leading-6 text-fg-muted">{item.example}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge>{item.categoryTitle || item.categoryId}</Badge>
              {item.collocation && <span className="text-[10px] text-fg-faint">搭配：{item.collocation}</span>}
              {item.custom && <Badge tone="info">自定义</Badge>}
              {favorites.includes(item.id) && (() => { const state = reviewState('vocab', item.id); return <Badge tone={state.due ? 'warning' : 'neutral'}>{state.due ? '今天复习' : `下次 ${state.dueDate}`}</Badge> })()}
            </div>
          </Panel>
        ))}
      </div>
      {filtered.length === 0 && <Notice tone="warning">没有匹配的词块。可以换关键词、关闭收藏筛选，或导入自己的笔记。</Notice>}

      <Panel>
        <SectionTitle title="我的替换库" hint={`${replacements.length} 对 · 来自阅读/听力复盘一键收藏`} />
        {replacements.length === 0 ? <p className="text-xs text-fg-faint">还没有收藏同义替换。在讲解中点击“收入替换库”后会汇总到这里。</p> : <div className="grid gap-2 sm:grid-cols-2">{replacements.map(pair => { const id = pair.id || `${pair.question}→${pair.passage}`; const state = reviewState('replacement', id); return <div key={id} className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-xs text-fg-muted"><div className="flex items-center justify-between gap-2"><span><strong className="text-fg">{pair.question}</strong> ↔ {pair.passage}</span><Badge tone={state.due ? 'warning' : 'neutral'}>{state.due ? '今天复习' : `下次 ${state.dueDate}`}</Badge></div></div> })}</div>}
      </Panel>

      <Modal open={addOpen} title="添加自定义词块" onClose={() => setAddOpen(false)} footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button><Button onClick={addCustom}>保存</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="英文表达"><TextInput value={draft.expression} onChange={event => setDraft({ ...draft, expression: event.target.value })} /></Field>
          <Field label="中文释义"><TextInput value={draft.meaning} onChange={event => setDraft({ ...draft, meaning: event.target.value })} /></Field>
          <Field label="原创例句" className="sm:col-span-2"><TextArea rows={3} value={draft.example} onChange={event => setDraft({ ...draft, example: event.target.value })} /></Field>
          <Field label="搭配说明"><TextInput value={draft.collocation} onChange={event => setDraft({ ...draft, collocation: event.target.value })} /></Field>
          <Field label="分类"><Select value={draft.categoryId} onChange={event => setDraft({ ...draft, categoryId: event.target.value })}>{VOCAB_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field>
        </div>
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      </Modal>

      <Modal open={importOpen} title="导入词块" onClose={() => setImportOpen(false)} footer={<><Button variant="ghost" onClick={() => setImportOpen(false)}>取消</Button><Button onClick={importItems}>导入</Button></>}>
        <div className="space-y-3">
          <Notice tone="info">Markdown 每行：`表达 | 释义 | 例句 | 搭配`。JSON 数组字段：expression、meaning、example、collocation、categoryId。</Notice>
          <Field label="格式"><Select value={importFormat} onChange={event => setImportFormat(event.target.value)}><option value="markdown">Markdown / 纯文本</option><option value="json">JSON</option></Select></Field>
          <Field label="粘贴内容"><TextArea rows={8} value={importText} onChange={event => setImportText(event.target.value)} placeholder="edge upwards | 小幅上升 | Prices edged upwards. | edge upwards from" /></Field>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Modal>
    </div>
  )
}
