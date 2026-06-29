<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useLocale } from '../composables/useLocale.js'

const MARK_EDGE = 12
const MARK_GAP_MIN = 8
const MARK_GAP_MAX = 12

const props = defineProps({
  messages: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const { t } = useLocale()

const trackRef = ref(null)
const navRef = ref(null)
const hoverId = ref('')
const previewPos = ref(null)

/** @param {string} text @param {number} max */
function clipText(text, max) {
  const flat = (text || '').replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}

const markers = computed(() => {
  const list = props.messages || []
  const out = []

  for (let i = 0; i < list.length; i++) {
    const msg = list[i]
    if (msg.role !== 'user') continue
    const text = (msg.text || '').trim()
    if (!text) continue

    let replyPreview = ''
    for (let j = i + 1; j < list.length; j++) {
      const next = list[j]
      if (next.role === 'user') break
      if (next.role === 'assistant') {
        replyPreview = clipText(next.text || next.thinking || '', 140)
        if (replyPreview) break
      }
    }

    out.push({
      id: msg.id,
      preview: clipText(text, 72),
      replyPreview,
    })
  }

  return out
})

const marks = ref([])
const trackContentHeight = ref(120)

function layoutMarks() {
  const items = markers.value
  if (!items.length) {
    marks.value = []
    trackContentHeight.value = 120
    return
  }

  const viewportHeight = trackRef.value?.clientHeight ?? 320
  const count = items.length
  const minContentHeight = MARK_EDGE * 2 + Math.max(0, count - 1) * MARK_GAP_MIN
  const needsScroll = minContentHeight > viewportHeight

  let gap = MARK_GAP_MIN
  let startY = MARK_EDGE

  if (!needsScroll && count > 1) {
    gap = Math.min(MARK_GAP_MAX, Math.max(MARK_GAP_MIN, (viewportHeight - MARK_EDGE * 2) / (count - 1)))
    const stackHeight = (count - 1) * gap
    startY = Math.max(MARK_EDGE, (viewportHeight - stackHeight) / 2)
  }

  const contentHeight = needsScroll
    ? minContentHeight
    : Math.max(viewportHeight, MARK_EDGE * 2 + Math.max(0, count - 1) * gap)

  trackContentHeight.value = contentHeight

  marks.value = items.map((item, index) => ({
    ...item,
    top: startY + index * gap,
  }))
}

function scrollMarkIntoView(markId, behavior = 'smooth') {
  const track = trackRef.value
  if (!track || !markId) return

  const idx = marks.value.findIndex((m) => m.id === markId)
  if (idx < 0) return

  const markTop = marks.value[idx].top
  const viewH = track.clientHeight
  const target = markTop - viewH / 2
  track.scrollTo({ top: Math.max(0, target), behavior })
}

let resizeObserver = null

function bindTrackObserver() {
  resizeObserver?.disconnect()
  layoutMarks()
  if (!trackRef.value) return
  resizeObserver = new ResizeObserver(layoutMarks)
  resizeObserver.observe(trackRef.value)
}

onMounted(async () => {
  await nextTick()
  bindTrackObserver()
  document.addEventListener('pointermove', onDocumentPointerMove, { passive: true })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('pointermove', onDocumentPointerMove)
})

watch(markers, async () => {
  await nextTick()
  bindTrackObserver()
})

const previewMark = computed(() => marks.value.find((m) => m.id === hoverId.value) ?? null)

/** 悬停涟漪：高斯衰减，中心最宽、远端陡降（非线性） */
const NEIGHBOR_EACH_SIDE = 4
const BAR_PEAK = 36
const BAR_IDLE = 10
const BAR_PEAK_H = 4
const BAR_IDLE_H = 3
const IDLE_OPACITY = 0.5

/** 高斯衰减：exp(-k·t²)，k 越大远端衰减越陡 */
const RIPPLE_STEEPNESS = 7

function rippleFactor(dist) {
  if (dist > NEIGHBOR_EACH_SIDE) return 0
  const t = dist / NEIGHBOR_EACH_SIDE
  return Math.exp(-RIPPLE_STEEPNESS * t * t)
}

const barVisuals = computed(() => {
  const hoverIdx = marks.value.findIndex((m) => m.id === hoverId.value)
  const hovering = hoverIdx >= 0

  return marks.value.map((mark, index) => {
    const isActive = mark.id === props.activeId
    const dist = hovering ? Math.abs(index - hoverIdx) : NEIGHBOR_EACH_SIDE + 1
    const inRipple = hovering && dist <= NEIGHBOR_EACH_SIDE
    const factor = inRipple ? rippleFactor(dist) : 0

    const width = inRipple ? BAR_IDLE + (BAR_PEAK - BAR_IDLE) * factor : BAR_IDLE
    const height = inRipple ? BAR_IDLE_H + (BAR_PEAK_H - BAR_IDLE_H) * factor : BAR_IDLE_H
    const opacity = inRipple
      ? IDLE_OPACITY + (1 - IDLE_OPACITY) * factor
      : isActive
        ? 1
        : IDLE_OPACITY

    return { width, height, opacity, colorClass: 'bg-t-text' }
  })
})

const HIT_RADIUS = 14

function isPointerInNav(event) {
  const nav = navRef.value
  if (!nav) return false
  const r = nav.getBoundingClientRect()
  return (
    event.clientX >= r.left &&
    event.clientX <= r.right &&
    event.clientY >= r.top &&
    event.clientY <= r.bottom
  )
}

function updateHoverFromPointer(event) {
  const track = trackRef.value
  if (!track) return

  const rect = track.getBoundingClientRect()
  const y = event.clientY - rect.top + track.scrollTop

  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < marks.value.length; i++) {
    const d = Math.abs(marks.value[i].top - y)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }

  if (bestIdx < 0 || bestDist > HIT_RADIUS) {
    clearHover()
    return
  }

  const mark = marks.value[bestIdx]
  hoverId.value = mark.id
  previewPos.value = {
    top: rect.top + mark.top - track.scrollTop - 4,
    left: rect.right + 12,
  }
}

function onNavPointerMove(event) {
  updateHoverFromPointer(event)
}

function onNavPointerLeave() {
  clearHover()
}

function onDocumentPointerMove(event) {
  if (!navRef.value) return
  if (!isPointerInNav(event) && hoverId.value) {
    clearHover()
  }
}

function clearHover() {
  hoverId.value = ''
  previewPos.value = null
}

function jumpTo(id, event) {
  clearHover()
  event?.currentTarget?.blur()
  emit('select', id)
}

watch(
  () => props.activeId,
  async (id) => {
    clearHover()
    await nextTick()
    scrollMarkIntoView(id)
  }
)

const previewStyle = computed(() => {
  if (!previewPos.value) return {}
  const { top, left } = previewPos.value
  const width = 300
  const safeLeft =
    left + width > window.innerWidth - 12 ? Math.max(12, left - width - 24) : left
  return {
    top: `${Math.min(window.innerHeight - 120, Math.max(12, top - 8))}px`,
    left: `${safeLeft}px`,
    width: `${width}px`,
  }
})
</script>

<template>
  <nav
    v-if="markers.length"
    ref="navRef"
    class="hidden md:block w-10 shrink-0 h-full min-h-0 border-r border-t-border/50 bg-t-raised/40"
    :aria-label="t('chat.userNavLabel')"
  >
    <div
      ref="trackRef"
      class="h-full overflow-y-auto overflow-x-hidden relative"
      @pointermove="onNavPointerMove"
      @pointerleave="onNavPointerLeave"
    >
      <div class="relative" :style="{ minHeight: `${trackContentHeight}px` }">
        <button
          v-for="(mark, index) in marks"
          :key="mark.id"
          type="button"
          class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          :style="{ top: `${mark.top}px` }"
          :title="mark.preview"
          :aria-label="mark.preview"
          @click="jumpTo(mark.id, $event)"
        >
          <span
            class="block rounded-full mx-auto transition-[width,height,opacity] duration-150 ease-out"
            :class="barVisuals[index]?.colorClass"
            :style="{
              width: `${barVisuals[index]?.width ?? BAR_IDLE}px`,
              height: `${barVisuals[index]?.height ?? BAR_IDLE_H}px`,
              opacity: barVisuals[index]?.opacity ?? IDLE_OPACITY,
            }"
          />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="previewMark && previewPos"
        class="fixed z-[9000] pointer-events-none rounded-xl border border-t-border bg-t-raised shadow-lg px-3.5 py-3"
        :style="previewStyle"
      >
        <p class="text-sm font-semibold text-t-text leading-snug line-clamp-2">
          {{ previewMark.preview }}
        </p>
        <p v-if="previewMark.replyPreview" class="text-xs text-t-muted mt-2 leading-relaxed line-clamp-3">
          {{ previewMark.replyPreview }}
        </p>
      </div>
    </Teleport>
  </nav>
</template>
