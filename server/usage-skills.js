import fs from 'fs'

/** @param {string} raw */
export function formatSkillName(raw) {
  if (!raw) return 'unknown'
  const name = raw.includes(':') ? raw.split(':').pop() : raw
  if (name.startsWith('.') || name === 'system') return ''
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** @param {string} text @param {Map<string, number>} counts */
function collectSkillsFromText(text, counts) {
  if (!text) return

  const patterns = [
    /\/\.codex\/skills\/(?:[^/]+\/)?([^/]+)\/SKILL\.md/gi,
    /\/\.skillshub\/([^/]+)\/SKILL\.md/gi,
    /\/\.cursor\/skills(?:-cursor)?\/([^/]+)\/SKILL\.md/gi,
    /\/plugins\/cache\/[^/]+\/[^/]+\/skills\/([^/]+)\/SKILL\.md/gi,
    /\/skills\/([^/]+)\/SKILL\.md/gi,
  ]

  for (const re of patterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const name = formatSkillName(m[1])
      if (name) counts.set(name, (counts.get(name) || 0) + 1)
    }
  }

  const openskills = text.match(/openskills\s+read\s+([^\n"'`;]+)/i)
  if (openskills) {
    for (const part of openskills[1].split(/[,\s]+/)) {
      const name = formatSkillName(part.trim())
      if (name) counts.set(name, (counts.get(name) || 0) + 1)
    }
  }
}

/** @param {object[]} blocks @param {Map<string, number>} counts */
function collectSkillsFromToolBlocks(blocks, counts) {
  if (!Array.isArray(blocks)) return

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const name = block.name || ''
    const input = block.input || block.arguments || {}
    const inputText = typeof input === 'string' ? input : JSON.stringify(input)

    if (['Read', 'ReadFile', 'Write', 'StrReplace', 'Glob', 'Grep'].includes(name)) {
      collectSkillsFromText(inputText, counts)
    }

    if (name === 'Bash' || name === 'Shell') {
      const cmd = typeof input === 'object' ? input.command || inputText : inputText
      collectSkillsFromText(cmd, counts)
    }
  }
}

/** @param {string} filePath */
export function extractSkillsFromClaudeFile(filePath) {
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
      if (row.type === 'assistant') {
        collectSkillsFromToolBlocks(row.message?.content, counts)
      }
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractSkillsFromCursorFile(filePath) {
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
      collectSkillsFromToolBlocks(blocks, counts)
    }
  } catch {
    return counts
  }
  return counts
}

/** @param {string} filePath */
export function extractSkillsFromCodexFile(filePath) {
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

      if (row.type !== 'response_item') continue
      const payload = row.payload || {}
      if (payload.type !== 'function_call') continue

      const argsText =
        typeof payload.arguments === 'string'
          ? payload.arguments
          : JSON.stringify(payload.arguments || {})

      collectSkillsFromText(argsText, counts)
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
export function aggregateTopSkills(sessions, source) {
  /** @type {Map<string, { name: string, calls: number, sessions: number }>} */
  const map = new Map()

  const extract =
    source === 'codex'
      ? extractSkillsFromCodexFile
      : source === 'cursor'
        ? extractSkillsFromCursorFile
        : extractSkillsFromClaudeFile

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
