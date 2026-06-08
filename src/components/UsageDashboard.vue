<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { formatTokenCount, formatTokenCountFull, formatTime } from '../utils/format.js'

const emit = defineEmits(['select-session', 'back'])

const { t, locale } = useLocale()

const loading = ref(true)
const error = ref('')
const sourceTab = ref('claude')
const report = ref(null)

/** @type {import('vue').Ref<'7'|'14'|'30'|'90'|'all'|'custom'>} */
const rangePreset = ref('14')
const rangeStart = ref('')
const rangeEnd = ref('')

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const active = computed(() => {
  if (!report.value) return null
  return sourceTab.value === 'claude' ? report.value.claude : report.value.cursor
})

const allChartDays = computed(() => {
  const days = active.value?.byDay
  return Array.isArray(days) ? days : []
})

const dataDateBounds = computed(() => {
  const days = allChartDays.value
  if (!days.length) return { min: '', max: '' }
  return { min: days[0].date, max: days[days.length - 1].date }
})

function applyRangePreset(preset) {
  rangePreset.value = preset
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = formatYmd(today)

  if (preset === 'all') {
    rangeStart.value = dataDateBounds.value.min || end
    rangeEnd.value = dataDateBounds.value.max || end
    return
  }
  if (preset === 'custom') return

  const days = Number(preset)
  const start = new Date(today)
  start.setDate(start.getDate() - days + 1)
  rangeStart.value = formatYmd(start)
  rangeEnd.value = end
}

function onCustomStartChange() {
  rangePreset.value = 'custom'
  if (rangeStart.value && rangeEnd.value && rangeStart.value > rangeEnd.value) {
    rangeEnd.value = rangeStart.value
  }
}

function onCustomEndChange() {
  rangePreset.value = 'custom'
  if (rangeStart.value && rangeEnd.value && rangeEnd.value < rangeStart.value) {
    rangeStart.value = rangeEnd.value
  }
}

function enableCustomRange() {
  if (!rangeStart.value || !rangeEnd.value) applyRangePreset('14')
  rangePreset.value = 'custom'
}

const rangePresets = [
  { id: '7', labelKey: 'range7d' },
  { id: '14', labelKey: 'range14d' },
  { id: '30', labelKey: 'range30d' },
  { id: '90', labelKey: 'range90d' },
  { id: 'all', labelKey: 'rangeAll' },
  { id: 'custom', labelKey: 'rangeCustom' },
]

async function loadUsage() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/usage')
    if (!res.ok) throw new Error(await res.text())
    report.value = await res.json()
  } catch (e) {
    error.value = t('dashboard.loadFailed')
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUsage()
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
})

defineExpose({ refresh: loadUsage })

const chartDays = computed(() => {
  let days = allChartDays.value
  if (rangeStart.value) days = days.filter((d) => d.date >= rangeStart.value)
  if (rangeEnd.value) days = days.filter((d) => d.date <= rangeEnd.value)
  const max = Math.max(...days.map((d) => d.totalTokens), 1)
  return days.map((d) => ({ ...d, pct: Math.round((d.totalTokens / max) * 100) }))
})

const chartPeriodTotal = computed(() =>
  chartDays.value.reduce((sum, d) => sum + d.totalTokens, 0)
)

const chartScrollable = computed(() => chartDays.value.length > 31)

const selectedDay = ref('')
const chartInteractionRef = ref(null)
const todayCompareRef = ref(null)

const dayCompare = computed(() => active.value?.dayCompare ?? null)

const selectedDayMeta = computed(() =>
  chartDays.value.find((d) => d.date === selectedDay.value) ?? null
)

const selectedDaySessions = computed(() => {
  if (!selectedDay.value) return []
  const fromMeta = selectedDayMeta.value?.sessions
  if (Array.isArray(fromMeta) && fromMeta.length) return fromMeta
  return active.value?.sessionsByDay?.[selectedDay.value] || []
})

function selectChartDay(date) {
  selectedDay.value = date
}

function clearSelectedDay() {
  selectedDay.value = ''
}

function onDocumentPointerDown(e) {
  if (!selectedDay.value) return
  const target = e.target
  if (chartInteractionRef.value?.contains(target)) return
  if (todayCompareRef.value?.contains(target)) return
  clearSelectedDay()
}

function selectTodayFromCompare() {
  const today = dayCompare.value?.today
  if (today && (dayCompare.value?.todayTokens ?? 0) > 0) {
    selectChartDay(today)
  }
}

function formatCompareDelta(delta, pct) {
  if (delta > 0) return t('dashboard.compareUp', { n: formatTokenCount(delta), pct: Math.abs(pct) })
  if (delta < 0) return t('dashboard.compareDown', { n: formatTokenCount(Math.abs(delta)), pct: Math.abs(pct) })
  return t('dashboard.compareFlat')
}

const modelRows = computed(() => {
  const rows = selectedDay.value && selectedDayMeta.value?.models?.length
    ? selectedDayMeta.value.models
    : (active.value?.byModel || [])
  const max = Math.max(...rows.map((r) => r.totalTokens), 1)
  return rows.map((r) => ({ ...r, pct: Math.round((r.totalTokens / max) * 100) }))
})

const modelSectionTitle = computed(() =>
  selectedDay.value ? t('dashboard.byModelDay', { date: selectedDay.value }) : t('dashboard.byModel')
)

const modelSectionHint = computed(() =>
  selectedDay.value ? t('dashboard.byModelDayHint') : t('dashboard.byModelHint')
)

function formatDisplayDate(ymd) {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  const tag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleDateString(tag, { month: 'long', day: 'numeric', weekday: 'short' })
}

const totalsHero = computed(() => active.value?.totals ?? null)

const tokenBreakdown = computed(() => {
  const totals = totalsHero.value
  if (!totals?.totalTokens) return { inputPct: 0, outputPct: 0 }
  const inputPct = Math.round((totals.inputTokens / totals.totalTokens) * 100)
  const outputPct = Math.round((totals.outputTokens / totals.totalTokens) * 100)
  return { inputPct, outputPct }
})

const todaySharePct = computed(() => {
  const total = totalsHero.value?.totalTokens ?? 0
  const today = dayCompare.value?.todayTokens ?? 0
  if (!total || !today) return 0
  return Math.round((today / total) * 1000) / 10
})

const secondaryStatCards = computed(() => statCards.value.filter((c) => c.key !== 'total'))

const statCards = computed(() => {
  const totals = active.value?.totals
  if (!totals) return []
  const cards = [
    { key: 'total', label: t('dashboard.totalTokens'), value: totals.totalTokens, accent: 'text-accent' },
    { key: 'input', label: t('dashboard.inputTokens'), value: totals.inputTokens, accent: 'text-sky-400' },
    { key: 'output', label: t('dashboard.outputTokens'), value: totals.outputTokens, accent: 'text-emerald-400' },
    { key: 'turns', label: t('dashboard.turnCount'), value: totals.turnCount, accent: 'text-t-text', raw: true },
  ]
  if (!active.value?.estimated) {
    cards.splice(3, 0,
      { key: 'cacheRead', label: t('dashboard.cacheRead'), value: totals.cacheReadTokens, accent: 'text-violet-400' },
      { key: 'cacheCreate', label: t('dashboard.cacheCreate'), value: totals.cacheCreationTokens, accent: 'text-amber-400' },
    )
  }
  return cards
})

const hasData = computed(() => (active.value?.sessionsWithUsage ?? 0) > 0)

function shortModel(name) {
  if (!name || name === 'unknown') return t('dashboard.unknownModel')
  return name.replace(/^claude-/, '').slice(0, 28)
}

watch(sourceTab, () => {
  selectedDay.value = ''
  applyRangePreset(rangePreset.value === 'custom' ? '14' : rangePreset.value)
})

watch(
  () => active.value?.byDay,
  (days) => {
    if (!days?.length) return
    if (!rangeStart.value || !rangeEnd.value || rangePreset.value !== 'custom') {
      applyRangePreset(rangePreset.value === 'custom' ? '14' : rangePreset.value)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-t-bg theme-transition">
    <div class="shrink-0 px-4 md:px-8 py-4 border-b border-t-border bg-t-raised/80 backdrop-blur-sm">
      <div class="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 class="text-lg font-semibold text-t-text tracking-tight">{{ t('dashboard.title') }}</h2>
          <p class="text-xs text-t-muted mt-0.5">{{ t('dashboard.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-t-border bg-t-bg p-0.5">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              :class="sourceTab === 'claude' ? 'bg-accent/15 text-accent' : 'text-t-muted hover:text-t-text'"
              @click="sourceTab = 'claude'"
            >
              Claude Code
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              :class="sourceTab === 'cursor' ? 'bg-sky-500/15 text-sky-400' : 'text-t-muted hover:text-t-text'"
              @click="sourceTab = 'cursor'"
            >
              Cursor
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <p v-if="error" class="text-sm text-red-400 mb-4">{{ error }}</p>

      <div v-if="loading && !report" class="flex items-center justify-center py-24 text-t-muted text-sm">
        {{ t('dashboard.loading') }}
      </div>

      <template v-else-if="active">
        <div
          v-if="active.estimated"
          class="mb-4 flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-t-text"
        >
          <svg class="w-5 h-5 shrink-0 text-sky-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" />
          </svg>
          <div>
            <p class="font-medium">{{ t('dashboard.cursorEstimatedTitle') }}</p>
            <p class="text-xs text-t-muted mt-1 leading-relaxed">{{ t('dashboard.cursorEstimatedDesc') }}</p>
          </div>
        </div>

        <div
          v-if="!hasData"
          class="max-w-xl mx-auto text-center py-16 px-6 rounded-2xl border border-dashed border-t-border bg-t-raised/50"
        >
          <h3 class="text-base font-semibold text-t-text">{{ t('dashboard.noSessionData') }}</h3>
          <p class="text-sm text-t-muted mt-2">{{ t('dashboard.sessionCount', { n: active.sessionCount }) }}</p>
        </div>

        <template v-else>
          <!-- Hero: today + total -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div
              v-if="dayCompare"
              ref="todayCompareRef"
              class="relative overflow-hidden rounded-2xl border bg-t-raised p-5 md:p-6 theme-transition"
              :class="[
                selectedDay === dayCompare.today ? 'border-accent/50 ring-1 ring-accent/20' : 'border-t-border',
                dayCompare.todayTokens > 0 ? 'cursor-pointer hover:border-accent/40' : '',
              ]"
              :role="dayCompare.todayTokens > 0 ? 'button' : undefined"
              :tabindex="dayCompare.todayTokens > 0 ? 0 : undefined"
              @click="selectTodayFromCompare"
              @keydown.enter="selectTodayFromCompare"
            >
              <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/80 via-accent/40 to-transparent" />
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-medium text-t-muted">{{ t('dashboard.todayUsage') }}</p>
                    <span v-if="active.estimated" class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {{ t('dashboard.estimatedBadge') }}
                    </span>
                  </div>
                  <p
                    class="text-4xl md:text-[2.75rem] font-bold tabular-nums tracking-tight text-t-text mt-2 leading-none"
                    :title="formatTokenCountFull(dayCompare.todayTokens)"
                  >
                    {{ formatTokenCount(dayCompare.todayTokens) }}
                  </p>
                  <p class="text-sm text-t-muted mt-2">{{ formatDisplayDate(dayCompare.today) }}</p>
                </div>
                <div
                  v-if="dayCompare.todayTokens > 0 && todaySharePct > 0"
                  class="shrink-0 rounded-xl border border-t-border bg-t-bg/80 px-3 py-2 text-right"
                >
                  <p class="text-[10px] uppercase tracking-wider text-t-muted">{{ t('dashboard.todayShare') }}</p>
                  <p class="text-lg font-semibold tabular-nums text-accent mt-0.5">{{ todaySharePct }}%</p>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t border-t-border/70 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-t-muted">{{ t('dashboard.vsYesterday') }}</span>
                  <span class="font-medium tabular-nums text-t-text">{{ formatTokenCount(dayCompare.yesterdayTokens) }}</span>
                </div>
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium tabular-nums"
                  :class="[
                    dayCompare.delta > 0 ? 'bg-amber-500/10 text-amber-400' : '',
                    dayCompare.delta < 0 ? 'bg-emerald-500/10 text-emerald-400' : '',
                    dayCompare.delta === 0 ? 'bg-t-bg text-t-muted border border-t-border' : '',
                  ]"
                >
                  {{ formatCompareDelta(dayCompare.delta, dayCompare.deltaPct) }}
                </span>
              </div>
            </div>

            <div
              v-if="totalsHero"
              class="relative overflow-hidden rounded-2xl border border-t-border bg-t-raised p-5 md:p-6 theme-transition"
            >
              <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/70 via-emerald-500/50 to-transparent" />
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-t-muted">{{ t('dashboard.totalTokens') }}</p>
                <span v-if="active.estimated" class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {{ t('dashboard.estimatedBadge') }}
                </span>
              </div>
              <p
                class="text-4xl md:text-[2.75rem] font-bold tabular-nums tracking-tight text-accent mt-2 leading-none"
                :title="formatTokenCountFull(totalsHero.totalTokens)"
              >
                {{ formatTokenCount(totalsHero.totalTokens) }}
              </p>
              <p class="text-sm text-t-muted mt-2">{{ t('dashboard.totalTokensHint') }}</p>
              <div class="mt-4">
                <div class="h-2 rounded-full bg-t-bg overflow-hidden flex">
                  <div
                    class="h-full bg-sky-400/80 transition-all duration-500"
                    :style="{ width: `${tokenBreakdown.inputPct}%` }"
                  />
                  <div
                    class="h-full bg-emerald-400/80 transition-all duration-500"
                    :style="{ width: `${tokenBreakdown.outputPct}%` }"
                  />
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-t-muted">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-sky-400/80 shrink-0" />
                    {{ t('dashboard.inputTokens') }}
                    <span class="tabular-nums text-t-text font-medium">{{ formatTokenCount(totalsHero.inputTokens) }}</span>
                    <span class="tabular-nums">({{ tokenBreakdown.inputPct }}%)</span>
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-400/80 shrink-0" />
                    {{ t('dashboard.outputTokens') }}
                    <span class="tabular-nums text-t-text font-medium">{{ formatTokenCount(totalsHero.outputTokens) }}</span>
                    <span class="tabular-nums">({{ tokenBreakdown.outputPct }}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Secondary metrics -->
          <div
            v-if="secondaryStatCards.length"
            class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6"
            :class="secondaryStatCards.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'"
          >
            <div
              v-for="card in secondaryStatCards"
              :key="card.key"
              class="rounded-xl border border-t-border/80 bg-t-raised/60 px-4 py-3 theme-transition"
            >
              <p class="text-[11px] text-t-muted font-medium truncate">{{ card.label }}</p>
              <p
                class="text-xl font-semibold mt-1 tabular-nums"
                :class="card.accent"
                :title="card.raw ? String(card.value) : formatTokenCountFull(card.value)"
              >
                {{ card.raw ? card.value : formatTokenCount(card.value) }}
              </p>
            </div>
          </div>

          <p class="text-xs text-t-muted mb-6">
            {{ t('dashboard.scannedSummary', {
              sessions: active.sessionCount,
              withUsage: active.sessionsWithUsage,
              turns: active.totals?.turnCount ?? 0,
            }) }}
          </p>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <!-- Daily chart -->
            <section ref="chartInteractionRef" class="rounded-xl border border-t-border bg-t-raised p-5 theme-transition">
              <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 class="text-sm font-semibold text-t-text">{{ t('dashboard.dailyUsage') }}</h3>
                  <p class="text-xs text-t-muted mt-0.5">
                    {{ t('dashboard.dailyUsageHint') }}
                    <span v-if="chartDays.length" class="text-t-text font-medium tabular-nums">
                      · {{ formatTokenCount(chartPeriodTotal) }}
                    </span>
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    v-for="p in rangePresets"
                    :key="p.id"
                    type="button"
                    class="px-2 py-1 text-[10px] rounded-md border transition-colors"
                    :class="rangePreset === p.id
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-t-border text-t-muted hover:text-t-text'"
                    @click="p.id === 'custom' ? enableCustomRange() : applyRangePreset(p.id)"
                  >
                    {{ t(`dashboard.${p.labelKey}`) }}
                  </button>
                </div>
              </div>

              <div
                v-if="rangePreset === 'custom'"
                class="flex flex-wrap items-center gap-2 mb-4 text-xs"
              >
                <label class="flex items-center gap-1.5 text-t-muted">
                  <span>{{ t('dashboard.rangeFrom') }}</span>
                  <input
                    v-model="rangeStart"
                    type="date"
                    class="px-2 py-1 rounded-md border border-t-border bg-t-bg text-t-text focus:outline-none focus:ring-1 focus:ring-accent/50"
                    :min="dataDateBounds.min"
                    :max="rangeEnd || dataDateBounds.max"
                    @change="onCustomStartChange"
                  />
                </label>
                <label class="flex items-center gap-1.5 text-t-muted">
                  <span>{{ t('dashboard.rangeTo') }}</span>
                  <input
                    v-model="rangeEnd"
                    type="date"
                    class="px-2 py-1 rounded-md border border-t-border bg-t-bg text-t-text focus:outline-none focus:ring-1 focus:ring-accent/50"
                    :min="rangeStart || dataDateBounds.min"
                    :max="dataDateBounds.max"
                    @change="onCustomEndChange"
                  />
                </label>
              </div>

              <div v-if="chartDays.length === 0" class="text-sm text-t-muted py-8 text-center">
                {{ t('dashboard.noDailyData') }}
              </div>
              <div
                v-else
                class="h-40"
                :class="chartScrollable ? 'overflow-x-auto pb-1' : ''"
              >
                <div
                  class="flex items-end gap-2 h-full px-0.5"
                  :class="chartScrollable ? 'min-w-max' : 'w-full'"
                >
                  <button
                    v-for="day in chartDays"
                    :key="day.date"
                    type="button"
                    class="group flex flex-col items-center gap-1.5 h-full focus:outline-none"
                    :class="chartScrollable ? 'w-8 shrink-0' : 'flex-1 min-w-[20px]'"
                    :aria-pressed="selectedDay === day.date"
                    :title="`${day.date}: ${formatTokenCountFull(day.totalTokens)}`"
                    @click.stop="selectChartDay(day.date)"
                  >
                    <span
                      class="text-[9px] tabular-nums whitespace-nowrap transition-opacity"
                      :class="selectedDay === day.date ? 'text-accent opacity-100' : 'text-t-muted opacity-0 group-hover:opacity-100'"
                    >
                      {{ formatTokenCount(day.totalTokens) }}
                    </span>
                    <div class="flex-1 w-full flex items-end min-h-[8px]">
                      <div
                        class="w-full rounded-sm transition-all duration-200 min-h-[6px]"
                        :class="selectedDay === day.date
                          ? 'bg-accent shadow-[0_0_0_2px_rgb(var(--t-bg)),0_0_0_3px] shadow-accent/60'
                          : 'bg-accent/45 group-hover:bg-accent/70'"
                        :style="{ height: `${Math.max(day.pct, 6)}%` }"
                      />
                    </div>
                    <span
                      class="text-[9px] truncate w-full text-center leading-none"
                      :class="selectedDay === day.date ? 'text-accent font-medium' : 'text-t-muted'"
                    >
                      {{ day.date.slice(5) }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Day detail panel -->
              <div
                v-if="selectedDay && selectedDayMeta"
                class="mt-4 pt-4 border-t border-t-border"
              >
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 class="text-sm font-semibold text-t-text">
                      {{ t('dashboard.dayDetailTitle', { date: selectedDay }) }}
                    </h4>
                    <p class="text-xs text-t-muted mt-0.5">
                      {{ formatTokenCount(selectedDayMeta.totalTokens) }}
                      · ↑ {{ formatTokenCount(selectedDayMeta.inputTokens) }}
                      · ↓ {{ formatTokenCount(selectedDayMeta.outputTokens) }}
                      · {{ selectedDayMeta.turnCount }} {{ t('dashboard.turns') }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="text-xs text-t-muted hover:text-t-text px-2 py-1 rounded border border-t-border"
                    @click="clearSelectedDay"
                  >
                    {{ t('dashboard.closeDayDetail') }}
                  </button>
                </div>
                <div v-if="selectedDaySessions.length === 0" class="text-sm text-t-muted py-4 text-center">
                  {{ t('dashboard.noDaySessions') }}
                </div>
                <ul v-else class="space-y-1.5 max-h-48 overflow-y-auto">
                  <li
                    v-for="row in selectedDaySessions"
                    :key="row.sessionId"
                    class="flex items-center gap-3 px-3 py-2 rounded-lg border border-t-border/60 hover:bg-t-overlay/60 cursor-pointer transition-colors group"
                    @click="emit('select-session', { sessionId: row.sessionId, source: row.source })"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-t-text truncate group-hover:text-accent transition-colors">{{ row.title }}</p>
                      <p class="text-[10px] text-t-muted font-mono truncate">{{ row.projectPath }}</p>
                    </div>
                    <span class="text-sm font-semibold tabular-nums text-accent shrink-0">{{ formatTokenCount(row.totalTokens) }}</span>
                  </li>
                </ul>
              </div>
              <p v-else-if="chartDays.length" class="text-[10px] text-t-muted mt-3">{{ t('dashboard.clickBarHint') }}</p>
            </section>

            <!-- Model breakdown -->
            <section
              class="rounded-xl border bg-t-raised p-5 theme-transition"
              :class="selectedDay ? 'border-accent/40' : 'border-t-border'"
            >
              <h3 class="text-sm font-semibold text-t-text mb-1">{{ modelSectionTitle }}</h3>
              <p class="text-xs text-t-muted mb-4">{{ modelSectionHint }}</p>
              <div v-if="modelRows.length === 0" class="text-sm text-t-muted py-8 text-center">
                {{ t('dashboard.noModelData') }}
              </div>
              <ul v-else class="space-y-3">
                <li v-for="row in modelRows.slice(0, 8)" :key="row.model">
                  <div class="flex items-center justify-between gap-2 text-xs mb-1">
                    <span class="font-mono text-t-text truncate" :title="row.model">{{ shortModel(row.model) }}</span>
                    <span class="text-t-muted tabular-nums shrink-0">{{ formatTokenCount(row.totalTokens) }}</span>
                  </div>
                  <div class="h-2 rounded-full bg-t-bg overflow-hidden">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-500"
                      :style="{ width: `${row.pct}%` }"
                    />
                  </div>
                  <div class="flex gap-3 mt-0.5 text-[10px] text-t-muted">
                    <span>↑ {{ formatTokenCount(row.inputTokens) }}</span>
                    <span>↓ {{ formatTokenCount(row.outputTokens) }}</span>
                    <span>{{ row.turnCount }} {{ t('dashboard.turns') }}</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>

          <!-- Top sessions -->
          <section class="rounded-xl border border-t-border bg-t-raised overflow-hidden theme-transition">
            <div class="px-5 py-4 border-b border-t-border">
              <h3 class="text-sm font-semibold text-t-text">{{ t('dashboard.topSessions') }}</h3>
              <p class="text-xs text-t-muted mt-0.5">{{ t('dashboard.topSessionsHint') }}</p>
            </div>
            <div v-if="!active.topSessions?.length" class="px-5 py-10 text-sm text-t-muted text-center">
              {{ t('dashboard.noSessionData') }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-[10px] uppercase tracking-wider text-t-muted border-b border-t-border bg-t-bg/50">
                    <th class="px-5 py-2.5 font-medium">{{ t('dashboard.colSession') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right">{{ t('dashboard.colTotal') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right hidden sm:table-cell">{{ t('dashboard.colInput') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right hidden sm:table-cell">{{ t('dashboard.colOutput') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right hidden md:table-cell">{{ t('dashboard.colCache') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right hidden lg:table-cell">{{ t('dashboard.colTurns') }}</th>
                    <th class="px-3 py-2.5 font-medium text-right hidden md:table-cell">{{ t('dashboard.colUpdated') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in active.topSessions"
                    :key="row.sessionId"
                    class="border-b border-t-border/60 hover:bg-t-overlay/60 transition-colors cursor-pointer group"
                    @click="emit('select-session', { sessionId: row.sessionId, source: row.source })"
                  >
                    <td class="px-5 py-3">
                      <div class="flex items-start gap-2 min-w-0">
                        <span class="text-[10px] text-t-muted tabular-nums w-4 shrink-0 pt-0.5">{{ idx + 1 }}</span>
                        <div class="min-w-0">
                          <p class="text-t-text truncate group-hover:text-accent transition-colors">{{ row.title }}</p>
                          <p class="text-[10px] text-t-muted font-mono truncate mt-0.5">{{ row.projectPath }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-3 text-right font-semibold tabular-nums text-accent">{{ formatTokenCount(row.totalTokens) }}</td>
                    <td class="px-3 py-3 text-right tabular-nums text-t-muted hidden sm:table-cell">{{ formatTokenCount(row.inputTokens) }}</td>
                    <td class="px-3 py-3 text-right tabular-nums text-t-muted hidden sm:table-cell">{{ formatTokenCount(row.outputTokens) }}</td>
                    <td class="px-3 py-3 text-right tabular-nums text-t-muted hidden md:table-cell">{{ formatTokenCount(row.cacheReadTokens + row.cacheCreationTokens) }}</td>
                    <td class="px-3 py-3 text-right tabular-nums text-t-muted hidden lg:table-cell">{{ row.turnCount }}</td>
                    <td class="px-3 py-3 text-right text-xs text-t-muted hidden md:table-cell whitespace-nowrap">{{ formatTime(row.updatedAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>
