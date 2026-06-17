<script setup>
import { ref, computed } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { formatTokenCount, formatTokenCountFull } from '../utils/format.js'
import { formatDurationMs } from '../utils/usage-heatmap.js'
import TokenActivityHeatmap from './TokenActivityHeatmap.vue'

const props = defineProps({
  activity: { type: Object, default: null },
  totals: { type: Object, default: null },
  byDay: { type: Array, default: () => [] },
  estimated: { type: Boolean, default: false },
  selectedDay: { type: String, default: '' },
  /** @type {'claude'|'cursor'|'codex'} */
  source: { type: String, default: 'claude' },
  sourceTab: { type: Object, required: true },
})

const emit = defineEmits(['select-day', 'update:selectedDay'])

const { t, locale } = useLocale()
const heatmapMode = ref('daily')
const panelRef = ref(null)

defineExpose({ panelRef })

function shortModel(name) {
  if (!name || name === 'unknown') return t('dashboard.unknownModel')
  return name.replace(/^claude-/, '').slice(0, 28)
}

const summaryStats = computed(() => {
  const act = props.activity
  const totals = props.totals
  if (!act && !totals) return []

  const totalTokens = totals?.totalTokens ?? act?.totalTokens ?? 0
  const peakTokens = act?.peakDayTokens ?? 0
  const longestTaskMs = act?.longestTaskMs ?? 0
  const currentStreak = act?.currentStreak ?? 0
  const longestStreak = act?.longestStreak ?? 0

  return [
    {
      key: 'total',
      label: t('dashboard.cumulativeTokens'),
      value: formatTokenCount(totalTokens),
      full: formatTokenCountFull(totalTokens),
      accent: totalTokens > 0 ? props.sourceTab.totalAccent : 'text-t-muted',
      dot: totalTokens > 0 ? props.sourceTab.totalAccent.replace('text-', 'bg-') : 'bg-t-muted/60',
    },
    {
      key: 'peak',
      label: t('dashboard.peakTokens'),
      value: formatTokenCount(peakTokens),
      full: act?.peakDayDate ? `${act.peakDayDate} · ${formatTokenCountFull(peakTokens)}` : '',
      accent: peakTokens > 0 ? 'text-amber-400' : 'text-t-muted',
      dot: peakTokens > 0 ? 'bg-amber-400' : 'bg-t-muted/60',
    },
    {
      key: 'duration',
      label: t('dashboard.longestTask'),
      value: formatDurationMs(longestTaskMs, locale.value),
      full: '',
      accent: longestTaskMs > 0 ? 'text-violet-400' : 'text-t-muted',
      dot: longestTaskMs > 0 ? 'bg-violet-400' : 'bg-t-muted/60',
    },
    {
      key: 'current',
      label: t('dashboard.currentStreak'),
      value: t('dashboard.streakDays', { n: currentStreak }),
      full: '',
      accent: currentStreak > 0 ? 'text-emerald-400' : 'text-t-muted',
      dot: currentStreak > 0 ? 'bg-emerald-400' : 'bg-t-muted/60',
    },
    {
      key: 'longest',
      label: t('dashboard.longestStreak'),
      value: t('dashboard.streakDays', { n: longestStreak }),
      full: '',
      accent: longestStreak > 0 ? 'text-orange-400' : 'text-t-muted',
      dot: longestStreak > 0 ? 'bg-orange-400' : 'bg-t-muted/60',
    },
  ]
})

const insightRows = computed(() => {
  const act = props.activity
  if (!act) return []
  const rows = []
  rows.push({
    label: t('dashboard.insightEstimated'),
    value: props.estimated ? t('dashboard.estimatedBadge') : t('dashboard.insightExact'),
  })
  if (act.topModel) {
    rows.push({
      label: t('dashboard.insightTopModel'),
      value: `${shortModel(act.topModel)} · ${act.topModelPct}%`,
    })
  }
  rows.push(
    { label: t('dashboard.insightActiveDays'), value: String(act.activeDays) },
    { label: t('dashboard.insightSessions'), value: String(act.sessionCount) },
    { label: t('dashboard.insightAvgDaily'), value: formatTokenCount(act.avgTokensPerActiveDay) }
  )
  if (act.longestTaskMs > 0) {
    rows.push({
      label: t('dashboard.insightLongestTask'),
      value: formatDurationMs(act.longestTaskMs, locale.value),
    })
  }
  return rows
})

const topProjects = computed(() => props.activity?.topProjects ?? [])
const topPlugins = computed(() => props.activity?.topPlugins ?? [])
const topSkills = computed(() => props.activity?.topSkills ?? [])

const showExtensionPanel = computed(
  () => topPlugins.value.length > 0 || topSkills.value.length > 0
)

const extensionPanel = computed(() => {
  if (topPlugins.value.length > 0) {
    return { kind: 'plugin', titleKey: 'topPlugins', items: topPlugins.value }
  }
  if (topSkills.value.length > 0) {
    return { kind: 'skill', titleKey: 'topSkills', items: topSkills.value }
  }
  return null
})

function onHeatmapDay(date) {
  emit('select-day', date)
}
</script>

<template>
  <section
    ref="panelRef"
    class="rounded-2xl border border-t-border bg-t-raised overflow-hidden theme-transition mb-6"
  >
    <!-- Summary strip -->
    <div class="border-b border-t-border/60 bg-t-bg/30">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-t-border/40">
        <div
          v-for="stat in summaryStats"
          :key="stat.key"
          class="px-4 py-4 md:px-5 md:py-5"
          :title="stat.full || undefined"
        >
          <p
            class="text-lg md:text-xl font-semibold tabular-nums leading-tight transition-colors"
            :class="stat.accent"
          >
            {{ stat.value }}
          </p>
          <p class="text-[11px] text-t-muted mt-1 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="stat.dot" />
            {{ stat.label }}
          </p>
        </div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="p-4 md:p-5 border-b border-t-border/60">
      <TokenActivityHeatmap
        :by-day="byDay"
        :mode="heatmapMode"
        :selected-day="selectedDay"
        :source="source"
        :top-tools="activity?.topTools ?? []"
        :source-tab="sourceTab"
        embedded
        @update:mode="heatmapMode = $event"
        @select-day="onHeatmapDay"
      />
    </div>

    <!-- Insights + Plugins/Skills + Projects -->
    <div
      class="grid grid-cols-1 divide-y lg:divide-y-0 lg:divide-x divide-t-border/60"
      :class="showExtensionPanel ? 'lg:grid-cols-3' : 'lg:grid-cols-2'"
    >
      <div class="p-4 md:p-5">
        <h3 class="text-sm font-semibold text-t-text mb-3">{{ t('dashboard.activityInsights') }}</h3>
        <ul class="space-y-2.5">
          <li
            v-for="row in insightRows"
            :key="row.label"
            class="flex items-center justify-between gap-3 text-sm py-1"
          >
            <span class="text-t-muted">{{ row.label }}</span>
            <span class="text-t-text font-medium tabular-nums text-right shrink-0">{{ row.value }}</span>
          </li>
        </ul>
      </div>

      <div v-if="extensionPanel" class="p-4 md:p-5">
        <h3 class="text-sm font-semibold text-t-text mb-3">{{ t(`dashboard.${extensionPanel.titleKey}`) }}</h3>
        <ul class="space-y-1.5">
          <li
            v-for="(item, idx) in extensionPanel.items"
            :key="`${extensionPanel.kind}-${item.name}`"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-t-overlay/50 transition-colors"
          >
            <span
              class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
              :class="sourceTab.activeClass"
            >
              {{ idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-t-text truncate font-medium" :title="item.name">{{ item.name }}</p>
              <p class="text-[10px] text-t-muted">
                {{ t('dashboard.pluginCalls', { n: item.calls }) }}
                · {{ t('dashboard.projectSessions', { n: item.sessions }) }}
              </p>
            </div>
          </li>
        </ul>
      </div>

      <div class="p-4 md:p-5">
        <h3 class="text-sm font-semibold text-t-text mb-3">{{ t('dashboard.topProjects') }}</h3>
        <div v-if="topProjects.length === 0" class="text-sm text-t-muted py-4 text-center">
          {{ t('dashboard.noProjectData') }}
        </div>
        <ul v-else class="space-y-1.5">
          <li
            v-for="(proj, idx) in topProjects"
            :key="proj.path"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-t-overlay/50 transition-colors"
          >
            <span
              class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
              :class="sourceTab.activeClass"
            >
              {{ idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-t-text truncate font-mono" :title="proj.path">{{ proj.path }}</p>
              <p class="text-[10px] text-t-muted">{{ t('dashboard.projectSessions', { n: proj.sessions }) }}</p>
            </div>
            <span class="text-xs font-semibold tabular-nums shrink-0" :class="sourceTab.totalAccent">
              {{ formatTokenCount(proj.tokens) }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
