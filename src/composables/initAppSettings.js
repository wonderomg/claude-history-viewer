import { initLocale } from './useLocale.js'
import { initTheme } from './useTheme.js'

let initPromise = null

/** Load /api/config once, apply locale & theme before first paint. */
export function initAppSettings() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    let remote = null
    try {
      const res = await fetch('/api/config')
      if (res.ok) remote = await res.json()
    } catch {
      /* dev / offline */
    }
    await Promise.all([initLocale(remote), initTheme(remote)])
  })()

  return initPromise
}
