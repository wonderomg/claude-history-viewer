import darkUrl from 'highlight.js/styles/github-dark.css?url'
import lightUrl from 'highlight.js/styles/github.css?url'

let linkEl = null

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
  const isDark = document.documentElement.classList.contains('dark')
  applyHljsTheme(isDark ? 'dark' : 'light')
  window.addEventListener('theme-change', (e) => {
    applyHljsTheme(e.detail)
  })
}
