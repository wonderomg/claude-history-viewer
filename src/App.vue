<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import SessionSidebar from './components/SessionSidebar.vue'
import ChatView from './components/ChatView.vue'
import UsageDashboard from './components/UsageDashboard.vue'
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
const codexDir = ref('')
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
/** 'sessions' | 'dashboard' */
const appView = ref('sessions')
const refreshing = ref(false)
const dashboardRef = ref(null)
const sidebarRef = ref(null)
/** 进入会话详情前所在的视图，用于返回上一页 */
const previousAppView = ref(null)

/** 顶栏展示的数据目录（随来源切换） */
const activeDataDir = computed(() => {
  if (sourceFilter.value === 'cursor') return cursorDir.value
  if (sourceFilter.value === 'claude') return claudeDir.value
  if (sourceFilter.value === 'codex') return codexDir.value
  const parts = [claudeDir.value, cursorDir.value, codexDir.value].filter(Boolean)
  return parts.join(' · ')
})

const activeDataDirTitle = computed(() => {
  if (sourceFilter.value === 'all') {
    const lines = []
    if (claudeDir.value) lines.push(`Claude: ${claudeDir.value}`)
    if (cursorDir.value) lines.push(`Cursor: ${cursorDir.value}`)
    if (codexDir.value) lines.push(`Codex: ${codexDir.value}`)
    return lines.join('\n') || activeDataDir.value
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
    codexDir.value = data.codexDir || ''
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

const globalComposing = ref(false)

function scheduleGlobalSearch() {
  clearTimeout(globalTimer)
  globalTimer = setTimeout(runGlobalSearch, 400)
}

function onGlobalInput(e) {
  globalQuery.value = e.target.value
  if (globalComposing.value) return
  scheduleGlobalSearch()
}

function onGlobalCompositionStart() {
  globalComposing.value = true
  clearTimeout(globalTimer)
}

function onGlobalCompositionEnd(e) {
  globalComposing.value = false
  globalQuery.value = e.target.value
  scheduleGlobalSearch()
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

function toggleAppView() {
  if (appView.value === 'dashboard') {
    previousAppView.value = null
    appView.value = 'sessions'
  } else {
    previousAppView.value = null
    appView.value = 'dashboard'
  }
}

function goBack() {
  const prev = previousAppView.value
  if (!prev) return
  previousAppView.value = null
  appView.value = prev
}

async function openSessionFromDashboard(payload) {
  const sessionId = typeof payload === 'string' ? payload : payload?.sessionId
  const source = typeof payload === 'object' ? payload?.source : null
  if (!sessionId) return

  previousAppView.value = appView.value
  appView.value = 'sessions'
  listQuery.value = ''
  projectFilter.value = ''

  if (source === 'cursor' || source === 'claude' || source === 'codex') {
    sourceFilter.value = source
  }

  await loadSessions()

  if (!sessions.value.some((s) => s.id === sessionId) && sourceFilter.value !== 'all') {
    sourceFilter.value = 'all'
    await loadSessions()
  }

  const target = sessions.value.find((s) => s.id === sessionId)
  if (target?.kind === 'subagent') {
    hideSubagents.value = false
  }

  await selectSession(sessionId, true)
  await nextTick()
  sidebarRef.value?.focusSession?.(sessionId)
}

async function refreshData() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    if (appView.value === 'dashboard') {
      await dashboardRef.value?.refresh?.()
    } else {
      await loadSessions()
      if (selectedId.value) {
        await selectSession(selectedId.value, true)
      }
      if (globalQuery.value.trim()) {
        await runGlobalSearch()
      }
    }
  } finally {
    refreshing.value = false
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
      <div v-if="appView === 'sessions'" ref="globalSearchInput" class="flex-1 max-w-2xl min-w-0">
        <input
          :value="globalQuery"
          type="search"
          :placeholder="t('app.globalSearchPlaceholder')"
          class="w-full px-3 py-1.5 text-sm rounded-lg bg-t-bg border border-t-border text-t-text placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-accent/50 theme-transition"
          @input="onGlobalInput"
          @compositionstart="onGlobalCompositionStart"
          @compositionend="onGlobalCompositionEnd"
          @focus="onGlobalSearchFocus"
          @mousedown="onGlobalSearchPointerDown"
        />
      </div>
      <div v-else class="flex-1 min-w-0">
        <p class="text-sm font-medium text-t-text">{{ t('dashboard.title') }}</p>
      </div>
      <span v-if="appView === 'sessions' && globalSearching" class="text-xs text-t-muted shrink-0 hidden sm:inline">{{ t('app.searching') }}</span>
      <span
        v-else-if="appView === 'sessions' && activeDataDir"
        class="text-[10px] text-t-muted font-mono hidden lg:block truncate max-w-xs shrink-0"
        :title="activeDataDirTitle"
      >{{ activeDataDir }}</span>
      <div class="shrink-0 ml-auto flex items-center gap-1.5 pl-2 pr-0.5">
        <button
          v-if="appView === 'sessions' && previousAppView"
          type="button"
          class="p-2 rounded-lg border border-accent/50 bg-accent/10 text-accent hover:bg-accent/15 transition-all duration-300"
          :title="t('app.goBack')"
          :aria-label="t('app.goBack')"
          @click="goBack"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          class="p-2 rounded-lg border transition-all duration-300"
          :class="appView === 'dashboard'
            ? 'border-accent/50 bg-accent/10 text-accent'
            : 'border-t-border bg-t-raised text-t-muted hover:text-t-text hover:border-accent/40'"
          :title="appView === 'dashboard' ? t('app.backToSessions') : t('app.openDashboard')"
          :aria-label="appView === 'dashboard' ? t('app.backToSessions') : t('app.openDashboard')"
          @click="toggleAppView"
        >
          <svg
            v-if="appView === 'dashboard'"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <svg
            v-else
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 3v18h18" />
            <path d="M7 16l4-6 4 3 5-8" />
          </svg>
        </button>
        <button
          type="button"
          class="p-2 rounded-lg border border-t-border bg-t-raised text-t-muted hover:text-t-text hover:border-accent/40 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
          :title="refreshing ? t('app.refreshing') : t('app.refresh')"
          :aria-label="refreshing ? t('app.refreshing') : t('app.refresh')"
          :disabled="refreshing"
          @click="refreshData"
        >
          <svg
            class="w-5 h-5"
            :class="refreshing ? 'animate-spin' : ''"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
        <ThemeToggle />
        <SettingsMenu />
      </div>
    </header>

    <p v-if="error" class="shrink-0 px-4 py-2 text-sm text-red-400 bg-red-950/30 border-b border-red-900/30">
      {{ error }}
    </p>

    <div
      v-if="appView === 'sessions' && showGlobalResultsPanel && (globalResults.length || globalSearching)"
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
          :class="r.source === 'cursor'
            ? 'bg-sky-500/20 text-sky-400'
            : r.source === 'codex'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-accent/20 text-accent'"
        >{{ r.source === 'cursor' ? 'Cursor' : r.source === 'codex' ? 'Codex' : 'Claude' }}</span>
        <span v-if="r.kind === 'subagent'" class="text-purple-400 text-xs mr-1">SUB</span>
        <span class="text-t-text">{{ r.title }}</span>
        <span class="text-t-muted text-xs ml-2">{{ r.projectPath }}</span>
        <span class="text-t-muted text-xs ml-2">{{ t('app.hitPlaces', { n: r.total ?? r.hits.length }) }}</span>
      </button>
    </div>

    <div class="flex-1 flex min-h-0 overflow-hidden">
      <UsageDashboard
        v-show="appView === 'dashboard'"
        ref="dashboardRef"
        class="flex-1 min-w-0 flex flex-col min-h-0"
        @select-session="openSessionFromDashboard"
      />
      <div v-show="appView === 'sessions'" class="flex-1 flex min-h-0 min-w-0">
        <SessionSidebar
          ref="sidebarRef"
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
  </div>
</template>
