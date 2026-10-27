import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  DEFAULT_IELTS_SETTINGS,
  IELTS_KEYS,
  loadIeltsSettings,
  loadIeltsValue,
  saveIeltsSettings,
  saveIeltsValue,
} from '../../../services/storage/IeltsStore.js'
import { loadMistakeStore } from '../../../services/storage/MistakesStore.js'
import { buildRequestPreview, invokeTemplate } from '../ai/client.js'
import { buildMockOutput } from '../ai/mock.js'
import { appendModelAudit, updateAuditEvidence, verifyTemplateEvidence } from '../ai/auditLog.js'
import { Button, Modal, Notice } from '../components/ui.jsx'
import { applyReviewGrade, emptyReviewSchedule, normalizeReviewSchedule } from '../domain/spacedRepetition.js'

const IeltsContext = createContext(null)

export function IeltsProvider({ children }) {
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_IELTS_SETTINGS, ...loadIeltsSettings() }))
  const [records, setRecords] = useState(() => loadMistakeStore().records)
  const [vocabState, setVocabState] = useState(() => loadIeltsValue(IELTS_KEYS.vocab, { favorites: [], custom: [] }))
  const [replacements, setReplacements] = useState(() => loadIeltsValue(IELTS_KEYS.replacements, []))
  const [knowledgeState, setKnowledgeState] = useState(() => loadIeltsValue(IELTS_KEYS.knowledge, { notes: [], edited: {} }))
  const [reviewSchedule, setReviewSchedule] = useState(() => normalizeReviewSchedule(loadIeltsValue(IELTS_KEYS.reviewSchedule, emptyReviewSchedule())))
  const [modelRequest, setModelRequest] = useState(null)
  const [modelError, setModelError] = useState('')
  const [modelBusy, setModelBusy] = useState(false)

  const updateSettings = useCallback(patch => {
    const next = saveIeltsSettings(patch)
    setSettingsState(next)
    return next
  }, [])

  const refreshRecords = useCallback(() => {
    const next = loadMistakeStore().records
    setRecords(next)
    return next
  }, [])

  const updateVocab = useCallback(patch => {
    setVocabState(previous => {
      const next = { ...previous, ...patch }
      saveIeltsValue(IELTS_KEYS.vocab, next)
      return next
    })
  }, [])

  const addReplacement = useCallback(pair => {
    setReplacements(previous => {
      const id = `${pair.question}→${pair.passage}`
      if (previous.some(item => item.id === id)) return previous
      const next = [{ ...pair, id, createdAt: Date.now() }, ...previous]
      saveIeltsValue(IELTS_KEYS.replacements, next)
      return next
    })
  }, [])

  const updateKnowledge = useCallback(patch => {
    setKnowledgeState(previous => {
      const next = { ...previous, ...patch }
      saveIeltsValue(IELTS_KEYS.knowledge, next)
      return next
    })
  }, [])

  const replaceReviewSchedule = useCallback(schedule => {
    const next = normalizeReviewSchedule(schedule)
    saveIeltsValue(IELTS_KEYS.reviewSchedule, next)
    setReviewSchedule(next)
    return next
  }, [])

  const resetLearnerCollections = useCallback(() => {
    setVocabState({ favorites: [], custom: [] })
    setReplacements([])
    setKnowledgeState({ notes: [], edited: {} })
  }, [])

  const gradeReviewItem = useCallback((item, grade) => {
    const next = applyReviewGrade(reviewSchedule, item, grade)
    saveIeltsValue(IELTS_KEYS.reviewSchedule, next)
    setReviewSchedule(next)
    return next
  }, [reviewSchedule])

  const requestModel = useCallback((templateId, variables) => new Promise(resolve => {
    try {
      const preview = buildRequestPreview(templateId, variables, settings)
      setModelError('')
      setModelRequest({ preview, variables, resolve })
    } catch (error) {
      setModelError(error.message)
      resolve(null)
    }
  }), [settings])

  const closeModel = useCallback(() => {
    if (modelBusy) return
    modelRequest?.resolve(null)
    setModelRequest(null)
    setModelError('')
  }, [modelBusy, modelRequest])

  const confirmModel = async () => {
    if (!modelRequest) return
    setModelBusy(true)
    setModelError('')
    try {
      const result = await invokeTemplate(modelRequest.preview.templateId, modelRequest.variables, {
        settings,
        onAudit: event => appendModelAudit(event),
      })
      if (result.meta?.auditId) {
        const verification = verifyTemplateEvidence(modelRequest.preview.templateId, modelRequest.variables, result.data)
        if (verification) updateAuditEvidence(result.meta.auditId, verification)
      }
      modelRequest.resolve(result)
      setModelRequest(null)
    } catch (error) {
      setModelError(error.message)
    } finally {
      setModelBusy(false)
    }
  }

  const useMock = () => {
    if (!modelRequest) return
    try {
      const result = buildMockOutput(modelRequest.preview.templateId, modelRequest.variables)
      modelRequest.resolve(result)
      setModelRequest(null)
      setModelError('')
    } catch (error) {
      setModelError(error.message)
    }
  }

  const value = useMemo(() => ({
    settings,
    updateSettings,
    records,
    refreshRecords,
    vocabState,
    updateVocab,
    replacements,
    addReplacement,
    knowledgeState,
    updateKnowledge,
    reviewSchedule,
    replaceReviewSchedule,
    resetLearnerCollections,
    gradeReviewItem,
    requestModel,
    hasKey: !!settings.apiKey,
  }), [settings, updateSettings, records, refreshRecords, vocabState, updateVocab, replacements, addReplacement, knowledgeState, updateKnowledge, reviewSchedule, replaceReviewSchedule, resetLearnerCollections, gradeReviewItem, requestModel])

  return (
    <IeltsContext.Provider value={value}>
      {children}
      <Modal
        open={!!modelRequest}
        title="发送给模型前确认"
        onClose={closeModel}
        width="max-w-3xl"
        footer={(
          <>
            <Button variant="ghost" onClick={closeModel} disabled={modelBusy}>取消</Button>
            <Button variant="subtle" onClick={useMock} disabled={modelBusy}>使用模拟反馈</Button>
            <Button onClick={confirmModel} disabled={!settings.apiKey || modelBusy}>
              {modelBusy ? '请求中…' : settings.apiKey ? '确认发送' : '需要配置模型'}
            </Button>
          </>
        )}
      >
        {modelRequest && (
          <div className="space-y-3 text-xs leading-6 text-fg-muted">
            <Notice tone="warning" title="将发送到模型服务商">
              本次会发送模板 <code>{modelRequest.preview.templateId}</code> v{modelRequest.preview.templateVersion} 的变量，包括你录入的原文/文稿、题目、答案和作答。
              {modelRequest.preview.transport === 'proxy' ? ' 本次经站内 /api/ielts/llm 仅转发，不保存请求内容。' : ' 本次由浏览器直接请求服务商。'}
            </Notice>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border-soft bg-surface p-3">服务商：{modelRequest.preview.provider}</div>
              <div className="rounded-lg border border-border-soft bg-surface p-3">模型：{modelRequest.preview.model}</div>
              <div className="rounded-lg border border-border-soft bg-surface p-3">模板用途：{modelRequest.preview.purpose}</div>
              <div className="rounded-lg border border-border-soft bg-surface p-3">约 {modelRequest.preview.characterCount} 字符</div>
            </div>
            <details className="rounded-xl border border-border-soft bg-surface p-3">
              <summary className="cursor-pointer font-semibold text-fg">展开查看完整发送内容</summary>
              <div className="mt-3 space-y-3">
                {modelRequest.preview.messages.map((message, index) => (
                  <div key={index}>
                    <p className="font-semibold text-fg">{message.role === 'system' ? '系统约束' : '发送内容'}</p>
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg p-3 font-mono text-[11px] leading-5 text-fg-muted">{message.content}</pre>
                  </div>
                ))}
              </div>
            </details>
            {!settings.apiKey && <Notice tone="danger">没有 API key。你仍可使用明确标注的模拟反馈完成流程，或先去设置配置自己的 key。</Notice>}
            {modelError && <Notice tone="danger" title="本次请求失败">{modelError}</Notice>}
            <p className="text-[11px] text-fg-faint">API key 只保存在本机浏览器；请求预览与日志不会写入模型 key。</p>
          </div>
        )}
      </Modal>
    </IeltsContext.Provider>
  )
}

export function useIelts() {
  const value = useContext(IeltsContext)
  if (!value) throw new Error('useIelts must be used inside IeltsProvider')
  return value
}
