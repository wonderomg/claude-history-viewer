import fs from 'fs'

/** @param {string} raw */
export function formatToolName(raw) {
  if (!raw) return 'unknown'
  if (raw.startsWith('mcp__')) {
    const parts = raw.split('__')
    if (parts.length >= 3) return `MCP ${formatToolName(parts[1])}`
    if (parts.length >= 2) return `MCP ${formatToolName(parts[1])}`
  }
  if (raw === 'CallMcpTool') return 'MCP'
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** @param {Map<string, number>} counts @param {string} name @param {number} [n] */
function bump(counts, name, n = 1) {
  const key = formatToolName(name)
  counts.set(key, (counts.get(key) || 0) + n)
}

/** @param {object[]} blocks @param {Map<string, number>} counts */
function collectToolBlocks(blocks, counts) {
  if (!Array.isArray(blocks)) return
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'tool_use' && block.name) {
      bump(counts, block.name)
      continue
    }
    if (block.name && (block.input != null || block.arguments != null)) {
      bump(counts, block.name)
    }
  }
}

/** @param {string} filePath */
export function extractToolsFromClaudeFile(filePath) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let row
      try {
        row = JSON.parse(trimmed)
      } catch {
        continue
      }
      if (row.type !== 'assistant') continue
      collectToolBlocks(row.message?.content, counts)
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractToolsFromCursorFile(filePath) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let row
      try {
        row = JSON.parse(trimmed)
      } catch {
        continue
      }
      collectToolBlocks(row.message?.content || row.content, counts)
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractToolsFromCodexFile(filePath) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let row
      try {
        row = JSON.parse(trimmed)
      } catch {
        continue
      }

      if (row.type === 'event_msg') {
        const payload = row.payload || {}
        if (payload.type === 'mcp_tool_call_end') {
          const inv = payload.invocation || {}
          bump(counts, inv.tool ? `mcp__${inv.server || 'mcp'}__${inv.tool}` : inv.server || 'mcp')
        } else if (payload.type === 'web_search_end') {
          bump(counts, 'web_search')
        }
        continue
      }

      if (row.type !== 'response_item') continue
      const payload = row.payload || {}
      if (payload.type === 'function_call' && payload.name) {
        bump(counts, payload.name)
      } else if (payload.type === 'web_search_call') {
        bump(counts, 'web_search')
      }
    }
  } catch {
    return counts
  }
  return counts
}

/**
 * @param {object[]} sessions
 * @param {'claude'|'cursor'|'codex'} source
 */
export function aggregateTopTools(sessions, source) {
  /** @type {Map<string, { name: string, calls: number, sessions: number }>} */
  const map = new Map()

  const extract =
    source === 'codex'
      ? extractToolsFromCodexFile
      : source === 'cursor'
        ? extractToolsFromCursorFile
        : extractToolsFromClaudeFile

  for (const session of sessions) {
    if (session.source !== source || !session.filePath) continue
    const counts = extract(session.filePath)
    if (!counts.size) continue

    const seenInSession = new Set()
    for (const [name, calls] of counts) {
      if (!map.has(name)) map.set(name, { name, calls: 0, sessions: 0 })
      const entry = map.get(name)
      entry.calls += calls
      if (!seenInSession.has(name)) {
        entry.sessions += 1
        seenInSession.add(name)
      }
    }
  }

  return [...map.values()].sort((a, b) => b.calls - a.calls || b.sessions - a.sessions).slice(0, 8)
}
