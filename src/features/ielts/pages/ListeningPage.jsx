import { useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { rawToBand, verifyEvidence } from '../core/index.js'
import { LISTENING_CAUSES, LISTENING_QUICK_TAGS, TYPE_LABELS } from '../data/causes.js'
import { SAMPLE_LISTENING } from '../data/samples.js'
import { evaluateQuestions, mistakeFromResult, reviewStats, seriesKey } from '../domain/review.js'
import { addMistakeRecords, updateMistakeRecord } from '../../../services/storage/MistakesStore.js'
import { getActiveMethod, loadReviewSummaries, saveReviewSummary } from '../storage.js'
import MethodCard from '../components/MethodCard.jsx'
import ThreeBoxEntry from '../components/ThreeBoxEntry.jsx'
import PracticeTimer from '../components/PracticeTimer.jsx'
import { Badge, Button, Field, Notice, PageHeader, Panel, SectionTitle, SettingsLink, TextArea } from '../components/ui.jsx'

/** The original sample as three boxes, so "载入原创示例" shows the real entry flow. */
function sampleBoxes() {
  const gaps = SAMPLE_LISTENING.questions.filter(question => question.type === 'gap')
  const choice = SAMPLE_LISTENING.questions.filter(question => question.type !== 'gap')
  const questionsText = [
    `Questions 1-${gaps.length}`,
    'Write ONE WORD AND/OR A NUMBER for each answer.',
    ...gaps.map(question => `${question.number} ${question.prompt}`),
    ...choice.flatMap(question => [`Question ${question.number}`, 'Choose the correct letter.', `${question.number} ${question.prompt}`, ...(question.options || [])]),
  ].join('\n')
  const answersText = SAMPLE_LISTENING.questions.map(question => `${question.number} ${question.key} | ${question.userAnswer}`).join('\n')
  return { source: SAMPLE_LISTENING.source, text: SAMPLE_LISTENING.transcript, questionsText, answersText }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `listening-${crypto.randomUUID()}`
  return `listening-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ListeningPage() {
  const { settings, requestModel, refreshRecords, addReplacement } = useIelts()
  const method = useMemo(() => getActiveMethod('listening'), [])
  const [started, setStarted] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [review, setReview] = useState(null)
  const [results, setResults] = useState([])
  const [explanations, setExplanations] = useState({})
  const [reflections, setReflections] = useState({})
  const [summary, setSummary] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const stats = useMemo(() => reviewStats(results.map(result => ({ ...result, cause: explanations[result.id]?.cause || result.cause }))), [results, explanations])

  const persistRecords = (nextExplanations = explanations, currentResults = results, currentReview = review, nextReflections = reflections) => {
    if (!currentReview) return
    const records = currentResults.filter(result => !result.correct).map(result => mistakeFromResult(
      { ...currentReview, reflections: nextReflections },
      result,
      nextExplanations[result.id],
    ))
    if (records.length) addMistakeRecords(records)
    refreshRecords()
  }

  const startReview = ({ source, elapsedMinutes, text, questions, saveFullSource }) => {
    const evaluated = evaluateQuestions(questions)
    const computed = reviewStats(evaluated)
    const nextReview = {
      id: newId(), module: 'listening', source: source || '未标注来源', createdAt: Date.now(),
      saveFullSource, fullSource: text,
      elapsedSeconds: elapsedMinutes ? Number(elapsedMinutes) * 60 : 0,
      methodId: method?.id || '',
      ...computed,
    }
    // The original sample ships with example reflections; map them onto this run's question ids.
    const sampleReflections = source === SAMPLE_LISTENING.source
      ? Object.fromEntries(evaluated.map(result => {
        const original = SAMPLE_LISTENING.questions.find(question => String(question.number) === String(result.number))
        return [result.id, SAMPLE_LISTENING.reflections[original?.id] || '']
      }).filter(([, text]) => text))
      : {}
    setTranscript(text)
    setReview(nextReview)
    setResults(evaluated)
    setExplanations({})
    setReflections(sampleReflections)
    setSummary(null)
    setStarted(true)
    setError('')
    saveReviewSummary(nextReview)
    const records = evaluated.filter(result => !result.correct).map(result => mistakeFromResult({ ...nextReview, reflections: sampleReflections }, result, null))
    if (records.length) addMistakeRecords(records)
    refreshRecords()
  }

  const explainQuestion = async result => {
    setBusyId(result.id)
    const response = await requestModel('ielts.listening.explain', {
      transcript,
      question: result.prompt,
      answerKey: Array.isArray(result.key) ? result.key.join(', ') : result.key,
      userAnswer: result.userAnswer || '(未作答)',
      instruction: result.instruction || '',
      reflection: reflections[result.id] || '',
      ruleErrors: result.errors,
      strictness: settings.strictness,
    })
    setBusyId('')
    if (!response) return
    const data = response.data
    const evidenceQuotes = [data.locationQuote, ...(data.signals || [])]
    const verification = verifyEvidence(transcript, evidenceQuotes)
    const previous = explanations[result.id] || {}
    const userPicked = !result.ruleCause && previous.causeBasis === 'user' && previous.cause
    const cause = result.ruleCause || (userPicked ? previous.cause : data.cause) || '待归类'
    const next = {
      ...data,
      quickTag: previous.quickTag,
      modelCause: data.cause,
      cause,
      causeBasis: result.ruleCause ? 'rule' : userPicked ? 'user' : (String(reflections[result.id] || '').trim() ? 'inference' : data.causeBasis || 'model'),
      evidenceVerified: verification.ok,
      mock: response.meta.mock,
      meta: response.meta,
    }
    const map = { ...explanations, [result.id]: next }
    setExplanations(map)
    persistRecords(map)
  }

  const saveReflection = result => {
    persistRecords(explanations, results, review, reflections)
    const existing = explanations[result.id]
    if (existing) updateMistakeRecord(`ielts:${review.id}:${result.id}`, { reflection: reflections[result.id] || '' })
    refreshRecords()
  }

  const setCause = (result, cause, basis = '') => {
    const current = explanations[result.id] || { causeBasis: result.ruleCause ? 'rule' : 'user' }
    const map = { ...explanations, [result.id]: { ...current, cause, ...(basis ? { causeBasis: basis } : {}) } }
    setExplanations(map)
    persistRecords(map)
  }

  const generateSummary = async () => {
    setBusyId('summary')
    const response = await requestModel('ielts.review.summary', {
      module: 'listening', source: review.source,
      results: results.map(result => ({
        number: result.number, type: result.type, correct: result.correct,
        userAnswer: result.userAnswer, answerKey: result.key,
        cause: explanations[result.id]?.cause || result.ruleCause || '',
      })),
      strictness: settings.strictness,
    })
    setBusyId('')
    if (response) setSummary({ ...response.data, mock: response.meta.mock })
  }

  if (started) {
    const availableBand = (() => {
      if (review.source === '未标注来源' || review.source === '原创示例，非真题') return null
      const key = seriesKey(review.source)
      const group = loadReviewSummaries().filter(item => item.module === 'listening' && seriesKey(item.source) === key)
      if (new Set(group.map(item => item.id)).size < 4) return null
      const total = group.reduce((sum, item) => sum + item.total, 0)
      const raw = group.reduce((sum, item) => sum + item.correct, 0)
      if (total < 37) return null
      return { raw, total, band: rawToBand('listening', raw) }
    })()
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="LISTENING REVIEW"
          title={review.source}
          description={`Part 复盘 · ${stats.total} 题 · 对 ${stats.correct} · 错 ${stats.wrong}`}
          actions={<Button variant="ghost" onClick={() => { setStarted(false); setReview(null) }}>重新录入</Button>}
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {results.map(result => {
              // A user-picked cause alone is not a model explanation; only render the explanation card once the model (or mock) answered.
              const explanation = explanations[result.id]?.meta ? explanations[result.id] : null
              return (
                <Panel key={result.id} className={result.correct ? 'border-success/20' : 'border-danger/20'}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${result.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{result.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={result.correct ? 'success' : 'danger'}>{result.correct ? '正确' : '错误'}</Badge>
                        <Badge>{TYPE_LABELS[result.type]}</Badge>
                        {result.ruleCause && <Badge tone="warning">规则判定：{result.ruleCause}</Badge>}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-fg">{result.prompt}</p>
                      {(result.options || []).length > 0 && <div className="mt-2 grid gap-1 text-xs text-fg-muted sm:grid-cols-2">{result.options.map(option => <span key={option}>{option}</span>)}</div>}
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg bg-surface px-3 py-2 text-fg-muted">你的答案：<strong className="text-fg">{result.userAnswer || '未作答'}</strong></div>
                        <div className="rounded-lg bg-surface px-3 py-2 text-fg-muted">答案册：<strong className="text-fg">{Array.isArray(result.key) ? result.key.join(', ') : result.key}</strong></div>
                      </div>
                      {!result.correct && (
                        <div className="mt-3 rounded-lg border border-border-soft bg-surface p-2.5">
                          <Field label="我的反思（可用语音转文字，中文可）" hint="例如：听成了 fifteen / 没反应过来他改口了 / 这个词不认识。">
                            <TextArea rows={2} value={reflections[result.id] || ''} onChange={event => setReflections(previous => ({ ...previous, [result.id]: event.target.value }))} placeholder="当时到底发生了什么？" />
                          </Field>
                          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="快捷反思标签">
                            {LISTENING_QUICK_TAGS.map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${explanations[result.id]?.quickTag === tag.id ? 'border-accent-border bg-accent-soft text-accent' : 'border-border-soft text-fg-muted hover:text-fg'}`}
                                onClick={() => {
                                  const text = String(reflections[result.id] || '')
                                  const nextReflections = { ...reflections, [result.id]: text.includes(tag.reflection) ? text : `${text}${text ? ' ' : ''}${tag.reflection}` }
                                  setReflections(nextReflections)
                                  const current = explanations[result.id] || {}
                                  const keepRule = !!result.ruleCause
                                  const map = { ...explanations, [result.id]: { ...current, quickTag: tag.id, cause: keepRule ? result.ruleCause : tag.cause, causeBasis: keepRule ? 'rule' : 'user' } }
                                  setExplanations(map)
                                  persistRecords(map, results, review, nextReflections)
                                }}
                              >{tag.label}</button>
                            ))}
                          </div>
                          {!explanation && (
                            <Field label="错因（你来定，模型只补充）" className="mt-2">
                              <select aria-label={`第 ${result.number} 题错因`} className="w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={explanations[result.id]?.cause || result.ruleCause || ''} onChange={event => setCause(result, event.target.value, 'user')}>
                                <option value="">待归类</option>
                                {LISTENING_CAUSES.map(cause => <option key={cause}>{cause}</option>)}
                              </select>
                            </Field>
                          )}
                          <Button variant="ghost" className="mt-2 text-[11px]" onClick={() => saveReflection(result)}>保存反思</Button>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant={explanation ? 'subtle' : 'primary'} className="text-xs" onClick={() => explainQuestion(result)} disabled={busyId === result.id}>{busyId === result.id ? '生成中…' : explanation ? '重新生成讲解' : result.correct ? '打开对题讲解' : '生成错题讲解'}</Button>
                      </div>
                      {explanation && (
                        <div className="mt-4 space-y-3 rounded-xl border border-border-soft bg-surface-mid p-3.5">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={explanation.mock ? 'warning' : 'info'}>{explanation.mock ? '模拟反馈（未调用模型）' : '模型讲解'}</Badge>
                            <Badge tone={explanation.causeBasis === 'rule' ? 'success' : explanation.causeBasis === 'inference' ? 'warning' : 'info'}>{explanation.causeBasis === 'rule' ? '规则判定' : explanation.causeBasis === 'user' ? '你确认的错因' : explanation.causeBasis === 'inference' ? '推断' : '模型建议'}</Badge>
                            <Badge tone={explanation.evidenceVerified ? 'success' : 'danger'}>{explanation.evidenceVerified ? '文稿定位已校验' : '讲解不可靠'}</Badge>
                          </div>
                          {!explanation.evidenceVerified && <Notice tone="danger" title="讲解不可靠">定位句不是文稿原文子串，不能作为可靠结论。请重试。</Notice>}
                          {explanation.locationQuote && <blockquote className="border-l-2 border-accent pl-3 text-xs italic leading-6 text-fg-muted">“{explanation.locationQuote}”<span className="mt-1 block not-italic text-[10px] text-fg-faint">{explanation.locationHint}</span></blockquote>}
                          {explanation.causeBasis === 'inference' && <Notice tone="warning" title="推断依据">{explanation.inferenceNote || '该错因来自你的反思与文稿线索，仍只能视为推断；发音、连读和语调需以真实音频确认。'}</Notice>}
                          {explanation.signals?.length > 0 && <div className="flex flex-wrap gap-1.5">{explanation.signals.map(signal => <Badge key={signal} tone="info">{signal}</Badge>)}</div>}
                          {explanation.distraction && <div><p className="text-[11px] font-bold text-fg">干扰 / 改口</p><p className="mt-1 text-xs leading-6 text-fg-muted">{explanation.distraction}</p></div>}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div><p className="text-[11px] font-bold text-fg">为什么答案册正确</p><p className="mt-1 text-xs leading-6 text-fg-muted">{explanation.whyKeyCorrect}</p></div>
                            <div><p className="text-[11px] font-bold text-fg">为什么你的答案错</p><p className="mt-1 text-xs leading-6 text-fg-muted">{explanation.whyUserWrong}</p></div>
                          </div>
                          {explanation.advice && <Notice tone="success" title="下次这样做">{explanation.advice}</Notice>}
                          {explanation.synonymPairs?.length > 0 && <div className="space-y-1.5">{explanation.synonymPairs.map((pair, index) => <div key={index} className="flex justify-between gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs"><span>{pair.question} ↔ {pair.passage}</span><Button variant="subtle" className="px-2 py-1 text-[10px]" onClick={() => addReplacement(pair)}>收入替换库</Button></div>)}</div>}
                          {!result.correct && (
                            <div className="flex flex-wrap items-end gap-2">
                              <Field label="错因（可修改）" className="min-w-52 flex-1">
                                <select className="w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={explanation.cause || ''} onChange={event => setCause(result, event.target.value, 'user')}>
                                  {LISTENING_CAUSES.map(cause => <option key={cause}>{cause}</option>)}
                                </select>
                              </Field>
                              {explanation.causeBasis === 'user' && explanation.modelCause && explanation.modelCause !== explanation.cause && <p className="text-[11px] text-fg-faint">模型建议：{explanation.modelCause}（已保留你的选择）</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              )
            })}
          </div>
          <aside className="space-y-4">
            <PracticeTimer minutes={10} label="一个 Part 复盘计时（可选）" />
            <Panel>
              <SectionTitle title="Part 小结" hint="数据来自逐题判题" />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-success/10 p-2"><p className="text-lg font-bold text-success">{stats.correct}</p><p className="text-[10px] text-fg-faint">答对</p></div>
                <div className="rounded-lg bg-danger/10 p-2"><p className="text-lg font-bold text-danger">{stats.wrong}</p><p className="text-[10px] text-fg-faint">答错</p></div>
              </div>
              {stats.causeShares.map(item => <div key={item.cause} className="mt-2"><div className="flex justify-between text-[10px] text-fg-muted"><span>{item.cause}</span><span>{item.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-strong"><div className="h-full rounded-full bg-warning" style={{ width: `${item.share * 100}%` }} /></div></div>)}
              <Button variant="subtle" className="mt-3 text-xs" onClick={generateSummary} disabled={busyId === 'summary'}>{busyId === 'summary' ? '生成中…' : '生成 Part 小结'}</Button>
              {summary && <div className="mt-3 space-y-2 border-t border-border-soft pt-3 text-xs leading-5 text-fg-muted"><Badge tone={summary.mock ? 'warning' : 'info'}>{summary.mock ? '模拟反馈' : '模型总结'}</Badge><p>{summary.overview}</p>{summary.nextActions?.map(action => <p key={action} className="rounded-lg bg-accent-soft px-2.5 py-2 text-fg">下次：{action}</p>)}</div>}
            </Panel>
            <Panel>
              <SectionTitle title="估算分数段" hint="同一套四个 Part 都录入后才显示" />
              {availableBand ? <p className="text-xs leading-6 text-fg-muted">本套原始分 {availableBand.raw}/{availableBand.total}，估算听力 Band <strong className="text-fg">{availableBand.band.toFixed(1)}</strong>。按公开换算锚点近似估算，不是官方成绩。</p> : <p className="text-xs leading-6 text-fg-muted">尚未集齐同一套四个 Part 的 37–40 题数据，因此不给出分数段，避免用不完整数据编造成绩。</p>}
            </Panel>
            <Notice tone={settings.apiKey ? 'info' : 'warning'} title={settings.apiKey ? '真实模型模式' : '未配置模型'}>
              {settings.apiKey ? '每次讲解前会展示将发送的文稿与答案。' : '判题、错题库、统计和计时不受影响；可选择模拟反馈完成演示。'}
              {!settings.apiKey && <div className="mt-2"><SettingsLink /></div>}
            </Notice>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="LISTENING REVIEW" title="听力复盘" description="按一个 Part 复盘。系统不播放、不处理音频：贴文稿、题目、答案，判题后结合你的反思找到当时发生了什么。" />
      {method && <MethodCard module="listening" method={method} />}
      {error && <Notice tone="danger">{error}</Notice>}
      <ThreeBoxEntry module="listening" sample={sampleBoxes()} onStart={startReview} />
      <div className="grid gap-4 md:grid-cols-2">
        <PracticeTimer minutes={10} label="一个 Part 复盘计时（可选）" />
        <Notice tone="warning" title="不处理音频">系统不会上传、播放或保存音频。语音转文字由你的输入法完成，再把文本粘贴到“我的反思”。</Notice>
      </div>
    </div>
  )
}
