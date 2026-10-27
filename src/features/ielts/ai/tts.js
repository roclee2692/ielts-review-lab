// Browser speech is the default. This is the extension point for a future
// bring-your-own-key speech provider; no request is made unless configured.

export function browserSpeechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}
export function speakWithBrowser(text, { lang = 'en-GB', rate = 0.95 } = {}) {
  if (!browserSpeechAvailable()) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(String(text || ''))
  utterance.lang = lang
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
  return true
}

export async function synthesizeWithProvider({ text, settings, fetchImpl = globalThis.fetch }) {
  if (!settings?.ttsBaseUrl || !settings?.ttsApiKey) {
    throw new Error('第三方语音合成尚未配置；可使用浏览器朗读')
  }
  const response = await fetchImpl(settings.ttsBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.ttsApiKey}` },
    body: JSON.stringify({ text, voice: settings.ttsProvider }),
  })
  if (!response.ok) throw new Error(`语音合成失败：HTTP ${response.status}`)
  return response.blob()
}
