import darkUrl from 'highlight.js/styles/github-dark.css?url'
import lightUrl from 'highlight.js/styles/github.css?url'

let linkEl = null

/** @param {'light' | 'dark' | 'eye'} theme */
export function applyHljsTheme(theme) {
  if (!linkEl) {
    linkEl = document.createElement('link')
    linkEl.rel = 'stylesheet'
    linkEl.id = 'hljs-theme'
    document.head.appendChild(linkEl)
  }
  linkEl.href = theme === 'dark' ? darkUrl : lightUrl
}

export function initHljsTheme() {
  const theme = document.documentElement.dataset.theme || 'light'
  applyHljsTheme(theme === 'dark' ? 'dark' : 'light')
  window.addEventListener('theme-change', (e) => {
    const next = e.detail === 'dark' ? 'dark' : 'light'
    applyHljsTheme(next)
  })
}
