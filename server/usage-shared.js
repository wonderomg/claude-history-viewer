/** @param {string|number|Date|null|undefined} ts */
export function toLocalDateKey(ts) {
  if (ts == null || ts === '') return null
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (Number.isNaN(d.getTime())) {
    if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10)
    return null
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {string|number|Date|null|undefined} ts @param {string|number|Date|null|undefined} [fallback] */
export function toLocalDateKeyWithFallback(ts, fallback) {
  return toLocalDateKey(ts) || toLocalDateKey(fallback) || null
}

/** @param {object} dayBucket */
export function ensureDayModel(dayBucket, model) {
  if (!dayBucket.byModel) dayBucket.byModel = {}
  if (!dayBucket.byModel[model]) {
    dayBucket.byModel[model] = {
      model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
      turnCount: 0,
    }
  }
  return dayBucket.byModel[model]
}

/** @param {object} target @param {object} source */
export function mergeModelStats(target, source) {
  target.inputTokens += source.inputTokens || 0
  target.outputTokens += source.outputTokens || 0
  target.cacheReadTokens += source.cacheReadTokens || 0
  target.cacheCreationTokens += source.cacheCreationTokens || 0
  target.reasoningOutputTokens = (target.reasoningOutputTokens || 0) + (source.reasoningOutputTokens || 0)
  target.totalTokens += source.totalTokens || 0
  target.turnCount += source.turnCount || 0
}

/** @param {{ byDay: Record<string, object>, sessionsByDay: Record<string, object[]> }} combined */
export function finalizeByDay(combined) {
  const byDay = Object.values(combined.byDay).sort((a, b) => a.date.localeCompare(b.date))
  for (const d of byDay) {
    d.sessions = combined.sessionsByDay[d.date] || []
    d.models = Object.values(d.byModel || {}).sort((a, b) => b.totalTokens - a.totalTokens)
    delete d.byModel
  }
  return byDay
}

/** @param {{ date: string, totalTokens: number }[]} byDay */
export function buildDayCompare(byDay) {
  const map = new Map(byDay.map((d) => [d.date, d.totalTokens]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const todayKey = fmt(today)
  const yesterdayKey = fmt(yesterday)
  const todayTokens = map.get(todayKey) ?? 0
  const yesterdayTokens = map.get(yesterdayKey) ?? 0
  const delta = todayTokens - yesterdayTokens
  let deltaPct = 0
  if (yesterdayTokens > 0) {
    deltaPct = Math.round((delta / yesterdayTokens) * 1000) / 10
  } else if (todayTokens > 0) {
    deltaPct = 100
  }
  return {
    today: todayKey,
    yesterday: yesterdayKey,
    todayTokens,
    yesterdayTokens,
    delta,
    deltaPct,
  }
}

/** @param {Record<string, object[]>} sessionsByDay @param {string} day @param {object} entry */
export function pushSessionDay(sessionsByDay, day, entry) {
  if (!sessionsByDay[day]) sessionsByDay[day] = []
  sessionsByDay[day].push(entry)
  sessionsByDay[day].sort((a, b) => b.totalTokens - a.totalTokens)
}
