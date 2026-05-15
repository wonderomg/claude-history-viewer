import { ref, watch, onMounted, computed } from 'vue'
import { messages } from '../i18n/messages.js'

const STORAGE_KEY = 'claude-history-viewer-locale'

function readInitialLocale() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

/** @type {import('vue').Ref<'zh' | 'en'>} */
const locale = ref(readInitialLocale())

function applyLocale(value) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.dataset.locale = value
}

/**
 * @param {string} key dot-separated path
 * @param {Record<string, string | number>} [params]
 */
export function t(key, params = {}) {
  const parts = key.split('.')
  let val = messages[locale.value]
  for (const p of parts) {
    val = val?.[p]
  }
  if (typeof val !== 'string') return key
  return val.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
}

export function useLocale() {
  onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') {
      locale.value = saved
    }
    applyLocale(locale.value)
  })

  watch(locale, (value) => {
    applyLocale(value)
    localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new CustomEvent('locale-change', { detail: value }))
  })

  function setLocale(next) {
    if (next === 'zh' || next === 'en') locale.value = next
  }

  function toggleLocale() {
    locale.value = locale.value === 'zh' ? 'en' : 'zh'
  }

  const languageSwitchLabel = computed(() =>
    locale.value === 'zh' ? t('settings.switchToEn') : t('settings.switchToZh')
  )

  return { locale, t, setLocale, toggleLocale, languageSwitchLabel }
}
