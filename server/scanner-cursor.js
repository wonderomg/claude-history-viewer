import fs from 'fs'
import path from 'path'
import os from 'os'
import { decodeProjectSlug } from './scanner.js'

const CURSOR_DIR = path.join(os.homedir(), '.cursor')
const PROJECTS_DIR = path.join(CURSOR_DIR, 'projects')
const SOURCE = 'cursor'
const ID_PREFIX = 'cursor::'

export function cursorSessionId(uuid) {
  return `${ID_PREFIX}${uuid}`
}

export function parseCursorSessionId(id) {
  if (!id.startsWith(ID_PREFIX)) return null
  const rest = id.slice(ID_PREFIX.length)
  if (rest.includes('::sub::')) {
    const [parent, agent] = rest.split('::sub::')
    return { uuid: parent, parentSessionId: cursorSessionId(parent), agentId: agent, kind: 'subagent' }
  }
  return { uuid: rest, kind: 'main' }
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function extractPreview(filePath) {
  let title = ''
  let text = ''
  let messageCount = 0

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n').slice(0, 100)) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        const role = row.role || row.type
        if (role === 'user' && row.message?.content) {
          messageCount++
          const c = row.message.content
          let t = ''
          if (typeof c === 'string') t = c
          else if (Array.isArray(c)) {
            t = c.filter((x) => x?.type === 'text').map((x) => x.text).join('')
          }
          const m = t.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i)
          if (m) t = m[1]
          t = t.replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, '').trim()
          if (t && !text) text = t.slice(0, 120)
          if (t && !title) title = t.slice(0, 60)
        }
        if (role === 'assistant') messageCount++
      } catch {
        /* skip */
      }
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        if (row.role === 'user' || row.role === 'assistant') messageCount++
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }

  return { title, text, messageCount }
}

function decodeCursorProjectSlug(slug) {
  if (/^\d+$/.test(slug)) return `Cursor 工作区 #${slug}`
  return decodeProjectSlug(slug)
}

function buildRecord({
  id,
  projectSlug,
  filePath,
  kind,
  parentSessionId,
  stat,
}) {
  const preview = extractPreview(filePath)
  return {
    id,
    source: SOURCE,
    kind,
    parentSessionId,
    projectSlug,
    projectPath: decodeCursorProjectSlug(projectSlug),
    filePath,
    title: preview.title || (kind === 'subagent' ? 'Sub-agent' : '未命名会话'),
    preview: preview.text,
    cwd: decodeCursorProjectSlug(projectSlug),
    startedAt: stat?.birthtimeMs,
    updatedAt: stat?.mtimeMs,
    messageCount: preview.messageCount,
    agentType: kind === 'subagent' ? 'cursor-subagent' : null,
    agentDescription: null,
  }
}

function scanCursorSubagents(projectSlug, parentUuid, transcriptsDir) {
  const subDir = path.join(transcriptsDir, parentUuid, 'subagents')
  if (!fs.existsSync(subDir)) return []

  const list = []
  for (const entry of fs.readdirSync(subDir)) {
    if (!entry.endsWith('.jsonl')) continue
    const filePath = path.join(subDir, entry)
    const stat = statSafe(filePath)
    if (!stat) continue

    const agentId = entry.replace(/\.jsonl$/, '')
    const parentId = cursorSessionId(parentUuid)
    list.push(
      buildRecord({
        id: `${parentId}::sub::${agentId}`,
        projectSlug,
        filePath,
        kind: 'subagent',
        parentSessionId: parentId,
        stat,
      })
    )
  }
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return list
}

/** 扫描 ~/.cursor/projects 下 agent-transcripts 目录中的 jsonl */
export function scanCursorSessions() {
  const sessions = []
  if (!fs.existsSync(PROJECTS_DIR)) return sessions

  for (const projectSlug of fs.readdirSync(PROJECTS_DIR)) {
    const transcriptsDir = path.join(PROJECTS_DIR, projectSlug, 'agent-transcripts')
    if (!fs.existsSync(transcriptsDir)) continue

    for (const sessionUuid of fs.readdirSync(transcriptsDir)) {
      const sessionDir = path.join(transcriptsDir, sessionUuid)
      if (!fs.statSync(sessionDir).isDirectory()) continue

      const mainFile = path.join(sessionDir, `${sessionUuid}.jsonl`)
      if (fs.existsSync(mainFile) && fs.statSync(mainFile).isFile()) {
        const stat = statSafe(mainFile)
        sessions.push(
          buildRecord({
            id: cursorSessionId(sessionUuid),
            projectSlug,
            filePath: mainFile,
            kind: 'main',
            parentSessionId: null,
            stat,
          })
        )
        sessions.push(...scanCursorSubagents(projectSlug, sessionUuid, transcriptsDir))
      }
    }
  }

  return sessions
}

export function getCursorDir() {
  return CURSOR_DIR
}
