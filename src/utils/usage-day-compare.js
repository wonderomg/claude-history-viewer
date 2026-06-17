/** @param {Date} d */
function formatLocalYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 根据 byDay 计算今日 vs 日历昨日（浏览器本地时区）。
 * @param {{ date: string, totalTokens: number }[]} byDay
 */
export function buildDayCompare(byDay) {
  const map = new Map((byDay || []).map((d) => [d.date, d.totalTokens]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayKey = formatLocalYmd(today)
  const yesterdayKey = formatLocalYmd(yesterday)
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
