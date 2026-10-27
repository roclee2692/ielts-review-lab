import { useState } from 'react'
import { parseAnswerLine } from '../core/index.js'
import { deleteMaterial, loadMaterials } from '../storage.js'
import { Badge, Button, Field, Notice, Panel, SectionTitle, TextInput } from './ui.jsx'

/**
 * 录入提速：题集库（同一篇只录一次）+ 一行答案速记。
 * 速记只改题目的 key 或 userAnswer 字段，其余仍可在下方逐题编辑。
 */
export default function QuickEntry({ module, questions, setQuestions, onLoadMaterial, saveToLibrary, setSaveToLibrary }) {
  const [materials, setMaterials] = useState(() => loadMaterials().filter(item => item.module === module))
  const [selected, setSelected] = useState('')
  const [line, setLine] = useState('')
  const [target, setTarget] = useState('userAnswer')
  const [message, setMessage] = useState(null)

  const load = () => {
    const material = materials.find(item => item.id === selected)
    if (!material) return
    onLoadMaterial(material)
    setMessage({ tone: 'success', text: `已载入「${material.source}」的原文、${material.questions.length} 道题和答案册。只需要填你这次的答案。` })
  }

  const remove = () => {
    if (!selected) return
    setMaterials(deleteMaterial(selected).filter(item => item.module === module))
    setSelected('')
  }

  const apply = () => {
    const types = Object.fromEntries(questions.map(question => [Number(question.number), question.type]))
    const first = Number(questions[0]?.number) || 1
    const { answers, warnings } = parseAnswerLine(line, { first, types })
    if (answers.length === 0) {
      setMessage({ tone: 'danger', text: '没有识别到答案。格式示例：1 TRUE 2 NG 3 museum' })
      return
    }
    const byNumber = new Map(answers.map(item => [item.number, item.answer]))
    const known = new Set(questions.map(question => Number(question.number)))
    if (questions.length === 0) {
      // No questions yet: create bare gap questions so the answer line still works.
      setQuestions(answers.map(item => ({
        id: `q-line-${Date.now()}-${item.number}`,
        number: String(item.number),
        type: /^(true|false|not given)$/i.test(item.answer) ? 'tfng' : /^(yes|no)$/i.test(item.answer) ? 'ynng' : 'gap',
        prompt: '',
        options: [],
        key: target === 'key' ? item.answer : '',
        userAnswer: target === 'userAnswer' ? item.answer : '',
        instruction: '',
      })))
    } else {
      setQuestions(items => items.map(question => {
        const value = byNumber.get(Number(question.number))
        return value === undefined ? question : { ...question, [target]: value }
      }))
    }
    const unknown = answers.filter(item => questions.length > 0 && !known.has(item.number)).map(item => item.number)
    const notes = [...warnings, ...(unknown.length ? [`题号 ${unknown.join('、')} 不在当前题目里，已忽略`] : [])]
    setMessage({
      tone: notes.length ? 'warning' : 'success',
      text: `已填入 ${answers.length - unknown.length} 题的${target === 'key' ? '答案册' : '我的答案'}。${notes.join('；')}`,
    })
  }

  return (
    <Panel>
      <SectionTitle title="快速录入" hint="同一篇只录一次；之后重做只敲一行自己的答案。" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Field label={`题集库（${materials.length} 篇，只存在本机）`}>
            <select aria-label="题集库" className="w-full rounded-lg border border-border-soft bg-surface px-2.5 py-2 text-xs text-fg" value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="">{materials.length ? '选择已录过的一篇…' : '还没有存过题集'}</option>
              {materials.map(item => <option key={item.id} value={item.id}>{item.source} · {item.questions.length} 题</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" className="text-xs" onClick={load} disabled={!selected}>载入</Button>
            <Button variant="ghost" className="text-xs" onClick={remove} disabled={!selected}>从题集库删除</Button>
          </div>
          <label className="flex items-start gap-2 text-[11px] leading-5 text-fg-muted">
            <input type="checkbox" checked={saveToLibrary} onChange={event => setSaveToLibrary(event.target.checked)} className="mt-1" />
            判题时把原文、题目和答案册存进题集库（按来源标签覆盖；不存你的答案）。
          </label>
        </div>
        <div className="space-y-2">
          <Field label="答案速记" hint="题号 + 答案，空格分隔。判断题可写 T / F / NG / Y / N，会按题型展开。">
            <TextInput aria-label="答案速记" value={line} onChange={event => setLine(event.target.value)} placeholder="1 TRUE 2 NG 3 car park 4 B" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="速记填入位置" className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs text-fg" value={target} onChange={event => setTarget(event.target.value)}>
              <option value="userAnswer">填入我的答案</option>
              <option value="key">填入答案册</option>
            </select>
            <Button className="text-xs" onClick={apply} disabled={!line.trim()}>填入</Button>
            <Badge>{questions.length} 题已录</Badge>
          </div>
        </div>
      </div>
      {message && <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
    </Panel>
  )
}
