import { useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { rawToBand, verifyEvidence } from '../core/index.js'
import { LISTENING_CAUSES, LISTENING_QUICK_TAGS, TYPE_LABELS } from '../data/causes.js'
import { SAMPLE_LISTENING } from '../data/samples.js'
import { parseReviewPaste } from '../domain/parse.js'
import { evaluateQuestions, mistakeFromResult, reviewStats, seriesKey } from '../domain/review.js'
import { addMistakeRecords, updateMistakeRecord } from '../../../services/storage/MistakesStore.js'
import { loadReviewSummaries, saveMaterial, saveReviewSummary } from '../storage.js'
import QuickEntry from '../components/QuickEntry.jsx'
import PracticeTimer from '../components/PracticeTimer.jsx'
import QuestionEditor from '../components/QuestionEditor.jsx'
import { Badge, Button, Field, Notice, PageHeader, Panel, SectionTitle, SettingsLink, TextArea, TextInput } from '../components/ui.jsx'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `listening-${crypto.randomUUID()}`
  return `listening-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ListeningPage() {
  const { settings, requestModel, refreshRecords, addReplacement } = useIelts()
  const [started, setStarted] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [source, setSource] = useState('')
  const [elapsedMinutes, setElapsedMinutes] = useState('')
  const [saveFullSource, setSaveFullSource] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(false)
  const [pasteQuestions, setPasteQuestions] = useState('')
  const [pasteAnswers, setPasteAnswers] = useState('')
  const [pasteUser, setPasteUser] = useState('')
  const [questions, setQuestions] = useState([])
  const [review, setReview] = useState(null)
  const [results, setResults] = useState([])
  const [explanations, setExplanations] = useState({})
  const [reflections, setReflections] = useState({})
  const [summary, setSummary] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const stats = useMemo(() => reviewStats(results.map(result => ({ ...result, cause: explanations[result.id]?.cause || result.cause }))), [results, explanations])

  const loadSample = () => {
    setTranscript(SAMPLE_LISTENING.transcript)
    setSource(SAMPLE_LISTENING.source)
    setQuestions(SAMPLE_LISTENING.questions.map(question => ({ ...question, options: [...(question.options || [])] })))
    setReflections({ ...SAMPLE_LISTENING.reflections })
    setPasteQuestions('')
    setPasteAnswers('')
    setPasteUser('')
  }

  const parsePaste = () => {
    const parsed = parseReviewPaste(pasteQuestions, pasteAnswers, pasteUser)
    if (!parsed.length) {
      setError('没有识别到编号题目，请确认每题以编号开头。')
      return
    }
    setQuestions(parsed)
    setError('')
  }

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

  const startReview = () => {
    if (!transcript.trim() || questions.length === 0) {
      setError('听力文稿和至少一道题是必填项。')
      return
    }
    if (questions.some(question => !String(question.key).trim())) {
      setError('每道题都需要答案册答案。')
      return
    }
    if (saveToLibrary) {
      try {
        saveMaterial({ module: 'listening', source, passage: transcript, questions })
      } catch (saveError) {
        setError(saveError.message)
        return
      }
    }
    const evaluated = evaluateQuestions(questions, Object.fromEntries(questions.map(question => [question.id, question.userAnswer || ''])))
    const createdAt = Date.now()
    const computed = reviewStats(evaluated)
    const nextReview = {
      id: newId(), module: 'listening', source: source.trim() || '未标注来源', createdAt,
      saveFullSource, fullSource: transcript,
      elapsedSeconds: elapsedMinutes ? Number(elapsedMinutes) * 60 : 0,
      ...computed,
    }
    setReview(nextReview)
    setResults(evaluated)
    setExplanations({})
    setSummary(null)
    setStarted(true)
    setError('')
    saveReviewSummary(nextReview)
    const records = evaluated.filter(result => !result.correct).map(result => mistakeFromResult({ ...nextReview, reflections }, result, null))
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
      <PageHeader
        eyebrow="LISTENING REVIEW"
        title="听力复盘"
        description="按一个 Part 复盘。系统不播放或处理音频；你只需录入听力文稿、题目、答案册和答案，再结合自己的反思定位当时发生了什么。"
        actions={<><Button variant="subtle" onClick={loadSample}>载入原创示例</Button><Badge tone="warning">原创示例非真题</Badge></>}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <div className="space-y-4">
          <QuickEntry
            module="listening"
            questions={questions}
            setQuestions={setQuestions}
            saveToLibrary={saveToLibrary}
            setSaveToLibrary={setSaveToLibrary}
            onLoadMaterial={material => {
              setSource(material.source)
              setTranscript(material.passage)
              setQuestions(material.questions.map(question => ({ ...question, userAnswer: '' })))
              setReflections({})
            }}
          />
          <Panel>
            <SectionTitle title="1 · 听力文稿与来源" hint="文稿逐字用于答案定位和证据校验。" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="来源标签"><TextInput value={source} onChange={event => setSource(event.target.value)} placeholder="例如：剑 18 Test 2 Part 3（仅你有权使用的材料）" /></Field>
              <Field label="实际用时（分钟，可选）"><TextInput type="number" min="0" value={elapsedMinutes} onChange={event => setElapsedMinutes(event.target.value)} placeholder="10" /></Field>
              <Field label="保存策略"><div className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-xs text-fg-muted">默认仅保留错题定位片段</div></Field>
            </div>
            <Field label="英文听力文稿" className="mt-3"><TextArea rows={8} value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="粘贴你有权使用的听力文稿。系统不处理音频。" /></Field>
            <label className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-fg-muted"><input type="checkbox" checked={saveFullSource} onChange={event => setSaveFullSource(event.target.checked)} className="mt-1" />保存完整听力文稿（可在设置中一键删除）。</label>
          </Panel>
          <Panel>
            <SectionTitle title="2 · 题目、答案与作答" hint="按 Part 的 10 题录入，支持整段粘贴自动拆题。" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="题目整段粘贴"><TextArea rows={5} value={pasteQuestions} onChange={event => setPasteQuestions(event.target.value)} placeholder={'1. The station opens at ______.\n2. …'} /></Field>
              <Field label="答案册整段粘贴"><TextArea rows={5} value={pasteAnswers} onChange={event => setPasteAnswers(event.target.value)} placeholder={'1. nine\n2. slot'} /></Field>
              <Field label="我的答案整段粘贴"><TextArea rows={5} value={pasteUser} onChange={event => setPasteUser(event.target.value)} placeholder={'1. eight\n2. slots'} /></Field>
            </div>
            <Button className="mt-3 text-xs" onClick={parsePaste}>智能拆题</Button>
            <div className="mt-4"><QuestionEditor questions={questions} setQuestions={setQuestions} /></div>
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel>
            <SectionTitle title="复盘单位" />
            <p className="text-xs leading-6 text-fg-muted">一个 Part 通常是 10 题。判题后，每道错题都可以补一段中文反思，模型会把它作为错因推断依据并标明“推断”。</p>
            <Button className="mt-3 w-full" onClick={startReview}>开始判题</Button>
            {questions.length === 0 && <p className="mt-2 text-[11px] text-fg-faint">可先载入原创示例体验完整流程。</p>}
          </Panel>
          <Notice tone="warning" title="不处理音频">系统不会上传、播放或保存音频。语音转文字由你的输入法完成，再把文本粘贴到“我的反思”。</Notice>
        </aside>
      </div>
    </div>
  )
}
