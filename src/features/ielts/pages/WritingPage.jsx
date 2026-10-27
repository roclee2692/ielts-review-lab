import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIelts } from '../context/IeltsContext.jsx'
import { canStart, getWritingLadder } from '../core/index.js'
import { KNOWLEDGE_CARDS, KNOWLEDGE_FOR_STEP } from '../data/writingKnowledge.js'
import { taskForStep } from '../data/writingTasks.js'
import { loadWritingProgress, saveWritingProgress } from '../storage.js'
import MarkdownText from '../components/MarkdownText.jsx'
import PracticeTimer from '../components/PracticeTimer.jsx'
import { Badge, Button, Field, Notice, PageHeader, Panel, SectionTitle, Select, TextArea, TextInput } from '../components/ui.jsx'

function countWords(text) {
  return String(text || '').trim() ? String(text).trim().split(/\s+/).length : 0
}

export default function WritingPage() {
  const { settings, requestModel, knowledgeState, updateKnowledge } = useIelts()
  const location = useLocation()
  const [progress, setProgress] = useState(() => loadWritingProgress())
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('step') || 't1-intro')
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [editingCard, setEditingCard] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState('markdown')
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [outlineMinutes, setOutlineMinutes] = useState(10)
  const [translationExercise, setTranslationExercise] = useState({
    chineseSentence: '真正有效的练习，不是把同一道题再做一遍，而是找出上次出错的那个判断。',
    focus: 'not…but… 结构 + 定语从句',
  })

  const ladder = getWritingLadder()
  const step = ladder.find(item => item.id === selected) || ladder[0]
  const task = taskForStep(step.id)
  const unlocked = canStart(progress, step.id)
  const words = countWords(draft)
  const completed = new Set(progress.completed)
  const edited = useMemo(() => knowledgeState.edited || {}, [knowledgeState.edited])
  const importedNotes = useMemo(() => Array.isArray(knowledgeState.notes) ? knowledgeState.notes : [], [knowledgeState.notes])

  const relevantKnowledge = useMemo(() => {
    const stepKnowledgeIds = KNOWLEDGE_FOR_STEP[selected] || []
    const baseCards = knowledgeSearch.trim()
      ? KNOWLEDGE_CARDS
      : KNOWLEDGE_CARDS.filter(card => stepKnowledgeIds.includes(card.id))
    const cards = baseCards.map(card => ({
      ...card,
      content: edited[card.id] ?? card.content,
      source: edited[card.id] ? '我的修订' : '内置原创',
    }))
    const needle = knowledgeSearch.trim().toLowerCase()
    const notes = importedNotes.filter(note => !needle || `${note.title} ${note.content}`.toLowerCase().includes(needle))
    return {
      cards: cards.filter(card => !needle || `${card.title} ${card.content} ${card.examples.join(' ')}`.toLowerCase().includes(needle)),
      notes,
    }
  }, [edited, importedNotes, knowledgeSearch, selected])

  const chooseStep = id => {
    setSelected(id)
    setDraft('')
    setFeedback(null)
    setError('')
    window.history.replaceState(null, '', `/ielts/writing?step=${id}`)
  }

  const effectivePrompt = showCustom && customPrompt.trim() ? customPrompt : task.prompt
  const knowledgeNotes = importedNotes.map(note => `${note.title}\n${note.content}`).join('\n\n').slice(0, 4000)

  const submit = async () => {
    if (!unlocked) {
      setError('该训练节点尚未解锁。请先完成并提交前置步骤。')
      return
    }
    if (!draft.trim()) {
      setError('请先提交你的作答。')
      return
    }
    setBusy(true)
    setError('')
    let response
    if (step.id === 'translation') {
      response = await requestModel('ielts.writing.translation', {
        mode: 'feedback', sentence: translationExercise.chineseSentence,
        translation: draft, strictness: settings.strictness,
      })
    } else {
      response = await requestModel('ielts.writing.feedback', {
        stepId: step.id,
        taskPrompt: effectivePrompt,
        submission: draft,
        wordTarget: task.wordTarget,
        strictness: settings.strictness,
        targetBand: settings.targetBand,
        knowledgeNotes,
      })
    }
    setBusy(false)
    if (!response) return
    const result = { ...response.data, mock: response.meta.mock, at: Date.now() }
    setFeedback(result)
    const nextCompleted = progress.completed.includes(step.id) ? progress.completed : [...progress.completed, step.id]
    const next = {
      completed: nextCompleted,
      submissions: {
        ...progress.submissions,
        [step.id]: { draft, prompt: effectivePrompt, feedback: result, at: Date.now() },
      },
    }
    setProgress(next)
    saveWritingProgress(next)
  }

  const generateTranslation = async () => {
    setBusy(true)
    const response = await requestModel('ielts.writing.translation', {
      mode: 'generate', sentence: '', translation: '', strictness: settings.strictness,
    })
    setBusy(false)
    if (response) {
      setTranslationExercise(response.data)
      setDraft('')
      setFeedback(null)
    }
  }

  const saveCard = cardId => {
    updateKnowledge({ edited: { ...edited, [cardId]: editingContent } })
    setEditingCard('')
    setEditingContent('')
  }

  const importNotes = () => {
    try {
      let notes = []
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText)
        const list = Array.isArray(parsed) ? parsed : parsed.notes
        if (!Array.isArray(list)) throw new Error('JSON 需要是数组，或包含 notes 数组')
        notes = list.map((note, index) => ({
          id: `note-${Date.now()}-${index}`,
          title: String(note.title || `笔记 ${index + 1}`),
          content: String(note.content || note.text || ''),
          createdAt: Date.now(),
        }))
      } else {
        notes = [{ id: `note-${Date.now()}`, title: importText.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60) || '导入笔记', content: importText, createdAt: Date.now() }]
      }
      updateKnowledge({ notes: [...importedNotes, ...notes] })
      setImportText('')
      setShowImport(false)
      setError('')
    } catch (importError) {
      setError(importError.message)
    }
  }

  const taskDisplay = (
    <div className="space-y-3">
      <div className="rounded-xl border border-border-soft bg-surface p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="info">{task.label || (step.id.startsWith('t2') || step.id === 'mock-t2' ? 'Task 2 · 原创题目' : '原创训练任务')}</Badge>
          <button className="text-[11px] text-accent" onClick={() => setShowCustom(value => !value)}>{showCustom ? '使用站内题目' : '粘贴自己的题目'}</button>
        </div>
        {showCustom ? <TextArea rows={4} className="mt-2" value={customPrompt} onChange={event => setCustomPrompt(event.target.value)} placeholder="粘贴你有权使用的题目。题干只用于本次训练，不写入内置题库。" /> : <p className="mt-2 text-sm font-semibold leading-6 text-fg">{task.prompt}</p>}
        {task.chart && !showCustom && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border-soft">
            <table className="w-full min-w-[420px] border-collapse text-left text-xs">
              <caption className="px-3 py-2 text-left text-[10px] text-fg-faint">{task.chart.caption}</caption>
              <thead><tr className="bg-surface-mid">{task.chart.columns.map(column => <th key={column} className="border-t border-border-soft px-3 py-2 font-semibold text-fg">{column}</th>)}</tr></thead>
              <tbody>{task.chart.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-t border-border-soft px-3 py-2 text-fg-muted">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {task.diagramText && !showCustom && <ol className="mt-3 list-decimal space-y-1.5 rounded-lg bg-surface-mid px-7 py-3 text-xs leading-5 text-fg-muted">{task.diagramText.map(line => <li key={line}>{line}</li>)}</ol>}
        <p className="mt-3 text-[11px] leading-5 text-fg-muted">{task.instruction}</p>
        {task.wordTarget > 0 && <p className="mt-1 text-[10px] text-fg-faint">字数目标：至少 {task.wordTarget} 词</p>}
      </div>
      {step.id === 't2-outline' && <Field label="构思限时（分钟，默认 10）"><TextInput type="number" min="1" max="60" value={outlineMinutes} onChange={event => setOutlineMinutes(Math.max(1, Number(event.target.value) || 1))} className="sm:max-w-40" /></Field>}
      {task.minutes && <PracticeTimer key={`${step.id}-${step.id === 't2-outline' ? outlineMinutes : task.minutes}`} minutes={step.id === 't2-outline' ? outlineMinutes : task.minutes} label="限时训练" />}
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="DELIBERATE PRACTICE"
        title="写作训练"
        description="把一篇作文拆成可反复练的小步骤。每一步必须先提交并拿到反馈，下一步才解锁；反馈最多指出三处最值得改的问题，不整篇重写。"
        actions={<Button variant="subtle" onClick={() => setKnowledgeOpen(true)}>打开知识卡片</Button>}
      />

      {!unlocked && (
        <Notice tone="warning" title="当前节点尚未解锁">
          {step.requires.length ? `需要先完成并提交：${step.requires.map(id => ladder.find(item => item.id === id)?.title || id).join('、')}。` : '请完成前置步骤。'}
          直接输入地址或参数也不能绕过这个判断。
        </Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-[285px_1fr]">
        <Panel className="h-fit">
          <SectionTitle title="训练路径" hint={`${progress.completed.length} / ${ladder.length} 已完成`} />
          <div className="space-y-1.5">
            {ladder.map(item => {
              const available = canStart(progress, item.id)
              const done = completed.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => chooseStep(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${selected === item.id ? 'border-accent-border bg-accent-soft' : 'border-border-soft bg-surface hover:border-border-strong'} ${!available ? 'opacity-55' : ''}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-success text-white' : available ? 'bg-surface-strong text-fg-muted' : 'bg-surface-strong text-fg-faint'}`}>{done ? '✓' : available ? '○' : '×'}</span>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-fg">{item.title}</span>
                  <span className="text-[9px] text-fg-faint">{item.section}</span>
                </button>
              )
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle
              title={step.title}
              hint={step.description}
              action={<Button variant="subtle" className="text-xs" onClick={() => setKnowledgeOpen(true)}>知识卡片（{relevantKnowledge.cards.length}）</Button>}
            />
            {!unlocked ? (
              <div className="rounded-xl border border-dashed border-border-soft px-4 py-10 text-center text-xs leading-6 text-fg-muted">
                先完成前置节点。每个节点都必须提交作答并获得真实或明确标注的模拟反馈。
              </div>
            ) : step.id === 'translation' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border-soft bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-2"><Badge tone="info">中译英句型</Badge><Button variant="subtle" className="text-[11px]" onClick={generateTranslation} disabled={busy}>换一句</Button></div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-fg">{translationExercise.chineseSentence}</p>
                  <p className="mt-1 text-[11px] text-fg-faint">侧重：{translationExercise.focus}</p>
                </div>
                <Field label="你的英文翻译"><TextArea rows={6} value={draft} onChange={event => setDraft(event.target.value)} placeholder="先写主干，再检查从句和介词搭配。" /></Field>
                {translationExercise.feedback && <Notice tone="info">{translationExercise.feedback}</Notice>}
              </div>
            ) : (
              <>
                {taskDisplay}
                <Field label="你的作答" className="mt-3" hint={`当前 ${words} 词${task.wordTarget ? ` / 目标至少 ${task.wordTarget} 词` : ''}`}>
                  <TextArea rows={12} value={draft} onChange={event => setDraft(event.target.value)} placeholder={step.id === 't2-outline' ? '立场：…\n开头：…\n结尾：…\n主体段 1 中心：…\n  分论点 1（论证方式：…）\n  分论点 2（论证方式：…）\n主体段 2 中心：…' : '直接写你的训练作答，不要粘贴整篇范文。'} />
                </Field>
                {task.wordTarget > 0 && words < task.wordTarget && <p className="mt-1 text-[11px] text-warning">目前约 {words} 词，低于 {task.wordTarget} 词目标。提交会保留这个提醒。</p>}
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={submit} disabled={busy || !draft.trim()}>{busy ? '生成反馈中…' : '提交并获取反馈'}</Button>
              {feedback && <Badge tone={feedback.mock ? 'warning' : 'success'}>{feedback.mock ? '模拟反馈（未调用模型）' : '真实模型反馈'}</Badge>}
            </div>
            {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
          </Panel>

          {feedback && <FeedbackCard step={step} feedback={feedback} />}
          {!feedback && progress.submissions[step.id] && (
            <Notice tone="info">这一步之前已提交过。如需再次练习，重新写入并提交即可覆盖最近一次记录。</Notice>
          )}
        </div>
      </div>

      <ModalKnowledge
        open={knowledgeOpen}
        onClose={() => setKnowledgeOpen(false)}
        relevant={relevantKnowledge}
        search={knowledgeSearch}
        setSearch={setKnowledgeSearch}
        editingCard={editingCard}
        setEditingCard={setEditingCard}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        saveCard={saveCard}
        showImport={showImport}
        setShowImport={setShowImport}
        importFormat={importFormat}
        setImportFormat={setImportFormat}
        importText={importText}
        setImportText={setImportText}
        importNotes={importNotes}
        notes={importedNotes}
      />
    </div>
  )
}

function FeedbackCard({ step, feedback }) {
  const isTranslation = step.id === 'translation'
  const isOutline = step.id === 't2-outline'
  return (
    <Panel>
      <SectionTitle title="训练反馈" hint={isTranslation ? '只处理一个最值得改的句型问题' : '任务回应与逻辑优先，语言其次；最多三处问题'} action={<Badge tone={feedback.mock ? 'warning' : 'success'}>{feedback.mock ? '模拟反馈' : '模型反馈'}</Badge>} />
      {isTranslation ? (
        <div className="space-y-2 text-xs leading-6 text-fg-muted">
          <p>{feedback.feedback}</p>
          {feedback.revision && <div className="rounded-lg bg-surface p-3"><p className="text-[11px] font-bold text-fg">更自然的版本</p><p>{feedback.revision}</p></div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`grid gap-2 ${isOutline ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <div className="rounded-lg bg-surface p-3 text-xs leading-5 text-fg-muted"><strong className="text-fg">任务回应</strong><br />{feedback.taskResponse}</div>
            <div className="rounded-lg bg-surface p-3 text-xs leading-5 text-fg-muted"><strong className="text-fg">构思与衔接</strong><br />{feedback.coherence}</div>
            {!isOutline && <div className="rounded-lg bg-surface p-3 text-xs leading-5 text-fg-muted"><strong className="text-fg">语言</strong><br />{feedback.language}</div>}
          </div>
          {feedback.issues?.length > 0 && <div className="space-y-2">{feedback.issues.map((issue, index) => <div key={index} className="rounded-lg border border-border-soft bg-surface p-3 text-xs leading-6"><p className="text-fg-muted"><strong className="text-fg">原句：</strong>{issue.original}</p><p className="text-fg-muted"><strong className="text-fg">改法：</strong>{issue.revision}</p><p className="text-fg-muted"><strong className="text-fg">原因：</strong>{issue.reason}</p></div>)}</div>}
          {feedback.expressions?.length > 0 && <div><p className="mb-1 text-[11px] font-bold text-fg">考场可用表达</p><div className="flex flex-wrap gap-1.5">{feedback.expressions.map(expression => <Badge key={expression} tone="accent">{expression}</Badge>)}</div></div>}
          {feedback.wordCountWarning && <Notice tone="warning">{feedback.wordCountWarning}</Notice>}
          <div className="rounded-lg bg-surface p-3 text-xs text-fg-muted">估算 Band：<strong className="text-fg">{feedback.estimatedBand > 0 ? feedback.estimatedBand.toFixed(1) : '未估分'}</strong> <span className="text-fg-faint">（估算，非官方成绩）</span></div>
          {feedback.disclaimer && <p className="text-[10px] text-fg-faint">{feedback.disclaimer}</p>}
        </div>
      )}
    </Panel>
  )
}

function ModalKnowledge({ open, onClose, relevant, search, setSearch, editingCard, setEditingCard, editingContent, setEditingContent, saveCard, showImport, setShowImport, importFormat, setImportFormat, importText, setImportText, importNotes, notes }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="写作知识卡片">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-2xl border border-border-strong bg-bg-elev shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5"><div><h2 className="text-sm font-bold text-fg">写作知识卡片</h2><p className="text-[10px] text-fg-faint">内置内容为原创，可编辑；导入笔记与内置内容一起搜索。</p></div><button className="icon-btn" onClick={onClose} aria-label="关闭">×</button></div>
        <div className="max-h-[76vh] overflow-y-auto p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <TextInput value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索标题、正文、例句或导入笔记" />
            <Button variant="subtle" className="shrink-0 text-xs" onClick={() => setShowImport(value => !value)}>{showImport ? '收起导入' : '导入 Markdown / JSON'}</Button>
          </div>
          {showImport && (
            <div className="mb-4 rounded-xl border border-border-soft bg-surface p-3">
              <Select value={importFormat} onChange={event => setImportFormat(event.target.value)} className="mb-2"><option value="markdown">Markdown</option><option value="json">JSON</option></Select>
              <TextArea rows={5} value={importText} onChange={event => setImportText(event.target.value)} placeholder={importFormat === 'json' ? '[{"title":"我的笔记","content":"…"}]' : '# 我的笔记\n…'} />
              <Button className="mt-2 text-xs" onClick={importNotes}>导入到本地笔记</Button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {relevant.cards.map(card => (
              <article key={card.id} className="rounded-xl border border-border-soft bg-surface p-3.5">
                <div className="flex items-start justify-between gap-2"><div><Badge tone="accent">{card.section}</Badge><h3 className="mt-2 text-sm font-bold text-fg">{card.title}</h3></div><span className="text-[9px] text-fg-faint">{card.source}</span></div>
                {editingCard === card.id ? <><TextArea rows={6} className="mt-2" value={editingContent} onChange={event => setEditingContent(event.target.value)} /><div className="mt-2 flex gap-2"><Button className="text-xs" onClick={() => saveCard(card.id)}>保存修订</Button><Button variant="ghost" className="text-xs" onClick={() => setEditingCard('')}>取消</Button></div></> : <><p className="mt-2 text-xs leading-6 text-fg-muted">{card.content}</p><div className="mt-2 flex flex-wrap gap-1.5">{card.examples.map(example => <Badge key={example} tone="neutral">{example}</Badge>)}</div><button className="mt-2 text-[10px] text-accent" onClick={() => { setEditingCard(card.id); setEditingContent(card.content) }}>编辑这张卡片</button></>}
              </article>
            ))}
            {relevant.notes.map(note => <article key={note.id} className="rounded-xl border border-info/25 bg-info/5 p-3.5"><Badge tone="info">我的导入</Badge><h3 className="mt-2 text-sm font-bold text-fg">{note.title}</h3><div className="mt-2"><MarkdownText text={note.content} /></div></article>)}
          </div>
          {notes.length > 0 && <p className="mt-3 text-[10px] text-fg-faint">当前共有 {notes.length} 条导入笔记，均只保存在本机浏览器。</p>}
          {relevant.cards.length === 0 && relevant.notes.length === 0 && <p className="py-8 text-center text-xs text-fg-faint">没有匹配的内容。</p>}
        </div>
      </div>
    </div>
  )
}
