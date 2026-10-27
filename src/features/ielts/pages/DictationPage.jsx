import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIelts } from '../context/IeltsContext.jsx'
import { browserSpeechAvailable, englishVoices, speakWithBrowser } from '../ai/tts.js'
import { judgeAnswer } from '../core/index.js'
import { buildDictationList, parseCustomWords, recordDictation } from '../domain/dictation.js'
import { IELTS_KEYS, loadIeltsValue, saveIeltsValue } from '../../../services/storage/IeltsStore.js'
import { Badge, Button, EmptyState, Field, Notice, PageHeader, Panel, SectionTitle, TextArea, TextInput } from '../components/ui.jsx'

const ACCENTS = [
  { lang: 'en-GB', label: '英音' },
  { lang: 'en-AU', label: '澳音' },
  { lang: 'en-US', label: '美音' },
]

/**
 * 拼写听写：把听力里“听到了但写错”的词集中重写。
 * 声音来自浏览器自带的语音合成，不用 key、不联网；没有真题音频（版权）。
 */
export default function DictationPage() {
  const { records } = useIelts()
  const [history, setHistory] = useState(() => loadIeltsValue(IELTS_KEYS.dictation, { version: 1, words: {} }))
  const [customText, setCustomText] = useState('')
  const [accent, setAccent] = useState('en-GB')
  const [rate, setRate] = useState(0.85)
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useState('')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(null)
  const [session, setSession] = useState({ right: 0, wrong: 0 })
  const inputRef = useRef(null)
  const supported = browserSpeechAvailable()

  useEffect(() => {
    if (!supported) return undefined
    const load = () => setVoices(englishVoices(accent))
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [accent, supported])

  // Order is fixed for the session (from the history at page load); otherwise
  // every answer would re-sort the list and "下一个" could skip or repeat words.
  const [startHistory] = useState(history)
  const list = useMemo(() => {
    const fromMistakes = buildDictationList(records, startHistory)
    const custom = parseCustomWords(customText).filter(word => !fromMistakes.some(item => item.id === word.id))
    return [...custom, ...fromMistakes]
  }, [records, startHistory, customText])
  const current = list[index % Math.max(1, list.length)]

  const say = () => current && speakWithBrowser(current.say, { lang: accent, rate, voiceName })

  const check = () => {
    if (!current || !answer.trim()) return
    const verdict = judgeAnswer({ type: 'gap', key: current.key }, answer)
    const next = recordDictation(history, current.id, verdict.correct)
    setHistory(next)
    saveIeltsValue(IELTS_KEYS.dictation, next)
    setChecked({ ...verdict, expected: current.say })
    setSession(previous => ({ right: previous.right + (verdict.correct ? 1 : 0), wrong: previous.wrong + (verdict.correct ? 0 : 1) }))
  }

  const nextWord = () => {
    setIndex(value => value + 1)
    setAnswer('')
    setChecked(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="DICTATION"
        title="拼写听写"
        description="把听力里“听到了但写错”的词集中重写：拼写、单复数、数字日期。系统念，你写，同一套规则判对错。"
        actions={<Link to="/ielts/listening" className="btn-ghost text-xs">回听力复盘</Link>}
      />
      {!supported && <Notice tone="warning" title="这个浏览器不支持朗读">换 Chrome、Edge 或 Safari 就能用。也可以以后在设置里接自己 key 的第三方语音合成（接口已预留）。</Notice>}
      <Notice tone="info" title="声音从哪来">用浏览器和系统自带的英文语音（不联网、不用 key）。系统没有真题音频，也不会去找；口音和真实考试会有差别，练的是“听到能写对”。</Notice>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          {list.length === 0 ? (
            <EmptyState icon="✎" title="还没有要练的词">听力 / 阅读复盘里因为拼写、单复数、数字日期丢的分会自动进来；也可以在右边自己加。</EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{(index % list.length) + 1} / {list.length}</Badge>
                {current.cause && <Badge tone="warning">{current.cause}</Badge>}
                {current.source && <Badge>{current.source}</Badge>}
                {(history.words?.[current.id]?.streak || 0) >= 3 && <Badge tone="success">已连续写对 {history.words[current.id].streak} 次</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={say} disabled={!supported}>▶ 播放</Button>
                <Button variant="subtle" onClick={() => speakWithBrowser(current.say, { lang: accent, rate: 0.6, voiceName })} disabled={!supported}>慢速再听</Button>
              </div>
              <Field label="听到什么写什么" hint="回车提交；答对按回车进入下一个。">
                <TextInput
                  ref={inputRef}
                  aria-label="听写答案"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={answer}
                  onChange={event => { setAnswer(event.target.value); setChecked(null) }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                    if (checked) nextWord()
                    else check()
                  }}
                />
              </Field>
              {checked && (
                <Notice tone={checked.correct ? 'success' : 'danger'} title={checked.correct ? '对了' : '再看一眼'}>
                  {checked.correct ? `正确：${checked.expected}` : `应为：${checked.expected}${checked.errors.includes('PLURAL') ? '（单复数）' : checked.errors.includes('SPELLING') ? '（拼写差一两个字母）' : ''}`}
                </Notice>
              )}
              <div className="flex gap-2">
                <Button variant="subtle" onClick={check} disabled={!answer.trim() || !!checked}>提交</Button>
                <Button variant="ghost" onClick={nextWord}>下一个</Button>
              </div>
              <p className="text-[11px] text-fg-faint">本轮：对 {session.right} · 错 {session.wrong}</p>
            </div>
          )}
        </Panel>

        <aside className="space-y-4">
          <Panel>
            <SectionTitle title="声音" />
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {ACCENTS.map(item => (
                  <button key={item.lang} type="button" onClick={() => setAccent(item.lang)} aria-pressed={accent === item.lang} className={`rounded-full border px-2.5 py-1 text-[11px] ${accent === item.lang ? 'border-accent-border bg-accent-soft text-accent' : 'border-border-soft text-fg-muted'}`}>{item.label}</button>
                ))}
              </div>
              {voices.length > 0 && (
                <select aria-label="语音" className="w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={voiceName} onChange={event => setVoiceName(event.target.value)}>
                  <option value="">自动选择</option>
                  {voices.map(voice => <option key={voice.name} value={voice.name}>{voice.name} · {voice.lang}</option>)}
                </select>
              )}
              <Field label={`语速 ${rate.toFixed(2)}`}>
                <input type="range" min="0.5" max="1.2" step="0.05" value={rate} onChange={event => setRate(Number(event.target.value))} className="w-full" aria-label="语速" />
              </Field>
            </div>
          </Panel>
          <Panel>
            <SectionTitle title="自己加词" hint="每行一个，或用逗号隔开。" />
            <TextArea rows={4} aria-label="自己加词" value={customText} onChange={event => setCustomText(event.target.value)} placeholder={'accommodation\nWednesday\n15th February'} />
          </Panel>
        </aside>
      </div>
    </div>
  )
}
