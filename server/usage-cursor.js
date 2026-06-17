import fs from 'fs'

import { buildDayCompare, ensureDayModel, finalizeByDay, pushSessionDay, toLocalDateKey, toLocalDateKeyWithFallback } from './usage-shared.js'
import { buildActivityProfile } from './usage-activity.js'
import { aggregateTopPlugins } from './usage-plugins.js'
import { aggregateTopSkills } from './usage-skills.js'
import { aggregateTopTools } from './usage-tools.js'

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

/** @param {unknown} content */
function extractCursorTimestamp(content) {
  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    text = content
      .filter((c) => c?.type === 'text')
      .map((c) => c.text || '')
      .join('\n')
  }
  const m = text.match(/<timestamp>\s*([\s\S]*?)\s*<\/timestamp>/i)
  return m?.[1]?.trim() || null
}

/** @param {Record<string, { userChars: number, outputChars: number, assistantLines: number, userLines: number }>} byDay */
function ensureDayBucket(byDay, day) {
  if (!byDay[day]) {
    byDay[day] = { userChars: 0, outputChars: 0, assistantLines: 0, userLines: 0 }
  }
  return byDay[day]
}

/** @param {Record<string, { userChars: number, outputChars: number, assistantLines: number, userLines: number }>} byDay @param {string|null} day @param {'user'|'assistant'} kind @param {number} chars */
function addCursorDayChars(byDay, day, kind, chars) {
  if (!day || chars <= 0) return
  const bucket = ensureDayBucket(byDay, day)
  if (kind === 'user') {
    bucket.userChars += chars
    bucket.userLines += 1
  } else {
    bucket.outputChars += chars
    bucket.assistantLines += 1
  }
}

/** @param {Record<string, { userChars: number, outputChars: number, assistantLines: number, userLines: number }>} byDay */
function cursorUsageFromDayBuckets(byDay) {
  const totals = emptyUsage()
  for (const [day, bucket] of Object.entries(byDay)) {
    const inputTokens = Math.ceil(bucket.userChars / CHARS_PER_TOKEN)
    const outputTokens = Math.ceil(bucket.outputChars / CHARS_PER_TOKEN)
    const totalTokens = inputTokens + outputTokens
    if (totalTokens <= 0) continue

    totals.userTurnCount += bucket.userLines
    totals.turnCount += bucket.assistantLines
    totals.inputTokens += inputTokens
    totals.outputTokens += outputTokens
    totals.totalTokens += totalTokens

    totals.byDay[day] = {
      date: day,
      inputTokens,
      outputTokens,
      totalTokens,
      turnCount: bucket.assistantLines,
      byModel: {},
    }
    const model = 'Cursor (estimated)'
    const m = ensureDayModel(totals.byDay[day], model)
    m.inputTokens += inputTokens
    m.outputTokens += outputTokens
    m.totalTokens += totalTokens
    m.turnCount += bucket.assistantLines
  }

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

/** @param {string} filePath @param {number|string|Date|null|undefined} [fallbackTs] */
export function extractEstimatedUsageFromCursorFile(filePath, fallbackTs) {
  /** @type {Record<string, { userChars: number, outputChars: number, assistantLines: number, userLines: number }>} */
  const byDay = {}
  let lastDay = toLocalDateKey(fallbackTs)
  let hasMessageTimestamp = false

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
      const messageContent = row.message?.content

      if (role === 'user') {
        const ts = extractCursorTimestamp(messageContent)
        const day = toLocalDateKeyWithFallback(ts, lastDay || fallbackTs)
        if (ts) {
          hasMessageTimestamp = true
          lastDay = day
        } else if (day) {
          lastDay = day
        }
        const chars = extractCursorUserText(messageContent).length
        addCursorDayChars(byDay, day, 'user', chars)
      } else if (role === 'assistant') {
        const day = lastDay || toLocalDateKey(fallbackTs)
        const chars = extractCursorAssistantText(messageContent).length
        addCursorDayChars(byDay, day, 'assistant', chars)
      }
    }
  } catch {
    return emptyUsage()
  }

  if (!Object.keys(byDay).length) {
    return emptyUsage()
  }

  if (!hasMessageTimestamp && fallbackTs) {
    const fallbackDay = toLocalDateKey(fallbackTs)
    if (fallbackDay) {
      const merged = { userChars: 0, outputChars: 0, assistantLines: 0, userLines: 0 }
      for (const bucket of Object.values(byDay)) {
        merged.userChars += bucket.userChars
        merged.outputChars += bucket.outputChars
        merged.assistantLines += bucket.assistantLines
        merged.userLines += bucket.userLines
      }
      return cursorUsageFromDayBuckets({ [fallbackDay]: merged })
    }
  }

  return cursorUsageFromDayBuckets(byDay)
}

/** @param {object[]} sessions */
export function aggregateCursorUsage(sessions) {
  const cursorSessions = sessions.filter((s) => s.source === 'cursor' && s.filePath)
  const combined = emptyUsage()
  /** @type {object[]} */
  const topSessions = []

  for (const session of cursorSessions) {
    const usage = extractEstimatedUsageFromCursorFile(session.filePath, session.updatedAt)
    if (usage.totalTokens === 0) continue

    combined.inputTokens += usage.inputTokens
    combined.outputTokens += usage.outputTokens
    combined.totalTokens += usage.totalTokens
    combined.turnCount += usage.turnCount
    combined.userTurnCount += usage.userTurnCount

    for (const [day, data] of Object.entries(usage.byDay)) {
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
      d.inputTokens += data.inputTokens
      d.outputTokens += data.outputTokens
      d.totalTokens += data.totalTokens
      d.turnCount += data.turnCount

      const model = 'Cursor (estimated)'
      const m = ensureDayModel(d, model)
      m.inputTokens += data.inputTokens
      m.outputTokens += data.outputTokens
      m.totalTokens += data.totalTokens
      m.turnCount += data.turnCount

      pushSessionDay(combined.sessionsByDay, day, {
        sessionId: session.id,
        title: session.title || session.id,
        projectPath: session.projectPath || '',
        kind: session.kind,
        source: session.source,
        updatedAt: session.updatedAt || 0,
        turnCount: data.turnCount,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: data.totalTokens,
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
    activity: buildActivityProfile({
      byDay,
      byModel,
      topSessions,
      topPlugins: aggregateTopPlugins(cursorSessions, 'cursor'),
      topSkills: aggregateTopSkills(cursorSessions, 'cursor'),
      topTools: aggregateTopTools(cursorSessions, 'cursor'),
      sessionCount: cursorSessions.length,
      estimated: true,
    }),
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
