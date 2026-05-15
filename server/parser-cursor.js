import fs from 'fs'
import { searchMessages, dedupeHitsByMessage } from './search-utils.js'

/** 从 Cursor 用户消息中提取可读文本 */
function extractCursorUserText(content) {
  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    text = content
      .filter((c) => c?.type === 'text')
      .map((c) => c.text || '')
      .join('\n')
  }
  text = text.replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, '')
  const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i)
  if (m) text = m[1].trim()
  return text.trim()
}

/**
 * 解析 Cursor agent-transcripts JSONL
 * 格式：每行 { role: 'user'|'assistant', message: { content: [...] } }
 */
export function parseCursorTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').filter((l) => l.trim())

  const messages = []
  let title = ''
  let lineIdx = 0
  let assistantRun = null

  const flushAssistantRun = () => {
    if (!assistantRun) return
    if (assistantRun.text || assistantRun.toolUses.length > 0 || assistantRun.thinking) {
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

    const role = row.role || row.type
    if (!role) continue

    if (role === 'user') {
      flushAssistantRun()
      const text = extractCursorUserText(row.message?.content)
      if (text) {
        if (!title) title = text.slice(0, 60)
        messages.push({
          id: `cursor-user-${lineIdx}`,
          role: 'user',
          text,
        })
      }
      continue
    }

    if (role === 'assistant') {
      const content = row.message?.content
      if (!Array.isArray(content)) continue

      if (!assistantRun) {
        assistantRun = {
          id: `cursor-asst-${lineIdx}`,
          role: 'assistant',
          model: 'Cursor',
          thinking: '',
          text: '',
          toolUses: [],
        }
      }

      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'thinking' && block.thinking) {
          assistantRun.thinking += block.thinking
        }
        if (block.type === 'text' && block.text) {
          assistantRun.text += block.text
        }
        if (block.type === 'tool_use' || block.name) {
          assistantRun.toolUses.push({
            id: block.id || `tool-${lineIdx}-${assistantRun.toolUses.length}`,
            name: block.name || block.type,
            input: block.input || {},
          })
        }
      }
    }
  }

  flushAssistantRun()

  return {
    meta: { title, cwd: '', sessionId: '', source: 'cursor' },
    messages: messages.filter((m) => {
      if (m.role === 'assistant') {
        return m.text || m.thinking || m.toolUses?.length > 0
      }
      return true
    }),
  }
}

export function searchInCursorTranscript(filePath, query) {
  if (!query?.trim()) {
    return { matches: [], hits: [], total: 0 }
  }
  const { messages } = parseCursorTranscript(filePath)
  const matches = searchMessages(messages, query)
  return {
    matches,
    hits: dedupeHitsByMessage(matches),
    total: matches.length,
  }
}
