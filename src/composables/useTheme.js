import { ref, watch, onMounted } from 'vue'

const STORAGE_KEY = 'claude-history-viewer-theme'

function readInitialTheme() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  }
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  return 'light'
}

/** @type {import('vue').Ref<'dark' | 'light'>} */
const theme = ref(readInitialTheme())

function applyTheme(value) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(value)
  root.dataset.theme = value
  root.style.colorScheme = value
}

export function useTheme() {
  onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      theme.value = saved
    }
    applyTheme(theme.value)
  })

  watch(theme, (value) => {
    applyTheme(value)
    localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new CustomEvent('theme-change', { detail: value }))
  })

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  const isDark = () => theme.value === 'dark'

  return { theme, toggleTheme, isDark }
}
