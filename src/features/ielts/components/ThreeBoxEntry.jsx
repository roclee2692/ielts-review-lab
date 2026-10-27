import { useState } from 'react'
import { parseAnswerLine } from '../core/index.js'
import { buildQuestionsFromBoxes } from '../domain/entry.js'
import { loadMaterials, saveMaterial } from '../storage.js'
import QuestionEditor from './QuestionEditor.jsx'
import { Button, Collapsible, Field, Notice, Panel, TextArea, TextInput } from './ui.jsx'

const ANSWER_HINT = `每行：题号 答案册 [你的答案]
1 FALSE NG          ← 答案册 FALSE，你写了 NG
2 two weeks | two week
3 B ✓               ← 你答对了
4 C ✗ A             ← 你选了 A
也可以一行：1 TRUE 2 NG 3 B ✓`

const COPY = {
  reading: { source: '剑 19 Test 2 Passage 1', text: '原文', textHint: '有原文，讲解的引用才能逐字校验。', textPlaceholder: '粘贴你有权使用的文章原文。', minutes: '20' },
  listening: { source: '剑 19 Test 2 Part 3', text: '听力文稿', textHint: '有文稿才能定位答案句、信号词和改口。系统不处理音频。', textPlaceholder: '粘贴你有权使用的听力文稿（答案册后面的 Audioscripts）。', minutes: '10' },
}

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * 三个框：原文/文稿（可选）、题目（可选）、答案（答案册 + 我的答案，一个框）。
 * onStart({ source, elapsedMinutes, text, questions, saveFullSource }) 在判题时调用。
 * sample: { source, text, questionsText, answersText } 用于“载入原创示例”。
 */
export default function ThreeBoxEntry({ module, sample, onStart }) {
  const copy = COPY[module]
  const [materials] = useState(() => loadMaterials().filter(item => item.module === module))
  const [source, setSource] = useState('')
  const [elapsedMinutes, setElapsedMinutes] = useState('')
  const [text, setText] = useState('')
  const [questionsText, setQuestionsText] = useState('')
  const [answersText, setAnswersText] = useState('')
  const [mineLine, setMineLine] = useState('')
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [saveFullSource, setSaveFullSource] = useState(false)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')

  const loadSample = () => {
    setSource(sample.source)
    setText(sample.text)
    setQuestionsText(sample.questionsText)
    setAnswersText(sample.answersText)
    setDraft(null)
    setError('')
  }

  const loadMaterial = id => {
    const material = materials.find(item => item.id === id)
    if (!material) return
    setSource(material.source)
    setText(material.passage)
    setQuestionsText(material.questionsText || material.questions.map(question => `${question.number} ${question.prompt}`).join('\n'))
    setAnswersText(material.questions.map(question => `${question.number} ${Array.isArray(question.key) ? question.key.join(', ') : question.key}`).join('\n'))
    setMineLine('')
    setDraft(null)
  }

  const recognise = () => {
    if (!answersText.trim()) {
      setError('答案框是必填的：至少要有答案册，才能确定性判题。')
      return null
    }
    const built = buildQuestionsFromBoxes({ questionsText, answersText, idPrefix: newId(module === 'reading' ? 'rq' : 'lq') })
    if (built.questions.length === 0) {
      setError('没认出题号。每题以题号开头，比如“1 FALSE NG”。')
      return null
    }
    let questions = built.questions
    if (mineLine.trim()) {
      const types = Object.fromEntries(questions.map(question => [Number(question.number), question.type]))
      const mine = new Map(parseAnswerLine(mineLine, { first: built.missingMine[0], types }).answers.map(item => [String(item.number), item.answer]))
      questions = questions.map(question => (question.mineUnknown && mine.has(question.number) ? { ...question, userAnswer: mine.get(question.number), mineUnknown: false } : question))
    }
    const next = { ...built, questions, missingMine: questions.filter(question => question.mineUnknown).map(question => Number(question.number)) }
    setDraft(next)
    setError('')
    return next
  }

  const start = current => {
    if (!current) return
    if (current.questions.some(question => !String(question.key).trim())) {
      setError('有的题没有答案册答案，没法判。展开“逐题核对”看看。')
      return
    }
    if (saveToLibrary && source.trim() && source.trim() !== sample.source) {
      saveMaterial({ module, source, passage: text, questionsText, questions: current.questions.map(question => ({ ...question, mineUnknown: undefined })) })
    }
    onStart({ source: source.trim(), elapsedMinutes, text, questions: current.questions, saveFullSource })
  }

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">三个框：{copy.text}、题目、答案。{copy.text}和题目可以不填；答案框里答案册和你的答案写在一起就行。</p>
        <Button variant="subtle" className="text-xs" onClick={loadSample}>载入原创示例（非真题）</Button>
      </div>
      {error && <div className="mb-3"><Notice tone="danger">{error}</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="来源（以后重做时直接载入）">
          <div className="flex gap-2">
            <TextInput aria-label="来源" value={source} onChange={event => setSource(event.target.value)} placeholder={`例如：${copy.source}`} />
            {materials.length > 0 && (
              <select aria-label="题集库" className="w-40 shrink-0 rounded-lg border border-border-soft bg-surface px-2 text-xs text-fg" value="" onChange={event => loadMaterial(event.target.value)}>
                <option value="">载入录过的…</option>
                {materials.map(item => <option key={item.id} value={item.id}>{item.source}</option>)}
              </select>
            )}
          </div>
        </Field>
        <Field label="用时（分钟）"><TextInput aria-label="用时" type="number" min="0" value={elapsedMinutes} onChange={event => setElapsedMinutes(event.target.value)} placeholder={copy.minutes} /></Field>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Field label={`${copy.text}（可选）`} hint={copy.textHint}>
          <TextArea rows={12} aria-label={copy.text} value={text} onChange={event => setText(event.target.value)} placeholder={copy.textPlaceholder} />
        </Field>
        <Field label="题目（可选）" hint="整段粘贴，题型和字数要求会从说明行读出来。">
          <TextArea rows={12} aria-label="题目" value={questionsText} onChange={event => setQuestionsText(event.target.value)} placeholder={'Questions 1-5\nWrite NO MORE THAN TWO WORDS.\n1 …\n2 …'} />
        </Field>
        <Field label="答案（答案册 + 你的答案）" hint="对着答案册批改时怎么写就怎么贴。">
          <TextArea rows={12} aria-label="答案" value={answersText} onChange={event => setAnswersText(event.target.value)} placeholder={ANSWER_HINT} className="font-mono" />
        </Field>
      </div>

      {draft?.missingMine?.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <Field label={`第 ${draft.missingMine.join('、')} 题只有答案册，你当时写的是？`} hint="一行写完：题号 + 你的答案。">
            <TextInput aria-label="我的答案" value={mineLine} onChange={event => setMineLine(event.target.value)} placeholder={`${draft.missingMine[0]} NOT GIVEN ${draft.missingMine[1] || ''} …`} />
          </Field>
        </div>
      )}
      {draft?.warnings?.length > 0 && <div className="mt-3"><Notice tone="warning" title="识别时注意到">{draft.warnings.join('；')}</Notice></div>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => { const next = recognise(); if (next && next.missingMine.length === 0) start(next) }} disabled={!answersText.trim()}>识别并判题</Button>
        {draft?.missingMine?.length > 0 && (
          <Button variant="subtle" onClick={() => {
            const next = recognise()
            if (next) start({ ...next, questions: next.questions.map(question => (question.mineUnknown ? { ...question, userAnswer: question.key, mineUnknown: false } : question)) })
          }}>没写的都算答对，开始判题</Button>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-fg-muted"><input type="checkbox" checked={saveToLibrary} onChange={event => setSaveToLibrary(event.target.checked)} />存进题集库</label>
        <label className="flex items-center gap-1.5 text-[11px] text-fg-muted"><input type="checkbox" checked={saveFullSource} onChange={event => setSaveFullSource(event.target.checked)} />复盘记录里保存全文</label>
      </div>

      {draft && (
        <div className="mt-4">
          <Collapsible title={`逐题核对（${draft.questions.length} 题，识别错了在这里改）`}>
            <QuestionEditor questions={draft.questions} setQuestions={update => setDraft(previous => ({ ...previous, questions: typeof update === 'function' ? update(previous.questions) : update }))} />
            <Button className="mt-3 text-xs" onClick={() => start(draft)}>按核对后的结果判题</Button>
          </Collapsible>
        </div>
      )}
    </Panel>
  )
}
