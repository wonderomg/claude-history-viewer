import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  scanAllSessions,
  findSessionById,
  readRawTranscript,
  getClaudeDir,
  decodeProjectSlug,
} from './scanner.js'
import { getCursorDir } from './scanner-cursor.js'
import { getCodexDir } from './scanner-codex.js'
import { parseTranscript, searchInTranscript } from './parser.js'
import { parseCursorTranscript, searchInCursorTranscript } from './parser-cursor.js'
import { parseCodexTranscript, searchInCodexTranscript } from './parser-codex.js'
import { messagesToMarkdown } from './export.js'
import { openBrowser } from './open-browser.js'
import { buildUsageReport } from './usage.js'
import {
  resolveAppConfig,
  printConfigHelp,
  ensureUserConfig,
  printResolvedConfig,
} from './load-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let appConfig
try {
  appConfig = resolveAppConfig()
} catch (err) {
  console.error(`[error] ${err.message}`)
  process.exit(1)
}

if (appConfig.help) {
  printConfigHelp()
  process.exit(0)
}

if (appConfig.initConfig) {
  const { path: configPath, created } = ensureUserConfig({ force: appConfig.forceInit })
  if (created || appConfig.forceInit) {
    console.log(`[ok] Config: ${configPath}`)
  } else {
    console.log(`[ok] Config already exists: ${configPath}`)
  }
  process.exit(0)
}

if (appConfig.showConfig) {
  ensureUserConfig()
  printResolvedConfig(appConfig)
  process.exit(0)
}

const { created, path: userConfigPath } = ensureUserConfig()
if (created) {
  console.log(`[info] Created default config: ${userConfigPath}`)
}

const PORT = appConfig.port
const HOST = appConfig.host
const isProd = process.env.NODE_ENV === 'production'

const app = express()
app.use(express.json())

function parseSessionFile(session) {
  if (session.source === 'cursor') {
    return parseCursorTranscript(session.filePath)
  }
  if (session.source === 'codex') {
    return parseCodexTranscript(session.filePath)
  }
  return parseTranscript(session.filePath)
}

function searchSessionFile(session, query) {
  if (session.source === 'cursor') {
    return searchInCursorTranscript(session.filePath, query)
  }
  if (session.source === 'codex') {
    return searchInCodexTranscript(session.filePath, query)
  }
  return searchInTranscript(session.filePath, query)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claudeDir: getClaudeDir(), cursorDir: getCursorDir(), codexDir: getCodexDir() })
})

app.get('/api/config', (_req, res) => {
  res.json({
    locale: appConfig.language,
    language: appConfig.language,
    theme: appConfig.theme,
    port: appConfig.port,
    host: appConfig.host,
    userConfigPath: appConfig.userConfigPath,
  })
})

app.get('/api/usage', (_req, res) => {
  try {
    const sessions = scanAllSessions({ source: 'all' })
    res.json(buildUsageReport(sessions))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sessions', (req, res) => {
  try {
    const source = req.query.source || 'all'
    const sessions = scanAllSessions({ source })
    const projects = [...new Set(sessions.map((s) => s.projectSlug))].map((slug) => ({
      slug,
      path: sessions.find((s) => s.projectSlug === slug)?.projectPath || slug,
      count: sessions.filter((s) => s.projectSlug === slug).length,
    }))
    res.json({
      sessions,
      projects,
      claudeDir: getClaudeDir(),
      cursorDir: getCursorDir(),
      codexDir: getCodexDir(),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = findSessionById(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    const parsed = parseSessionFile(session)
    const subagents =
      session.kind === 'main'
        ? scanAllSessions({ source: session.source }).filter(
            (s) => s.kind === 'subagent' && s.parentSessionId === session.id
          )
        : []
    res.json({
      session,
      meta: parsed.meta,
      messages: parsed.messages,
      subagents,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sessions/:id/raw', (req, res) => {
  try {
    const session = findSessionById(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    const raw = readRawTranscript(session.filePath)
    res.json({ session: { id: session.id, filePath: session.filePath }, ...raw })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sessions/:id/export', (req, res) => {
  try {
    const session = findSessionById(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    const parsed = parseSessionFile(session)
    const md = messagesToMarkdown(session, parsed.meta, parsed.messages)
    const filename = `${session.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 40)}.md`
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.send(md)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sessions/:id/search', (req, res) => {
  try {
    const q = req.query.q || ''
    const session = findSessionById(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    const result = searchSessionFile(session, q)
    res.json({ query: q, hits: result.hits, matches: result.matches, total: result.total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json({ query: q, results: [] })

    const source = req.query.source || 'all'
    const sessions = scanAllSessions({ source })
    const results = []

    for (const session of sessions) {
      const result = searchSessionFile(session, q)
      if (result.total > 0) {
        results.push({
          sessionId: session.id,
          title: session.title,
          projectPath: session.projectPath,
          source: session.source,
          kind: session.kind,
          parentSessionId: session.parentSessionId,
          hits: result.hits,
          total: result.total,
        })
      }
    }

    res.json({ query: q, results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

if (isProd) {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')
        }
      },
    })
  )
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

const DEV_WEB_PORT = process.env.VITE_PORT || 5173

const server = app.listen(PORT, HOST, () => {
  const apiUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`
  const browseUrl = isProd ? apiUrl : `http://localhost:${DEV_WEB_PORT}`

  console.log(`Claude History Viewer API → ${apiUrl}`)
  console.log(`Reading from ${getClaudeDir()}`)
  if (!isProd) {
    console.log(`Dev frontend  → ${browseUrl} (proxy /api → :${PORT})`)
  }

  const delay = isProd ? 300 : 800
  setTimeout(() => openBrowser(browseUrl), delay)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[error] Port ${PORT} is already in use (${HOST}:${PORT}).`)
    console.error('  Stop the other process, or use another port:')
    console.error('    claudecode-history-viewer --port 3748')
    console.error('    PORT=3748 npm start')
    process.exit(1)
  }
  throw err
})
