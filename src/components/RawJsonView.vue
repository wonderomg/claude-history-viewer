<script setup>
import { ref, watch, computed } from 'vue'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const props = defineProps({
  sessionId: { type: String, default: '' },
})

const loading = ref(false)
const error = ref('')
const lines = ref([])
const expanded = ref(new Set())
const filterType = ref('')

watch(
  () => props.sessionId,
  async (id) => {
    if (!id) {
      lines.value = []
      return
    }
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/raw`)
      if (!res.ok) throw new Error(t('raw.loadFailed'))
      const data = await res.json()
      lines.value = data.lines || []
      expanded.value = new Set()
    } catch (e) {
      error.value = e.message
      lines.value = []
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

const displayLines = computed(() => {
  if (!filterType.value) return lines.value
  return lines.value.filter((l) => l.json?.type === filterType.value)
})

function toggleLine(n) {
  const s = new Set(expanded.value)
  if (s.has(n)) s.delete(n)
  else s.add(n)
  expanded.value = s
}

function typeOf(line) {
  return line.json?.type || (line.parseError ? 'parse-error' : 'unknown')
}

const typeColors = {
  user: 'text-blue-400',
  assistant: 'text-accent',
  system: 'text-t-muted',
  attachment: 'text-purple-400',
  'ai-title': 'text-emerald-400',
  'file-history-snapshot': 'text-t-muted',
  'parse-error': 'text-red-400',
}
</script>

<template>
  <div class="h-full overflow-y-auto px-4 py-4 font-mono text-xs">
    <p v-if="loading" class="text-t-muted text-center py-12">{{ t('raw.loading') }}</p>
    <p v-else-if="error" class="text-red-400 text-center py-12">{{ error }}</p>

    <template v-else>
      <div class="flex items-center gap-2 mb-4 sticky top-0 bg-t-bg py-2 z-10">
        <span class="text-t-muted">{{ t('raw.lineCount', { n: lines.length }) }}</span>
        <select
          v-model="filterType"
          class="px-2 py-1 rounded bg-t-overlay border border-t-border text-t-text"
        >
          <option value="">{{ t('raw.allTypes') }}</option>
          <option value="user">user</option>
          <option value="assistant">assistant</option>
          <option value="system">system</option>
          <option value="attachment">attachment</option>
          <option value="ai-title">ai-title</option>
        </select>
      </div>

      <div
        v-for="line in displayLines"
        :key="line.lineNumber"
        class="mb-2 rounded-lg border border-t-border bg-t-overlay/50 overflow-hidden"
      >
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-t-overlay"
          @click="toggleLine(line.lineNumber)"
        >
          <span class="text-t-muted w-8 shrink-0">L{{ line.lineNumber }}</span>
          <span :class="typeColors[typeOf(line)] || 'text-t-muted'" class="shrink-0">
            {{ typeOf(line) }}
          </span>
          <span class="text-t-muted truncate flex-1">
            {{ line.raw.slice(0, 100) }}{{ line.raw.length > 100 ? '…' : '' }}
          </span>
          <span class="text-t-muted">{{ expanded.has(line.lineNumber) ? '▼' : '▶' }}</span>
        </button>
        <pre
          v-if="expanded.has(line.lineNumber)"
          class="px-3 pb-3 text-[11px] text-t-muted overflow-x-auto whitespace-pre-wrap break-all border-t border-t-border"
        >{{ line.json ? JSON.stringify(line.json, null, 2) : line.raw }}</pre>
      </div>
    </template>
  </div>
</template>
