<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import SessionSidebar from './components/SessionSidebar.vue'
import ChatView from './components/ChatView.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import { useLocale } from './composables/useLocale.js'

const { t } = useLocale()

const sessions = ref([])
const projects = ref([])
const claudeDir = ref('')
const selectedId = ref('')
const currentSession = ref(null)
const messages = ref([])
const meta = ref({})
const subagents = ref([])
const listLoading = ref(true)
const detailLoading = ref(false)
const projectFilter = ref('')
const listQuery = ref('')
const hideSubagents = ref(false)
const sourceFilter = ref('claude')
const cursorDir = ref('')
const searchQuery = ref('')
const searchHits = ref([])
const searchMatches = ref([])
const toolsOnly = ref(false)
const viewMode = ref('chat')
const globalQuery = ref('')
const globalResults = ref([])
const globalSearching = ref(false)
/** 是否展示跨会话命中面板（与 globalResults 分离，便于聚焦搜索框时恢复） */
const showGlobalResultsPanel = ref(false)
/** 跨会话搜索跳转后需滚动定位的消息 id */
const focusMessageId = ref('')
const globalSearchInput = ref(null)
const globalResultsPanel = ref(null)
const error = ref('')

/** 顶栏展示的数据目录（随来源切换） */
const activeDataDir = computed(() => {
  if (sourceFilter.value === 'cursor') return cursorDir.value
  if (sourceFilter.value === 'claude') return claudeDir.value
  if (claudeDir.value && cursorDir.value) {
    return `${claudeDir.value} · ${cursorDir.value}`
  }
  return claudeDir.value || cursorDir.value
})

const activeDataDirTitle = computed(() => {
  if (sourceFilter.value === 'all' && claudeDir.value && cursorDir.value) {
    return `Claude: ${claudeDir.value}\nCursor: ${cursorDir.value}`
  }
  return activeDataDir.value
})

async function loadSessions() {
  listLoading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/sessions?source=${encodeURIComponent(sourceFilter.value)}`)
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    sessions.value = data.sessions || []
    projects.value = data.projects || []
    claudeDir.value = data.claudeDir || ''
    cursorDir.value = data.cursorDir || ''
  } catch (e) {
    error.value = t('app.backendError')
    console.error(e)
  } finally {
    listLoading.value = false
  }
}

/**
 * @param {string} id
 * @param {boolean} [force]
 * @param {{ searchText?: string, focusMessageId?: string }} [options]
 */
async function selectSession(id, force = false, options = {}) {
  const { searchText, focusMessageId: focusId } = options
  if (!force && selectedId.value === id && messages.value.length && !focusId) return

  selectedId.value = id
  focusMessageId.value = ''
  if (searchText !== undefined) {
    searchQuery.value = searchText
  } else {
    searchQuery.value = ''
    searchHits.value = []
    searchMatches.value = []
  }
  viewMode.value = 'chat'
  toolsOnly.value = false
  detailLoading.value = true
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(t('app.loadFailed'))
    const data = await res.json()
    currentSession.value = data.session
    messages.value = data.messages || []
    meta.value = data.meta || {}
    subagents.value = data.subagents || []
  } catch (e) {
    console.error(e)
    messages.value = []
    subagents.value = []
  } finally {
    detailLoading.value = false
    if (searchText) {
      await searchInSession()
    }
    if (focusId) {
      await nextTick()
      focusMessageId.value = focusId
    }
  }
}

async function searchInSession() {
  if (!selectedId.value || !searchQuery.value.trim()) {
    searchHits.value = []
    searchMatches.value = []
    return { hits: [], matches: [], total: 0 }
  }
  try {
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(selectedId.value)}/search?q=${encodeURIComponent(searchQuery.value)}`
    )
    const data = await res.json()
    searchHits.value = data.hits || []
    searchMatches.value = data.matches || []
    return { hits: searchHits.value, matches: searchMatches.value, total: data.total ?? searchMatches.value.length }
  } catch {
    searchHits.value = []
    searchMatches.value = []
    return { hits: [], matches: [], total: 0 }
  }
}

async function onSessionSearchEnter() {
  await searchInSession()
}

let globalTimer
async function runGlobalSearch() {
  const q = globalQuery.value.trim()
  if (!q) {
    globalResults.value = []
    showGlobalResultsPanel.value = false
    return
  }
  globalSearching.value = true
  showGlobalResultsPanel.value = true
  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(sourceFilter.value)}`
    )
    const data = await res.json()
    globalResults.value = data.results || []
    showGlobalResultsPanel.value = globalResults.value.length > 0
  } catch {
    globalResults.value = []
    showGlobalResultsPanel.value = false
  } finally {
    globalSearching.value = false
  }
}

function onGlobalInput() {
  clearTimeout(globalTimer)
  globalTimer = setTimeout(runGlobalSearch, 400)
}

function onGlobalSearchFocus() {
  if (globalQuery.value.trim()) {
    showGlobalResultsPanel.value = true
  }
}

/** 点击搜索框即展示结果并重新检索 */
function onGlobalSearchPointerDown() {
  const q = globalQuery.value.trim()
  if (!q) return
  showGlobalResultsPanel.value = true
  clearTimeout(globalTimer)
  runGlobalSearch()
}

function onDocumentPointerDown(e) {
  if (!showGlobalResultsPanel.value) return
  const target = e.target
  if (globalSearchInput.value?.contains(target)) return
  if (globalResultsPanel.value?.contains(target)) return
  showGlobalResultsPanel.value = false
}

async function openGlobalResult(result) {
  const q = globalQuery.value.trim()
  const messageId = result.hits?.[0]?.messageId || result.matches?.[0]?.messageId || ''
  await selectSession(result.sessionId, true, {
    searchText: q,
    focusMessageId: messageId,
  })
  showGlobalResultsPanel.value = false
}

function exportMarkdown() {
  if (!selectedId.value) return
  const url = `/api/sessions/${encodeURIComponent(selectedId.value)}/export`
  window.open(url, '_blank')
}

function onSourceFilterChange(v) {
  sourceFilter.value = v
  loadSessions()
  if (globalQuery.value.trim()) {
    clearTimeout(globalTimer)
    runGlobalSearch()
  } else {
    globalResults.value = []
    showGlobalResultsPanel.value = false
  }
}

onMounted(() => {
  loadSessions()
  document.addEventListener('mousedown', onDocumentPointerDown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-t-bg theme-transition">
    <header class="shrink-0 flex items-center gap-3 pl-4 pr-2 py-2 border-b border-t-border bg-t-raised theme-transition">
      <div class="shrink-0 min-w-0">
        <h1 class="text-sm font-semibold text-t-text tracking-tight font-mono">claude-history-viewer</h1>
        <p class="text-[10px] text-t-muted mt-0.5 hidden sm:block">{{ t('app.subtitle') }}</p>
      </div>
      <div ref="globalSearchInput" class="flex-1 max-w-2xl min-w-0">
        <input
          v-model="globalQuery"
          type="search"
          :placeholder="t('app.globalSearchPlaceholder')"
          class="w-full px-3 py-1.5 text-sm rounded-lg bg-t-bg border border-t-border text-t-text placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-accent/50 theme-transition"
          @input="onGlobalInput"
          @focus="onGlobalSearchFocus"
          @mousedown="onGlobalSearchPointerDown"
        />
      </div>
      <span v-if="globalSearching" class="text-xs text-t-muted shrink-0 hidden sm:inline">{{ t('app.searching') }}</span>
      <span
        v-else-if="activeDataDir"
        class="text-[10px] text-t-muted font-mono hidden lg:block truncate max-w-xs shrink-0"
        :title="activeDataDirTitle"
      >{{ activeDataDir }}</span>
      <div class="shrink-0 ml-auto flex items-center gap-1.5 pl-2 pr-0.5">
        <ThemeToggle />
        <SettingsMenu />
      </div>
    </header>

    <p v-if="error" class="shrink-0 px-4 py-2 text-sm text-red-400 bg-red-950/30 border-b border-red-900/30">
      {{ error }}
    </p>

    <div
      v-if="showGlobalResultsPanel && (globalResults.length || globalSearching)"
      ref="globalResultsPanel"
      class="shrink-0 max-h-40 overflow-y-auto border-b border-t-border bg-t-overlay px-4 py-2 theme-transition"
    >
      <p class="text-xs text-t-muted mb-2">
        <template v-if="globalSearching">{{ t('app.searching') }}</template>
        <template v-else>{{ t('app.globalHits', { n: globalResults.length }) }}</template>
      </p>
      <button
        v-for="r in globalResults"
        :key="r.sessionId"
        type="button"
        class="block w-full text-left text-sm py-1.5 px-2 rounded hover:bg-t-bg text-t-text theme-transition"
        @mousedown.prevent
        @click="openGlobalResult(r)"
      >
        <span
          class="text-[10px] px-1 rounded mr-1"
          :class="r.source === 'cursor' ? 'bg-sky-500/20 text-sky-400' : 'bg-accent/20 text-accent'"
        >{{ r.source === 'cursor' ? 'Cursor' : 'Claude' }}</span>
        <span v-if="r.kind === 'subagent'" class="text-purple-400 text-xs mr-1">SUB</span>
        <span class="text-t-text">{{ r.title }}</span>
        <span class="text-t-muted text-xs ml-2">{{ r.projectPath }}</span>
        <span class="text-t-muted text-xs ml-2">{{ t('app.hitPlaces', { n: r.total ?? r.hits.length }) }}</span>
      </button>
    </div>

    <div class="flex-1 flex min-h-0">
      <SessionSidebar
        class="w-72 lg:w-80 shrink-0"
        :sessions="sessions"
        :projects="projects"
        :selected-id="selectedId"
        :project-filter="projectFilter"
        :list-query="listQuery"
        :hide-subagents="hideSubagents"
        :source-filter="sourceFilter"
        :loading="listLoading"
        @select="selectSession($event, true)"
        @update:project-filter="projectFilter = $event"
        @update:list-query="listQuery = $event"
        @update:hide-subagents="hideSubagents = $event"
        @update:source-filter="onSourceFilterChange"
      />
      <ChatView
        class="flex-1 min-w-0"
        :session="currentSession"
        :meta="meta"
        :messages="messages"
        :subagents="subagents"
        :loading="detailLoading"
        v-model:search-query="searchQuery"
        v-model:tools-only="toolsOnly"
        v-model:view-mode="viewMode"
        :search-hits="searchHits"
        :search-matches="searchMatches"
        :focus-message-id="focusMessageId"
        @search="searchInSession"
        @search-enter="onSessionSearchEnter"
        @focus-handled="focusMessageId = ''"
        @select-subagent="selectSession($event, true)"
        @export="exportMarkdown"
      />
    </div>
  </div>
</template>
