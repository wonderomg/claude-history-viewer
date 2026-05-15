<script setup>
import { ref, computed } from 'vue'
import { highlightPlainText } from '../utils/highlight.js'

const props = defineProps({
  content: { type: String, default: '' },
  isError: { type: Boolean, default: false },
  toolUseId: { type: String, default: '' },
  highlightQuery: { type: String, default: '' },
})

const expanded = ref(false)
const MAX_PREVIEW = 600

const displayContent = computed(() => {
  const text =
    expanded.value || props.content.length <= MAX_PREVIEW
      ? props.content
      : props.content.slice(0, MAX_PREVIEW) + '\n…'
  return highlightPlainText(text, props.highlightQuery)
})
</script>

<template>
  <div
    class="rounded-lg border text-sm font-mono overflow-hidden"
    :class="isError ? 'border-red-900/50 bg-red-950/20' : 'border-emerald-900/40 bg-emerald-950/15'"
  >
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-left"
      @click="expanded = !expanded"
    >
      <span :class="isError ? 'text-red-400' : 'text-emerald-400'" class="text-xs font-medium">
        {{ isError ? 'Tool Error' : 'Tool Result' }}
      </span>
      <span class="text-t-muted text-xs truncate flex-1">{{ toolUseId }}</span>
      <span class="text-t-muted text-xs">{{ expanded ? '▼' : '▶' }}</span>
    </button>
    <pre
      class="px-3 pb-3 text-xs text-t-muted overflow-x-auto max-h-96 whitespace-pre-wrap break-words border-t border-t-border/50"
      :class="{ 'max-h-24 overflow-hidden': !expanded && content.length > MAX_PREVIEW }"
      v-html="displayContent"
    />
  </div>
</template>
