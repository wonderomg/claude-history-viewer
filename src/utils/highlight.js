export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @returns {RegExp | null} */
export function buildHighlightRegex(query) {
  const q = query?.trim()
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, 'gi')
}

/** 纯文本 → 带 <mark> 的安全 HTML */
export function highlightPlainText(text, query) {
  if (!text) return ''
  const re = buildHighlightRegex(query)
  if (!re) return escapeHtml(text)

  let out = ''
  let last = 0
  const reGlobal = new RegExp(re.source, re.flags)
  let match
  while ((match = reGlobal.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, match.index))
    out += `<mark class="search-highlight">${escapeHtml(match[0])}</mark>`
    last = match.index + match[0].length
  }
  out += escapeHtml(text.slice(last))
  return out
}

/** 在已渲染 DOM 内高亮文本节点（用于 Markdown） */
export function highlightTextNodes(root, query) {
  if (!root || !query?.trim()) return

  const re = buildHighlightRegex(query)
  if (!re) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('mark.search-highlight')) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'BUTTON') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes = []
  let current
  while ((current = walker.nextNode())) textNodes.push(current)

  for (const textNode of textNodes) {
    const text = textNode.nodeValue
    const reGlobal = new RegExp(re.source, re.flags)
    if (!reGlobal.test(text)) continue

    const frag = document.createDocumentFragment()
    let last = 0
    reGlobal.lastIndex = 0
    let match
    while ((match = reGlobal.exec(text)) !== null) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)))
      }
      const mark = document.createElement('mark')
      mark.className = 'search-highlight'
      mark.textContent = match[0]
      frag.appendChild(mark)
      last = match.index + match[0].length
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)))
    }
    textNode.parentNode?.replaceChild(frag, textNode)
  }
}

/** 在容器内获取所有搜索高亮 mark（文档顺序） */
export function getSearchMarks(container) {
  const root = container || document
  return [...root.querySelectorAll('mark.search-highlight')]
}

/** 激活第 index 个高亮并滚动到视口 */
export function setActiveSearchMark(container, index) {
  const marks = getSearchMarks(container)
  marks.forEach((m, i) => {
    m.classList.toggle('search-highlight-active', index >= 0 && i === index)
  })
  if (index < 0) return false
  const target = marks[index]
  if (!target) return false
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

/** 滚动到消息内首个高亮，若无 mark 则滚到消息块 */
export function scrollToMessageHighlight(messageId, options = {}) {
  const root = document.getElementById('msg-' + messageId)
  if (!root) return false
  const mark = root.querySelector('mark.search-highlight')
  const target = mark || root
  target.scrollIntoView({
    behavior: options.behavior ?? 'smooth',
    block: options.block ?? 'center',
  })
  return true
}

/** 等待高亮渲染后定位到第 matchIndex 个出现位置 */
export function scheduleScrollToMatchIndex(container, matchIndex, maxAttempts = 40) {
  let attempts = 0
  const tryScroll = () => {
    if (setActiveSearchMark(container, matchIndex)) return
    if (++attempts < maxAttempts) requestAnimationFrame(tryScroll)
  }
  requestAnimationFrame(() => requestAnimationFrame(tryScroll))
}

/** 等待 Markdown 等高亮渲染完成后滚动到消息首个高亮 */
export function scheduleScrollToMessageHighlight(messageId, maxAttempts = 30) {
  let attempts = 0
  const tryScroll = () => {
    if (scrollToMessageHighlight(messageId)) return
    if (++attempts < maxAttempts) requestAnimationFrame(tryScroll)
  }
  requestAnimationFrame(() => requestAnimationFrame(tryScroll))
}
