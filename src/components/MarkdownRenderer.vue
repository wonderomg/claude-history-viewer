<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { renderMarkdown } from '../utils/markdown.js'
import { highlightTextNodes } from '../utils/highlight.js'
import { useLocale } from '../composables/useLocale.js'

const { t, locale } = useLocale()

const props = defineProps({
  source: { type: String, default: '' },
  highlightQuery: { type: String, default: '' },
})

const emit = defineEmits(['highlighted'])

const html = computed(() => renderMarkdown(props.source))
const root = ref(null)

function attachCopyButtons() {
  if (!root.value) return
  root.value.querySelectorAll('.copy-btn').forEach((btn) => btn.remove())
  root.value.querySelectorAll('pre').forEach((pre) => {
    const btn = document.createElement('button')
    btn.className =
      'copy-btn absolute top-2 right-2 px-2 py-1 text-[11px] rounded bg-t-overlay text-t-text hover:bg-t-border opacity-0 group-hover:opacity-100 transition-opacity'
    btn.textContent = t('markdown.copy')
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText || ''
      await navigator.clipboard.writeText(code)
      btn.textContent = t('markdown.copied')
      setTimeout(() => (btn.textContent = t('markdown.copy')), 1500)
    })
    pre.classList.add('group')
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

function applyHighlights() {
  if (!root.value || !props.highlightQuery.trim()) return false
  highlightTextNodes(root.value, props.highlightQuery)
  return root.value.querySelector('mark.search-highlight') != null
}

async function afterRender() {
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!root.value) return
      attachCopyButtons()
      applyHighlights()
      emit('highlighted')
    })
  })
}

watch([html, () => props.highlightQuery], afterRender, { flush: 'post' })
watch(locale, afterRender)
</script>

<template>
  <div ref="root" class="prose-chat" v-html="html" />
</template>
