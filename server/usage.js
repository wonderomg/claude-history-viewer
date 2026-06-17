import fs from 'fs'
import { aggregateCursorUsage } from './usage-cursor.js'
import { aggregateCodexUsage } from './usage-codex.js'
import { buildDayCompare, ensureDayModel, finalizeByDay, mergeModelStats, pushSessionDay, toLocalDateKeyWithFallback } from './usage-shared.js'
import { buildActivityProfile } from './usage-activity.js'
import { aggregateTopPlugins } from './usage-plugins.js'
import { aggregateTopSkills } from './usage-skills.js'
import { aggregateTopTools } from './usage-tools.js'

/** @param {object} usage */
function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const input = Number(usage.input_tokens) || 0
  const output = Number(usage.output_tokens) || 0
  const cacheRead = Number(usage.cache_read_input_tokens) || 0
  const cacheCreate = Number(usage.cache_creation_input_tokens) || 0
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreate,
    totalTokens: input + output + cacheRead + cacheCreate,
  }
}

/** @param {string} filePath @param {number|string|Date|null|undefined} [fallbackTs] */
export function extractUsageFromClaudeFile(filePath, fallbackTs) {
  /** @type {Map<string, { usage: ReturnType<typeof normalizeUsage>, model: string, timestamp: string }>} */
  const byMessageId = new Map()

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
      const msg = row.message
      if (!msg?.usage) continue
      const normalized = normalizeUsage(msg.usage)
      if (!normalized) continue
      const msgId = msg.id || row.uuid
      if (!msgId) continue
      byMessageId.set(msgId, {
        usage: normalized,
        model: msg.model || 'unknown',
        timestamp: row.timestamp || '',
      })
    }
  } catch {
    return emptyClaudeUsage()
  }

  return aggregateTurns([...byMessageId.values()], fallbackTs)
}

function emptyClaudeUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    turnCount: 0,
    byModel: {},
    byDay: {},
    sessionsByDay: {},
  }
}

/** @param {{ usage: ReturnType<typeof normalizeUsage>, model: string, timestamp: string }[]} turns @param {number|string|Date|null|undefined} [fallbackTs] */
function aggregateTurns(turns, fallbackTs) {
  const totals = emptyClaudeUsage()
  totals.turnCount = turns.length

  for (const turn of turns) {
    const u = turn.usage
    totals.inputTokens += u.inputTokens
    totals.outputTokens += u.outputTokens
    totals.cacheReadTokens += u.cacheReadTokens
    totals.cacheCreationTokens += u.cacheCreationTokens
    totals.totalTokens += u.totalTokens

    const model = turn.model || 'unknown'
    if (!totals.byModel[model]) {
      totals.byModel[model] = {
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        turnCount: 0,
      }
    }
    const m = totals.byModel[model]
    m.inputTokens += u.inputTokens
    m.outputTokens += u.outputTokens
    m.cacheReadTokens += u.cacheReadTokens
    m.cacheCreationTokens += u.cacheCreationTokens
    m.totalTokens += u.totalTokens
    m.turnCount += 1

    const day = toLocalDateKeyWithFallback(turn.timestamp, fallbackTs)
    if (day) {
      if (!totals.byDay[day]) {
        totals.byDay[day] = {
          date: day,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalTokens: 0,
          turnCount: 0,
          byModel: {},
        }
      }
      const d = totals.byDay[day]
      d.inputTokens += u.inputTokens
      d.outputTokens += u.outputTokens
      d.cacheReadTokens += u.cacheReadTokens
      d.cacheCreationTokens += u.cacheCreationTokens
      d.totalTokens += u.totalTokens
      d.turnCount += 1

      const dm = ensureDayModel(d, model)
      dm.inputTokens += u.inputTokens
      dm.outputTokens += u.outputTokens
      dm.cacheReadTokens += u.cacheReadTokens
      dm.cacheCreationTokens += u.cacheCreationTokens
      dm.totalTokens += u.totalTokens
      dm.turnCount += 1
    }
  }

  return totals
}

/** @param {object[]} sessions */
export function aggregateClaudeUsage(sessions) {
  const claudeSessions = sessions.filter((s) => s.source === 'claude' && s.filePath)
  const combined = emptyClaudeUsage()
  /** @type {object[]} */
  const topSessions = []

  for (const session of claudeSessions) {
    const usage = extractUsageFromClaudeFile(session.filePath, session.updatedAt)
    if (usage.turnCount === 0) continue

    combined.inputTokens += usage.inputTokens
    combined.outputTokens += usage.outputTokens
    combined.cacheReadTokens += usage.cacheReadTokens
    combined.cacheCreationTokens += usage.cacheCreationTokens
    combined.totalTokens += usage.totalTokens
    combined.turnCount += usage.turnCount

    for (const [model, data] of Object.entries(usage.byModel)) {
      if (!combined.byModel[model]) {
        combined.byModel[model] = {
          model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalTokens: 0,
          turnCount: 0,
        }
      }
      const m = combined.byModel[model]
      m.inputTokens += data.inputTokens
      m.outputTokens += data.outputTokens
      m.cacheReadTokens += data.cacheReadTokens
      m.cacheCreationTokens += data.cacheCreationTokens
      m.totalTokens += data.totalTokens
      m.turnCount += data.turnCount
    }

    for (const [day, data] of Object.entries(usage.byDay)) {
      if (!combined.byDay[day]) {
        combined.byDay[day] = {
          date: day,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalTokens: 0,
          turnCount: 0,
          byModel: {},
        }
      }
      const d = combined.byDay[day]
      d.inputTokens += data.inputTokens
      d.outputTokens += data.outputTokens
      d.cacheReadTokens += (data.cacheReadTokens || 0)
      d.cacheCreationTokens += (data.cacheCreationTokens || 0)
      d.totalTokens += data.totalTokens
      d.turnCount += data.turnCount

      for (const [model, mdata] of Object.entries(data.byModel || {})) {
        mergeModelStats(ensureDayModel(d, model), mdata)
      }

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
        cacheReadTokens: data.cacheReadTokens || 0,
        cacheCreationTokens: data.cacheCreationTokens || 0,
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
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      totalTokens: usage.totalTokens,
    })
  }

  topSessions.sort((a, b) => b.totalTokens - a.totalTokens)

  const byModel = Object.values(combined.byModel).sort((a, b) => b.totalTokens - a.totalTokens)
  const byDay = finalizeByDay(combined)

  return {
    available: true,
    estimated: false,
    sessionCount: claudeSessions.length,
    sessionsWithUsage: topSessions.length,
    dayCompare: buildDayCompare(byDay),
    activity: buildActivityProfile({
      byDay,
      byModel,
      topSessions,
      topPlugins: aggregateTopPlugins(claudeSessions, 'claude'),
      topSkills: aggregateTopSkills(claudeSessions, 'claude'),
      topTools: aggregateTopTools(claudeSessions, 'claude'),
      sessionCount: claudeSessions.length,
      estimated: false,
    }),
    totals: {
      inputTokens: combined.inputTokens,
      outputTokens: combined.outputTokens,
      cacheReadTokens: combined.cacheReadTokens,
      cacheCreationTokens: combined.cacheCreationTokens,
      totalTokens: combined.totalTokens,
      turnCount: combined.turnCount,
    },
    byModel,
    byDay,
    sessionsByDay: combined.sessionsByDay,
    topSessions: topSessions.slice(0, 20),
  }
}

/** @param {object[]} sessions */
export function buildCursorUsageSummary(sessions) {
  return aggregateCursorUsage(sessions)
}

/** @param {object[]} sessions */
export function buildUsageReport(sessions) {
  return {
    claude: aggregateClaudeUsage(sessions),
    cursor: buildCursorUsageSummary(sessions),
    codex: aggregateCodexUsage(sessions),
  }
}
