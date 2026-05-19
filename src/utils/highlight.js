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

/** 在指定滚动容器内将元素滚入视口 */
export function scrollElementInContainer(element, container, options = {}) {
  if (!element || !container) return false
  const behavior = options.behavior ?? 'smooth'
  const block = options.block ?? 'center'
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const elementHeight = elementRect.height
  const containerHeight = container.clientHeight
  let top = elementRect.top - containerRect.top + container.scrollTop
  if (block === 'center') {
    top -= containerHeight / 2 - elementHeight / 2
  } else if (block === 'start') {
    top -= 12
  }
  container.scrollTo({ top: Math.max(0, top), behavior })
  return true
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
  scrollElementInContainer(target, container, { block: 'center' })
  return true
}

/** 等待高亮渲染后定位到第 matchIndex 个出现位置 */
export function scheduleScrollToMatchIndex(container, matchIndex, messageId, maxAttempts = 80) {
  let attempts = 0
  const tryScroll = () => {
    if (setActiveSearchMark(container, matchIndex)) return
    if (messageId && container) {
      const msgEl = document.getElementById('msg-' + messageId)
      if (msgEl) scrollElementInContainer(msgEl, container, { block: 'center' })
    }
    if (++attempts < maxAttempts) requestAnimationFrame(tryScroll)
  }
  requestAnimationFrame(() => requestAnimationFrame(tryScroll))
}

/** 等待高亮渲染完成后滚动到消息内首个高亮（或消息块） */
export function scheduleScrollToMessageInContainer(container, messageId, maxAttempts = 80) {
  let attempts = 0
  const tryScroll = () => {
    const msgEl = document.getElementById('msg-' + messageId)
    if (!msgEl || !container) {
      if (++attempts < maxAttempts) requestAnimationFrame(tryScroll)
      return
    }
    const marksInMsg = [...msgEl.querySelectorAll('mark.search-highlight')]
    if (marksInMsg.length > 0) {
      const allMarks = getSearchMarks(container)
      const globalIdx = allMarks.indexOf(marksInMsg[0])
      if (globalIdx >= 0) {
        setActiveSearchMark(container, globalIdx)
        return
      }
    }
    scrollElementInContainer(msgEl, container, { block: 'center' })
    if (++attempts < maxAttempts) requestAnimationFrame(tryScroll)
  }
  requestAnimationFrame(() => requestAnimationFrame(tryScroll))
}

/** @deprecated 使用 scheduleScrollToMessageInContainer(container, messageId) */
export function scheduleScrollToMessageHighlight(messageId, maxAttempts = 80) {
  const container = document.querySelector('[data-chat-scroll]')
  scheduleScrollToMessageInContainer(container, messageId, maxAttempts)
}

/** 滚动到消息内首个高亮，若无 mark 则滚到消息块 */
export function scrollToMessageHighlight(messageId, options = {}) {
  const root = document.getElementById('msg-' + messageId)
  if (!root) return false
  const container = options.container
  const mark = root.querySelector('mark.search-highlight')
  const target = mark || root
  if (container) {
    scrollElementInContainer(target, container, {
      behavior: options.behavior ?? 'smooth',
      block: options.block ?? 'center',
    })
    return true
  }
  target.scrollIntoView({
    behavior: options.behavior ?? 'smooth',
    block: options.block ?? 'center',
  })
  return true
}
