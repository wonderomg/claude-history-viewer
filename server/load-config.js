import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULT_PORT = 3747
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_LANGUAGE = 'en'
const DEFAULT_THEME = 'light'

const USER_CONFIG_DIR_NAME = '.claudecode-history-viewer'
const USER_CONFIG_FILE = 'config.yaml'

/** @returns {string | null} */
export function getUserConfigDir() {
  const home = os.homedir()
  return home ? path.join(home, USER_CONFIG_DIR_NAME) : null
}

export function getUserConfigPath() {
  const dir = getUserConfigDir()
  return dir ? path.join(dir, USER_CONFIG_FILE) : null
}

export function getPackageConfigPath() {
  return path.join(PACKAGE_ROOT, USER_CONFIG_FILE)
}

function getDefaultConfigYaml() {
  const pkgPath = getPackageConfigPath()
  if (fs.existsSync(pkgPath)) {
    return fs.readFileSync(pkgPath, 'utf8')
  }
  return `port: ${DEFAULT_PORT}
host: ${DEFAULT_HOST}
language: ${DEFAULT_LANGUAGE}
theme: ${DEFAULT_THEME}
`
}

/**
 * Create ~/.claudecode-history-viewer/config.yaml if missing.
 * @param {{ force?: boolean }} [opts]
 * @returns {{ path: string, created: boolean }}
 */
export function ensureUserConfig(opts = {}) {
  const configPath = getUserConfigPath()
  if (!configPath) {
    throw new Error('Cannot resolve home directory for user config')
  }
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (fs.existsSync(configPath) && !opts.force) {
    return { path: configPath, created: false }
  }
  fs.writeFileSync(configPath, getDefaultConfigYaml(), 'utf8')
  return { path: configPath, created: true }
}

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

/** @returns {Record<string, string | number>} */
export function loadMergedFileConfig() {
  const layers = [
    getPackageConfigPath(),
    getUserConfigPath(),
    path.join(process.cwd(), USER_CONFIG_FILE),
  ].filter((p) => p && fs.existsSync(p))

  return layers.reduce((merged, filePath) => ({ ...merged, ...loadYamlFile(filePath) }), {})
}

/** @param {string | number | undefined} value */
export function parseLanguage(value) {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim().toLowerCase()
  if (['zh', 'zh-cn', 'zh_cn', 'chinese', '中文', '简体', '简体中文'].includes(s)) return 'zh'
  if (['en', 'en-us', 'en_us', 'english', '英文', '英语'].includes(s)) return 'en'
  return null
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

/**
 * @param {string[]} argv
 * @returns {{
 *   help?: boolean,
 *   initConfig?: boolean,
 *   showConfig?: boolean,
 *   forceInit?: boolean,
 *   port?: number,
 *   host?: string,
 *   language?: 'zh' | 'en',
 *   theme?: 'light' | 'dark' | 'eye',
 * }}
 */
export function parseCliArgs(argv) {
  /** @type {ReturnType<typeof parseCliArgs>} */
  const result = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      result.help = true
      continue
    }
    if (arg === '--init-config' || arg === '--init') {
      result.initConfig = true
      continue
    }
    if (arg === '--force') {
      result.forceInit = true
      continue
    }
    if (arg === '--config' || arg === '--confg' || arg === '--show-config') {
      result.showConfig = true
      continue
    }
    if (arg === '--port' || arg === '-p') {
      const next = argv[++i]
      if (next === undefined || next.startsWith('-')) throw new Error('--port requires a port number')
      result.port = parsePort(next, 'port')
      continue
    }
    if (arg.startsWith('--port=')) {
      result.port = parsePort(arg.slice('--port='.length), 'port')
      continue
    }
    if (arg === '--host') {
      const next = argv[++i]
      if (!next || next.startsWith('-')) throw new Error('--host requires a value')
      result.host = next.trim()
      continue
    }
    if (arg.startsWith('--host=')) {
      result.host = arg.slice('--host='.length).trim()
      continue
    }
    if (arg === '--language' || arg === '--lang') {
      const next = argv[++i]
      if (!next || next.startsWith('-')) throw new Error('--language requires zh or en')
      const parsed = parseLanguage(next)
      if (!parsed) throw new Error(`Invalid language: ${next} (use zh or en)`)
      result.language = parsed
      continue
    }
    if (arg.startsWith('--language=') || arg.startsWith('--lang=')) {
      const raw = arg.includes('--lang=') ? arg.slice('--lang='.length) : arg.slice('--language='.length)
      const parsed = parseLanguage(raw)
      if (!parsed) throw new Error(`Invalid language: ${raw} (use zh or en)`)
      result.language = parsed
      continue
    }
    if (arg === '--theme') {
      const next = argv[++i]
      if (!next || next.startsWith('-')) throw new Error('--theme requires light, dark, or eye')
      const parsed = parseTheme(next)
      if (!parsed) throw new Error(`Invalid theme: ${next} (use light, dark, or eye)`)
      result.theme = parsed
      continue
    }
    if (arg.startsWith('--theme=')) {
      const parsed = parseTheme(arg.slice('--theme='.length))
      if (!parsed) throw new Error(`Invalid theme (use light, dark, or eye)`)
      result.theme = parsed
      continue
    }
  }
  return result
}

/**
 * @param {string[]} [argv]
 */
export function resolveAppConfig(argv = process.argv) {
  const cli = parseCliArgs(argv)
  if (cli.help) {
    return {
      help: true,
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
      language: DEFAULT_LANGUAGE,
      theme: DEFAULT_THEME,
    }
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
    cli.host ||
    (process.env.HOST && String(process.env.HOST).trim()) ||
    (typeof fileConfig.host === 'string' ? fileConfig.host : undefined) ||
    DEFAULT_HOST

  const language =
    cli.language ||
    (process.env.CHV_LANGUAGE && parseLanguage(process.env.CHV_LANGUAGE)) ||
    resolveLanguageFromConfig(fileConfig) ||
    DEFAULT_LANGUAGE

  const theme =
    cli.theme ||
    (process.env.CHV_THEME && parseTheme(process.env.CHV_THEME)) ||
    resolveThemeFromConfig(fileConfig) ||
    DEFAULT_THEME

  return {
    help: false,
    initConfig: !!cli.initConfig,
    showConfig: !!cli.showConfig,
    forceInit: !!cli.forceInit,
    port,
    host,
    language,
    theme,
    userConfigPath: getUserConfigPath(),
    packageConfigPath: getPackageConfigPath(),
    cwdConfigPath: path.join(process.cwd(), USER_CONFIG_FILE),
    fileConfig,
  }
}

/** @param {ReturnType<typeof resolveAppConfig>} config */
export function printResolvedConfig(config) {
  const userPath = getUserConfigPath()
  const userExists = userPath && fs.existsSync(userPath)
  console.log('claudecode-history-viewer configuration\n')
  console.log(`  User config:    ${userPath}${userExists ? '' : ' (not created yet)'}`)
  console.log(`  Package config: ${getPackageConfigPath()}`)
  console.log(`  CWD config:     ${path.join(process.cwd(), USER_CONFIG_FILE)}`)
  console.log('\nEffective values (CLI > env > user config > package > cwd):\n')
  console.log(`  port:     ${config.port}`)
  console.log(`  host:     ${config.host}`)
  console.log(`  language: ${config.language}`)
  console.log(`  theme:    ${config.theme}`)
  if (!userExists) {
    console.log('\nCreate user config: claudecode-history-viewer --init-config')
  }
}

export function printConfigHelp() {
  console.log(`claudecode-history-viewer — local Claude / Cursor history viewer

Usage:
  claudecode-history-viewer [options]          Start server
  claudecode-history-viewer --init-config      Create ~/.claudecode-history-viewer/config.yaml
  claudecode-history-viewer --config           Show config paths and effective values

Options:
  --port, -p <port>       Listen port (default: ${DEFAULT_PORT})
  --host <address>        Bind address (default: ${DEFAULT_HOST})
  --language, --lang <l>  UI language: zh | en
  --theme <name>          UI theme: light | dark | eye
  --init-config, --init   Write default config to ~/.claudecode-history-viewer/config.yaml
  --force                 With --init-config, overwrite existing file
  --config, --show-config Show resolved configuration (alias: --confg)
  --help, -h              Show this help

Config file (auto-created on first start if missing):
  ~/.claudecode-history-viewer/config.yaml

Merge order (later overrides earlier):
  <package>/config.yaml → ~/.claudecode-history-viewer/config.yaml → ./config.yaml

Example ~/.claudecode-history-viewer/config.yaml:
  port: 3747
  host: 127.0.0.1
  language: en
  theme: dark
`)
}

/** @deprecated use resolveAppConfig */
export function resolveServerConfig(argv = process.argv) {
  const app = resolveAppConfig(argv)
  return {
    help: app.help,
    port: app.port,
    host: app.host,
  }
}
