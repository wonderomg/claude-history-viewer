<div align="center">

# claude-history-viewer

**A lightweight, local web viewer for Claude Code and Cursor conversation history.**

Browse, search, and export sessions from `~/.claude` and `~/.cursor` — **100% offline**, no cloud, no telemetry.

[![Stars](https://img.shields.io/github/stars/wonderomg/claude-history-viewer?style=flat&color=yellow)](https://github.com/wonderomg/claude-history-viewer/stargazers)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Languages**: [中文 (简体)](README.md) | [English](README.en-US.md)

</div>

<p align="center">
  <img width="80%" alt="History" src="https://raw.githubusercontent.com/wonderomg/claude-history-viewer/master/claude-history-viewer.png" />
</p>

## Quick Start

Requires **Node.js 18+**. Optional: existing `~/.claude` / `~/.cursor` history on your machine.

### Install from GitHub (recommended)

```bash
npm install -g git+https://github.com/wonderomg/claude-history-viewer.git
claude-history-viewer
```

The first install clones the repo, installs dependencies, and builds — may take a minute or two.

### Run from source

```bash
git clone https://github.com/wonderomg/claude-history-viewer.git
cd claude-history-viewer
npm install
npm run build && npm start
```

Open **http://localhost:3747**. Auto-open on start; disable: `NO_OPEN_BROWSER=1 claude-history-viewer` (global) or `NO_OPEN_BROWSER=1 npm start` (source).

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
| Extras | Raw JSONL, Markdown export, light/dark theme, EN/中文 UI |

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

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | API bind address |
| `PORT` | `3747` | API / production static server |
| `VITE_PORT` | `5173` | Vite dev port |
| `NO_OPEN_BROWSER` | — | `1` to skip opening browser |

---

## Local API

`GET /api/health` · `GET /api/sessions?source=` · `GET /api/sessions/:id` · `GET /api/sessions/:id/search?q=` · `GET /api/sessions/:id/raw` · `GET /api/sessions/:id/export` · `GET /api/search?q=&source=`

---

## Privacy & security

- Reads `~/.claude` and `~/.cursor` only; nothing uploaded
- Chats may contain secrets; the viewer shows them as-is
- No auth; bound to localhost by default — do not expose to untrusted networks

---

## FAQ

| Issue | Fix |
|-------|-----|
| Cannot connect to backend | Run `claude-history-viewer` or `npm start`; ensure port `3747` is free |
| `git dep preparation failed` / code 236 | Run `unset NODE_ENV` before install; need Node 18+; use latest repo commit |
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
