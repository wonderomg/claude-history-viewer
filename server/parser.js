import fs from 'fs'
import { searchMessages, dedupeHitsByMessage } from './search-utils.js'

const SKIP_TYPES = new Set([
  'file-history-snapshot',
  'permission-mode',
  'last-prompt',
  'queue-operation',
])

/**
 * 解析 JSONL 为前端可渲染的消息列表
 * @returns {{ messages: object[], meta: object }}
 */
export function parseTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').filter((l) => l.trim())

  const messages = []
  const assistantBuffer = new Map() // messageId -> merged assistant
  let title = ''
  let cwd = ''
  let sessionId = ''

  const flushAssistant = (msgId) => {
    const buf = assistantBuffer.get(msgId)
    if (!buf) return
    messages.push(buf)
    assistantBuffer.delete(msgId)
  }

  for (const line of lines) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }

    if (row.sessionId) sessionId = row.sessionId
    if (row.cwd) cwd = row.cwd
    if (row.type === 'ai-title' && row.aiTitle) title = row.aiTitle

    if (SKIP_TYPES.has(row.type)) continue

    if (row.type === 'attachment') {
      const att = row.attachment
      if (att?.type === 'skill_listing') continue // 技能列表太长，默认折叠为摘要
      messages.push({
        id: row.uuid,
        role: 'system',
        subtype: 'attachment',
        timestamp: row.timestamp,
        attachmentType: att?.type,
        text: typeof att?.content === 'string' ? att.content : JSON.stringify(att, null, 2),
      })
      continue
    }

    if (row.type === 'system') {
      if (row.subtype === 'turn_duration') {
        messages.push({
          id: row.uuid,
          role: 'system',
          subtype: 'turn_duration',
          timestamp: row.timestamp,
          durationMs: row.durationMs,
          messageCount: row.messageCount,
        })
      }
      continue
    }

    if (row.type === 'user') {
      // flush any pending assistants before user turn
      for (const msgId of [...assistantBuffer.keys()]) {
        flushAssistant(msgId)
      }

      const content = row.message?.content
      const toolResults = []
      let text = ''

      if (typeof content === 'string') {
        text = content
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text') text += (block.text || '') + '\n'
          if (block?.type === 'tool_result') {
            toolResults.push({
              toolUseId: block.tool_use_id,
              content: normalizeToolResultContent(block.content),
              isError: !!block.is_error,
            })
          }
        }
        text = text.trim()
      }

      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          messages.push({
            id: `${row.uuid}-${tr.toolUseId}`,
            role: 'tool_result',
            timestamp: row.timestamp,
            toolUseId: tr.toolUseId,
            content: tr.content,
            isError: tr.isError,
          })
        }
      }

      if (text) {
        messages.push({
          id: row.uuid,
          role: 'user',
          timestamp: row.timestamp,
          text,
        })
      }
      continue
    }

    if (row.type === 'assistant') {
      const msg = row.message
      if (!msg) continue

      const msgId = msg.id || row.uuid
      let buf = assistantBuffer.get(msgId)
      if (!buf) {
        buf = {
          id: row.uuid,
          messageId: msgId,
          role: 'assistant',
          timestamp: row.timestamp,
          model: msg.model,
          thinking: '',
          text: '',
          toolUses: [],
        }
        assistantBuffer.set(msgId, buf)
      }

      if (row.timestamp) buf.timestamp = row.timestamp
      if (msg.model) buf.model = msg.model

      for (const block of msg.content || []) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'thinking' && block.thinking) {
          buf.thinking += block.thinking
        }
        if (block.type === 'text' && block.text) {
          buf.text += block.text
        }
        if (block.type === 'tool_use') {
          buf.toolUses.push({
            id: block.id,
            name: block.name,
            input: block.input,
          })
        }
      }
    }
  }

  // flush remaining assistants
  for (const msgId of [...assistantBuffer.keys()]) {
    flushAssistant(msgId)
  }

  return {
    meta: { sessionId, title, cwd },
    messages: messages.filter((m) => {
      if (m.role === 'assistant') {
        return m.text || m.thinking || (m.toolUses && m.toolUses.length > 0)
      }
      return true
    }),
  }
}

function normalizeToolResultContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c
        if (c?.type === 'text') return c.text
        return JSON.stringify(c)
      })
      .join('\n')
  }
  return JSON.stringify(content, null, 2)
}

/** 在会话 transcript 中全文搜索 */
export function searchInTranscript(filePath, query) {
  if (!query?.trim()) {
    return { matches: [], hits: [], total: 0 }
  }
  const { messages } = parseTranscript(filePath)
  const matches = searchMessages(messages, query)
  return {
    matches,
    hits: dedupeHitsByMessage(matches),
    total: matches.length,
  }
}
