/** @param {Date} d */
export function formatYmd(d) {
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

/** @param {string} ymd @param {string} rangeStartYmd */
export function getWeeklyBlockStart(ymd, rangeStartYmd) {
  const startMs = new Date(`${rangeStartYmd}T12:00:00`).getTime()
  const dayMs = new Date(`${ymd}T12:00:00`).getTime()
  const diffDays = Math.floor((dayMs - startMs) / 86_400_000)
  const blockIndex = Math.floor(diffDays / 7)
  const blockStart = new Date(startMs + blockIndex * 7 * 86_400_000)
  return formatYmd(blockStart)
}

/**
 * @param {{ date: string, totalTokens?: number }[]} byDay
 * @param {'daily'|'weekly'|'cumulative'} mode
 */
export function buildHeatmapGrid(byDay, mode = 'daily') {
  const valueByDate = new Map(
    (byDay || []).map((d) => [d.date, d.totalTokens || 0])
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endYmd = formatYmd(today)

  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  const startYmd = formatYmd(start)

  /** @type {Map<string, number>} */
  const displayValues = new Map()

  if (mode === 'daily') {
    for (const [date, val] of valueByDate) {
      if (date >= startYmd && date <= endYmd) displayValues.set(date, val)
    }
  } else if (mode === 'weekly') {
    for (let d = new Date(`${startYmd}T12:00:00`); formatYmd(d) <= endYmd; d.setDate(d.getDate() + 7)) {
      const weekStart = formatYmd(d)
      let sum = 0
      for (let i = 0; i < 7; i++) {
        const key = addDays(weekStart, i)
        if (key > endYmd) break
        sum += valueByDate.get(key) || 0
      }
      for (let i = 0; i < 7; i++) {
        const key = addDays(weekStart, i)
        if (key > endYmd || key < startYmd) continue
        displayValues.set(key, sum)
      }
    }
  } else {
    let cumulative = 0
    for (let d = new Date(`${startYmd}T12:00:00`); formatYmd(d) <= endYmd; d.setDate(d.getDate() + 1)) {
      const key = formatYmd(d)
      cumulative += valueByDate.get(key) || 0
      displayValues.set(key, cumulative)
    }
  }

  const gridStart = new Date(`${startYmd}T12:00:00`)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const weeks = []
  const monthLabels = []
  let lastMonth = -1

  for (let w = 0; w < 53; w++) {
    const days = []
    for (let dow = 0; dow < 7; dow++) {
      const cell = new Date(gridStart)
      cell.setDate(cell.getDate() + w * 7 + dow)
      const date = formatYmd(cell)
      const inRange = date >= startYmd && date <= endYmd
      const value = inRange ? (displayValues.get(date) || 0) : 0
      const day = { date, value, inRange }
      if (inRange && mode === 'weekly') {
        day.weekBlockStart = getWeeklyBlockStart(date, startYmd)
      }
      days.push(day)

      if (dow === 0 && inRange) {
        const m = cell.getMonth()
        if (m !== lastMonth) {
          monthLabels.push({ weekIndex: w, label: m + 1 })
          lastMonth = m
        }
      }
    }
    weeks.push({ days })
  }

  const activeValues = [...displayValues.values()].filter((v) => v > 0)
  const max = Math.max(...activeValues, 1)

  for (const week of weeks) {
    for (const day of week.days) {
      if (!day.inRange || day.value <= 0) day.level = 0
      else {
        const ratio = day.value / max
        if (ratio <= 0.25) day.level = 1
        else if (ratio <= 0.5) day.level = 2
        else if (ratio <= 0.75) day.level = 3
        else day.level = 4
      }
    }
  }

  return { weeks, monthLabels, max, mode, rangeStart: startYmd }
}

/** @param {number} ms @param {'zh'|'en'} locale */
export function formatDurationMs(ms, locale = 'zh') {
  if (!ms || ms <= 0) return locale === 'zh' ? '—' : '—'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return locale === 'zh' ? `${sec} 秒` : `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (locale === 'zh') return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** @param {string} ymd @param {'zh'|'en'} locale */
export function formatHeatmapDayLabelFull(ymd, locale = 'zh') {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  if (locale === 'zh') return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** @param {string} ymd @param {'zh'|'en'} locale */
export function formatHeatmapDayLabel(ymd, locale = 'zh') {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  if (locale === 'zh') return `${d.getMonth() + 1}月${d.getDate()}日`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** @param {number} month 1-12 @param {'zh'|'en'} locale */
export function formatHeatmapMonth(month, locale) {
  if (locale === 'zh') return `${month}月`
  return new Date(2024, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}
