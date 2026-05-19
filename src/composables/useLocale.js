import { ref, watch, computed } from 'vue'
import { messages } from '../i18n/messages.js'

const STORAGE_KEY = 'claude-history-viewer-locale'
/** Set to "1" only when user picks language in Settings (not from config defaults). */
const USER_CHOICE_KEY = 'claude-history-viewer-locale-user'

function readStoredLocale() {
  if (typeof localStorage === 'undefined') return null
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'zh' || saved === 'en' ? saved : null
}

function hasUserLocaleChoice() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(USER_CHOICE_KEY) === '1'
}

function readBrowserLocale() {
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

function persistUserLocale(value) {
  localStorage.setItem(STORAGE_KEY, value)
  localStorage.setItem(USER_CHOICE_KEY, '1')
}

/** @type {import('vue').Ref<'zh' | 'en'>} */
const locale = ref('en')

function applyLocale(value) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.dataset.locale = value
}

/**
 * @param {{ locale?: string, language?: string } | null} [remote]
 */
export async function initLocale(remote = null) {
  if (hasUserLocaleChoice()) {
    const stored = readStoredLocale()
    if (stored) {
      locale.value = stored
      applyLocale(stored)
      return
    }
  }

  const fromConfig = remote?.locale ?? remote?.language
  if (fromConfig === 'zh' || fromConfig === 'en') {
    locale.value = fromConfig
    applyLocale(fromConfig)
    return
  }

  locale.value = readBrowserLocale()
  applyLocale(locale.value)
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
  watch(locale, (value) => {
    applyLocale(value)
    window.dispatchEvent(new CustomEvent('locale-change', { detail: value }))
  })

  function setLocale(next) {
    if (next === 'zh' || next === 'en') {
      locale.value = next
      persistUserLocale(next)
    }
  }

  function toggleLocale() {
    const next = locale.value === 'zh' ? 'en' : 'zh'
    locale.value = next
    persistUserLocale(next)
  }

  const languageSwitchLabel = computed(() =>
    locale.value === 'zh' ? t('settings.switchToEn') : t('settings.switchToZh')
  )

  return { locale, t, setLocale, toggleLocale, languageSwitchLabel }
}
