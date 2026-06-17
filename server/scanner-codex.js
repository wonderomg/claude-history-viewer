import fs from 'fs'
import path from 'path'
import os from 'os'

const CODEX_DIR = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex')
const SESSIONS_DIR = path.join(CODEX_DIR, 'sessions')
const SOURCE = 'codex'
const ID_PREFIX = 'codex::'

export function codexSessionId(uuid) {
  return `${ID_PREFIX}${uuid}`
}

export function parseCodexSessionId(id) {
  if (!id.startsWith(ID_PREFIX)) return null
  return { uuid: id.slice(ID_PREFIX.length), kind: 'main' }
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function cwdToProjectSlug(cwd) {
  if (!cwd) return 'unknown'
  const trimmed = cwd.replace(/^\//, '').replace(/\//g, '-')
  return trimmed || 'unknown'
}

function isEnvironmentUserText(text) {
  const t = (text || '').trim()
  if (!t) return true
  if (/^<environment_context>[\s\S]*<\/environment_context>\s*$/i.test(t)) return true
  if (/^<permissions instructions>[\s\S]*$/i.test(t) && !t.includes('</permissions instructions>')) return false
  return false
}

function extractInputText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c?.type === 'input_text' || c?.type === 'text')
    .map((c) => c.text || '')
    .join('\n')
    .trim()
}

function readSessionMeta(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 5)
    for (const line of head) {
      if (!line.trim()) continue
      const row = JSON.parse(line)
      if (row.type === 'session_meta' && row.payload) {
        return row.payload
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function extractPreview(filePath) {
  let title = ''
  let text = ''
  let cwd = ''
  let messageCount = 0
  let sessionId = ''

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      let row
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }

      if (row.type === 'session_meta') {
        cwd = row.payload?.cwd || cwd
        sessionId = row.payload?.id || sessionId
      }

      if (row.type === 'event_msg' && row.payload?.type === 'user_message') {
        messageCount++
        const t = (row.payload.message || '').trim()
        if (t && !title) title = t.slice(0, 60)
        if (t && !text) text = t.slice(0, 120)
      }

      if (row.type === 'response_item' && row.payload?.type === 'message' && row.payload.role === 'user') {
        const t = extractInputText(row.payload.content)
        if (t && !isEnvironmentUserText(t)) {
          messageCount++
          if (!title) title = t.slice(0, 60)
          if (!text) text = t.slice(0, 120)
        }
      }

      if (
        row.type === 'response_item' &&
        (row.payload?.type === 'message' && row.payload.role === 'assistant' ||
          row.payload?.type === 'function_call')
      ) {
        messageCount++
      }
    }
  } catch {
    /* ignore */
  }

  return { title, text, cwd, messageCount, sessionId }
}

function buildRecord({ filePath, stat }) {
  const preview = extractPreview(filePath)
  const meta = readSessionMeta(filePath)
  const uuid = preview.sessionId || meta?.id || path.basename(filePath, '.jsonl').replace(/^rollout-[^-]+-[^-]+-[^-]+-/, '')
  const cwd = preview.cwd || meta?.cwd || ''
  const projectSlug = cwdToProjectSlug(cwd)

  return {
    id: codexSessionId(uuid),
    source: SOURCE,
    kind: 'main',
    parentSessionId: null,
    projectSlug,
    projectPath: cwd || projectSlug,
    filePath,
    title: preview.title || '未命名会话',
    preview: preview.text,
    cwd: cwd || projectSlug,
    startedAt: meta?.timestamp ? Date.parse(meta.timestamp) : stat?.birthtimeMs,
    updatedAt: stat?.mtimeMs,
    messageCount: preview.messageCount,
    agentType: meta?.originator || null,
    agentDescription: meta?.cli_version ? `Codex ${meta.cli_version}` : null,
  }
}

function walkRolloutFiles(dir, out) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    let st
    try {
      st = fs.statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkRolloutFiles(full, out)
      continue
    }
    if (!entry.startsWith('rollout-') || !entry.endsWith('.jsonl')) continue
    out.push({ filePath: full, stat: st })
  }
}

/** 扫描 CODEX_HOME/sessions 下所有 rollout-*.jsonl */
export function scanCodexSessions() {
  const files = []
  walkRolloutFiles(SESSIONS_DIR, files)
  const sessions = files.map(({ filePath, stat }) => buildRecord({ filePath, stat }))
  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return sessions
}

export function getCodexDir() {
  return CODEX_DIR
}
