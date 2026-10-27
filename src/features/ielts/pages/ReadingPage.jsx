import { useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { verifyEvidence, rawToBand } from '../core/index.js'
import { READING_CAUSES, TYPE_LABELS } from '../data/causes.js'
import { SAMPLE_READING } from '../data/samples.js'
import { parseReviewPaste } from '../domain/parse.js'
import { evaluateQuestions, mistakeFromResult, reviewStats, seriesKey } from '../domain/review.js'
import { addMistakeRecords, deleteMistakeRecord } from '../../../services/storage/MistakesStore.js'
import { loadReviewSummaries, saveMaterial, saveReviewSummary } from '../storage.js'
import QuickEntry from '../components/QuickEntry.jsx'
import PracticeTimer from '../components/PracticeTimer.jsx'
import QuestionEditor from '../components/QuestionEditor.jsx'
import { Badge, Button, Field, Notice, PageHeader, Panel, SectionTitle, SettingsLink, TextArea, TextInput } from '../components/ui.jsx'

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sampleQuestions() {
  return SAMPLE_READING.questions.map(question => ({
    ...question,
    options: [...(question.options || [])],
    userAnswer: SAMPLE_READING.userAnswers[question.id] || '',
  }))
}

export default function ReadingPage() {
  const { settings, requestModel, refreshRecords, addReplacement } = useIelts()
  const [started, setStarted] = useState(false)
  const [passage, setPassage] = useState('')
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
  const [summary, setSummary] = useState(null)
  const [followups, setFollowups] = useState({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const stats = useMemo(() => reviewStats(results.map(result => ({ ...result, cause: explanations[result.id]?.cause || result.cause }))), [results, explanations])

  const loadSample = () => {
    setPassage(SAMPLE_READING.passage)
    setSource(SAMPLE_READING.source)
    setQuestions(sampleQuestions())
    setPasteQuestions('')
    setPasteAnswers('')
    setPasteUser('')
  }

  const parsePaste = () => {
    const parsed = parseReviewPaste(pasteQuestions, pasteAnswers, pasteUser)
    if (parsed.length === 0) {
      setError('没有识别到编号题目。请确认每题以 1. / 2. 这样的编号开头。')
      return
    }
    setQuestions(parsed)
    setError('')
  }

  const persistWrongRecords = (nextExplanations = explanations, nextResults = results, currentReview = review) => {
    if (!currentReview) return
    const records = nextResults.filter(result => !result.correct).map(result => {
      const explanation = nextExplanations[result.id]
      return mistakeFromResult(currentReview, result, explanation)
    })
    if (records.length) addMistakeRecords(records)
    refreshRecords()
  }

  const startReview = () => {
    if (!passage.trim() || questions.length === 0) {
      setError('原文和至少一道题是必填项。')
      return
    }
    if (questions.some(question => !String(question.key).trim())) {
      setError('每道题都需要答案册答案；没有答案无法进行确定性判题。')
      return
    }
    if (saveToLibrary) {
      try {
        saveMaterial({ module: 'reading', source, passage, questions })
      } catch (saveError) {
        setError(saveError.message)
        return
      }
    }
    const answers = Object.fromEntries(questions.map(question => [question.id, question.userAnswer || '']))
    const evaluated = evaluateQuestions(questions, answers)
    const reviewId = newId('reading')
    const createdAt = Date.now()
    const computed = reviewStats(evaluated)
    const nextReview = {
      id: reviewId,
      module: 'reading',
      source: source.trim() || '未标注来源',
      createdAt,
      saveFullSource,
      fullSource: passage,
      elapsedSeconds: elapsedMinutes ? Number(elapsedMinutes) * 60 : 0,
      ...computed,
    }
    setReview(nextReview)
    setResults(evaluated)
    setExplanations({})
    setSummary(null)
    setStarted(true)
    setError('')
    saveReviewSummary({ ...nextReview, total: computed.total, correct: computed.correct, wrong: computed.wrong })
    const records = evaluated.filter(result => !result.correct).map(result => mistakeFromResult(nextReview, result, null))
    if (records.length) addMistakeRecords(records)
    refreshRecords()
  }

  const explainQuestion = async result => {
    setBusyId(result.id)
    setError('')
    const response = await requestModel('ielts.reading.explain', {
      passage,
      question: result.prompt,
      answerKey: Array.isArray(result.key) ? result.key.join(', ') : result.key,
      userAnswer: result.userAnswer || '(未作答)',
      questionType: TYPE_LABELS[result.type] || result.type,
      instruction: result.instruction || '',
      ruleErrors: result.errors,
      strictness: settings.strictness,
    })
    setBusyId('')
    if (!response) return
    const data = response.data
    const evidenceQuotes = [data.locationQuote, ...(data.synonymPairs || []).map(pair => pair.passage)]
    const verification = verifyEvidence(passage, evidenceQuotes)
    const previous = explanations[result.id] || {}
    const userPicked = !result.ruleCause && previous.causeBasis === 'user' && previous.cause
    const cause = result.ruleCause || (userPicked ? previous.cause : data.cause) || '待归类'
    const next = {
      ...data,
      modelCause: data.cause,
      cause,
      causeBasis: result.ruleCause ? 'rule' : userPicked ? 'user' : (data.causeBasis || 'model'),
      evidenceVerified: verification.ok,
      evidenceMissing: verification.missing,
      mock: response.meta.mock,
      meta: response.meta,
    }
    const map = { ...explanations, [result.id]: next }
    setExplanations(map)
    persistWrongRecords(map)
  }

  const setCause = (result, cause, basis = '') => {
    const current = explanations[result.id] || { causeBasis: result.ruleCause ? 'rule' : 'user' }
    const map = { ...explanations, [result.id]: { ...current, cause, ...(basis ? { causeBasis: basis } : {}) } }
    setExplanations(map)
    persistWrongRecords(map)
  }

  const generateSummary = async () => {
    setBusyId('summary')
    const response = await requestModel('ielts.review.summary', {
      module: 'reading',
      source: review.source,
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

  const askFollowup = async result => {
    const followup = String(followups[result.id] || '').trim()
    if (!followup) return
    setBusyId(`follow-${result.id}`)
    const response = await requestModel('ielts.reading.followup', {
      passage,
      question: result.prompt,
      answerKey: Array.isArray(result.key) ? result.key.join(', ') : result.key,
      userAnswer: result.userAnswer || '',
      history: explanations[result.id] || {},
      followup,
    })
    setBusyId('')
    if (!response) return
    const verification = verifyEvidence(passage, response.data.evidenceQuotes)
    setFollowups(previous => ({
      ...previous,
      [result.id]: { ...response.data, mock: response.meta.mock, evidenceVerified: verification.ok },
    }))
  }

  if (started) {
    const availableBand = (() => {
      if (review.source === '未标注来源' || review.source === '原创示例，非真题') return null
      const key = seriesKey(review.source)
      const group = loadReviewSummaries().filter(item => item.module === 'reading' && seriesKey(item.source) === key)
      if (new Set(group.map(item => item.id)).size < 3) return null
      const total = group.reduce((sum, item) => sum + item.total, 0)
      const raw = group.reduce((sum, item) => sum + item.correct, 0)
      if (total < 37) return null
      return { raw, total, band: rawToBand('reading-academic', raw) }
    })()

    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="READING REVIEW"
          title={review.source}
          description={`${stats.total} 题 · 对 ${stats.correct} · 错 ${stats.wrong} · 规则判题已完成`}
          actions={<Button variant="ghost" onClick={() => { setStarted(false); setReview(null) }}>重新录入</Button>}
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {results.map(result => {
              const explanation = explanations[result.id]?.meta ? explanations[result.id] : null
              const isBusy = busyId === result.id
              return (
                <Panel key={result.id} className={result.correct ? 'border-success/20' : 'border-danger/20'}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${result.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{result.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                      {!result.correct && !explanation && (
                        <Field label="错因（你来定，模型只补充）" className="mt-3 max-w-sm">
                          <select aria-label={`第 ${result.number} 题错因`} className="w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={explanations[result.id]?.cause || result.ruleCause || ''} onChange={event => setCause(result, event.target.value, 'user')}>
                            <option value="">待归类</option>
                            {READING_CAUSES.map(cause => <option key={cause}>{cause}</option>)}
                          </select>
                        </Field>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant={explanation ? 'subtle' : 'primary'} className="text-xs" onClick={() => explainQuestion(result)} disabled={isBusy}>
                          {isBusy ? '生成中…' : explanation ? '重新生成讲解' : result.correct ? '打开对题讲解' : '生成错题讲解'}
                        </Button>
                      </div>
                      {explanation && (
                        <div className="mt-4 space-y-3 rounded-xl border border-border-soft bg-surface-mid p-3.5">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={explanation.mock ? 'warning' : 'info'}>{explanation.mock ? '模拟反馈（未调用模型）' : '模型讲解'}</Badge>
                            <Badge tone={explanation.causeBasis === 'rule' ? 'success' : 'warning'}>{explanation.causeBasis === 'rule' ? '规则判定错因' : explanation.causeBasis === 'user' ? '你确认的错因' : '模型建议错因'}</Badge>
                            <Badge tone={explanation.evidenceVerified ? 'success' : 'danger'}>{explanation.evidenceVerified ? '定位已逐字校验' : '讲解不可靠'}</Badge>
                          </div>
                          {!explanation.evidenceVerified && <Notice tone="danger" title="讲解不可靠">模型给出的定位句不在你粘贴的原文中，因此不能把它当作可靠结论。请重试或更换模型。</Notice>}
                          {explanation.locationQuote && <blockquote className="border-l-2 border-accent pl-3 text-xs italic leading-6 text-fg-muted">“{explanation.locationQuote}”<span className="mt-1 block not-italic text-[10px] text-fg-faint">{explanation.locationHint}</span></blockquote>}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div><p className="text-[11px] font-bold text-fg">为什么答案册正确</p><p className="mt-1 text-xs leading-6 text-fg-muted">{explanation.whyKeyCorrect}</p></div>
                            <div><p className="text-[11px] font-bold text-fg">为什么你的答案错</p><p className="mt-1 text-xs leading-6 text-fg-muted">{explanation.whyUserWrong}</p></div>
                          </div>
                          {explanation.synonymPairs?.length > 0 && (
                            <div>
                              <p className="mb-2 text-[11px] font-bold text-fg">同义替换对照</p>
                              <div className="space-y-1.5">
                                {explanation.synonymPairs.map((pair, pairIndex) => (
                                  <div key={`${pair.question}-${pairIndex}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs">
                                    <span><strong>{pair.question}</strong> ↔ {pair.passage}</span>
                                    <Button variant="subtle" className="px-2 py-1 text-[10px]" onClick={() => addReplacement(pair)}>收入替换库</Button>
                                  </div>
                                ))}
                              </div>
                              <Button variant="ghost" className="mt-2 text-[11px]" onClick={() => explanation.synonymPairs.forEach(addReplacement)}>全部收入我的替换库</Button>
                            </div>
                          )}
                          {!result.correct && (
                            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border-soft bg-bg p-2.5">
                              <Field label="错因（可修改）" className="min-w-52 flex-1">
                                <select className="w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={explanation.cause || ''} onChange={event => setCause(result, event.target.value, 'user')}>
                                  {READING_CAUSES.map(cause => <option key={cause}>{cause}</option>)}
                                </select>
                              </Field>
                              {explanation.causeBasis === 'user' && explanation.modelCause && explanation.modelCause !== explanation.cause && <p className="text-[11px] text-fg-faint">模型建议：{explanation.modelCause}（已保留你的选择）</p>}
                              <Button variant="ghost" className="text-[11px]" onClick={() => { deleteMistakeRecord(`ielts:${review.id}:${result.id}`); refreshRecords() }}>从错题库删除</Button>
                            </div>
                          )}
                          <div className="rounded-lg border border-border-soft bg-bg p-2.5">
                            <p className="mb-1.5 text-[11px] font-bold text-fg">就这道题继续追问</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <TextInput value={followups[result.id]?.question || ''} onChange={event => setFollowups(previous => ({ ...previous, [result.id]: { ...(previous[result.id] || {}), question: event.target.value } }))} placeholder="例如：为什么不选 C？" />
                              <Button variant="subtle" className="shrink-0 text-xs" onClick={() => askFollowup({ ...result })} disabled={busyId === `follow-${result.id}`}>{busyId === `follow-${result.id}` ? '回答中…' : '追问'}</Button>
                            </div>
                            {followups[result.id]?.answer && (
                              <div className="mt-2 text-xs leading-6 text-fg-muted">
                                <Badge tone={followups[result.id].evidenceVerified ? 'success' : 'danger'}>{followups[result.id].mock ? '模拟反馈' : followups[result.id].evidenceVerified ? '证据已校验' : '回答不可靠'}</Badge>
                                <p className="mt-1">{followups[result.id].answer}</p>
                                {(followups[result.id].evidenceQuotes || []).map(quote => <p key={quote} className="mt-1 border-l-2 border-border-strong pl-2 text-[11px] italic text-fg-faint">“{quote}”</p>)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              )
            })}
          </div>

          <aside className="space-y-4">
            <PracticeTimer minutes={20} label="本篇文章建议用时" />
            <Panel>
              <SectionTitle title="本篇小结" hint="规则统计 + 可选模型总结" />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-success/10 p-2"><p className="text-lg font-bold text-success">{stats.correct}</p><p className="text-[10px] text-fg-faint">答对</p></div>
                <div className="rounded-lg bg-danger/10 p-2"><p className="text-lg font-bold text-danger">{stats.wrong}</p><p className="text-[10px] text-fg-faint">答错</p></div>
              </div>
              {stats.causeShares.length > 0 && <div className="mt-3 space-y-2">{stats.causeShares.map(item => <div key={item.cause}><div className="flex justify-between gap-2 text-[10px] text-fg-muted"><span>{item.cause}</span><span>{item.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-strong"><div className="h-full rounded-full bg-warning" style={{ width: `${item.share * 100}%` }} /></div></div>)}</div>}
              <Button variant="subtle" className="mt-3 text-xs" onClick={generateSummary} disabled={busyId === 'summary'}>{busyId === 'summary' ? '生成中…' : '生成小结'}</Button>
              {summary && (
                <div className="mt-3 space-y-2 border-t border-border-soft pt-3 text-xs leading-5 text-fg-muted">
                  <Badge tone={summary.mock ? 'warning' : 'info'}>{summary.mock ? '模拟反馈' : '模型总结'}</Badge>
                  <p>{summary.overview}</p>
                  {summary.nextActions?.map(action => <p key={action} className="rounded-lg bg-accent-soft px-2.5 py-2 text-fg">下次：{action}</p>)}
                </div>
              )}
            </Panel>
            <Panel>
              <SectionTitle title="成绩估算" hint="仅在同一套三篇都录入时出现" />
              {availableBand ? <p className="text-xs leading-6 text-fg-muted">本套原始分 {availableBand.raw}/{availableBand.total}，估算阅读 Band <strong className="text-fg">{availableBand.band.toFixed(1)}</strong>。按公开换算锚点近似估算，不是官方成绩。</p> : <p className="text-xs leading-6 text-fg-muted">本套尚未收齐三篇 37–40 题数据，暂不给出分数段，避免用不完整数据编造成绩。</p>}
            </Panel>
            <Notice tone={settings.apiKey ? 'info' : 'warning'} title={settings.apiKey ? '当前使用真实模型' : '尚未配置模型'}>
              {settings.apiKey ? '讲解会发送你在预览中确认的内容。' : '判题、错题库、归因和计时不受影响；讲解可明确选择模拟反馈。'}
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
        eyebrow="READING REVIEW"
        title="阅读复盘"
        description="按一篇文章复盘。先录入原文、题目、答案册和自己的答案，规则会确定判题，再逐题生成可核对证据的讲解。"
        actions={<><Button variant="subtle" onClick={loadSample}>载入原创示例</Button><Badge tone="warning">原创示例非真题</Badge></>}
      />
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <div className="space-y-4">
          <QuickEntry
            module="reading"
            questions={questions}
            setQuestions={setQuestions}
            saveToLibrary={saveToLibrary}
            setSaveToLibrary={setSaveToLibrary}
            onLoadMaterial={material => {
              setSource(material.source)
              setPassage(material.passage)
              setQuestions(material.questions.map(question => ({ ...question, userAnswer: '' })))
            }}
          />
          <Panel>
            <SectionTitle title="1 · 原文与来源" hint="默认不长期保存全文；判断题、填空题等定位片段会进入错题库。" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="来源标签"><TextInput value={source} onChange={event => setSource(event.target.value)} placeholder="例如：剑 18 Test 2 Passage 3（仅你有权使用的材料）" /></Field>
              <Field label="实际用时（分钟，可选）"><TextInput type="number" min="0" value={elapsedMinutes} onChange={event => setElapsedMinutes(event.target.value)} placeholder="20" /></Field>
            </div>
            <Field label="英文原文" className="mt-3"><TextArea rows={7} value={passage} onChange={event => setPassage(event.target.value)} placeholder="粘贴你有权使用的文章原文。讲解的定位句必须逐字来自这里。" /></Field>
            <label className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-fg-muted"><input type="checkbox" checked={saveFullSource} onChange={event => setSaveFullSource(event.target.checked)} className="mt-1" />保存本篇完整原文（可在设置中一键删除）。不勾选时只保存定位片段。</label>
          </Panel>

          <Panel>
            <SectionTitle title="2 · 题目与答案" hint="支持整段粘贴后自动拆题，拆错可手动改。" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="题目整段粘贴"><TextArea rows={5} value={pasteQuestions} onChange={event => setPasteQuestions(event.target.value)} placeholder={'1. TRUE / FALSE / NOT GIVEN: …\n2. Complete the sentence: …\nA. …'} /></Field>
              <Field label="答案册整段粘贴"><TextArea rows={5} value={pasteAnswers} onChange={event => setPasteAnswers(event.target.value)} placeholder={'1. FALSE\n2. two weeks'} /></Field>
              <Field label="我的答案整段粘贴"><TextArea rows={5} value={pasteUser} onChange={event => setPasteUser(event.target.value)} placeholder={'1. NOT GIVEN\n2. two week'} /></Field>
            </div>
            <Button className="mt-3 text-xs" onClick={parsePaste}>智能拆题</Button>
            <div className="mt-4"><QuestionEditor questions={questions} setQuestions={setQuestions} /></div>
          </Panel>
        </div>
        <aside className="space-y-4">
          <PracticeTimer minutes={20} label="站内计时（可暂停）" />
          <Panel>
            <SectionTitle title="开始前检查" />
            <ul className="space-y-2 text-xs leading-5 text-fg-muted">
              <li>✓ 原文和每题答案册答案都已填写</li>
              <li>✓ 题型和字数要求已确认</li>
              <li>✓ 你的答案来自实际作答，而非回忆修正</li>
            </ul>
            <Button className="mt-3 w-full" onClick={startReview} disabled={!passage.trim() || questions.length === 0}>开始确定性判题</Button>
            {questions.length === 0 && <p className="mt-2 text-[11px] text-fg-faint">没有题目时，可以先点“载入原创示例”体验完整流程。</p>}
          </Panel>
          <Notice tone="warning" title="版权边界">只粘贴你有权使用的材料。仓库不内置雅思官方或剑桥真题；页面内示例均为原创。</Notice>
        </aside>
      </div>
    </div>
  )
}
