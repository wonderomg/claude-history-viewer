import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const distIndex = path.join(root, 'dist', 'index.html')

if (fs.existsSync(distIndex)) {
  console.log('[claude-history-viewer] dist/ found, skip build')
  process.exit(0)
}

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
if (!fs.existsSync(viteBin)) {
  console.error(
    '[claude-history-viewer] Cannot build: vite not installed. Run npm install (without NODE_ENV=production) or use a release that includes dist/.'
  )
  process.exit(1)
}

console.log('[claude-history-viewer] Building frontend…')
execSync(`node "${viteBin}" build`, { cwd: root, stdio: 'inherit' })
