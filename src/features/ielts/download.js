/** @param {string} filename @param {string} content @param {string} [type] */
export function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** @param {unknown} payload @param {string} filename */
export function downloadJson(filename, payload) {
  downloadTextFile(filename, `${JSON.stringify(payload, null, 2)}\n`, 'application/json;charset=utf-8')
}
