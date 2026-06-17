import fs from 'fs'

import {
  buildDayCompare,
  ensureDayModel,
  finalizeByDay,
  mergeModelStats,
  pushSessionDay,
  toLocalDateKey,
  toLocalDateKeyWithFallback,
} from './usage-shared.js'
import { buildActivityProfile } from './usage-activity.js'
import { aggregateTopPlugins } from './usage-plugins.js'
import { aggregateTopSkills } from './usage-skills.js'
import { aggregateTopTools } from './usage-tools.js'

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    turnCount: 0,
    byModel: {},
    byDay: {},
    sessionsByDay: {},
  }
}

/** @param {object} usage */
function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const input = Number(usage.input_tokens) || 0
  const cached = Number(usage.cached_input_tokens) || 0
  const output = Number(usage.output_tokens) || 0
  const reasoning = Number(usage.reasoning_output_tokens) || 0
  const total = Number(usage.total_tokens) || input + output + reasoning
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cached,
    cacheCreationTokens: 0,
    reasoningOutputTokens: reasoning,
    totalTokens: total,
    turnCount: 1,
  }
}

function addUsage(totals, u, model, day) {
  totals.inputTokens += u.inputTokens
  totals.outputTokens += u.outputTokens
  totals.cacheReadTokens += u.cacheReadTokens
  totals.cacheCreationTokens += u.cacheCreationTokens
  totals.reasoningOutputTokens += u.reasoningOutputTokens
  totals.totalTokens += u.totalTokens
  totals.turnCount += u.turnCount

  if (!totals.byModel[model]) {
    totals.byModel[model] = {
      model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
      turnCount: 0,
    }
  }
  const m = totals.byModel[model]
  m.inputTokens += u.inputTokens
  m.outputTokens += u.outputTokens
  m.cacheReadTokens += u.cacheReadTokens
  m.cacheCreationTokens += u.cacheCreationTokens
  m.reasoningOutputTokens += u.reasoningOutputTokens
  m.totalTokens += u.totalTokens
  m.turnCount += u.turnCount

  if (day) {
    if (!totals.byDay[day]) {
      totals.byDay[day] = {
        date: day,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        reasoningOutputTokens: 0,
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
    d.reasoningOutputTokens += u.reasoningOutputTokens
    d.totalTokens += u.totalTokens
    d.turnCount += u.turnCount
    mergeModelStats(ensureDayModel(d, model), u)
  }
}

/** @param {string} filePath */
export function extractMaxTaskDurationMs(filePath) {
  let max = 0
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
      if (row.type === 'event_msg' && row.payload?.type === 'task_complete') {
        const ms = Number(row.payload.duration_ms) || 0
        if (ms > max) max = ms
      }
    }
  } catch {
    return 0
  }
  return max
}

/** @param {string} filePath @param {number|string|Date|null|undefined} [fallbackTs] */
export function extractUsageFromCodexFile(filePath, fallbackTs) {
  const totals = emptyUsage()
  let currentModel = 'Codex'
  let lastSessionTotal = null

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

      if (row.type === 'turn_context' && row.payload?.model) {
        currentModel = row.payload.model
      }

      if (row.type !== 'event_msg' || row.payload?.type !== 'token_count') continue

      const last = normalizeTokenUsage(row.payload.info?.last_token_usage)
      const total = normalizeTokenUsage(row.payload.info?.total_token_usage)
      if (total) lastSessionTotal = total

      if (!last || last.totalTokens === 0) continue

      const day = toLocalDateKeyWithFallback(row.timestamp, fallbackTs)
      addUsage(totals, last, currentModel, day)
    }
  } catch {
    return emptyUsage()
  }

  if (lastSessionTotal && totals.totalTokens === 0) {
    addUsage(totals, lastSessionTotal, currentModel, toLocalDateKey(fallbackTs))
  }

  return totals
}

/** @param {object[]} sessions */
export function aggregateCodexUsage(sessions) {
  const codexSessions = sessions.filter((s) => s.source === 'codex' && s.filePath)
  const combined = emptyUsage()
  /** @type {object[]} */
  const topSessions = []

  let longestTaskMs = 0

  for (const session of codexSessions) {
    longestTaskMs = Math.max(longestTaskMs, extractMaxTaskDurationMs(session.filePath))
    const usage = extractUsageFromCodexFile(session.filePath, session.updatedAt)
    if (usage.totalTokens === 0) continue

    if (Object.keys(usage.byDay).length === 0) {
      const day = toLocalDateKey(session.updatedAt)
      if (day) {
        usage.byDay[day] = {
          date: day,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          reasoningOutputTokens: usage.reasoningOutputTokens,
          totalTokens: usage.totalTokens,
          turnCount: usage.turnCount,
          byModel: { ...usage.byModel },
        }
      }
    }

    combined.inputTokens += usage.inputTokens
    combined.outputTokens += usage.outputTokens
    combined.cacheReadTokens += usage.cacheReadTokens
    combined.cacheCreationTokens += usage.cacheCreationTokens
    combined.reasoningOutputTokens += usage.reasoningOutputTokens
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
          reasoningOutputTokens: 0,
          totalTokens: 0,
          turnCount: 0,
        }
      }
      mergeModelStats(combined.byModel[model], data)
    }

    for (const [day, data] of Object.entries(usage.byDay)) {
      if (!combined.byDay[day]) {
        combined.byDay[day] = {
          date: day,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 0,
          turnCount: 0,
          byModel: {},
        }
      }
      const d = combined.byDay[day]
      d.inputTokens += data.inputTokens
      d.outputTokens += data.outputTokens
      d.cacheReadTokens += data.cacheReadTokens
      d.cacheCreationTokens += data.cacheCreationTokens
      d.reasoningOutputTokens += (data.reasoningOutputTokens || 0)
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
        cacheReadTokens: data.cacheReadTokens,
        cacheCreationTokens: 0,
        reasoningOutputTokens: data.reasoningOutputTokens || 0,
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
      cacheCreationTokens: 0,
      reasoningOutputTokens: usage.reasoningOutputTokens,
      totalTokens: usage.totalTokens,
    })
  }

  topSessions.sort((a, b) => b.totalTokens - a.totalTokens)

  const byModel = Object.values(combined.byModel).sort((a, b) => b.totalTokens - a.totalTokens)
  const byDay = finalizeByDay(combined)

  return {
    available: true,
    estimated: false,
    sessionCount: codexSessions.length,
    sessionsWithUsage: topSessions.length,
    dayCompare: buildDayCompare(byDay),
    activity: buildActivityProfile({
      byDay,
      byModel,
      topSessions,
      topPlugins: aggregateTopPlugins(codexSessions, 'codex'),
      topSkills: aggregateTopSkills(codexSessions, 'codex'),
      topTools: aggregateTopTools(codexSessions, 'codex'),
      sessionCount: codexSessions.length,
      longestTaskMs,
      estimated: false,
    }),
    totals: {
      inputTokens: combined.inputTokens,
      outputTokens: combined.outputTokens,
      cacheReadTokens: combined.cacheReadTokens,
      cacheCreationTokens: combined.cacheCreationTokens,
      reasoningOutputTokens: combined.reasoningOutputTokens,
      totalTokens: combined.totalTokens,
      turnCount: combined.turnCount,
    },
    byModel,
    byDay,
    sessionsByDay: combined.sessionsByDay,
    topSessions: topSessions.slice(0, 20),
  }
}
