import { messages } from '../i18n/messages.js'

/**
 * 将后端 formatToolName 产出的英文工具名转为当前语言展示名。
 * @param {string} name
 * @param {'zh'|'en'} locale
 */
export function formatToolDisplayName(name, locale) {
  if (!name) return name
  const labels = messages[locale]?.dashboard?.toolNames
  if (labels?.[name]) return labels[name]

  if (name.startsWith('MCP ')) {
    const tail = name.slice(4)
    if (labels?.[name]) return labels[name]
    if (locale === 'zh') {
      const parts = tail.split(/\s+/).filter(Boolean)
      const short = parts[parts.length - 1] || tail
      const shortLabel = labels?.[short] || short
      return `MCP · ${shortLabel}`
    }
  }

  return name
}
