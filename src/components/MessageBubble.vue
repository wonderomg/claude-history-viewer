<script setup>
import { computed } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ToolCallBlock from './ToolCallBlock.vue'
import ToolResultBlock from './ToolResultBlock.vue'
import { formatTime, formatDuration } from '../utils/format.js'
import { highlightPlainText } from '../utils/highlight.js'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const props = defineProps({
  message: { type: Object, required: true },
  highlight: { type: Boolean, default: false },
  toolsOnly: { type: Boolean, default: false },
  highlightQuery: { type: String, default: '' },
})

const highlightedUserText = computed(() =>
  highlightPlainText(props.message.text || '', props.highlightQuery)
)
const highlightedThinking = computed(() =>
  highlightPlainText(props.message.thinking || '', props.highlightQuery)
)

const showBubble = computed(() => {
  if (!props.toolsOnly) return true
  const m = props.message
  if (m.role === 'tool_result') return true
  if (m.role === 'assistant' && m.toolUses?.length) return true
  return false
})
</script>

<template>
  <article
    v-if="showBubble"
    :id="'msg-' + message.id"
    class="scroll-mt-4 transition-colors rounded-lg"
    :class="highlight ? 'ring-1 ring-accent/60 bg-accent/5' : ''"
  >
    <!-- 用户 -->
    <div v-if="message.role === 'user'" class="flex justify-end mb-4">
      <div class="max-w-[85%]">
        <div class="text-[11px] text-t-muted text-right mb-1">{{ formatTime(message.timestamp) }}</div>
        <div
          class="bg-blue-600/90 text-white rounded-2xl rounded-tr-sm px-4 py-3 whitespace-pre-wrap text-[15px] leading-relaxed [&_.search-highlight]:bg-amber-200/90 [&_.search-highlight]:text-slate-900"
          v-html="highlightedUserText"
        />
      </div>
    </div>

    <!-- 助手 -->
    <div v-else-if="message.role === 'assistant'" class="flex flex-col items-start mb-6 max-w-full">
      <div class="flex items-center gap-2 mb-2 text-xs text-t-muted">
        <span class="text-accent font-medium">Claude</span>
        <span v-if="message.model" class="font-mono">{{ message.model }}</span>
        <span>{{ formatTime(message.timestamp) }}</span>
      </div>

      <details v-if="message.thinking" class="mb-3 w-full max-w-4xl group">
        <summary class="cursor-pointer text-xs text-t-muted hover:text-t-muted select-none list-none flex items-center gap-1">
          <span class="inline-block transition-transform group-open:rotate-90">▶</span>
          {{ t('message.thinking') }}
        </summary>
        <div
          class="mt-2 pl-3 border-l-2 border-t-border text-sm text-t-muted italic whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
          v-html="highlightedThinking"
        />
      </details>

      <div v-if="message.toolUses?.length" class="w-full max-w-4xl space-y-2 mb-3">
        <ToolCallBlock v-for="t in message.toolUses" :key="t.id" :tool="t" />
      </div>

      <div v-if="message.text && !toolsOnly" class="w-full max-w-4xl bg-t-overlay/80 border border-t-border rounded-2xl rounded-tl-sm px-5 py-4">
        <MarkdownRenderer :source="message.text" :highlight-query="highlightQuery" />
      </div>
    </div>

    <!-- Tool Result -->
    <div v-else-if="message.role === 'tool_result'" class="mb-4 max-w-4xl">
      <ToolResultBlock
        :content="message.content"
        :is-error="message.isError"
        :tool-use-id="message.toolUseId"
        :highlight-query="highlightQuery"
      />
    </div>

    <!-- 系统 -->
    <div v-else-if="message.role === 'system'" class="mb-3">
      <div
        v-if="message.subtype === 'turn_duration'"
        class="text-center text-xs text-t-muted py-1"
      >
        {{ t('message.turnDuration', { duration: formatDuration(message.durationMs), count: message.messageCount }) }}
      </div>
      <details v-else-if="message.subtype === 'attachment'" class="text-xs text-t-muted">
        <summary class="cursor-pointer hover:text-t-muted">{{ t('message.attachment', { type: message.attachmentType }) }}</summary>
        <pre class="mt-1 p-2 bg-t-overlay rounded text-t-muted max-h-32 overflow-auto">{{ message.text?.slice(0, 500) }}…</pre>
      </details>
    </div>
  </article>
</template>
