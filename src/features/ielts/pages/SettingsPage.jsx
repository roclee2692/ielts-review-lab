import { useState } from 'react'
import { useIelts } from '../context/IeltsContext.jsx'
import { testProviderConnection } from '../ai/client.js'
import { buildReproductionBundle, clearModelAudit, loadModelAudit } from '../ai/auditLog.js'
import { emptyReviewSchedule } from '../domain/spacedRepetition.js'
import { clearIeltsData, DEFAULT_IELTS_SETTINGS, exportIeltsData, importIeltsData } from '../../../services/storage/IeltsStore.js'
import { loadMistakeStore, replaceMistakeStore } from '../../../services/storage/MistakesStore.js'
import { deleteSavedFullSource, loadReviewSummaries } from '../storage.js'
import { downloadJson } from '../download.js'
import { Button, Field, Notice, PageHeader, Panel, SectionTitle, Select, TextInput } from '../components/ui.jsx'

const PRESETS = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: null,
}

export default function SettingsPage() {
  const { settings, updateSettings, refreshRecords, records, replaceReviewSchedule, resetLearnerCollections } = useIelts()
  const [form, setForm] = useState({ ...settings })
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState('')
  const [testState, setTestState] = useState(null)
  const [reviews, setReviews] = useState(() => loadReviewSummaries())
  const [auditEntries, setAuditEntries] = useState(() => loadModelAudit())

  const patch = values => setForm(previous => ({ ...previous, ...values }))

  const save = () => {
    updateSettings(form)
    setSaved('设置已保存到当前浏览器。')
    setTimeout(() => setSaved(''), 2500)
  }

  const changeProvider = provider => {
    const preset = PRESETS[provider]
    patch({ provider, ...(preset || {}) })
  }

  const testConnection = async () => {
    setTestState({ busy: true, message: '测试中…' })
    try {
      await testProviderConnection({ baseUrl: form.baseUrl, model: form.model, apiKey: form.apiKey })
      setTestState({ busy: false, ok: true, message: '连接成功。' })
    } catch (error) {
      setTestState({ busy: false, ok: false, message: error.message })
    }
  }

  const exportData = () => {
    const payload = {
      ...exportIeltsData(),
      mistakes: loadMistakeStore(),
      note: 'API key 不进入导出文件。所有数据由用户主动导出。',
    }
    downloadJson(`ielts-lab-export-${new Date().toISOString().slice(0, 10)}.json`, payload)
  }

  const importData = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (!window.confirm('导入会用文件里的数据覆盖本机同名数据（API key 不会被导入）。继续？')) return
      const restored = importIeltsData(payload)
      if (payload.mistakes) replaceMistakeStore(payload.mistakes)
      setSaved(`已导入：${[...restored, ...(payload.mistakes ? ['mistakes'] : [])].join('、')}。刷新页面后生效。`)
    } catch (error) {
      setSaved(`导入失败：${error.message}`)
    }
  }

  const clearAll = () => {
    if (!window.confirm('确认清空所有雅思数据？将删除复盘摘要、错题、训练进度、词块笔记和 API key，且不可撤销。题集库也会一起清空。')) return
    const store = loadMistakeStore()
    replaceMistakeStore({ ...store, records: store.records.filter(record => record.domain !== 'ielts') })
    clearIeltsData()
    replaceReviewSchedule(emptyReviewSchedule())
    resetLearnerCollections()
    clearModelAudit()
    setReviews([])
    setAuditEntries([])
    refreshRecords()
    updateSettings(DEFAULT_IELTS_SETTINGS)
    setForm({ ...DEFAULT_IELTS_SETTINGS })
    setSaved('雅思本地数据已清空。')
  }

  const removeFullSource = id => {
    setReviews(deleteSavedFullSource(id))
  }

  const exportReproduction = () => {
    downloadJson(`ielts-reproduction-${new Date().toISOString().slice(0, 10)}.json`, buildReproductionBundle(auditEntries))
  }

  const clearAudit = () => {
    clearModelAudit()
    setAuditEntries([])
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="SETTINGS & DATA" title="设置与数据" description="模型由你自带。判题、错题库、归因统计、词块与计时不依赖模型；严格度只影响反馈措辞和详略。" />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <Panel>
            <SectionTitle title="学习目标" hint="目标分和严格度只用于反馈语境" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="目标分"><Select value={form.targetBand} onChange={event => patch({ targetBand: event.target.value })}><option value="6.0">6.0</option><option value="6.5">6.5</option><option value="7.0+">7.0+</option></Select></Field>
              <Field label="反馈严格度"><Select value={form.strictness} onChange={event => patch({ strictness: event.target.value })}><option value="gentle">温和</option><option value="standard">标准</option><option value="strict">严格</option></Select></Field>
            </div>
            <p className="mt-2 text-[11px] text-fg-faint">严格度不会改变确定性判题，也不会伪造分数。</p>
          </Panel>

          <Panel>
            <SectionTitle title="模型服务商（自带 key）" hint="DeepSeek 为默认；任何兼容 OpenAI Chat Completions 的服务也可用。" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="服务商"><Select value={form.provider} onChange={event => changeProvider(event.target.value)}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="custom">兼容 OpenAI 的其他服务商</option></Select></Field>
              <Field label="模型名"><TextInput value={form.model} onChange={event => patch({ model: event.target.value })} placeholder="deepseek-chat" /></Field>
              <Field label="Base URL" className="sm:col-span-2"><TextInput value={form.baseUrl} onChange={event => patch({ baseUrl: event.target.value, provider: 'custom' })} placeholder="https://api.example.com/v1" /></Field>
              <Field label="API key" className="sm:col-span-2" hint="只保存在当前浏览器 localStorage；不写入仓库、构建产物或无必要的服务器日志。">
                <div className="flex gap-2"><TextInput type={showKey ? 'text' : 'password'} autoComplete="off" value={form.apiKey} onChange={event => patch({ apiKey: event.target.value })} placeholder="sk-…" /><Button variant="subtle" className="shrink-0 text-xs" onClick={() => setShowKey(value => !value)}>{showKey ? '隐藏' : '显示'}</Button></div>
              </Field>
              <Field label="请求方式"><Select value={form.transport} onChange={event => patch({ transport: event.target.value })}><option value="direct">浏览器直连服务商</option><option value="proxy">经站内 /api/ielts/llm 转发</option></Select></Field>
              <div className="flex items-end gap-2"><Button variant="subtle" className="text-xs" onClick={testConnection} disabled={testState?.busy}>{testState?.busy ? '测试中…' : '测试连接'}</Button><Button className="text-xs" onClick={save}>保存设置</Button></div>
            </div>
            {testState?.message && <div className="mt-2"><Notice tone={testState.ok ? 'success' : 'danger'}>{testState.message}</Notice></div>}
            {saved && <div className="mt-2"><Notice tone={saved.startsWith('导入失败') ? 'danger' : 'success'}>{saved}</Notice></div>}
            <Notice tone="warning" title="中转边界">站内中转只接受注册模板 id，限制输入长度与超时，不保存请求体，也不记录 key 或原文。直连时 key 会直接发送给所选服务商。</Notice>
          </Panel>

          <Panel>
            <SectionTitle title="语音合成（预留第三方接口）" hint="默认用浏览器自带语音；不支持时界面隐藏朗读按钮。" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="提供方式"><Select value={form.ttsProvider || 'browser'} onChange={event => patch({ ttsProvider: event.target.value })}><option value="browser">浏览器语音</option><option value="custom">第三方 TTS（预留）</option></Select></Field>
              <Field label="第三方 endpoint"><TextInput value={form.ttsBaseUrl || ''} onChange={event => patch({ ttsBaseUrl: event.target.value })} placeholder="https://…" /></Field>
              <Field label="第三方 TTS key" className="sm:col-span-2" hint="仅预留接口，当前不自动调用；同样只保存在本机。"><TextInput type="password" autoComplete="off" value={form.ttsApiKey || ''} onChange={event => patch({ ttsApiKey: event.target.value })} /></Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <SectionTitle title="本地数据" hint={`${records.length} 条统一错题记录`} />
            <div className="space-y-2">
              <Button variant="subtle" className="w-full" onClick={exportData}>导出全部学习数据（不含 key）</Button>
              <label className="btn-ghost w-full cursor-pointer justify-center">
                从导出文件恢复
                <input type="file" accept="application/json,.json" className="sr-only" onChange={importData} aria-label="从导出文件恢复" />
              </label>
              <Button variant="danger" className="w-full" onClick={clearAll}>清空雅思数据</Button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-fg-faint">导出包含复盘摘要、错题、写作/口语记录、词块、笔记、替换库、复习排期、脱敏模型日志和题集库。API key 永不进入导出文件。清浏览器缓存会丢数据，建议定期导出。</p>
          </Panel>

          <Panel>
            <SectionTitle title="讲解质量日志" hint={`${auditEntries.length} 条脱敏调用记录`} />
            <div className="space-y-2">
              <Button variant="subtle" className="w-full" onClick={exportReproduction} disabled={auditEntries.length === 0}>导出复现包（不含 key / 原文）</Button>
              <Button variant="ghost" className="w-full" onClick={clearAudit} disabled={auditEntries.length === 0}>清空模型日志</Button>
            </div>
            {auditEntries.length === 0 ? <p className="mt-2 text-[11px] leading-5 text-fg-faint">真实模型调用后，这里记录模板 id、版本、输出、结构校验和引用校验结果。</p> : (
              <div className="mt-3 space-y-1.5">
                {auditEntries.slice(0, 5).map(entry => (
                  <div key={entry.id} className="rounded-lg bg-surface px-2.5 py-2 text-[10px] text-fg-muted">
                    <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-fg">{entry.templateId}@{entry.templateVersion}</span><span className={entry.status === 'success' ? 'text-success' : 'text-warning'}>{entry.status}</span></div>
                    <p className="mt-1 text-fg-faint">{new Date(entry.at).toLocaleString('zh-CN')} · 校验错误 {entry.validationErrors?.length || 0} · 证据 {entry.evidenceVerification ? (entry.evidenceVerification.ok ? '通过' : '未通过') : '不适用'}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle title="已保存的全文" hint={`${reviews.filter(review => review.fullSource).length} 篇`} />
            {reviews.filter(review => review.fullSource).length === 0 ? <p className="text-xs leading-5 text-fg-faint">没有保存全文。默认只保留讲解定位所需片段。</p> : (
              <div className="space-y-2">{reviews.filter(review => review.fullSource).map(review => <div key={review.id} className="rounded-lg border border-border-soft bg-surface px-3 py-2"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold text-fg">{review.source}</p><p className="text-[10px] text-fg-faint">{review.module === 'reading' ? '阅读' : '听力'} · {review.fullSource.length} 字符</p></div><Button variant="danger" className="text-[10px]" onClick={() => removeFullSource(review.id)}>删除全文</Button></div></div>)}</div>
            )}
          </Panel>

          <Panel>
            <SectionTitle title="安全与版权" />
            <ul className="space-y-2 text-xs leading-5 text-fg-muted">
              <li>• Key 只存浏览器；请求前逐次展示发送内容。</li>
              <li>• 不内置雅思官方或剑桥真题、音频、文稿。</li>
              <li>• 模拟反馈会醒目标注，不能冒充真实讲解。</li>
              <li>• 估算分数不是官方成绩，写作/口语单项取整含非官方假设。</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
