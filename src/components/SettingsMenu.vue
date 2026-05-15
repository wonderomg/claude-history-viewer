<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useLocale } from '../composables/useLocale.js'

const { t, toggleLocale, languageSwitchLabel } = useLocale()
const open = ref(false)
const root = ref(null)

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="relative shrink-0">
    <button
      type="button"
      class="p-2 rounded-lg border border-t-border bg-t-raised text-t-muted hover:text-t-text hover:border-accent/40 transition-all"
      :title="t('settings.title')"
      :aria-label="t('settings.title')"
      :aria-expanded="open"
      @click.stop="open = !open"
    >
      <svg
        class="w-5 h-5 transition-transform duration-300"
        :class="open ? 'rotate-90' : ''"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-1.5 z-50 min-w-[168px] rounded-lg border border-t-border bg-t-raised shadow-lg py-2 px-2 theme-transition"
      role="menu"
    >
      <p class="px-2 py-1 text-[10px] uppercase tracking-wide text-t-muted">
        {{ t('settings.language') }}
      </p>
      <button
        type="button"
        role="menuitem"
        class="w-full text-left px-2 py-2 text-sm rounded-md text-t-text hover:bg-t-overlay transition-colors"
        @click="toggleLocale(); open = false"
      >
        {{ languageSwitchLabel }}
      </button>
    </div>
  </div>
</template>
