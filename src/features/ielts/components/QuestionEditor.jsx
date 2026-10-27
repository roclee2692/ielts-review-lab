import { Button, Field, Select, TextArea, TextInput } from './ui.jsx'
import { TYPE_LABELS } from '../data/causes.js'

export default function QuestionEditor({ questions, setQuestions }) {
  const patch = (id, values) => setQuestions(items => items.map(item => item.id === id ? { ...item, ...values } : item))
  const remove = id => setQuestions(items => items.filter(item => item.id !== id))
  const add = () => setQuestions(items => [...items, {
    id: `q-manual-${Date.now()}`,
    number: String(items.length + 1),
    type: 'gap',
    prompt: '',
    key: '',
    userAnswer: '',
    instruction: '',
    options: [],
  }])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-fg">题目与答案 <span className="font-normal text-fg-faint">（自动拆题后可逐项修改）</span></p>
        <Button variant="subtle" onClick={add} className="text-xs">＋ 手动加一题</Button>
      </div>
      {questions.length === 0 && <p className="rounded-xl border border-dashed border-border-soft px-3 py-5 text-center text-xs text-fg-faint">先粘贴题目并拆题，或手动添加。</p>}
      {questions.map((question, index) => (
        <div key={question.id} className="rounded-xl border border-border-soft bg-surface-mid p-3">
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <Field label="题号" className="w-16 shrink-0"><TextInput value={question.number} onChange={event => patch(question.id, { number: event.target.value })} /></Field>
            <Field label="题型" className="min-w-44 flex-1"><Select value={question.type} onChange={event => patch(question.id, { type: event.target.value })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Button variant="danger" className="px-2 py-2 text-xs" onClick={() => remove(question.id)} aria-label={`删除第 ${index + 1} 题`}>删除</Button>
          </div>
          <Field label="题干"><TextArea rows={2} value={question.prompt} onChange={event => patch(question.id, { prompt: event.target.value })} placeholder="粘贴或输入题干" /></Field>
          {(question.type === 'mcq' || question.type === 'mcq-multi') && (
            <Field label="选项（每行一个，如 A. …）" className="mt-2"><TextArea rows={3} value={(question.options || []).join('\n')} onChange={event => patch(question.id, { options: event.target.value.split('\n').filter(Boolean) })} /></Field>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="答案册"><TextInput value={question.key} onChange={event => patch(question.id, { key: event.target.value })} placeholder="TRUE / two weeks / B" /></Field>
            <Field label="我的答案"><TextInput value={question.userAnswer || ''} onChange={event => patch(question.id, { userAnswer: event.target.value })} /></Field>
            <Field label="字数要求（可选）"><TextInput value={question.instruction || ''} onChange={event => patch(question.id, { instruction: event.target.value })} placeholder="NO MORE THAN TWO WORDS" /></Field>
            <Field label="备注 / 定位范围（可选）"><TextInput value={question.locationNote || ''} onChange={event => patch(question.id, { locationNote: event.target.value })} placeholder="如 Paragraph C" /></Field>
          </div>
        </div>
      ))}
    </div>
  )
}
