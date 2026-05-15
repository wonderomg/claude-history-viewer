import { spawn } from 'child_process'

/**
 * 启动后自动打开浏览器（macOS / Windows / Linux）
 * 设置环境变量 NO_OPEN_BROWSER=1 可禁用
 */
export function openBrowser(url) {
  if (process.env.NO_OPEN_BROWSER === '1' || process.env.NO_OPEN_BROWSER === 'true') {
    return
  }

  let command
  let args

  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
  } catch (err) {
    console.warn(`[open-browser] 无法自动打开浏览器: ${err.message}`)
    console.warn(`[open-browser] 请手动访问: ${url}`)
  }
}
