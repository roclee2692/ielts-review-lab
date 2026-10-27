import { useState } from 'react'
import { READING_CAUSES, READING_QUICK_TAGS, TYPE_LABELS } from '../data/causes.js'
import { Badge, Button, Field, Notice, Panel, TextArea, TextInput } from './ui.jsx'

const EVIDENCE_TONE = { 直接对应: 'success', 需逻辑推导: 'info', 证据不完整: 'warning' }

/** @param {any} value */
const keyText = value => (Array.isArray(value) ? value.join(', ') : String(value ?? ''))

/**
 * 一道题的复盘：先说你当时的处境 → 讲题（从你卡住的地方讲起）→ 接着聊。
 * state 是这道题在页面里的全部状态（处境、错因、讲解、对话）。
 */
export default function ReadingQuestionCard({ result, state = {}, hasPassage, busy, onSituation, onCause, onExplain, onFollowup, onAddReplacement }) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(!result.correct)
  const explanation = state.meta ? state : null
  const tags = state.situationTags || []
  const messages = state.messages || []
  const cause = state.cause || result.ruleCause || ''

  const toggleTag = (/** @type {any} */ tag) => {
    const next = tags.includes(tag.id) ? tags.filter(id => id !== tag.id) : [...tags, tag.id]
    // The first tag also proposes a cause, unless the rule or the learner already set one.
    const proposeCause = !result.correct && !result.ruleCause && state.causeBasis !== 'user' && next.length > 0 && !tags.includes(tag.id) ? tag.cause : ''
    onSituation(next, state.situationText || '', proposeCause)
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    onFollowup(text)
  }

  return (
    <Panel className={result.correct ? 'border-success/20' : 'border-danger/25'}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${result.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{result.number}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={result.correct ? 'success' : 'danger'}>{result.correct ? '正确' : '错误'}</Badge>
            <Badge>{TYPE_LABELS[result.type] || result.type}</Badge>
            {result.ruleCause && <Badge tone="warning">规则判定：{result.ruleCause}</Badge>}
            {result.mineUnknown && <Badge tone="warning">没记录你的答案</Badge>}
            {result.correct && <Button variant="ghost" className="ml-auto px-2 py-1 text-[11px]" onClick={() => setOpen(!open)}>{open ? '收起' : '这题也想讲讲'}</Button>}
          </div>
          {result.prompt && <p className="mt-2 text-sm font-semibold leading-6 text-fg">{result.prompt}</p>}
          {(result.options || []).length > 0 && <div className="mt-1 grid gap-0.5 text-xs text-fg-muted sm:grid-cols-2">{result.options.map((/** @type {string} */ option) => <span key={option}>{option}</span>)}</div>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-surface px-2.5 py-1.5 text-fg-muted">你的答案 <strong className="text-fg">{result.userAnswer || '—'}</strong></span>
            <span className="rounded-lg bg-surface px-2.5 py-1.5 text-fg-muted">答案册 <strong className="text-fg">{keyText(result.key)}</strong></span>
          </div>

          {open && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-border-soft bg-surface p-3">
                <p className="text-[11px] font-bold text-fg">① 你做这题时是什么情况？<span className="font-normal text-fg-faint">（点一个或几个，讲题会从这里讲起）</span></p>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`第 ${result.number} 题做题处境`}>
                  {READING_QUICK_TAGS.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={tags.includes(tag.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${tags.includes(tag.id) ? 'border-accent-border bg-accent-soft text-accent' : 'border-border-soft text-fg-muted hover:text-fg'}`}
                      onClick={() => toggleTag(tag)}
                    >{tag.label}</button>
                  ))}
                </div>
                <TextArea
                  rows={2}
                  className="mt-2"
                  aria-label={`第 ${result.number} 题我当时怎么想的`}
                  value={state.situationText || ''}
                  onChange={event => onSituation(tags, event.target.value, '')}
                  placeholder="补一句你当时怎么想的（可选）：比如“我以为 subsidies 就是给穷人的”"
                />
                {!result.correct && (
                  <Field label={state.causeBasis === 'tag' ? '错因（按你点的处境推的，可改）' : '错因（你定，模型只补充）'} className="mt-2 max-w-sm">
                    <select aria-label={`第 ${result.number} 题错因`} className="w-full rounded-lg border border-border-soft bg-bg px-2 py-1.5 text-xs text-fg" value={cause} onChange={event => onCause(event.target.value)}>
                      <option value="">待归类</option>
                      {READING_CAUSES.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                )}
              </div>

              <Button variant={explanation ? 'subtle' : 'primary'} className="text-xs" onClick={onExplain} disabled={busy}>
                {busy ? '讲解生成中…' : explanation ? '重新讲这题' : '② 讲这题'}
              </Button>
              {!hasPassage && !explanation && <p className="text-[11px] text-fg-faint">没有原文：讲解无法逐字校验，会标出来。</p>}

              {explanation && <Explanation explanation={explanation} result={result} onAddReplacement={onAddReplacement} />}

              {explanation && (
                <div className="rounded-xl border border-border-soft bg-bg p-3">
                  <p className="text-[11px] font-bold text-fg">③ 接着聊这题</p>
                  {explanation.askUser && messages.length === 0 && <Bubble role="assistant" text={explanation.askUser} />}
                  <div className="mt-2 space-y-2">
                    {messages.map((/** @type {any} */ message, index) => (
                      <Bubble key={index} role={message.role} text={message.text} quotes={message.evidenceQuotes} verified={message.evidenceVerified} uncertain={message.uncertain} mock={message.mock} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <TextInput aria-label={`第 ${result.number} 题追问`} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) send() }} placeholder="比如：我当时以为 mitigate 是完全消除，为什么不对？" />
                    <Button variant="subtle" className="shrink-0 text-xs" onClick={send} disabled={busy || !draft.trim()}>{busy ? '回答中…' : '发送'}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

function Bubble({ role, text, quotes = [], verified, uncertain, mock }) {
  const mine = role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-6 ${mine ? 'bg-accent-soft text-fg' : 'bg-surface text-fg-muted'}`}>
        {!mine && (mock || uncertain || verified === false) && (
          <div className="mb-1 flex flex-wrap gap-1">
            {mock && <Badge tone="warning">模拟反馈</Badge>}
            {uncertain && <Badge tone="warning">原文证据不足</Badge>}
            {verified === false && <Badge tone="danger">引用不在原文里</Badge>}
          </div>
        )}
        <p className="whitespace-pre-wrap">{text}</p>
        {quotes.map((/** @type {string} */ quote) => <p key={quote} className="mt-1 border-l-2 border-border-strong pl-2 text-[11px] italic text-fg-faint">“{quote}”</p>)}
      </div>
    </div>
  )
}

function Explanation({ explanation, result, onAddReplacement }) {
  const pairs = explanation.synonymPairs || []
  const breakdown = explanation.sentenceBreakdown || []
  const vocab = explanation.vocab || []
  return (
    <div className="space-y-3 rounded-xl border border-border-soft bg-surface-mid p-3.5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={explanation.mock ? 'warning' : 'info'}>{explanation.mock ? '模拟反馈（未调用模型）' : '模型讲解'}</Badge>
        {!result.correct && <Badge tone={explanation.causeBasis === 'rule' ? 'success' : explanation.causeBasis === 'user' ? 'accent' : 'warning'}>{explanation.causeBasis === 'rule' ? '规则判定错因' : explanation.causeBasis === 'user' ? '你确认的错因' : explanation.causeBasis === 'tag' ? '按你点的处境' : '模型建议错因'}：{explanation.cause}</Badge>}
        {explanation.noPassage
          ? <Badge tone="warning">没有原文 · 无法校验</Badge>
          : <Badge tone={explanation.evidenceVerified ? 'success' : 'danger'}>{explanation.evidenceVerified ? '引用已逐字校验' : '讲解不可靠'}</Badge>}
      </div>
      {!explanation.noPassage && !explanation.evidenceVerified && <Notice tone="danger" title="讲解不可靠">模型给的引用有不在你原文里的：{(explanation.evidenceMissing || []).join(' / ')}。不要把它当结论，可以重讲。</Notice>}
      {explanation.uncertainty && <Notice tone="warning" title="证据不足 / 不确定的地方">{explanation.uncertainty}</Notice>}

      <Section title="题干在问什么">{explanation.stemReading}</Section>
      <Section title="原文在哪、怎么找过去">{explanation.locateRoute}</Section>
      {explanation.locationQuote && <blockquote className="border-l-2 border-accent pl-3 text-xs italic leading-6 text-fg-muted">“{explanation.locationQuote}”<span className="mt-1 block not-italic text-[10px] text-fg-faint">{explanation.locationHint}</span></blockquote>}
      {breakdown.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-fg">句子拆开看</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {breakdown.map((/** @type {any} */ item, index) => <div key={index} className="rounded-lg bg-surface px-2.5 py-1.5 text-xs"><span className="text-fg">{item.chunk}</span><span className="text-fg-faint"> · {item.meaning}</span></div>)}
          </div>
        </div>
      )}
      {pairs.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-fg">同义替换</p>
          <div className="space-y-1.5">
            {pairs.map((/** @type {any} */ pair, index) => (
              <div key={`${pair.question}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs">
                <span className="min-w-0"><strong>{pair.question}</strong> ↔ {pair.passage}{pair.note && <span className="block text-[11px] text-fg-faint">{pair.note}</span>}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {pair.mechanism && <Badge>{pair.mechanism}</Badge>}
                  {pair.evidence && <Badge tone={EVIDENCE_TONE[pair.evidence] || 'neutral'}>{pair.evidence}</Badge>}
                  <Button variant="subtle" className="px-2 py-1 text-[10px]" onClick={() => onAddReplacement(pair)}>收入替换库</Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="为什么答案册是这个">{explanation.whyKeyCorrect}</Section>
        {!result.correct && <Section title="你的答案差在哪">{explanation.whyUserWrong}</Section>}
      </div>
      <Section title="从你当时的角度看">{explanation.fromYourView}</Section>
      {explanation.methodTip && <Notice tone="success" title="下次这样做">{explanation.methodTip}</Notice>}
      {vocab.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-fg">难词短语</p>
          <div className="flex flex-wrap gap-1.5">{vocab.map((/** @type {any} */ item) => <Badge key={item.en} tone={item.priority === '高价值' ? 'accent' : 'neutral'}>{item.en} · {item.zh}</Badge>)}</div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  if (!children) return null
  return <div><p className="text-[11px] font-bold text-fg">{title}</p><p className="mt-1 text-xs leading-6 text-fg-muted">{children}</p></div>
}
