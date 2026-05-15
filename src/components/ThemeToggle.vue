<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useLocale } from '../composables/useLocale.js'

const { theme, toggleTheme } = useTheme()
const { t } = useLocale()

const themeLabel = computed(() =>
  theme.value === 'dark' ? t('theme.toLight') : t('theme.toDark')
)
</script>

<template>
  <button
    type="button"
    class="theme-toggle shrink-0 p-2 rounded-lg border border-t-border bg-t-raised text-t-muted hover:text-t-text hover:border-accent/40 transition-all duration-300 ease-out"
    :title="themeLabel"
    :aria-label="themeLabel"
    @click="toggleTheme"
  >
    <svg
      v-if="theme === 'dark'"
      class="w-5 h-5 transition-transform duration-300 hover:rotate-45"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg
      v-else
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
  </button>
</template>
