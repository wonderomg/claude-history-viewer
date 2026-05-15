/** 在文本中查找所有匹配起始位置（不区分大小写） */
export function findOccurrencesInText(text, query) {
  if (!text || !query?.trim()) return []
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const indices = []
  let pos = 0
  while (pos < lower.length) {
    const idx = lower.indexOf(q, pos)
    if (idx === -1) break
    indices.push(idx)
    pos = idx + Math.max(q.length, 1)
  }
  return indices
}

export function extractSnippetAt(text, query, atIndex, radius = 80) {
  if (!text) return ''
  const start = Math.max(0, atIndex - radius)
  const end = Math.min(text.length, atIndex + query.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

/** 与 MessageBubble DOM 顺序一致的可搜索文本段 */
export function getMessageSearchSegments(msg) {
  const segments = []
  if (msg.role === 'user') {
    if (msg.text) segments.push(msg.text)
    return segments
  }
  if (msg.role === 'assistant') {
    if (msg.thinking) segments.push(msg.thinking)
    if (msg.toolUses?.length) {
      for (const t of msg.toolUses) {
        segments.push(t.name || '')
        segments.push(JSON.stringify(t.input ?? {}))
      }
    }
    if (msg.text) segments.push(msg.text)
    return segments
  }
  if (msg.role === 'tool_result' && msg.content) {
    segments.push(msg.content)
    return segments
  }
  if (msg.text) segments.push(msg.text)
  if (msg.thinking) segments.push(msg.thinking)
  if (msg.content) segments.push(msg.content)
  return segments
}

export function findMatchesInMessage(msg, query) {
  const q = query.trim()
  if (!q) return []
  const matches = []
  for (const text of getMessageSearchSegments(msg)) {
    for (const charIndex of findOccurrencesInText(text, q)) {
      matches.push({
        messageId: msg.id,
        role: msg.role,
        snippet: extractSnippetAt(text, q, charIndex),
        charIndex,
      })
    }
  }
  return matches
}

/** 扁平化所有出现位置，带全局 index */
export function searchMessages(messages, query) {
  const q = query?.trim()
  if (!q) return []
  const matches = []
  let index = 0
  for (const msg of messages) {
    for (const m of findMatchesInMessage(msg, q)) {
      matches.push({ ...m, index: index++ })
    }
  }
  return matches
}

/** 按消息去重，供会话命中 chips 使用 */
export function dedupeHitsByMessage(matches) {
  const seen = new Set()
  const hits = []
  for (const m of matches) {
    if (seen.has(m.messageId)) continue
    seen.add(m.messageId)
    hits.push({ messageId: m.messageId, role: m.role, snippet: m.snippet })
  }
  return hits
}
