<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { formatTokenCountLocale } from '../utils/format.js'
import { formatToolDisplayName } from '../utils/tool-labels.js'
import { buildHeatmapGrid, formatHeatmapDayLabel, formatHeatmapDayLabelFull, formatHeatmapMonth } from '../utils/usage-heatmap.js'

const BASE_CELL = 11
const BASE_GAP = 3
const ROWS = 7
const MIN_CELL = 7
const MAX_CELL = 13
const WIDTH_PADDING = 12
/** 月份行 + 下边距（px） */
const MONTH_BLOCK = 24
/** 图例行 + 上边距（px） */
const LEGEND_BLOCK = 26

const props = defineProps({
  byDay: { type: Array, default: () => [] },
  mode: { type: String, default: 'daily' },
  selectedDay: { type: String, default: '' },
  /** @type {'claude'|'cursor'|'codex'} */
  source: { type: String, default: 'claude' },
  topTools: { type: Array, default: () => [] },
  sourceTab: { type: Object, default: null },
  /** 嵌入活动面板时使用，去掉外层卡片样式 */
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['update:mode', 'select-day'])

const { t, locale } = useLocale()

const heatmap = computed(() => buildHeatmapGrid(props.byDay, props.mode))

const tooltip = ref({ visible: false, text: '', x: 0, y: 0 })

const levelClass = computed(() => {
  if (props.source === 'cursor') {
    return ['', 'bg-sky-400/25', 'bg-sky-400/45', 'bg-sky-400/65', 'bg-sky-400/90']
  }
  if (props.source === 'codex') {
    return ['', 'bg-emerald-400/25', 'bg-emerald-400/45', 'bg-emerald-400/65', 'bg-emerald-400/90']
  }
  return ['', 'bg-accent/25', 'bg-accent/45', 'bg-accent/65', 'bg-accent/90']
})

const modes = [
  { id: 'daily', labelKey: 'heatmapDaily' },
  { id: 'weekly', labelKey: 'heatmapWeekly' },
  { id: 'cumulative', labelKey: 'heatmapCumulative' },
]

const topToolsDisplay = computed(() => props.topTools.slice(0, 8))

const totalToolCalls = computed(() =>
  topToolsDisplay.value.reduce((sum, tool) => sum + tool.calls, 0) || 1
)

const maxToolCalls = computed(() =>
  Math.max(...topToolsDisplay.value.map((tool) => tool.calls), 1)
)

function toolSharePct(calls) {
  return Math.round((calls / totalToolCalls.value) * 1000) / 10
}

function displayToolName(name) {
  return formatToolDisplayName(name, locale.value)
}

const toolsAsideRef = ref(null)
const heatmapAreaRef = ref(null)
const heatmapAreaHeight = ref(0)
const heatmapAreaWidth = ref(0)
const isWideSplit = ref(false)

const isSplitLayout = computed(() => topToolsDisplay.value.length > 0)
const shouldAdaptHeatmap = computed(() => isSplitLayout.value && isWideSplit.value)

function defaultHeatmapMetrics(weekCount) {
  return buildMetricsFromCell(BASE_CELL, weekCount)
}

function buildMetricsFromCell(cell, weekCount) {
  const roundedCell = Math.round(cell)
  const roundedGap = Math.max(2, Math.round(roundedCell * (BASE_GAP / BASE_CELL)))
  return {
    cell: roundedCell,
    gap: roundedGap,
    step: roundedCell + roundedGap,
    weekCount,
    monthBlock: Math.round(MONTH_BLOCK * (roundedCell / BASE_CELL)),
    legendBlock: Math.round(LEGEND_BLOCK * (roundedCell / BASE_CELL)),
    labelCol: Math.max(24, Math.round(28 * (roundedCell / BASE_CELL))),
    labelSize: Math.max(8, Math.round(9 * (roundedCell / BASE_CELL))),
    monthSize: Math.max(9, Math.round(10 * (roundedCell / BASE_CELL))),
    legendSize: Math.max(9, Math.round(10 * (roundedCell / BASE_CELL))),
    radius: Math.max(1, Math.round(2 * (roundedCell / BASE_CELL))),
  }
}

function metricsContentSize(m) {
  const gridH = ROWS * m.cell + (ROWS - 1) * m.gap
  const gridW = m.labelCol + m.weekCount * m.step
  return {
    width: gridW + WIDTH_PADDING,
    height: gridH + m.monthBlock + m.legendBlock,
  }
}

function fitsArea(m, areaWidth, areaHeight) {
  const { width, height } = metricsContentSize(m)
  if (areaWidth > 0 && width > areaWidth) return false
  if (areaHeight > 0 && height > areaHeight) return false
  return true
}

function computeHeatmapMetrics(areaHeight, areaWidth, weekCount) {
  if (areaHeight <= 0 && areaWidth <= 0) return defaultHeatmapMetrics(weekCount)

  const gapRatio = BASE_GAP / BASE_CELL
  let cell = MAX_CELL

  if (areaHeight > 0) {
    const gridAvailable = areaHeight - MONTH_BLOCK - LEGEND_BLOCK
    if (gridAvailable > 0) {
      cell = Math.min(cell, gridAvailable / (ROWS + (ROWS - 1) * gapRatio))
    }
  }

  if (areaWidth > 0 && weekCount > 0) {
    const available = areaWidth - WIDTH_PADDING
    const perCell = 28 / BASE_CELL + weekCount * (1 + gapRatio)
    cell = Math.min(cell, available / perCell)
  }

  cell = Math.max(MIN_CELL, Math.min(MAX_CELL, cell))

  let metrics = buildMetricsFromCell(cell, weekCount)
  while (metrics.cell > MIN_CELL && !fitsArea(metrics, areaWidth, areaHeight)) {
    metrics = buildMetricsFromCell(metrics.cell - 1, weekCount)
  }

  return metrics
}

const heatmapMetrics = computed(() => {
  const weekCount = heatmap.value.weeks.length
  if (!shouldAdaptHeatmap.value) return defaultHeatmapMetrics(weekCount)
  return computeHeatmapMetrics(heatmapAreaHeight.value, heatmapAreaWidth.value, weekCount)
})

const heatmapAreaStyle = computed(() => {
  const m = heatmapMetrics.value
  return {
    '--hm-cell': `${m.cell}px`,
    '--hm-gap': `${m.gap}px`,
    '--hm-step': `${m.step}px`,
    '--hm-radius': `${m.radius}px`,
    '--hm-label-col': `${m.labelCol}px`,
  }
})

const heatmapMinWidth = computed(() => {
  const m = heatmapMetrics.value
  return m.labelCol + m.weekCount * m.step + 8
})

let areaObserver = null
let toolsObserver = null
let splitMediaQuery = null

function syncHeatmapAreaSize() {
  heatmapAreaWidth.value = heatmapAreaRef.value?.clientWidth ?? 0
  heatmapAreaHeight.value = heatmapAreaRef.value?.clientHeight ?? 0
}

function observeHeatmapArea() {
  areaObserver?.disconnect()
  toolsObserver?.disconnect()

  if (!shouldAdaptHeatmap.value || typeof ResizeObserver === 'undefined') {
    heatmapAreaWidth.value = 0
    heatmapAreaHeight.value = 0
    return
  }

  if (heatmapAreaRef.value) {
    areaObserver = new ResizeObserver(() => syncHeatmapAreaSize())
    areaObserver.observe(heatmapAreaRef.value)
    syncHeatmapAreaSize()
  }

  if (toolsAsideRef.value) {
    toolsObserver = new ResizeObserver(() => {
      nextTick(() => syncHeatmapAreaSize())
    })
    toolsObserver.observe(toolsAsideRef.value)
  }
}

function updateWideSplit() {
  isWideSplit.value = splitMediaQuery?.matches ?? false
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    splitMediaQuery = window.matchMedia('(min-width: 1024px)')
    splitMediaQuery.addEventListener('change', updateWideSplit)
    updateWideSplit()
  }
  observeHeatmapArea()
})

onUnmounted(() => {
  areaObserver?.disconnect()
  toolsObserver?.disconnect()
  splitMediaQuery?.removeEventListener('change', updateWideSplit)
})

watch(
  [shouldAdaptHeatmap, () => heatmap.value.weeks.length, () => props.mode, topToolsDisplay],
  async () => {
    await nextTick()
    observeHeatmapArea()
  }
)

const toolBarClass = computed(() => {
  if (props.source === 'cursor') return 'bg-sky-400/70'
  if (props.source === 'codex') return 'bg-emerald-400/70'
  return 'bg-accent/70'
})

function cellClass(day) {
  if (!day.inRange) return 'bg-transparent'
  if (day.level === 0) return 'bg-t-bg border border-t-border/40'
  return levelClass.value[day.level] || levelClass.value[1]
}

function tooltipText(day) {
  const count = formatTokenCountLocale(day.value, locale.value)
  const loc = locale.value

  if (props.mode === 'weekly') {
    const weekStart = day.weekBlockStart || day.date
    const dateLabel = formatHeatmapDayLabelFull(weekStart, loc)
    if (day.value > 0) {
      return t('dashboard.heatmapTooltipWeekly', { date: dateLabel, count })
    }
    return t('dashboard.heatmapTooltipWeeklyEmpty', { date: dateLabel })
  }

  if (props.mode === 'cumulative') {
    const dateLabel = formatHeatmapDayLabelFull(day.date, loc)
    if (day.value > 0) {
      return t('dashboard.heatmapTooltipCumulative', { date: dateLabel, count })
    }
    return t('dashboard.heatmapTooltipCumulativeEmpty', { date: dateLabel })
  }

  const dateLabel = formatHeatmapDayLabel(day.date, loc)
  if (day.value > 0) {
    return t('dashboard.heatmapTooltipDaily', { date: dateLabel, count })
  }
  return t('dashboard.heatmapTooltipDailyEmpty', { date: dateLabel })
}

function showTooltip(e, day) {
  if (!day.inRange) return
  const rect = e.currentTarget.getBoundingClientRect()
  tooltip.value = {
    visible: true,
    text: tooltipText(day),
    x: rect.left + rect.width / 2,
    y: rect.top,
  }
}

function moveTooltip(e, day) {
  if (!day.inRange || !tooltip.value.visible) return
  const rect = e.currentTarget.getBoundingClientRect()
  tooltip.value.x = rect.left + rect.width / 2
  tooltip.value.y = rect.top
}

function hideTooltip() {
  tooltip.value.visible = false
}

function onCellClick(day) {
  if (!day.inRange || day.value <= 0) return
  emit('select-day', day.date)
}
</script>

<template>
  <component :is="embedded ? 'div' : 'section'" :class="embedded ? '' : 'rounded-2xl border border-t-border bg-t-raised p-5 md:p-6 theme-transition'">
    <div
      class="gap-4"
      :class="isSplitLayout ? 'grid grid-cols-1 lg:grid-cols-2 lg:items-stretch' : ''"
    >
      <div class="min-w-0 flex flex-col" :class="shouldAdaptHeatmap ? 'lg:h-full' : ''">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
          <h3 class="text-base font-semibold text-t-text">{{ t('dashboard.tokenActivity') }}</h3>
          <div class="inline-flex rounded-lg border border-t-border bg-t-bg p-0.5 text-xs shrink-0">
            <button
              v-for="m in modes"
              :key="m.id"
              type="button"
              class="px-3 py-1 rounded-md transition-colors"
              :class="mode === m.id ? 'bg-t-raised text-t-text shadow-sm' : 'text-t-muted hover:text-t-text'"
              @click="emit('update:mode', m.id)"
            >
              {{ t(`dashboard.${m.labelKey}`) }}
            </button>
          </div>
        </div>

        <div
          ref="heatmapAreaRef"
          class="min-w-0"
          :class="shouldAdaptHeatmap ? 'flex-1 flex flex-col justify-center' : ''"
        >
          <div
            class="pb-1 w-full"
            :class="shouldAdaptHeatmap ? 'overflow-hidden' : 'overflow-x-auto'"
            :style="heatmapAreaStyle"
          >
            <div :style="shouldAdaptHeatmap ? undefined : { minWidth: `${heatmapMinWidth}px` }">
              <div
                class="flex gap-1 pl-8 text-t-muted"
                :style="{ marginBottom: `${Math.max(6, Math.round(heatmapMetrics.gap))}px`, fontSize: `${heatmapMetrics.monthSize}px`, height: `${Math.max(14, heatmapMetrics.monthBlock - 8)}px` }"
              >
                <div class="flex relative w-full" :style="{ gap: `${heatmapMetrics.gap}px`, height: `${Math.max(14, heatmapMetrics.monthBlock - 8)}px` }">
                  <template v-for="m in heatmap.monthLabels" :key="`label-${m.weekIndex}-${m.label}`">
                    <span
                      class="absolute top-0 whitespace-nowrap"
                      :style="{ left: `${heatmapMetrics.labelCol + m.weekIndex * heatmapMetrics.step}px` }"
                    >
                      {{ formatHeatmapMonth(m.label, locale) }}
                    </span>
                  </template>
                </div>
              </div>

              <div class="flex" :style="{ gap: `${heatmapMetrics.gap}px` }">
                <div
                  class="flex flex-col pt-0.5 text-t-muted shrink-0"
                  :style="{ gap: `${heatmapMetrics.gap}px`, width: `${heatmapMetrics.labelCol}px`, fontSize: `${heatmapMetrics.labelSize}px` }"
                >
                  <span :style="{ height: `${heatmapMetrics.cell}px` }" />
                  <span :style="{ height: `${heatmapMetrics.cell}px`, lineHeight: `${heatmapMetrics.cell}px` }">Tue</span>
                  <span :style="{ height: `${heatmapMetrics.cell}px` }" />
                  <span :style="{ height: `${heatmapMetrics.cell}px`, lineHeight: `${heatmapMetrics.cell}px` }">Thu</span>
                  <span :style="{ height: `${heatmapMetrics.cell}px` }" />
                  <span :style="{ height: `${heatmapMetrics.cell}px`, lineHeight: `${heatmapMetrics.cell}px` }">Sat</span>
                </div>
                <div class="flex" :style="{ gap: `${heatmapMetrics.gap}px` }">
                  <div v-for="(week, wi) in heatmap.weeks" :key="wi" class="flex flex-col" :style="{ gap: `${heatmapMetrics.gap}px` }">
                    <button
                      v-for="(day, di) in week.days"
                      :key="`${wi}-${di}-${day.date}`"
                      type="button"
                      class="transition-all focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-t-raised shrink-0"
                      :style="{
                        width: `${heatmapMetrics.cell}px`,
                        height: `${heatmapMetrics.cell}px`,
                        borderRadius: `${heatmapMetrics.radius}px`,
                      }"
                      :class="[
                        cellClass(day),
                        selectedDay === day.date ? 'ring-1 ring-t-text/60 scale-110' : '',
                        day.inRange && day.value > 0 ? 'cursor-pointer hover:scale-110' : day.inRange ? 'cursor-default hover:scale-105' : 'cursor-default',
                      ]"
                      @mouseenter="showTooltip($event, day)"
                      @mousemove="moveTooltip($event, day)"
                      @mouseleave="hideTooltip"
                      @click="onCellClick(day)"
                    />
                  </div>
                </div>
              </div>

              <div
                class="flex items-center justify-end gap-1.5 text-t-muted"
                :style="{
                  marginTop: `${Math.max(8, Math.round(heatmapMetrics.gap * 1.5))}px`,
                  fontSize: `${heatmapMetrics.legendSize}px`,
                }"
              >
                <span>{{ t('dashboard.heatmapLess') }}</span>
                <span
                  v-for="lv in 5"
                  :key="lv"
                  class="shrink-0"
                  :style="{
                    width: `${heatmapMetrics.cell}px`,
                    height: `${heatmapMetrics.cell}px`,
                    borderRadius: `${heatmapMetrics.radius}px`,
                  }"
                  :class="lv === 1 ? 'bg-t-bg border border-t-border/40' : levelClass[lv - 1]"
                />
                <span>{{ t('dashboard.heatmapMore') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside
        v-if="topToolsDisplay.length"
        ref="toolsAsideRef"
        class="min-w-0 rounded-xl border border-t-border/70 bg-t-bg/40 p-3 lg:p-4 flex flex-col"
      >
        <h4 class="text-base font-semibold text-t-text mb-3">{{ t('dashboard.mostUsedTools') }}</h4>
        <ul class="space-y-2">
          <li
            v-for="tool in topToolsDisplay"
            :key="tool.name"
            class="min-w-0"
            :title="`${displayToolName(tool.name)} · ${t('dashboard.toolCalls', { n: tool.calls })} · ${t('dashboard.projectSessions', { n: tool.sessions })}`"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-[11px] font-medium text-t-text truncate">{{ displayToolName(tool.name) }}</span>
              <span class="text-[11px] tabular-nums shrink-0 text-t-muted">
                <span class="font-semibold" :class="sourceTab?.totalAccent || 'text-t-text'">{{ t('dashboard.toolCalls', { n: tool.calls }) }}</span>
                <span class="mx-1">·</span>
                <span>{{ t('dashboard.toolSharePct', { pct: toolSharePct(tool.calls) }) }}</span>
              </span>
            </div>
            <div class="h-1 rounded-full bg-t-bg overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="toolBarClass"
                :style="{ width: `${Math.max(Math.round((tool.calls / maxToolCalls) * 100), 6)}%` }"
              />
            </div>
          </li>
        </ul>
      </aside>
    </div>

    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="fixed z-[9999] pointer-events-none px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg border border-white/10 bg-[#3d444d] text-white"
        :style="{
          left: `${tooltip.x}px`,
          top: `${tooltip.y}px`,
          transform: 'translate(-50%, calc(-100% - 8px))',
        }"
      >
        {{ tooltip.text }}
      </div>
    </Teleport>
  </component>
</template>
