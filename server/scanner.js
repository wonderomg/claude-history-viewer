import fs from 'fs'
import path from 'path'
import os from 'os'
import { scanCursorSessions } from './scanner-cursor.js'
import { scanCodexSessions } from './scanner-codex.js'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

const SUBAGENT_ID_SEP = '::sub::'

/** 将项目目录名还原为可读路径 */
export function decodeProjectSlug(slug) {
  if (!slug || slug === '.claude') return slug
  const parts = slug.split('-').filter(Boolean)
  if (parts.length === 0) return slug
  return '/' + parts.join('/')
}

/** 子 Agent 复合 ID */
export function makeSubagentId(parentSessionId, agentFileName) {
  return `${parentSessionId}${SUBAGENT_ID_SEP}${agentFileName.replace(/\.jsonl$/, '')}`
}

export function parseSessionId(id) {
  if (!id.includes(SUBAGENT_ID_SEP)) {
    return { kind: 'main', parentSessionId: null, agentId: null }
  }
  const [parentSessionId, agentId] = id.split(SUBAGENT_ID_SEP)
  return { kind: 'subagent', parentSessionId, agentId }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

export function loadSessionMetaMap() {
  const map = new Map()
  if (!fs.existsSync(SESSIONS_DIR)) return map

  for (const file of fs.readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith('.json')) continue
    const meta = readJsonSafe(path.join(SESSIONS_DIR, file))
    if (meta?.sessionId) {
      map.set(meta.sessionId, meta)
    }
  }
  return map
}

function buildSessionRecord({
  id,
  projectSlug,
  filePath,
  metaMap,
  kind,
  parentSessionId,
  agentMeta,
}) {
  const meta = kind === 'main' ? metaMap.get(id) || {} : {}
  const preview = extractPreview(filePath)
  const stat = statSafe(filePath)

  const agentType = agentMeta?.agentType
  const agentDescription = agentMeta?.description

  let title = preview.title || meta.aiTitle
  if (!title && kind === 'subagent') {
    title = agentDescription || agentType || parseSessionId(id).agentId || 'Sub-agent'
  }
  if (!title) title = '未命名会话'

  return {
    id,
    source: 'claude',
    kind,
    parentSessionId: parentSessionId || null,
    projectSlug,
    projectPath: decodeProjectSlug(projectSlug),
    filePath,
    title,
    preview: preview.text,
    cwd: meta.cwd || preview.cwd || decodeProjectSlug(projectSlug),
    startedAt: meta.startedAt || stat?.birthtimeMs,
    updatedAt: meta.updatedAt || stat?.mtimeMs,
    version: meta.version,
    status: meta.status,
    messageCount: preview.messageCount,
    agentType,
    agentDescription,
  }
}

function scanSubagents(projectSlug, parentSessionId, metaMap) {
  const subagentsDir = path.join(
    PROJECTS_DIR,
    projectSlug,
    parentSessionId,
    'subagents'
  )
  if (!fs.existsSync(subagentsDir)) return []

  const list = []
  for (const entry of fs.readdirSync(subagentsDir)) {
    if (!entry.endsWith('.jsonl')) continue

    const filePath = path.join(subagentsDir, entry)
    const stat = statSafe(filePath)
    if (!stat) continue

    const metaPath = path.join(
      subagentsDir,
      entry.replace(/\.jsonl$/, '.meta.json')
    )
    const agentMeta = readJsonSafe(metaPath)

    list.push(
      buildSessionRecord({
        id: makeSubagentId(parentSessionId, entry),
        projectSlug,
        filePath,
        metaMap,
        kind: 'subagent',
        parentSessionId,
        agentMeta,
      })
    )
  }

  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return list
}

/**
 * 扫描 Claude Code 主会话 + 子 Agent
 */
export function scanClaudeSessions() {
  const metaMap = loadSessionMetaMap()
  const sessions = []

  if (!fs.existsSync(PROJECTS_DIR)) return sessions

  for (const projectSlug of fs.readdirSync(PROJECTS_DIR)) {
    const projectDir = path.join(PROJECTS_DIR, projectSlug)
    if (!fs.statSync(projectDir).isDirectory()) continue

    for (const entry of fs.readdirSync(projectDir)) {
      // 只处理项目根目录下的 .jsonl（主会话）
      if (!entry.endsWith('.jsonl')) continue

      const sessionId = entry.replace(/\.jsonl$/, '')
      const filePath = path.join(projectDir, entry)
      if (!fs.statSync(filePath).isFile()) continue

      const main = buildSessionRecord({
        id: sessionId,
        projectSlug,
        filePath,
        metaMap,
        kind: 'main',
        parentSessionId: null,
        agentMeta: null,
      })
      sessions.push(main)

      const subs = scanSubagents(projectSlug, sessionId, metaMap)
      sessions.push(...subs)
    }
  }

  sessions.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'main' ? -1 : 1
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
  return sessions
}

/**
 * 合并 Claude Code + Cursor + Codex 会话
 * @param {{ source?: 'all'|'claude'|'cursor'|'codex' }} options
 */
export function scanAllSessions(options = {}) {
  const { source = 'all' } = options

  let sessions = []
  if (source === 'all' || source === 'claude') {
    sessions = sessions.concat(scanClaudeSessions())
  }
  if (source === 'all' || source === 'cursor') {
    sessions = sessions.concat(scanCursorSessions())
  }
  if (source === 'all' || source === 'codex') {
    sessions = sessions.concat(scanCodexSessions())
  }

  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return sessions
}

export function findSessionById(id) {
  return scanAllSessions().find((s) => s.id === id) || null
}

/** 读取原始 JSONL 文本（按行解析为对象数组） */
export function readRawTranscript(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = []
  content.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      lines.push({ lineNumber: index + 1, raw: trimmed, json: JSON.parse(trimmed) })
    } catch {
      lines.push({ lineNumber: index + 1, raw: trimmed, json: null, parseError: true })
    }
  })
  return { lineCount: lines.length, lines }
}

function extractPreview(filePath) {
  let title = ''
  let text = ''
  let cwd = ''
  let messageCount = 0

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const headLines = content.split('\n').filter(Boolean).slice(0, 200)

    for (const line of headLines) {
      let row
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }

      if (row.type === 'ai-title' && row.aiTitle) title = row.aiTitle
      if (row.cwd) cwd = row.cwd

      if (row.type === 'user' && row.message?.content) {
        const t = extractTextContent(row.message.content)
        if (t && !text) text = t.slice(0, 120)
        if (!title) title = t.slice(0, 60)
      }
    }

    messageCount = 0
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        if (row.type === 'user' || row.type === 'assistant') messageCount++
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }

  return { title, text, cwd, messageCount }
}

function extractTextContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text || '')
    .join('\n')
}

export function getClaudeDir() {
  return CLAUDE_DIR
}
