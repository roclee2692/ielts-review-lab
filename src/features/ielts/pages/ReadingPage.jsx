import { useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { rawToBand, verifyEvidence } from '../core/index.js'
import { READING_QUICK_TAGS, TYPE_LABELS } from '../data/causes.js'
import { methodBrief } from '../data/methods.js'
import { SAMPLE_READING } from '../data/samples.js'
import { buildReadingReport } from '../domain/readingReport.js'
import { evaluateQuestions, mistakeFromResult, reviewStats, seriesKey } from '../domain/review.js'
import { addMistakeRecords } from '../../../services/storage/MistakesStore.js'
import { getActiveMethod, loadReviewSummaries, saveReviewSummary } from '../storage.js'
import MethodCard from '../components/MethodCard.jsx'
import PracticeTimer from '../components/PracticeTimer.jsx'
import ReadingQuestionCard from '../components/ReadingQuestionCard.jsx'
import ReportPanel from '../components/ReportPanel.jsx'
import ThreeBoxEntry from '../components/ThreeBoxEntry.jsx'
import { Button, Field, Notice, PageHeader, Panel, SectionTitle, SettingsLink, TextInput } from '../components/ui.jsx'

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Turn the sample into the three boxes, so "载入原创示例" shows the real entry flow. */
function sampleBoxes() {
  const HEADERS = {
    tfng: 'Write TRUE, FALSE or NOT GIVEN.',
    ynng: 'Write YES, NO or NOT GIVEN.',
    gap: 'Complete the sentence. Choose NO MORE THAN TWO WORDS from the passage.',
    mcq: 'Choose the correct letter.',
  }
  const questionsText = SAMPLE_READING.questions.map(question => [
    `Question ${question.number}`,
    HEADERS[question.type] || '',
    `${question.number} ${question.prompt}`,
    ...(question.options || []),
  ].filter(Boolean).join('\n')).join('\n')
  const answersText = SAMPLE_READING.questions
    .map(question => `${question.number} ${question.key} | ${SAMPLE_READING.userAnswers[question.id] || ''}`)
    .join('\n')
  return { source: SAMPLE_READING.source, text: SAMPLE_READING.passage, questionsText, answersText }
}

/** Situation text the model sees: tapped tags plus the learner's own words. */
function situationText(state) {
  const tags = (state?.situationTags || []).map(id => READING_QUICK_TAGS.find(tag => tag.id === id)?.situation).filter(Boolean)
  return [...tags, String(state?.situationText || '').trim()].filter(Boolean).join(' ')
}

export default function ReadingPage() {
  const { settings, requestModel, refreshRecords, addReplacement } = useIelts()
  const method = useMemo(() => getActiveMethod('reading'), [])
  const [passage, setPassage] = useState('')
  const [review, setReview] = useState(null)
  const [results, setResults] = useState([])
  const [cards, setCards] = useState({}) // question id → situation, cause, explanation, messages
  const [metrics, setMetrics] = useState({})
  const [metricsTouched, setMetricsTouched] = useState({})
  const [busyId, setBusyId] = useState('')

  const stats = useMemo(
    () => reviewStats(results.map(result => ({ ...result, cause: cards[result.id]?.cause || result.cause }))),
    [results, cards],
  )
  const report = useMemo(() => {
    if (!review) return null
    const explanations = Object.fromEntries(Object.entries(cards).map(([id, card]) => [id, { ...card, situation: situationText(card) }]))
    return buildReadingReport(review, results, explanations, method ? {
      methodTitle: method.title,
      metrics: method.metrics.map(metric => ({ label: metric.label, value: metrics[metric.id] ?? 0 })),
    } : {})
  }, [review, results, cards, method, metrics])

  const startReview = ({ source: label, elapsedMinutes, text, questions, saveFullSource }) => {
    const evaluated = evaluateQuestions(questions)
    const computed = reviewStats(evaluated)
    const nextReview = {
      id: newId('reading'),
      module: 'reading',
      source: label || '未标注来源',
      createdAt: Date.now(),
      saveFullSource,
      fullSource: text,
      elapsedSeconds: elapsedMinutes ? Number(elapsedMinutes) * 60 : 0,
      methodId: method?.id || '',
      ...computed,
    }
    setPassage(text)
    setReview(nextReview)
    setResults(evaluated)
    setCards({})
    setMetrics({})
    setMetricsTouched({})
    saveReviewSummary(nextReview)
    const records = evaluated.filter(result => !result.correct).map(result => mistakeFromResult(nextReview, result, null))
    if (records.length) addMistakeRecords(records)
    refreshRecords()
  }

  /** Persist every wrong question with its current card. */
  const persist = (nextCards, nextMetrics = metrics) => {
    const reflections = Object.fromEntries(Object.entries(nextCards).map(([id, card]) => [id, situationText(card)]))
    const records = results.filter(result => !result.correct).map(result => {
      const card = nextCards[result.id]
      return mistakeFromResult({ ...review, reflections }, result, card ? { ...card, cause: card.cause || result.ruleCause } : null)
    })
    if (records.length) addMistakeRecords(records)
    const current = reviewStats(results.map(result => ({ ...result, cause: nextCards[result.id]?.cause || result.cause })))
    saveReviewSummary({ ...review, total: current.total, correct: current.correct, wrong: current.wrong, causeShares: current.causeShares, methodMetrics: nextMetrics })
    refreshRecords()
  }

  const updateCard = (id, patch) => {
    const nextCards = { ...cards, [id]: { ...(cards[id] || {}), ...patch } }
    setCards(nextCards)
    // Prefill method metrics from tags (e.g. "首次经过答案句没认出"); the learner can still edit them.
    if (method && patch.situationTags) {
      const nextMetrics = { ...metrics }
      for (const metric of method.metrics.filter(item => item.fromTag)) {
        const counted = Object.values(nextCards).filter(card => (card.situationTags || []).includes(metric.fromTag)).length
        if (!metricsTouched[metric.id]) nextMetrics[metric.id] = counted
      }
      setMetrics(nextMetrics)
      persist(nextCards, nextMetrics)
      return
    }
    persist(nextCards)
  }

  const explain = async result => {
    const card = cards[result.id] || {}
    setBusyId(result.id)
    const response = await requestModel('ielts.reading.explain', {
      passage,
      question: [result.prompt, ...(result.options || [])].filter(Boolean).join('\n'),
      answerKey: Array.isArray(result.key) ? result.key.join(', ') : result.key,
      userAnswer: result.userAnswer || '(未记录)',
      questionType: TYPE_LABELS[result.type] || result.type,
      instruction: result.instruction || '',
      ruleErrors: result.errors,
      strictness: settings.strictness,
      situation: situationText(card),
      method: methodBrief(method),
    })
    setBusyId('')
    if (!response) return
    const data = response.data
    const noPassage = !passage.trim()
    const quotes = [data.locationQuote, ...(data.synonymPairs || []).map(pair => pair.passage)].filter(Boolean)
    const verification = noPassage ? { ok: false, missing: [] } : verifyEvidence(passage, quotes)
    // The learner's own choice — picked directly or implied by a situation tag — beats the model's suggestion.
    const userPicked = !result.ruleCause && (card.causeBasis === 'user' || card.causeBasis === 'tag') && card.cause
    updateCard(result.id, {
      ...data,
      modelCause: data.cause,
      cause: result.ruleCause || (userPicked ? card.cause : data.cause),
      causeBasis: result.ruleCause ? 'rule' : userPicked ? card.causeBasis : 'model',
      evidenceVerified: verification.ok,
      evidenceMissing: verification.missing,
      noPassage,
      mock: response.meta.mock,
      meta: response.meta,
      messages: card.messages || [],
    })
  }

  const followup = async (result, text) => {
    const card = cards[result.id] || {}
    const messages = [...(card.messages || []), { role: 'user', text }]
    setCards(previous => ({ ...previous, [result.id]: { ...card, messages } }))
    setBusyId(result.id)
    const history = { ...card }
    delete history.messages
    delete history.meta
    const response = await requestModel('ielts.reading.followup', {
      passage,
      question: result.prompt || `第 ${result.number} 题`,
      answerKey: Array.isArray(result.key) ? result.key.join(', ') : result.key,
      userAnswer: result.userAnswer || '',
      history,
      situation: situationText(card),
      messages: [...(card.askUser ? [{ role: 'assistant', text: card.askUser }] : []), ...messages.slice(0, -1)],
      followup: text,
    })
    setBusyId('')
    if (!response) {
      setCards(previous => ({ ...previous, [result.id]: { ...card, messages: card.messages || [] } }))
      return
    }
    const quotes = response.data.evidenceQuotes || []
    const verified = passage.trim() ? verifyEvidence(passage, quotes).ok : null
    const reply = {
      role: 'assistant',
      text: [response.data.answer, response.data.askUser].filter(Boolean).join('\n\n'),
      evidenceQuotes: quotes,
      evidenceVerified: quotes.length ? verified : null,
      uncertain: response.data.uncertain,
      mock: response.meta.mock,
    }
    updateCard(result.id, { ...card, messages: [...messages, reply] })
  }

  if (review) {
    const wrong = results.filter(result => !result.correct)
    const right = results.filter(result => result.correct)
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
          description={`${stats.total} 题 · 对 ${stats.correct} · 错 ${stats.wrong}${review.elapsedSeconds ? ` · 用时 ${Math.round(review.elapsedSeconds / 60)} 分钟` : ''}`}
          actions={<Button variant="ghost" onClick={() => setReview(null)}>重新录入</Button>}
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {wrong.length === 0 && <Notice tone="success" title="全对">这篇没有错题。想复盘某道对题的思路，可以在下面展开它。</Notice>}
            {[...wrong, ...right].map(result => (
              <ReadingQuestionCard
                key={result.id}
                result={result}
                state={cards[result.id]}
                hasPassage={!!passage.trim()}
                busy={busyId === result.id}
                onSituation={(tags, text, proposedCause) => updateCard(result.id, {
                  situationTags: tags,
                  situationText: text,
                  ...(proposedCause ? { cause: proposedCause, causeBasis: 'tag' } : {}),
                })}
                onCause={cause => updateCard(result.id, { cause, causeBasis: 'user' })}
                onExplain={() => explain(result)}
                onFollowup={text => followup(result, text)}
                onAddReplacement={addReplacement}
              />
            ))}
            {report && <ReportPanel report={report} filename={`阅读复盘-${review.source}`.replace(/[\\/:*?"<>|\s]+/g, '-')} />}
          </div>

          <aside className="space-y-4">
            <Panel>
              <SectionTitle title="本篇小结" hint="规则统计；错因按你确认后的算" />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-success/10 p-2"><p className="text-lg font-bold text-success">{stats.correct}</p><p className="text-[10px] text-fg-faint">答对</p></div>
                <div className="rounded-lg bg-danger/10 p-2"><p className="text-lg font-bold text-danger">{stats.wrong}</p><p className="text-[10px] text-fg-faint">答错</p></div>
              </div>
              {stats.causeShares.length > 0 && <div className="mt-3 space-y-2">{stats.causeShares.map(item => <div key={item.cause}><div className="flex justify-between gap-2 text-[10px] text-fg-muted"><span>{item.cause}</span><span>{item.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-strong"><div className="h-full rounded-full bg-warning" style={{ width: `${item.share * 100}%` }} /></div></div>)}</div>}
            </Panel>
            {method && (
              <Panel>
                <SectionTitle title={`${method.title} · 执行检查`} hint="这一篇按方法执行得怎么样。点了处境标签会自动数，也可以自己改。" />
                <div className="space-y-2">
                  {method.metrics.map(metric => (
                    <Field key={metric.id} label={metric.label} hint={metric.hint}>
                      <TextInput
                        type="number"
                        min="0"
                        aria-label={metric.label}
                        value={metrics[metric.id] ?? 0}
                        onChange={event => {
                          const next = { ...metrics, [metric.id]: Math.max(0, Number(event.target.value) || 0) }
                          setMetrics(next)
                          setMetricsTouched(previous => ({ ...previous, [metric.id]: true }))
                          persist(cards, next)
                        }}
                      />
                    </Field>
                  ))}
                  <p className="text-[11px] text-fg-faint">限时得分：{stats.correct}/{stats.total}{review.elapsedSeconds ? `，${Math.round(review.elapsedSeconds / 60)} 分钟` : '（没填用时）'}</p>
                </div>
              </Panel>
            )}
            <Panel>
              <SectionTitle title="成绩估算" hint="同一套三篇都录入后才出现" />
              {availableBand ? <p className="text-xs leading-6 text-fg-muted">本套原始分 {availableBand.raw}/{availableBand.total}，估算阅读 Band <strong className="text-fg">{availableBand.band.toFixed(1)}</strong>。按公开换算锚点近似估算，不是官方成绩。</p> : <p className="text-xs leading-6 text-fg-muted">同一套三篇还没录齐，暂不估分，免得用不完整的数据编成绩。</p>}
            </Panel>
            <Notice tone={settings.apiKey ? 'info' : 'warning'} title={settings.apiKey ? '当前使用真实模型' : '尚未配置模型'}>
              {settings.apiKey ? '每次讲解前会让你确认发送的内容。' : '判题、错题库、归因、报告不受影响；讲解可以选模拟反馈看流程。'}
              {!settings.apiKey && <div className="mt-2"><SettingsLink /></div>}
            </Notice>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="READING REVIEW" title="阅读复盘" description="做完一篇，把原文、题目、答案贴进来：规则判对错，然后从你做题时卡住的地方讲起。" />
      <MethodCard module="reading" method={method} />
      <ThreeBoxEntry module="reading" sample={sampleBoxes()} onStart={startReview} />
      <div className="grid gap-4 md:grid-cols-2">
        <PracticeTimer minutes={20} label="站内计时（可暂停，到点只提醒）" />
        <Notice tone="warning" title="版权边界">只粘贴你有权使用的材料。仓库不内置任何真题；示例均为原创。原文默认只在这次复盘里用，不长期保存。</Notice>
      </div>
    </div>
  )
}
