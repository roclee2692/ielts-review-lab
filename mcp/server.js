#!/usr/bin/env node
// Minimal MCP server over stdio (newline-delimited JSON-RPC 2.0), no
// dependencies. The host model calls our tools; the server never calls a
// model back (sampling is deprecated and not needed).
//
//   IELTS_LAB_DATA=/path/to/folder node mcp/server.js

import { realpathSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.js'
import { TOOLS, ToolError, callTool } from './tools.js'

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'ielts-review-lab', version: '0.3.0' }
const INSTRUCTIONS = [
  '雅思复盘引擎。流程：ingest_passage → judge_set → 对每道错题 submit_explanation → 请用户确认错因（set_cause）。',
  '对错只能由 judge_set 判；讲解只依据用户给的原文，不得推翻答案册；引用必须逐字来自原文，否则会被退回。',
  '错因只能从 judge_set 返回的 causes 里选。复练用 today / mark_reviewed，弱点画像用 weakness。',
  '同一本书同一篇只录一次：先 list_sets，有就把 set_id 传给 ingest_passage，只填这次的答案。',
].join('\n')

/**
 * @param {ReturnType<typeof createStore>} store
 * @param {any} message
 * @returns {object|null} the response, or null for notifications
 */
export function handleMessage(store, message) {
  const { id, method, params } = message || {}
  const isRequest = id !== undefined && id !== null
  const reply = (/** @type {any} */ result) => ({ jsonrpc: '2.0', id, result })
  const fail = (/** @type {number} */ code, /** @type {string} */ text) => ({ jsonrpc: '2.0', id, error: { code, message: text } })

  if (!isRequest) return null // notifications/initialized, notifications/cancelled, …

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({
        tools: Object.entries(TOOLS).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema })),
      })
    case 'tools/call': {
      const name = params?.name
      if (!TOOLS[name]) return fail(-32602, `Unknown tool: ${name}`)
      try {
        const { text, data } = callTool(store, name, params?.arguments || {})
        return reply({ content: [{ type: 'text', text }], structuredContent: data, isError: false })
      } catch (error) {
        // Validation failures are tool results, not protocol errors, so the
        // model sees the problems and can fix its call.
        const problems = error instanceof ToolError ? error.problems : []
        const text = [error instanceof Error ? error.message : String(error), ...problems.map(problem => `- ${problem}`)].join('\n')
        return reply({ content: [{ type: 'text', text }], structuredContent: { problems }, isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`)
  }
}

function main() {
  const store = createStore()
  const lines = createInterface({ input: process.stdin })
  lines.on('line', line => {
    if (!line.trim()) return
    let message
    try {
      message = JSON.parse(line)
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`)
      return
    }
    const response = handleMessage(store, message)
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
  })
  // Diagnostics go to stderr; stdout is reserved for protocol messages.
  process.stderr.write(`ielts-review-lab MCP ready · data: ${store.dir}\n`)
}

function isEntryPoint() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntryPoint()) main()
