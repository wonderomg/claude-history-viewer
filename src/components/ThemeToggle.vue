<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useLocale } from '../composables/useLocale.js'

const { theme, cycleTheme, nextThemeId } = useTheme()
const { t } = useLocale()

const themeLabel = computed(() => {
  const next = nextThemeId.value
  if (next === 'dark') return t('theme.toDark')
  if (next === 'eye') return t('theme.toEye')
  return t('theme.toLight')
})
</script>

<template>
  <button
    type="button"
    class="theme-toggle shrink-0 p-2 rounded-lg border border-t-border bg-t-raised text-t-muted hover:text-t-text hover:border-accent/40 transition-all duration-300 ease-out"
    :title="themeLabel"
    :aria-label="themeLabel"
    @click="cycleTheme"
  >
    <!-- 浅色 → 下一项深色 -->
    <svg
      v-if="theme === 'light'"
      class="w-5 h-5 transition-transform duration-300 hover:-rotate-12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
    <!-- 深色 → 下一项护眼 -->
    <svg
      v-else-if="theme === 'dark'"
      class="w-5 h-5 transition-transform duration-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <!-- 护眼 → 下一项浅色 -->
    <svg
      v-else
      class="w-5 h-5 transition-transform duration-300 hover:rotate-45"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 3c-4 0-7 2.5-7 6.5 0 3.5 3 6 7 11.5 4-5.5 7-8 7-11.5C19 5.5 16 3 12 3z" />
      <path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  </button>
</template>
