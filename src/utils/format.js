function resolveLocaleTag() {
  if (typeof document !== 'undefined') {
    const loc = document.documentElement.dataset.locale
    if (loc === 'en') return 'en-US'
    if (loc === 'zh') return 'zh-CN'
    if (document.documentElement.lang?.startsWith('en')) return 'en-US'
  }
  return 'zh-CN'
}

export function formatTime(ts) {
  if (!ts) return ''
  const d = typeof ts === 'number' && ts > 1e12 ? new Date(ts) : new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(resolveLocaleTag(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(ms) {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

export function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** @param {number} n @param {'zh'|'en'} [locale] */
export function formatTokenCountLocale(n, locale = 'zh') {
  const v = Number(n) || 0
  if (locale === 'zh') {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}亿`
    if (v >= 10_000) return `${(v / 10_000).toFixed(1)}万`
    if (v >= 1_000) return `${(v / 1_000).toFixed(2)}千`
    return String(v)
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return String(v)
}

/** @param {number} n */
export function formatTokenCount(n) {
  const tag = resolveLocaleTag()
  return formatTokenCountLocale(n, tag.startsWith('zh') ? 'zh' : 'en')
}

/** @param {number} n */
export function formatTokenCountFull(n) {
  return (Number(n) || 0).toLocaleString(resolveLocaleTag())
}
