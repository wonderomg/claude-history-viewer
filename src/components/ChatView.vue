<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import MessageBubble from './MessageBubble.vue'
import RawJsonView from './RawJsonView.vue'
import { formatTime } from '../utils/format.js'
import {
  scheduleScrollToMatchIndex,
  scheduleScrollToMessageHighlight,
  setActiveSearchMark,
} from '../utils/highlight.js'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const props = defineProps({
  session: { type: Object, default: null },
  meta: { type: Object, default: () => ({}) },
  messages: { type: Array, default: () => [] },
  subagents: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  searchHits: { type: Array, default: () => [] },
  searchMatches: { type: Array, default: () => [] },
  toolsOnly: { type: Boolean, default: false },
  viewMode: { type: String, default: 'chat' },
  focusMessageId: { type: String, default: '' },
})

const emit = defineEmits([
  'update:searchQuery',
  'update:toolsOnly',
  'update:viewMode',
  'search',
  'search-enter',
  'select-subagent',
  'export',
  'focusHandled',
])

const chatRef = ref(null)
const highlightId = ref('')
const currentMatchIndex = ref(0)

const totalMatches = computed(() => props.searchMatches.length)

const matchCountLabel = computed(() => {
  if (!totalMatches.value) return ''
  return t('chat.matchCount', {
    current: currentMatchIndex.value + 1,
    total: totalMatches.value,
  })
})

watch(
  () => props.session?.id,
  () => {
    highlightId.value = ''
    currentMatchIndex.value = 0
    nextTick(() => {
      if (chatRef.value) chatRef.value.scrollTop = 0
    })
  }
)

function goToMatch(index) {
  if (!totalMatches.value || props.loading || props.viewMode !== 'chat') return false
  const total = totalMatches.value
  const i = ((index % total) + total) % total
  const match = props.searchMatches[i]
  if (!match) return false

  currentMatchIndex.value = i
  highlightId.value = match.messageId
  scheduleScrollToMatchIndex(chatRef.value, i)
  return true
}

function goToPrevMatch() {
  if (!totalMatches.value) return
  goToMatch(currentMatchIndex.value - 1)
}

function goToNextMatch() {
  if (!totalMatches.value) return
  goToMatch(currentMatchIndex.value + 1)
}

function scrollToMessage(id) {
  if (!id) return
  highlightId.value = id
  scheduleScrollToMessageHighlight(id)
}

function scrollToHitMessage(messageId) {
  const idx = props.searchMatches.findIndex((m) => m.messageId === messageId)
  if (idx >= 0) {
    goToMatch(idx)
  } else {
    scrollToMessage(messageId)
  }
}

watch(
  () => [props.focusMessageId, props.loading, props.messages.length, props.viewMode, props.searchQuery],
  async ([id, loading]) => {
    if (!id || loading || props.viewMode !== 'chat' || !props.messages.length) return
    const idx = props.searchMatches.findIndex((m) => m.messageId === id)
    if (idx >= 0) {
      await nextTick()
      goToMatch(idx)
    } else {
      highlightId.value = id
      await nextTick()
      scheduleScrollToMessageHighlight(id)
    }
    emit('focusHandled')
  }
)

let lastSearchNavKey = ''

/** 搜索完成后定位到第一处 */
watch(
  () => [props.searchQuery, props.searchMatches],
  async ([query, matches]) => {
    if (!query?.trim() || !matches?.length || props.loading || props.viewMode !== 'chat') return
    const navKey = `${query}:${matches.length}:${matches[0]?.messageId}`
    if (navKey === lastSearchNavKey) return
    lastSearchNavKey = navKey
    await nextTick()
    goToMatch(0)
  },
  { deep: true }
)

watch(
  () => props.session?.id,
  () => {
    lastSearchNavKey = ''
    currentMatchIndex.value = 0
  }
)

watch(
  () => props.searchQuery,
  (q) => {
    if (!q?.trim()) {
      currentMatchIndex.value = 0
      setActiveSearchMark(chatRef.value, -1)
    }
  }
)

const localSearchQuery = ref('')
const isSearchComposing = ref(false)

watch(
  () => props.searchQuery,
  (q) => {
    if (!isSearchComposing.value) localSearchQuery.value = q
  },
  { immediate: true }
)

watch(
  () => props.session?.id,
  () => {
    isSearchComposing.value = false
    localSearchQuery.value = props.searchQuery
  }
)

let searchTimer
function scheduleSessionSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emit('search'), 300)
}

function onSearchInput(e) {
  const v = e.target.value
  localSearchQuery.value = v
  if (isSearchComposing.value) return
  emit('update:searchQuery', v)
  scheduleSessionSearch()
}

function onSearchCompositionStart() {
  isSearchComposing.value = true
  clearTimeout(searchTimer)
}

function onSearchCompositionEnd(e) {
  isSearchComposing.value = false
  const v = e.target.value
  localSearchQuery.value = v
  emit('update:searchQuery', v)
  scheduleSessionSearch()
}

function onSearchKeyup(e) {
  if (e.key === 'Enter' || isSearchComposing.value) return
  scheduleSessionSearch()
}

function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    if (isSearchComposing.value) return
    e.preventDefault()
    clearTimeout(searchTimer)
    lastSearchNavKey = ''
    emit('search-enter')
    return
  }
  if (e.altKey && e.key === 'ArrowUp') {
    e.preventDefault()
    goToPrevMatch()
  } else if (e.altKey && e.key === 'ArrowDown') {
    e.preventDefault()
    goToNextMatch()
  }
}

function setViewMode(mode) {
  emit('update:viewMode', mode)
}

const highlightQuery = computed(() => props.searchQuery.trim())

const sessionLabel = computed(() => {
  if (!props.session) return ''
  const src = props.session.source === 'cursor' ? 'Cursor' : 'Claude Code'
  if (props.session.kind === 'subagent') {
    return t('chat.subagentLabel', { source: src })
  }
  return src
})
</script>

<template>
  <main class="flex flex-col h-full min-w-0 bg-t-bg">
    <header
      v-if="session"
      class="shrink-0 px-5 py-4 border-b border-t-border bg-t-raised/50"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium"
              :class="session.kind === 'subagent' ? 'bg-purple-950/50 text-purple-300' : 'bg-t-overlay text-t-muted'"
            >
              {{ sessionLabel }}
            </span>
          </div>
          <h2 class="text-lg font-semibold text-t-text truncate">{{ meta.title || session.title }}</h2>
          <p v-if="session.agentDescription" class="text-xs text-t-muted mt-1">{{ session.agentDescription }}</p>
          <p class="text-xs text-t-muted font-mono mt-1 truncate">{{ session.cwd || session.projectPath }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md border transition-colors"
            :class="viewMode === 'chat' ? 'bg-accent/20 border-accent/40 text-accent' : 'border-t-border text-t-muted hover:text-t-text'"
            @click="setViewMode('chat')"
          >
            {{ t('chat.chatTab') }}
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md border transition-colors"
            :class="viewMode === 'raw' ? 'bg-accent/20 border-accent/40 text-accent' : 'border-t-border text-t-muted hover:text-t-text'"
            @click="setViewMode('raw')"
          >
            {{ t('chat.rawJsonTab') }}
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md border border-t-border text-t-muted hover:text-t-text hover:border-t-border"
            :title="t('chat.exportTitle')"
            @click="emit('export')"
          >
            {{ t('chat.exportMd') }}
          </button>
        </div>
      </div>

      <div v-if="subagents.length && session.kind !== 'subagent'" class="mt-3 flex flex-wrap gap-1.5">
        <span class="text-[10px] text-t-muted self-center mr-1">{{ t('chat.subagentsLabel') }}</span>
        <button
          v-for="sub in subagents"
          :key="sub.id"
          type="button"
          class="text-[11px] px-2 py-0.5 rounded-full border border-purple-900/40 text-purple-300 hover:bg-purple-950/30 truncate max-w-[200px]"
          :title="sub.agentDescription || sub.title"
          @click="emit('select-subagent', sub.id)"
        >
          {{ sub.title }}
        </button>
      </div>

      <div v-if="viewMode === 'chat'" class="flex flex-wrap items-center gap-2 mt-3">
        <input
          :value="localSearchQuery"
          type="search"
          :placeholder="t('chat.inSessionSearch')"
          class="flex-1 min-w-[160px] max-w-md px-3 py-1.5 text-sm rounded-lg bg-t-bg border border-t-border text-t-text placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
          @input="onSearchInput"
          @compositionstart="onSearchCompositionStart"
          @compositionend="onSearchCompositionEnd"
          @keyup="onSearchKeyup"
          @keydown="onSearchKeydown"
        />
        <div
          v-if="totalMatches > 0"
          class="flex items-center gap-0.5 shrink-0 rounded-lg border border-t-border bg-t-bg"
        >
          <button
            type="button"
            class="p-1.5 text-t-muted hover:text-t-text hover:bg-t-overlay rounded-l-lg transition-colors disabled:opacity-40"
            :title="t('chat.matchPrev')"
            :disabled="totalMatches <= 1"
            @click="goToPrevMatch"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="text-xs text-t-muted tabular-nums min-w-[3.5rem] text-center px-1">{{ matchCountLabel }}</span>
          <button
            type="button"
            class="p-1.5 text-t-muted hover:text-t-text hover:bg-t-overlay rounded-r-lg transition-colors disabled:opacity-40"
            :title="t('chat.matchNext')"
            :disabled="totalMatches <= 1"
            @click="goToNextMatch"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <label class="flex items-center gap-2 text-xs text-t-muted cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="toolsOnly"
            class="rounded border-t-border bg-t-bg text-accent focus:ring-accent/50"
            @change="emit('update:toolsOnly', $event.target.checked)"
          />
          {{ t('chat.toolsOnly') }}
        </label>
        <span class="text-xs text-t-muted">{{ formatTime(session.updatedAt) }}</span>
      </div>

      <div v-if="searchHits.length && viewMode === 'chat'" class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="(hit, i) in searchHits"
          :key="i"
          type="button"
          class="text-left text-xs px-2 py-1 rounded bg-t-overlay border border-t-border text-t-muted hover:border-accent/40 max-w-xs truncate"
          :class="searchMatches[currentMatchIndex]?.messageId === hit.messageId ? 'border-accent/50 text-t-text' : ''"
          :title="hit.snippet"
          @click="scrollToHitMessage(hit.messageId)"
        >
          {{ hit.role }}: {{ hit.snippet }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-t-muted">
      {{ t('chat.loadingSession') }}
    </div>

    <div
      v-else-if="!session"
      class="flex-1 flex flex-col items-center justify-center text-t-muted gap-2"
    >
      <p class="text-lg">{{ t('chat.pickSession') }}</p>
      <p class="text-sm text-t-muted">{{ t('chat.pickSessionHint') }}</p>
    </div>

    <RawJsonView v-else-if="viewMode === 'raw'" :session-id="session.id" class="flex-1 min-h-0" />

    <div v-else ref="chatRef" class="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :highlight="highlightId === msg.id"
        :tools-only="toolsOnly"
        :highlight-query="highlightQuery"
      />
      <p v-if="messages.length === 0" class="text-center text-t-muted py-12">
        {{ t('chat.noMessages') }}
      </p>
    </div>
  </main>
</template>
