#!/usr/bin/env node
/** Start production server (reads ~/.claude, ~/.cursor). */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
