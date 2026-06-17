/** @param {Date} d */
function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {string} ymd @param {number} deltaDays */
function addDays(ymd, deltaDays) {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return formatYmd(d)
}

/** @param {string[]} activeDates */
export function computeStreaks(activeDates) {
  const set = new Set(activeDates)
  if (!set.size) return { currentStreak: 0, longestStreak: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let currentStreak = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (set.has(formatYmd(d))) currentStreak++
    else if (i === 0) continue
    else break
  }

  const sorted = [...set].sort()
  let longestStreak = 0
  let run = 0
  let prev = ''
  for (const date of sorted) {
    if (!prev || addDays(prev, 1) === date) run++
    else run = 1
    longestStreak = Math.max(longestStreak, run)
    prev = date
  }

  return { currentStreak, longestStreak }
}

/**
 * @param {object} params
 * @param {{ date: string, totalTokens: number }[]} params.byDay
 * @param {object[]} [params.byModel]
 * @param {object[]} [params.topSessions]
 * @param {object[]} [params.topPlugins]
 * @param {object[]} [params.topSkills]
 * @param {object[]} [params.topTools]
 * @param {number} [params.sessionCount]
 * @param {number} [params.longestTaskMs]
 * @param {boolean} [params.estimated]
 */
export function buildActivityProfile({
  byDay,
  byModel = [],
  topSessions = [],
  topPlugins = [],
  topSkills = [],
  topTools = [],
  sessionCount = 0,
  longestTaskMs = 0,
  estimated = false,
}) {
  const days = Array.isArray(byDay) ? byDay : []
  const activeDates = days.filter((d) => d.totalTokens > 0).map((d) => d.date)

  const peakDay = days.reduce(
    (best, d) => ((d.totalTokens || 0) > (best?.totalTokens || 0) ? d : best),
    null
  )

  const { currentStreak, longestStreak } = computeStreaks(activeDates)
  const totalTokens = days.reduce((s, d) => s + (d.totalTokens || 0), 0)

  const topModel = byModel[0]
  const topModelPct =
    topModel && totalTokens > 0
      ? Math.round((topModel.totalTokens / totalTokens) * 1000) / 10
      : 0

  /** @type {Map<string, { path: string, tokens: number, sessions: number }>} */
  const projectMap = new Map()
  for (const row of topSessions) {
    const path = row.projectPath || 'unknown'
    if (!projectMap.has(path)) projectMap.set(path, { path, tokens: 0, sessions: 0 })
    const p = projectMap.get(path)
    p.tokens += row.totalTokens || 0
    p.sessions += 1
  }
  const topProjects = [...projectMap.values()]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 6)

  const avgTokensPerActiveDay =
    activeDates.length > 0 ? Math.round(totalTokens / activeDates.length) : 0

  return {
    totalTokens,
    peakDayTokens: peakDay?.totalTokens || 0,
    peakDayDate: peakDay?.date || '',
    longestTaskMs: longestTaskMs || 0,
    currentStreak,
    longestStreak,
    activeDays: activeDates.length,
    sessionCount,
    sessionsWithUsage: topSessions.length,
    topModel: topModel?.model || '',
    topModelPct,
    avgTokensPerActiveDay,
    estimated,
    topProjects,
    topPlugins: Array.isArray(topPlugins) ? topPlugins : [],
    topSkills: Array.isArray(topSkills) ? topSkills : [],
    topTools: Array.isArray(topTools) ? topTools : [],
  }
}
