<script setup>
import { formatTime } from '../utils/format.js'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

defineProps({
  session: { type: Object, required: true },
  selectedId: { type: String, default: '' },
  isSub: { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<template>
  <button
    type="button"
    class="w-full text-left rounded-lg transition-colors border"
    :data-session-id="session.id"
    :class="[
      selectedId === session.id
        ? 'bg-accent/15 border-accent/30 text-t-text'
        : 'hover:bg-t-overlay border-transparent text-t-text',
      isSub ? 'px-2 py-2' : 'px-3 py-2.5',
    ]"
    @click="$emit('select', session.id)"
  >
    <div class="flex items-center gap-1.5 min-w-0">
      <span
        class="text-[9px] px-1 rounded shrink-0 font-medium"
        :class="session.source === 'cursor' ? 'bg-sky-500/20 text-sky-400' : 'bg-accent/15 text-accent'"
      >{{ session.source === 'cursor' ? 'CR' : 'CC' }}</span>
      <span v-if="isSub" class="text-[10px] text-purple-400 shrink-0 font-medium">SUB</span>
      <span v-else-if="session.kind === 'subagent'" class="text-[10px] text-purple-400 shrink-0">SUB</span>
      <span class="text-sm font-medium truncate">{{ session.title }}</span>
    </div>
    <div v-if="!isSub" class="text-[11px] text-t-muted mt-1 truncate font-mono">
      {{ session.projectPath }}
    </div>
    <div v-else-if="session.agentType" class="text-[10px] text-t-muted mt-0.5 truncate">
      {{ session.agentType }}
    </div>
    <div class="flex items-center gap-2 mt-1 text-[10px] text-t-muted">
      <span>{{ formatTime(session.updatedAt) }}</span>
      <span v-if="session.messageCount">· {{ t('sidebar.messageCount', { n: session.messageCount }) }}</span>
    </div>
  </button>
</template>
