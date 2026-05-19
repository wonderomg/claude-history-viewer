#!/usr/bin/env node
/** Start production server (reads ~/.claude, ~/.cursor). */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveServerConfig, printConfigHelp } from '../server/load-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distIndex = path.join(root, 'dist', 'index.html')
const server = path.join(root, 'server', 'index.js')

if (!fs.existsSync(distIndex)) {
  console.error(
    '[claudecode-history-viewer] Missing dist/. Reinstall the package or run from a built clone (npm run build).'
  )
  process.exit(1)
}

let config
try {
  config = resolveServerConfig(process.argv)
} catch (err) {
  console.error(`[error] ${err.message}`)
  process.exit(1)
}

if (config.help) {
  printConfigHelp()
  process.exit(0)
}

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(config.port),
    HOST: config.host,
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
