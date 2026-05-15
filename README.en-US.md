<div align="center">


# claude-history-viewer

**A lightweight, local web viewer for Claude Code and Cursor conversation history.**

Browse, search, and navigate sessions from `~/.claude` and `~/.cursor` — **100% offline**, no cloud, no telemetry.

[![Stars](https://img.shields.io/github/stars/wonderomg/claude-history-viewer?style=flat&color=yellow)](https://github.com/wonderomg/claude-history-viewer/stargazers)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Languages**: [中文 (简体)](README.md) | [English](README.en-US.md)

</div>

---

<p align="center">
  <img width="49%" alt="History" src="https://raw.githubusercontent.com/wonderomg/claude-history-viewer/master/claude-history-viewer.png" />
</p>




## Quick Start

```bash
cd claude-history-viewer
npm install
npm run dev
```

| Mode | URL | Notes |
|------|-----|--------|
| Development | http://localhost:5173 | Vite dev server; `/api` proxied to backend |
| API (backend) | http://localhost:3747 | Express file scanner |

The browser opens automatically after startup (macOS / Windows / Linux). Disable: `NO_OPEN_BROWSER=1 npm run dev`.

**Production**

```bash
npm run build
npm start
# → http://localhost:3747
```

From the repo root (`board/`):

```bash
npm run dev    # forwards to claude-history-viewer
```

---

## Why This Project

AI assistants store rich conversation logs on disk, but there is no single place to **review Claude Code and Cursor history** in one UI. This viewer reads local JSONL transcripts and presents them in a readable chat layout with search and export, implemented as a minimal **Vue + Express** stack for quick local use.

| Provider | Data location | What you get |
|----------|---------------|--------------|
| **Claude Code** | `~/.claude/sessions/`, `~/.claude/projects/` | Session metadata, main transcripts, sub-agents |
| **Cursor** | `~/.cursor/projects/.../agent-transcripts/` | Agent transcripts, sub-agents |

No vendor lock-in for *viewing*: your files stay on disk; the app only reads them locally.

---

## Disclaimer

This is an independent open-source project. It is **not affiliated with, endorsed by, or sponsored by Anthropic, Cursor, or their respective companies**. Claude, Cursor, and related names are trademarks of their owners. This tool only reads local history files on your machine and does not provide any official service from those products.

---

## Table of Contents

- [Features](#features)
- [Data paths](#data-paths)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tech stack](#tech-stack)
- [Data privacy](#data-privacy)
- [FAQ](#faq)
- [Limitations](#limitations)
- [License](#license)

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **Dual source** | Switch **All / Claude Code / Cursor** in the sidebar; global search respects the active source |
| **Session list** | Filter by project, search titles/paths, optional hide sub-agents; expandable sub-agent tree |
| **Chat rendering** | User bubbles, assistant Markdown, Thinking (collapsible), tool calls & tool results |
| **Raw JSONL** | Per-line JSON view with type filter |
| **Export** | Download current session as Markdown |
| **Themes** | Light / dark toggle with smooth transitions |
| **i18n** | UI in **English** and **中文** (gear menu → language) |

### Search

| Feature | Description |
|---------|-------------|
| **Global search** | Top bar: search across sessions; click a result to open session and jump to first match |
| **In-session search** | Filter messages; show match count `current / total`; **Previous / Next** arrows; **Enter** re-runs search and scrolls |
| **Highlight** | Keywords highlighted in user text, Markdown, thinking, and tool output; active match emphasized |

### UI details

- Code highlighting (highlight.js, bundled offline)
- Copy button on code blocks
- “Tool calls only” filter in the conversation header
- Data directory path shown in the header (`~/.claude` or `~/.cursor` depending on source)

---

## Data paths

| Source | Path | Content |
|--------|------|---------|
| Claude Code | `~/.claude/sessions/*.json` | Session metadata |
| Claude Code | `~/.claude/projects/{slug}/{sessionId}.jsonl` | Main conversation |
| Claude Code | `.../{sessionId}/subagents/*.jsonl` | Sub-agent runs |
| Cursor | `~/.cursor/projects/{slug}/agent-transcripts/{id}/{id}.jsonl` | Agent transcript |
| Cursor | `.../subagents/*.jsonl` | Sub-agent transcripts |

Project slugs like `-Users-you-code-project` are decoded to readable paths in the UI.

---

## Installation

### Requirements

- **Node.js** 18+
- **npm** (or compatible package manager)
- Existing local data under `~/.claude` and/or `~/.cursor` (optional; empty state if missing)

### Steps

```bash
git clone https://github.com/wonderomg/claude-history-viewer.git
cd claude-history-viewer   # or board/claude-history-viewer
npm install
```

---

## Usage

1. Run `npm run dev` or `npm start` (after build).
2. In the sidebar, choose **Claude Code**, **Cursor**, or **All**.
3. Pick a session from the list (main sessions and sub-agents).
4. Use the top **global search** for keywords across sessions.
5. Use **in-session search** with ◀ ▶ to walk through every occurrence.
6. Switch **Chat / Raw JSON**, export Markdown, or toggle theme / language from the header.

### API (local)

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health + data directory paths |
| `GET /api/sessions?source=all\|claude\|cursor` | Session list |
| `GET /api/sessions/:id` | Parsed messages + meta |
| `GET /api/sessions/:id/search?q=` | In-session search (`matches`, `hits`, `total`) |
| `GET /api/sessions/:id/raw` | Raw JSONL lines |
| `GET /api/sessions/:id/export` | Markdown download |
| `GET /api/search?q=&source=` | Cross-session search |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | API bind address; keep default for local-only access; use `0.0.0.0` for LAN |
| `PORT` | `3747` | Express API / production static server |
| `VITE_PORT` | `5173` | Vite dev server (see `vite.config.js`) |
| `NODE_ENV` | — | Set to `production` for `npm start` |
| `NO_OPEN_BROWSER` | — | `1` or `true` to skip opening browser on start |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vue 3, Vite, Tailwind CSS, markdown-it, highlight.js |
| **Backend** | Node.js, Express (read-only filesystem access) |
| **i18n** | Custom `messages.js` + `useLocale` composable |

---

## Data privacy

**Runs fully offline.** The server only reads files under your home directory (`~/.claude`, `~/.cursor`). Nothing is uploaded to third-party services by this app.

**Important**

- Conversation files may contain **secrets pasted in chat**, internal paths, and proprietary code — the viewer will display them.
- The API has **no authentication** and binds to **`127.0.0.1` by default**. Do not expose the service to untrusted networks without a reverse proxy and auth.
- Exporting Markdown copies session content to a file you choose — handle exports like any sensitive document.

---

## FAQ

| Question | Answer |
|----------|--------|
| “Cannot connect to backend” | Run `npm run dev` from `claude-history-viewer`; ensure port `3747` is free |
| No sessions listed | Confirm `~/.claude` or `~/.cursor` exists and contains history from those tools |
| Global search panel won’t reopen | Click the search box again (mousedown retriggers search); results hide when clicking outside |
| Highlights / scroll out of sync | Press **Enter** in in-session search, or use ◀ ▶ after Markdown finishes rendering |
| Disable auto-open browser | `NO_OPEN_BROWSER=1 npm run dev` |

---

## Limitations

Compared to full-featured desktop history viewers:

- Only **Claude Code** and **Cursor** (not Gemini, Codex, Cline, etc.)
- **Web UI only** — no native desktop installer
- No analytics dashboard, token/cost charts, or live file watcher SSE
- No session delete/rename or screenshot export

This project targets a **small, hackable** codebase for local inspection and search.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

If this project helps you, please give it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=wonderomg/claude-history-viewer&type=Date)](https://star-history.com/#wonderomg/claude-history-viewer&Date)

</div>
