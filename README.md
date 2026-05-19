<div align="center">

# claude-history-viewer

**A lightweight, local web viewer for Claude Code and Cursor conversation history.**

Browse, search, and export sessions from `~/.claude` and `~/.cursor` — **100% offline**, no cloud, no telemetry.

[![Stars](https://img.shields.io/github/stars/wonderomg/claude-history-viewer?style=flat&color=yellow)](https://github.com/wonderomg/claude-history-viewer/stargazers)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Languages**: English | [中文 (简体)](README.zh-CN.md)

</div>

<p align="center">
  <img width="80%" alt="History" src="https://raw.githubusercontent.com/wonderomg/claude-history-viewer/master/claude-history-viewer-en.jpg" />
</p>

## Quick Start

Requires **Node.js 18+**. Optional: existing `~/.claude` / `~/.cursor` history on your machine.

### Use from npm (recommended)

```bash
npx -y claudecode-history-viewer
```

`npx` may ask to install the package on first run; `-y` skips the prompt. Later runs often skip it once cached.

Or install globally (no prompt):

```bash
npm install -g claudecode-history-viewer
claudecode-history-viewer
```

Open **http://localhost:3747** (port is configurable — see **Configuration**)

Disable auto-open: `NO_OPEN_BROWSER=1 npx -y claudecode-history-viewer`

Custom port:

```bash
npx -y claudecode-history-viewer --port 3800
```

### Clone from GitHub (development)

```bash
git clone https://github.com/wonderomg/claude-history-viewer.git
cd claude-history-viewer
npm install
npm run build && npm start
```

For development (hot reload): `npm run dev` in the repo → http://localhost:5173

---

## Disclaimer

Independent open-source project, **not affiliated with Anthropic or Cursor**. Trademark names belong to their owners. Read-only access to local history files only.

---

## Features

| Feature | Description |
|---------|-------------|
| Dual source | Sidebar **All / Claude Code / Cursor**; search follows source |
| Sessions | Filter by project, expandable sub-agents |
| Chat UI | User / Markdown / Thinking / tool calls & results |
| Search | Global + in-session (highlight, prev/next, Enter to jump) |
| Extras | Raw JSONL, Markdown export, light/dark/eye-care themes, EN/中文 UI |

---

## Data paths

| Source | Path | Content |
|--------|------|---------|
| Claude Code | `~/.claude/sessions/*.json` | Session metadata |
| Claude Code | `~/.claude/projects/{slug}/{sessionId}.jsonl` | Main conversation |
| Claude Code | `.../{sessionId}/subagents/*.jsonl` | Sub-agent |
| Cursor | `~/.cursor/projects/{slug}/agent-transcripts/{id}/{id}.jsonl` | Agent transcript |
| Cursor | `.../subagents/*.jsonl` | Sub-agent |

Project slugs like `-Users-you-code-project` are decoded to readable paths in the UI.

---

## Configuration

### Port (highest priority first)

1. CLI `--port` / `-p`
2. `PORT` environment variable
3. `config.yaml` (project directory overrides user home)
4. Default `3747`

```bash
claudecode-history-viewer --port 3800
npm start -- --port 3800
```

Edit **`config.yaml`** in the project root (the npm package ships one too — works with `npx` from any directory). Optional user override: `~/.claudecode-history-viewer/config.yaml`.

```yaml
port: 3747
host: 127.0.0.1
language: en   # UI language: zh | en (Settings → Language)
theme: eye     # UI theme: light | dark | eye (eye-care green)
```

`language` / `theme` in `config.yaml` apply on each start until you change them in **Settings** or the header theme button (then the browser remembers your choice). To re-apply config defaults, clear site data for this host or remove `claude-history-viewer-locale-user` / `claude-history-viewer-theme-user` in DevTools → Application → Local Storage.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | API bind address (also supported in config.yaml) |
| `PORT` | `3747` | API / production static server |
| `VITE_PORT` | `5173` | Vite dev port |
| `NO_OPEN_BROWSER` | — | `1` to skip opening browser |

---

## Local API

`GET /api/health` · `GET /api/config` · `GET /api/sessions?source=` · `GET /api/sessions/:id` · `GET /api/sessions/:id/search?q=` · `GET /api/sessions/:id/raw` · `GET /api/sessions/:id/export` · `GET /api/search?q=&source=`

---

## Privacy & security

- Reads `~/.claude` and `~/.cursor` only; nothing uploaded
- Chats may contain secrets; the viewer shows them as-is
- No auth; bound to localhost by default — do not expose to untrusted networks

---

## FAQ

| Issue | Fix |
|-------|-----|
| Cannot connect to backend | Run `npx -y claudecode-history-viewer` or `npm start`; ensure port `3747` is free |
| Empty session list | Ensure history dirs exist and tools have written data |
| Search/highlight off | Press **Enter** in in-session search, or use ◀ ▶ after render |

---

## Limitations

Claude Code and Cursor only; web UI; no token analytics, live file watch, or session edit/delete.

---

## License

[MIT License](LICENSE)

---

<div align="center">

If this project helps you, please give it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=wonderomg/claude-history-viewer&type=Date)](https://star-history.com/#wonderomg/claude-history-viewer&Date)

</div>
