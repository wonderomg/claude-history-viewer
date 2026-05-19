import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULT_PORT = 3747
const DEFAULT_HOST = '127.0.0.1'

/** @param {string} text */
function parseSimpleYaml(text) {
  /** @type {Record<string, string | number>} */
  const cfg = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([a-zA-Z_][\w-]*):\s*(.+)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (/^\d+$/.test(val)) cfg[key] = Number(val)
    else cfg[key] = val
  }
  return cfg
}

/** @param {string} filePath */
function loadYamlFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    return parseSimpleYaml(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    console.warn(`[warn] Failed to read ${filePath}: ${err.message}`)
    return {}
  }
}

/** @param {string | number | undefined} value */
export function parseLanguage(value) {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim().toLowerCase()
  if (['zh', 'zh-cn', 'zh_cn', 'chinese', '中文', '简体', '简体中文'].includes(s)) return 'zh'
  if (['en', 'en-us', 'en_us', 'english', '英文', '英语'].includes(s)) return 'en'
  return null
}

/** @returns {Record<string, string | number>} */
export function loadMergedFileConfig() {
  const home = os.homedir()
  const layers = [
    home ? path.join(home, '.claudecode-history-viewer', 'config.yaml') : null,
    path.join(PACKAGE_ROOT, 'config.yaml'),
    path.join(process.cwd(), 'config.yaml'),
  ].filter(Boolean)

  return layers.reduce((merged, filePath) => ({ ...merged, ...loadYamlFile(filePath) }), {})
}

/**
 * @param {Record<string, string | number>} [fileConfig]
 * @returns {'zh' | 'en' | undefined}
 */
export function resolveLanguageFromConfig(fileConfig = loadMergedFileConfig()) {
  const raw = fileConfig.language ?? fileConfig.locale
  if (raw === undefined) return undefined
  const parsed = parseLanguage(raw)
  if (parsed === null) {
    console.warn(`[warn] Invalid language in config: ${raw} (use zh or en)`)
    return undefined
  }
  return parsed
}

/** @param {string | number | undefined} value */
export function parseTheme(value) {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim().toLowerCase()
  if (['dark', 'dark-mode', 'night', '暗色', '深色', '黑色'].includes(s)) return 'dark'
  if (['light', 'light-mode', 'day', '明亮', '浅色', '白色'].includes(s)) return 'light'
  if (
    ['eye', 'eye-care', 'eyecare', 'care', 'green', '护眼', '豆沙绿', '护眼绿', '绿色'].includes(s)
  ) {
    return 'eye'
  }
  return null
}

/**
 * @param {Record<string, string | number>} [fileConfig]
 * @returns {'dark' | 'light' | 'eye' | undefined}
 */
export function resolveThemeFromConfig(fileConfig = loadMergedFileConfig()) {
  const raw = fileConfig.theme
  if (raw === undefined) return undefined
  const parsed = parseTheme(raw)
  if (parsed === null) {
    console.warn(`[warn] Invalid theme in config: ${raw} (use light, dark, or eye)`)
    return undefined
  }
  return parsed
}

/** @param {string | number | undefined} value @param {string} label */
function parsePort(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing ${label}`)
  }
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid ${label}: ${value} (use an integer from 1 to 65535)`)
  }
  return n
}

/** @param {string[]} argv */
function parseCli(argv) {
  /** @type {{ help?: boolean, port?: number }} */
  const result = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      result.help = true
      continue
    }
    if (arg === '--port' || arg === '-p') {
      const next = argv[++i]
      if (next === undefined || next.startsWith('-')) {
        throw new Error('--port requires a port number')
      }
      result.port = parsePort(next, 'port')
      continue
    }
    if (arg.startsWith('--port=')) {
      result.port = parsePort(arg.slice('--port='.length), 'port')
      continue
    }
  }
  return result
}

/**
 * Resolve server listen options.
 * Priority: CLI --port > PORT env > config.yaml (cwd > package > ~/.claudecode-history-viewer) > default.
 * HOST env > config host > default 127.0.0.1
 *
 * @param {string[]} [argv]
 */
export function resolveServerConfig(argv = process.argv) {
  const cli = parseCli(argv)
  if (cli.help) {
    return { help: true, port: DEFAULT_PORT, host: DEFAULT_HOST }
  }

  const fileConfig = loadMergedFileConfig()

  const port =
    cli.port ??
    (process.env.PORT !== undefined && process.env.PORT !== ''
      ? parsePort(process.env.PORT, 'PORT')
      : undefined) ??
    (fileConfig.port !== undefined ? parsePort(fileConfig.port, 'config port') : undefined) ??
    DEFAULT_PORT

  const host =
    (process.env.HOST && String(process.env.HOST).trim()) ||
    (typeof fileConfig.host === 'string' ? fileConfig.host : undefined) ||
    DEFAULT_HOST

  return { help: false, port, host }
}

export function printConfigHelp() {
  console.log(`claudecode-history-viewer — local Claude / Cursor history viewer

Usage:
  claudecode-history-viewer [options]
  npm start [-- --port <port>]

Options:
  --port, -p <port>   Listen port (default: ${DEFAULT_PORT})
  --help, -h          Show this help

Configuration (YAML, later overrides earlier):
  ~/.claudecode-history-viewer/config.yaml
  <package>/config.yaml
  ./config.yaml (current directory)

  language: zh | en   UI language (Settings → Language)
  theme: light | dark | eye   UI theme (header toggle / settings)

Priority: --port > PORT env > config.yaml > default (${DEFAULT_PORT})
`)
}
