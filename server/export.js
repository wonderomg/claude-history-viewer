/**
 * 将解析后的消息列表导出为 Markdown
 */

export function messagesToMarkdown(session, meta, messages) {
  const lines = []
  const title = meta?.title || session?.title || 'Claude Code Session'
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`- **Session ID**: \`${session?.id || ''}\``)
  if (session?.parentSessionId) {
    lines.push(`- **类型**: Sub-agent（父会话 \`${session.parentSessionId}\`）`)
  }
  if (session?.agentType) lines.push(`- **Agent 类型**: ${session.agentType}`)
  if (session?.agentDescription) lines.push(`- **描述**: ${session.agentDescription}`)
  lines.push(`- **项目**: \`${session?.projectPath || ''}\``)
  lines.push(`- **工作目录**: \`${session?.cwd || ''}\``)
  if (session?.updatedAt) {
    lines.push(`- **更新时间**: ${new Date(session.updatedAt).toLocaleString('zh-CN')}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push('## User')
      lines.push('')
      lines.push(msg.text || '')
      lines.push('')
    } else if (msg.role === 'assistant') {
      lines.push('## Assistant')
      if (msg.model) lines.push(`*model: ${msg.model}*`)
      lines.push('')
      if (msg.thinking) {
        lines.push('<details>')
        lines.push('<summary>Thinking</summary>')
        lines.push('')
        lines.push(msg.thinking)
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }
      if (msg.toolUses?.length) {
        for (const t of msg.toolUses) {
          lines.push(`### Tool: \`${t.name}\``)
          lines.push('')
          lines.push('```json')
          lines.push(JSON.stringify(t.input, null, 2))
          lines.push('```')
          lines.push('')
        }
      }
      if (msg.text) {
        lines.push(msg.text)
        lines.push('')
      }
    } else if (msg.role === 'tool_result') {
      const label = msg.isError ? 'Tool Error' : 'Tool Result'
      lines.push(`## ${label}`)
      lines.push('')
      lines.push('```')
      lines.push(msg.content || '')
      lines.push('```')
      lines.push('')
    } else if (msg.role === 'system' && msg.subtype === 'turn_duration') {
      lines.push(`*— 本轮耗时 ${Math.round((msg.durationMs || 0) / 1000)}s —*`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
