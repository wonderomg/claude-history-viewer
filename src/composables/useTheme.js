import { ref, watch, computed } from 'vue'

const STORAGE_KEY = 'claude-history-viewer-theme'
const USER_CHOICE_KEY = 'claude-history-viewer-theme-user'

/** @type {readonly ['light', 'dark', 'eye']} */
export const THEME_IDS = ['light', 'dark', 'eye']

/** @param {string} id */
export function isValidTheme(id) {
  return THEME_IDS.includes(id)
}

function readStoredTheme() {
  if (typeof localStorage === 'undefined') return null
  const saved = localStorage.getItem(STORAGE_KEY)
  return isValidTheme(saved) ? saved : null
}

function hasUserThemeChoice() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(USER_CHOICE_KEY) === '1'
}

function readSystemTheme() {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

function persistUserTheme(value) {
  localStorage.setItem(STORAGE_KEY, value)
  localStorage.setItem(USER_CHOICE_KEY, '1')
}

/** @type {import('vue').Ref<'light' | 'dark' | 'eye'>} */
const theme = ref('light')

function applyTheme(value) {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'eye')
  root.classList.add(value)
  root.dataset.theme = value
  root.style.colorScheme = value === 'dark' ? 'dark' : 'light'
}

/**
 * @param {{ theme?: string } | null} [remote]
 */
export async function initTheme(remote = null) {
  if (hasUserThemeChoice()) {
    const stored = readStoredTheme()
    if (stored) {
      theme.value = stored
      applyTheme(stored)
      return
    }
  }

  if (remote?.theme && isValidTheme(remote.theme)) {
    theme.value = remote.theme
    applyTheme(remote.theme)
    return
  }

  theme.value = readSystemTheme()
  applyTheme(theme.value)
}

export function useTheme() {
  watch(theme, (value) => {
    applyTheme(value)
    window.dispatchEvent(new CustomEvent('theme-change', { detail: value }))
  })

  function setTheme(next) {
    if (isValidTheme(next)) {
      theme.value = next
      persistUserTheme(next)
    }
  }

  function cycleTheme() {
    const i = THEME_IDS.indexOf(theme.value)
    const next = THEME_IDS[(i + 1) % THEME_IDS.length]
    theme.value = next
    persistUserTheme(next)
  }

  const nextThemeId = computed(() => {
    const i = THEME_IDS.indexOf(theme.value)
    return THEME_IDS[(i + 1) % THEME_IDS.length]
  })

  const isDark = () => theme.value === 'dark'

  return { theme, setTheme, cycleTheme, nextThemeId, isDark, THEME_IDS }
}
