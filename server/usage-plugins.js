import fs from 'fs'

/** @param {string} raw */
export function formatPluginName(raw) {
  if (!raw) return 'unknown'
  const known = {
    browser: 'Browser',
    documents: 'Documents',
    presentations: 'Presentations',
    spreadsheets: 'Spreadsheets',
    'browser-use': 'Browser',
    node_repl: 'Browser',
  }
  const key = raw.toLowerCase()
  if (known[key]) return known[key]
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** @param {Map<string, number>} counts @param {string} name @param {number} [n] */
function bump(counts, name, n = 1) {
  const key = formatPluginName(name)
  counts.set(key, (counts.get(key) || 0) + n)
}

/** @param {string} text */
function pluginsFromCodexPath(text) {
  /** @type {string[]} */
  const found = []
  const re = /\/plugins\/cache\/[^/]+\/([^/]+)\//gi
  let m
  while ((m = re.exec(text)) !== null) {
    found.push(m[1])
  }
  return found
}

/** @param {string} filePath */
export function extractPluginsFromClaudeFile(filePath) {
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
      for (const block of row.message?.content || []) {
        if (block?.type !== 'tool_use') continue
        const name = block.name || ''
        if (name.startsWith('mcp__')) {
          const parts = name.split('__')
          if (parts.length >= 2) bump(counts, parts[1])
        }
      }
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractPluginsFromCursorFile(filePath) {
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

      const blocks = row.message?.content || row.content || []
      if (!Array.isArray(blocks)) continue

      for (const block of blocks) {
        if (!block || typeof block !== 'object') continue
        const isToolUse = block.type === 'tool_use' || block.name
        if (!isToolUse) continue

        const name = block.name || ''
        if (name.startsWith('mcp__')) {
          const parts = name.split('__')
          if (parts.length >= 2) bump(counts, parts[1])
          continue
        }

        if (name === 'CallMcpTool') {
          const input = block.input || block.arguments || {}
          if (input.server) bump(counts, input.server)
        }
      }
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractPluginsFromCodexFile(filePath) {
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
          const blob = JSON.stringify(inv)
          const fromPath = pluginsFromCodexPath(blob)
          if (fromPath.length) {
            for (const p of fromPath) bump(counts, p)
          } else if (inv.server) {
            bump(counts, inv.server)
          }
        }
        continue
      }

      if (row.type !== 'response_item') continue
      const payload = row.payload || {}
      if (payload.type !== 'function_call') continue

      const argsText =
        typeof payload.arguments === 'string'
          ? payload.arguments
          : JSON.stringify(payload.arguments || {})

      for (const p of pluginsFromCodexPath(argsText)) {
        bump(counts, p)
      }

      const skillName = payload.name || ''
      if (skillName.includes(':')) {
        const prefix = skillName.split(':')[0]
        if (['browser', 'documents', 'presentations', 'spreadsheets'].includes(prefix.toLowerCase())) {
          bump(counts, prefix)
        }
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
export function aggregateTopPlugins(sessions, source) {
  /** @type {Map<string, { name: string, calls: number, sessions: number }>} */
  const map = new Map()

  const extract =
    source === 'codex'
      ? extractPluginsFromCodexFile
      : source === 'cursor'
        ? extractPluginsFromCursorFile
        : extractPluginsFromClaudeFile

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

  return [...map.values()].sort((a, b) => b.calls - a.calls || b.sessions - a.sessions).slice(0, 6)
}
