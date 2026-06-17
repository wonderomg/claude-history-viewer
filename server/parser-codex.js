import fs from 'fs'
import { searchMessages, dedupeHitsByMessage } from './search-utils.js'

function isEnvironmentUserText(text) {
  const t = (text || '').trim()
  if (!t) return true
  return /^<environment_context>[\s\S]*<\/environment_context>\s*$/i.test(t)
}

function extractInputText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c?.type === 'input_text' || c?.type === 'text')
    .map((c) => c.text || '')
    .join('\n')
    .trim()
}

function extractOutputText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c?.type === 'output_text' || c?.type === 'text')
    .map((c) => c.text || '')
    .join('\n')
    .trim()
}

function parseToolArguments(args) {
  if (!args) return {}
  if (typeof args === 'object') return args
  try {
    return JSON.parse(args)
  } catch {
    return { raw: String(args) }
  }
}

/**
 * 解析 Codex rollout JSONL
 * 格式：session_meta / event_msg / response_item / turn_context
 */
export function parseCodexTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').filter((l) => l.trim())

  const messages = []
  let title = ''
  let cwd = ''
  let sessionId = ''
  let model = 'Codex'
  let lineIdx = 0
  let assistantRun = null

  const flushAssistantRun = () => {
    if (!assistantRun) return
    if (assistantRun.text || assistantRun.thinking || assistantRun.toolUses.length > 0) {
      messages.push(assistantRun)
    }
    assistantRun = null
  }

  for (const line of lines) {
    lineIdx++
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }

    if (row.type === 'session_meta') {
      cwd = row.payload?.cwd || cwd
      sessionId = row.payload?.id || sessionId
      continue
    }

    if (row.type === 'turn_context') {
      if (row.payload?.model) model = row.payload.model
      continue
    }

    if (row.type === 'event_msg' && row.payload?.type === 'user_message') {
      flushAssistantRun()
      const text = (row.payload.message || '').trim()
      if (text) {
        if (!title) title = text.slice(0, 60)
        messages.push({ id: `codex-user-${lineIdx}`, role: 'user', text })
      }
      continue
    }

    if (row.type !== 'response_item') continue
    const payload = row.payload
    if (!payload) continue

    if (payload.type === 'message' && payload.role === 'user') {
      const text = extractInputText(payload.content)
      if (text && !isEnvironmentUserText(text)) {
        flushAssistantRun()
        if (!title) title = text.slice(0, 60)
        messages.push({ id: `codex-user-${lineIdx}`, role: 'user', text })
      }
      continue
    }

    if (payload.type === 'message' && payload.role === 'assistant') {
      const text = extractOutputText(payload.content)
      if (!assistantRun) {
        assistantRun = {
          id: `codex-asst-${lineIdx}`,
          role: 'assistant',
          model,
          thinking: '',
          text: '',
          toolUses: [],
        }
      }
      if (text) assistantRun.text += (assistantRun.text ? '\n' : '') + text
      continue
    }

    if (payload.type === 'reasoning') {
      if (!assistantRun) {
        assistantRun = {
          id: `codex-asst-${lineIdx}`,
          role: 'assistant',
          model,
          thinking: '',
          text: '',
          toolUses: [],
        }
      }
      const summary = Array.isArray(payload.summary) ? payload.summary.join('\n') : ''
      if (summary) assistantRun.thinking += summary
      continue
    }

    if (payload.type === 'function_call') {
      if (!assistantRun) {
        assistantRun = {
          id: `codex-asst-${lineIdx}`,
          role: 'assistant',
          model,
          thinking: '',
          text: '',
          toolUses: [],
        }
      }
      assistantRun.toolUses.push({
        id: payload.call_id || `tool-${lineIdx}-${assistantRun.toolUses.length}`,
        name: payload.name || 'function_call',
        input: parseToolArguments(payload.arguments),
      })
      continue
    }

    if (payload.type === 'web_search_call') {
      if (!assistantRun) {
        assistantRun = {
          id: `codex-asst-${lineIdx}`,
          role: 'assistant',
          model,
          thinking: '',
          text: '',
          toolUses: [],
        }
      }
      assistantRun.toolUses.push({
        id: payload.id || `web-${lineIdx}`,
        name: 'web_search',
        input: payload,
      })
    }
  }

  flushAssistantRun()

  return {
    meta: { title, cwd, sessionId, source: 'codex' },
    messages: messages.filter((m) => {
      if (m.role === 'assistant') {
        return m.text || m.thinking || m.toolUses?.length > 0
      }
      return true
    }),
  }
}

export function searchInCodexTranscript(filePath, query) {
  if (!query?.trim()) {
    return { matches: [], hits: [], total: 0 }
  }
  const { messages } = parseCodexTranscript(filePath)
  const matches = searchMessages(messages, query)
  return {
    matches,
    hits: dedupeHitsByMessage(matches),
    total: matches.length,
  }
}
