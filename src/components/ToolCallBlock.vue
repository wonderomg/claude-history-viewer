<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tool: { type: Object, required: true },
})

const expanded = ref(false)

const summary = computed(() => {
  const { name, input } = props.tool
  if (name === 'Bash' && input?.command) {
    return input.command.length > 120 ? input.command.slice(0, 120) + '…' : input.command
  }
  if (name === 'Read' && input?.file_path) return input.file_path
  if (name === 'Edit' && input?.file_path) return input.file_path
  if (name === 'Write' && input?.file_path) return input.file_path
  if (name === 'Grep' && input?.pattern) return `pattern: ${input.pattern}`
  return null
})

const inputJson = computed(() => JSON.stringify(props.tool.input, null, 2))
</script>

<template>
  <div
    class="rounded-lg border border-amber-900/40 bg-amber-950/20 overflow-hidden"
  >
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-950/30 transition-colors"
      @click="expanded = !expanded"
    >
      <span class="text-amber-400 text-xs font-mono font-medium shrink-0">{{ tool.name }}</span>
      <span v-if="summary" class="text-t-muted text-xs font-mono truncate flex-1">{{ summary }}</span>
      <span class="text-t-muted text-xs shrink-0">{{ expanded ? '▼' : '▶' }}</span>
    </button>
    <pre
      v-if="expanded"
      class="px-3 pb-3 text-xs font-mono text-t-muted overflow-x-auto border-t border-amber-900/30"
    >{{ inputJson }}</pre>
  </div>
</template>
