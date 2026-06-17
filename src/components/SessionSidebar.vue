<script setup>
import { computed, ref, nextTick } from 'vue'
import SessionItem from './SessionItem.vue'
import { useLocale } from '../composables/useLocale.js'
import { scrollElementInContainer } from '../utils/highlight.js'

const { t } = useLocale()

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  projects: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  projectFilter: { type: String, default: '' },
  listQuery: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  hideSubagents: { type: Boolean, default: false },
  sourceFilter: { type: String, default: 'claude' },
})

const emit = defineEmits([
  'select',
  'update:projectFilter',
  'update:listQuery',
  'update:hideSubagents',
  'update:sourceFilter',
])

const sourceOptions = computed(() => [
  { value: 'all', label: t('sidebar.sourceAll') },
  { value: 'claude', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codex', label: 'Codex' },
])

/** 主会话 id → true 表示 Sub-agent 已收起；默认无记录 = 展开 */
const collapsedParents = ref({})

function isSubagentsCollapsed(parentId) {
  return collapsedParents.value[parentId] === true
}

function toggleSubagents(parentId) {
  collapsedParents.value = {
    ...collapsedParents.value,
    [parentId]: !isSubagentsCollapsed(parentId),
  }
}

const filtered = computed(() => {
  let list = props.sessions
  if (props.hideSubagents) {
    list = list.filter((s) => s.kind !== 'subagent')
  }
  if (props.projectFilter) {
    list = list.filter((s) => s.projectSlug === props.projectFilter)
  }
  const q = props.listQuery.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.preview?.toLowerCase().includes(q) ||
        s.projectPath?.toLowerCase().includes(q) ||
        s.cwd?.toLowerCase().includes(q) ||
        s.agentType?.toLowerCase().includes(q)
    )
  }
  return list
})

const isSearching = computed(() => !!props.listQuery.trim())

const grouped = computed(() => {
  const mains = filtered.value.filter((s) => s.kind !== 'subagent')
  const subsByParent = new Map()
  for (const s of filtered.value) {
    if (s.kind === 'subagent' && s.parentSessionId) {
      if (!subsByParent.has(s.parentSessionId)) subsByParent.set(s.parentSessionId, [])
      subsByParent.get(s.parentSessionId).push(s)
    }
  }
  return mains.map((main) => ({
    main,
    subagents: subsByParent.get(main.id) || [],
  }))
})

const listRef = ref(null)

/** @param {string} sessionId */
function focusSession(sessionId) {
  const session = props.sessions.find((s) => s.id === sessionId)
  if (session?.kind === 'subagent' && session.parentSessionId) {
    collapsedParents.value = {
      ...collapsedParents.value,
      [session.parentSessionId]: false,
    }
  }
  nextTick(() => {
    const root = listRef.value
    if (!root) return
    const el = root.querySelector(`[data-session-id="${CSS.escape(sessionId)}"]`)
    if (el) scrollElementInContainer(el, root, { block: 'center' })
  })
}

defineExpose({ focusSession })
</script>

<template>
  <aside class="flex flex-col h-full border-r border-t-border bg-t-raised">
    <header class="p-4 border-b border-t-border shrink-0">
      <h1 class="text-sm font-semibold text-t-text tracking-tight">{{ t('sidebar.title') }}</h1>
      <p class="text-[11px] text-t-muted mt-1">{{ t('sidebar.subtitle') }}</p>
    </header>

    <div class="px-3 pt-3 pb-2 shrink-0 border-b border-t-border">
      <div class="flex rounded-lg border border-t-border p-0.5 gap-0.5 bg-t-bg">
        <button
          v-for="opt in sourceOptions"
          :key="opt.value"
          type="button"
          class="flex-1 text-[11px] py-1.5 rounded-md transition-colors"
          :class="
            sourceFilter === opt.value
              ? 'bg-t-raised text-t-text shadow-sm'
              : 'text-t-muted hover:text-t-text'
          "
          @click="emit('update:sourceFilter', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="p-3 pt-2 space-y-2 shrink-0 border-b border-t-border">
      <input
        :value="listQuery"
        type="search"
        :placeholder="t('sidebar.filterPlaceholder')"
        class="w-full px-3 py-2 text-sm rounded-lg bg-t-bg border border-t-border text-t-text placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
        @input="emit('update:listQuery', $event.target.value)"
      />
      <select
        :value="projectFilter"
        class="w-full px-3 py-2 text-sm rounded-lg bg-t-bg border border-t-border text-t-text focus:outline-none focus:ring-1 focus:ring-accent/50"
        @change="emit('update:projectFilter', $event.target.value)"
      >
        <option value="">{{ t('sidebar.allProjects', { n: sessions.length }) }}</option>
        <option v-for="p in projects" :key="p.slug" :value="p.slug">
          {{ p.path }} ({{ p.count }})
        </option>
      </select>
      <label class="flex items-center gap-2 text-xs text-t-muted cursor-pointer">
        <input
          type="checkbox"
          :checked="hideSubagents"
          class="rounded border-t-border"
          @change="emit('update:hideSubagents', $event.target.checked)"
        />
        {{ t('sidebar.hideSubagents') }}
      </label>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-t-muted text-sm">
      {{ t('sidebar.loading') }}
    </div>

    <ul v-else ref="listRef" class="flex-1 overflow-y-auto p-2 space-y-1">
      <li v-if="filtered.length === 0" class="px-3 py-8 text-center text-t-muted text-sm">
        {{ t('sidebar.noSessions') }}
      </li>

      <template v-if="isSearching">
        <li v-for="s in filtered" :key="s.id">
          <SessionItem
            :session="s"
            :selected-id="selectedId"
            :is-sub="s.kind === 'subagent'"
            @select="emit('select', $event)"
          />
        </li>
      </template>

      <template v-else>
        <li v-for="g in grouped" :key="g.main.id" class="space-y-0.5">
          <div class="flex items-stretch gap-0.5 min-w-0">
            <button
              v-if="g.subagents.length"
              type="button"
              class="shrink-0 w-6 flex flex-col items-center justify-center rounded-md text-t-muted hover:text-t-text hover:bg-t-overlay transition-colors"
              :title="isSubagentsCollapsed(g.main.id) ? t('sidebar.expandSubagents', { n: g.subagents.length }) : t('sidebar.collapseSubagents', { n: g.subagents.length })"
              @click.stop="toggleSubagents(g.main.id)"
            >
              <span
                class="text-[10px] leading-none transition-transform"
                :class="isSubagentsCollapsed(g.main.id) ? '' : 'rotate-90'"
              >▶</span>
              <span class="text-[9px] text-purple-500/80 mt-0.5">{{ g.subagents.length }}</span>
            </button>
            <SessionItem
              class="flex-1 min-w-0"
              :session="g.main"
              :selected-id="selectedId"
              @select="emit('select', $event)"
            />
          </div>
          <ul
            v-if="g.subagents.length && !isSubagentsCollapsed(g.main.id)"
            class="ml-3 pl-2 border-l border-t-border space-y-0.5"
          >
            <li v-for="sub in g.subagents" :key="sub.id">
              <SessionItem
                :session="sub"
                :selected-id="selectedId"
                is-sub
                @select="emit('select', $event)"
              />
            </li>
          </ul>
        </li>
      </template>
    </ul>
  </aside>
</template>
