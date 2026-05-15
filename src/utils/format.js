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
