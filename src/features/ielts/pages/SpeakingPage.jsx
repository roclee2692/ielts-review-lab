import { useEffect, useMemo, useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { IELTS_KEYS, loadIeltsValue, saveIeltsValue } from '../../../services/storage/IeltsStore.js'
import { SPEAKING_TOPICS, parseTopicImport } from '../data/speakingTopics.js'
import { loadSpeakingHistory, saveSpeakingPractice } from '../storage.js'
import { browserSpeechAvailable, speakWithBrowser } from '../ai/tts.js'
import PracticeTimer from '../components/PracticeTimer.jsx'
import { Badge, Button, Field, Modal, Notice, PageHeader, Panel, SectionTitle, Select, TextArea } from '../components/ui.jsx'

const PARTS = [1, 2, 3]

export default function SpeakingPage() {
  const { settings, requestModel } = useIelts()
  const [customTopics, setCustomTopics] = useState(() => {
    const saved = loadIeltsValue(IELTS_KEYS.speakingTopics, [])
    return Array.isArray(saved) ? saved : []
  })
  const topics = useMemo(() => [...SPEAKING_TOPICS, ...customTopics], [customTopics])
  const [topicId, setTopicId] = useState(SPEAKING_TOPICS[0].id)
  const [part, setPart] = useState(1)
  const [questions, setQuestions] = useState(() => ({
    part1: SPEAKING_TOPICS[0].part1,
    part2: SPEAKING_TOPICS[0].part2,
    part2Cues: SPEAKING_TOPICS[0].cues,
    part3: SPEAKING_TOPICS[0].part3,
  }))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState('text')
  const [history, setHistory] = useState(() => loadSpeakingHistory())
  const [ttsAvailable, setTtsAvailable] = useState(false)

  const topic = topics.find(item => item.id === topicId) || topics[0]
  useEffect(() => { setTtsAvailable(browserSpeechAvailable()) }, [])

  const chooseTopic = id => {
    const next = topics.find(item => item.id === id)
    if (!next) return
    setTopicId(id)
    setPart(1)
    setAnswer('')
    setFeedback(null)
    setQuestions({ part1: next.part1, part2: next.part2, part2Cues: next.cues, part3: next.part3 })
  }

  const generateQuestions = async () => {
    setBusy(true)
    const response = await requestModel('ielts.speaking.questions', {
      topic: topic.title,
      customTopics: customTopics.map(item => item.title),
      part,
    })
    setBusy(false)
    if (response) {
      setQuestions(response.data)
      setFeedback(null)
      setAnswer('')
    }
  }

  const currentQuestions = part === 1 ? questions.part1 : part === 2 ? [questions.part2] : questions.part3
  const questionText = part === 2 ? `${questions.part2}\n${(questions.part2Cues || []).map(cue => `• ${cue}`).join('\n')}` : currentQuestions.join('\n')

  const speak = () => {
    if (!ttsAvailable) return
    speakWithBrowser(`${part === 2 ? 'Part 2.' : `Part ${part}.`} ${questionText}`)
  }

  const submitFeedback = async () => {
    if (!answer.trim()) {
      setError('先用输入法语音转文字或直接输入你的回答。')
      return
    }
    setBusy(true)
    setError('')
    const response = await requestModel('ielts.speaking.feedback', {
      topic: topic.title,
      part,
      questions: currentQuestions,
      answer,
      strictness: settings.strictness,
      targetBand: settings.targetBand,
    })
    setBusy(false)
    if (!response) return
    const practice = {
      topic: topic.title,
      part,
      answer,
      questions: currentQuestions,
      feedback: { ...response.data, mock: response.meta.mock },
    }
    setFeedback(practice.feedback)
    setHistory(saveSpeakingPractice(practice))
  }

  const importTopics = () => {
    try {
      const imported = parseTopicImport(importText, importFormat)
      if (!imported.length) throw new Error('没有识别到话题')
      const next = [...customTopics, ...imported]
      setCustomTopics(next)
      saveIeltsValue(IELTS_KEYS.speakingTopics, next)
      setTopicId(imported[0].id)
      setPart(1)
      setAnswer('')
      setFeedback(null)
      setQuestions({ part1: imported[0].part1, part2: imported[0].part2, part2Cues: imported[0].cues, part3: imported[0].part3 })
      setImportOpen(false)
      setImportText('')
    } catch (importError) {
      setError(importError.message)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="SPEAKING PRACTICE"
        title="口语训练"
        description="用输入法语音转文字或直接打字作答。反馈重点是“像人和人聊天”：先给自然词块，再谈交流感；仅凭文字不评价发音。"
        actions={<Button variant="subtle" onClick={() => setImportOpen(true)}>导入本季话题</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Panel>
            <SectionTitle title="话题" hint={`${customTopics.length} 个自定义话题`} />
            <Select value={topicId} onChange={event => chooseTopic(event.target.value)}>
              {topics.map(item => <option key={item.id} value={item.id}>{item.title}{item.custom ? '（导入）' : ''}</option>)}
            </Select>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {PARTS.map(value => <button key={value} onClick={() => { setPart(value); setFeedback(null) }} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${part === value ? 'border-accent-border bg-accent-soft text-accent' : 'border-border-soft bg-surface text-fg-muted'}`}>Part {value}</button>)}
            </div>
            <Button variant="subtle" className="mt-3 w-full text-xs" onClick={generateQuestions} disabled={busy}>{busy ? '生成中…' : '按本季话题生成一套题'}</Button>
          </Panel>

          {part === 2 && (
            <Panel>
              <SectionTitle title="Part 2 计时" hint="1 分钟准备，2 分钟作答；到点只提醒" />
              <div className="space-y-2">
                <PracticeTimer minutes={1} label="准备" />
                <PracticeTimer minutes={2} label="作答" />
              </div>
            </Panel>
          )}

          <Panel>
            <SectionTitle title="最近练习" hint="按时间倒序" />
            {history.length === 0 ? <p className="text-xs text-fg-faint">完成一次反馈后记录在这里。</p> : <div className="space-y-2">{history.slice(0, 4).map(item => <div key={item.id} className="rounded-lg bg-surface px-2.5 py-2 text-xs"><p className="font-semibold text-fg">{item.topic}</p><p className="mt-0.5 text-[10px] text-fg-faint">Part {item.part} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</p></div>)}</div>}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <SectionTitle
              title={`Part ${part} · ${topic.title}`}
              hint={part === 1 ? '回答要直接、自然，可补一个小例子。' : part === 2 ? '按提示卡准备，覆盖所有要点，但不要背稿。' : '追问承接 Part 2 的话题，先给判断，再展开原因或对比。'}
              action={ttsAvailable ? <Button variant="subtle" className="text-xs" onClick={speak}>🔊 考官朗读</Button> : <Badge>当前浏览器不支持朗读</Badge>}
            />
            <div className="space-y-2 rounded-xl border border-border-soft bg-surface p-3.5 text-sm leading-6 text-fg">
              {part === 1 && currentQuestions.map(question => <p key={question}>• {question}</p>)}
              {part === 2 && <><p className="font-semibold">{questions.part2}</p><div className="grid gap-1 text-xs text-fg-muted sm:grid-cols-2">{(questions.part2Cues || []).map(cue => <span key={cue}>You should say: {cue}</span>)}</div></>}
              {part === 3 && currentQuestions.map(question => <p key={question}>• {question}</p>)}
            </div>
            <Field label="你的文字回答" className="mt-3" hint="可以用手机输入法语音转文字，再粘贴到答题区。"><TextArea rows={9} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="直接回答问题，再用一个原因或例子自然展开。" /></Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={submitFeedback} disabled={busy || !answer.trim()}>{busy ? '生成反馈中…' : '获取口语反馈'}</Button>
              {feedback && <Badge tone={feedback.mock ? 'warning' : 'success'}>{feedback.mock ? '模拟反馈（未调用模型）' : '模型反馈'}</Badge>}
            </div>
            {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
          </Panel>

          {feedback && (
            <Panel>
              <SectionTitle title="像聊天一样的反馈" hint="少而准，不评价发音" />
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-bold text-fg">你想说的意思，母语者常这么说</p>
                  <div className="flex flex-wrap gap-2">{feedback.chunks.map(chunk => <Badge key={chunk} tone="accent">{chunk}</Badge>)}</div>
                </div>
                <div className="rounded-xl bg-surface p-3"><p className="mb-1 text-[11px] font-bold text-fg">口语示范</p>{feedback.demonstrations.map(demo => <p key={demo} className="mt-1 text-xs leading-6 text-fg-muted">“{demo}”</p>)}</div>
                <div className="grid gap-2 md:grid-cols-3 text-xs leading-6">
                  <div className="rounded-lg border border-border-soft p-3"><strong className="text-fg">流利与连贯</strong><p className="mt-1 text-fg-muted">{feedback.fluencyCoherence}</p></div>
                  <div className="rounded-lg border border-border-soft p-3"><strong className="text-fg">词汇</strong><p className="mt-1 text-fg-muted">{feedback.lexicalResource}</p></div>
                  <div className="rounded-lg border border-border-soft p-3"><strong className="text-fg">语法</strong><p className="mt-1 text-fg-muted">{feedback.grammaticalRange}</p></div>
                </div>
                {feedback.grammarCorrections?.length > 0 && <div><p className="mb-1 text-[11px] font-bold text-fg">只改影响理解或明显的错误</p>{feedback.grammarCorrections.map((item, index) => <div key={index} className="mt-1 rounded-lg bg-surface p-2.5 text-xs leading-5 text-fg-muted"><p>原句：{item.original}</p><p>改法：{item.revision}</p><p>原因：{item.reason}</p></div>)}</div>}
                <Notice tone="info" title="交流感">{feedback.interaction}</Notice>
                <Notice tone="warning" title="只能由文字判断的部分">{feedback.pronunciationNote || '仅凭文字无法评估发音、连读或语调。'}</Notice>
                <p className="text-[10px] text-fg-faint">三项文字估算不是官方分数；本页不提供发音分或口语总分。</p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Modal open={importOpen} title="导入本季话题清单" onClose={() => setImportOpen(false)} footer={<><Button variant="ghost" onClick={() => setImportOpen(false)}>取消</Button><Button onClick={importTopics}>导入</Button></>}>
        <div className="space-y-3 text-xs text-fg-muted">
          <Notice tone="info">话题只保存在本机浏览器，不随仓库发布。纯文本每行一个话题；JSON 支持 title、part1、part2、cues、part3 字段。</Notice>
          <Field label="导入格式"><Select value={importFormat} onChange={event => setImportFormat(event.target.value)}><option value="text">纯文本</option><option value="json">JSON</option></Select></Field>
          <Field label="粘贴内容"><TextArea rows={8} value={importText} onChange={event => setImportText(event.target.value)} placeholder={importFormat === 'json' ? '[{"title":"A local market","part3":["Why do markets matter?"]}]' : 'A recent purchase\nA public place you enjoy'} /></Field>
        </div>
      </Modal>
    </div>
  )
}
