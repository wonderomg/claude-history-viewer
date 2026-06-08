import fs from 'fs'

import { buildDayCompare, ensureDayModel, finalizeByDay, pushSessionDay, toLocalDateKey } from './usage-shared.js'

/** 与 tokenuse 等工具类似的粗略估算：约 4 字符 ≈ 1 token */
const CHARS_PER_TOKEN = 4

function estimateTokensFromText(text) {
  const len = (text || '').length
  if (!len) return 0
  return Math.ceil(len / CHARS_PER_TOKEN)
}

/** @param {unknown} content */
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

/** @param {unknown[]} content */
function extractCursorAssistantText(content) {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'thinking' && block.thinking) out += block.thinking
    if (block.type === 'text' && block.text) out += block.text
    if (block.type === 'tool_use' || block.name) {
      try {
        out += JSON.stringify(block.input ?? block)
      } catch {
        out += String(block.name || '')
      }
    }
  }
  return out
}

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    turnCount: 0,
    userTurnCount: 0,
    byModel: {},
    byDay: {},
    sessionsByDay: {},
  }
}

/** @param {string} filePath */
export function extractEstimatedUsageFromCursorFile(filePath) {
  const totals = emptyUsage()
  let userChars = 0
  let outputChars = 0
  let assistantLines = 0
  let userLines = 0

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
      const role = row.role || row.type
      if (role === 'user') {
        userLines += 1
        userChars += extractCursorUserText(row.message?.content).length
      } else if (role === 'assistant') {
        assistantLines += 1
        outputChars += extractCursorAssistantText(row.message?.content).length
      }
    }
  } catch {
    return totals
  }

  totals.userTurnCount = userLines
  totals.turnCount = assistantLines
  totals.inputTokens = Math.ceil(userChars / CHARS_PER_TOKEN)
  totals.outputTokens = Math.ceil(outputChars / CHARS_PER_TOKEN)
  totals.totalTokens = totals.inputTokens + totals.outputTokens

  if (totals.totalTokens > 0) {
    totals.byModel = {
      'Cursor (estimated)': {
        model: 'Cursor (estimated)',
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: totals.totalTokens,
        turnCount: totals.turnCount,
      },
    }
  }

  return totals
}

/** @param {object[]} sessions */
export function aggregateCursorUsage(sessions) {
  const cursorSessions = sessions.filter((s) => s.source === 'cursor' && s.filePath)
  const combined = emptyUsage()
  /** @type {object[]} */
  const topSessions = []

  for (const session of cursorSessions) {
    const usage = extractEstimatedUsageFromCursorFile(session.filePath)
    if (usage.totalTokens === 0) continue

    combined.inputTokens += usage.inputTokens
    combined.outputTokens += usage.outputTokens
    combined.totalTokens += usage.totalTokens
    combined.turnCount += usage.turnCount
    combined.userTurnCount += usage.userTurnCount

    const day = toLocalDateKey(session.updatedAt)
    if (day) {
      if (!combined.byDay[day]) {
        combined.byDay[day] = {
          date: day,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          turnCount: 0,
          byModel: {},
        }
      }
      const d = combined.byDay[day]
      d.inputTokens += usage.inputTokens
      d.outputTokens += usage.outputTokens
      d.totalTokens += usage.totalTokens
      d.turnCount += usage.turnCount

      const model = 'Cursor (estimated)'
      const m = ensureDayModel(d, model)
      m.inputTokens += usage.inputTokens
      m.outputTokens += usage.outputTokens
      m.totalTokens += usage.totalTokens
      m.turnCount += usage.turnCount

      pushSessionDay(combined.sessionsByDay, day, {
        sessionId: session.id,
        title: session.title || session.id,
        projectPath: session.projectPath || '',
        kind: session.kind,
        source: session.source,
        updatedAt: session.updatedAt || 0,
        turnCount: usage.turnCount,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: usage.totalTokens,
      })
    }

    topSessions.push({
      sessionId: session.id,
      title: session.title || session.id,
      projectPath: session.projectPath || '',
      kind: session.kind,
      source: session.source,
      updatedAt: session.updatedAt || 0,
      turnCount: usage.turnCount,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: usage.totalTokens,
    })
  }

  topSessions.sort((a, b) => b.totalTokens - a.totalTokens)

  const byModel =
    combined.totalTokens > 0
      ? [
          {
            model: 'Cursor (estimated)',
            inputTokens: combined.inputTokens,
            outputTokens: combined.outputTokens,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            totalTokens: combined.totalTokens,
            turnCount: combined.turnCount,
          },
        ]
      : []

  const byDay = finalizeByDay(combined)

  return {
    available: true,
    estimated: true,
    estimationMethod: 'chars_div_4',
    reason: null,
    sessionCount: cursorSessions.length,
    sessionsWithUsage: topSessions.length,
    dayCompare: buildDayCompare(byDay),
    totals: {
      inputTokens: combined.inputTokens,
      outputTokens: combined.outputTokens,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: combined.totalTokens,
      turnCount: combined.turnCount,
      userTurnCount: combined.userTurnCount,
    },
    byModel,
    byDay,
    sessionsByDay: combined.sessionsByDay,
    topSessions: topSessions.slice(0, 20),
  }
}
