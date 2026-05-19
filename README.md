<div align="center">

# claude-history-viewer

**轻量级本地 Web 查看器，用于浏览 Claude Code 与 Cursor 会话历史。**

从 `~/.claude` 与 `~/.cursor` 读取对话记录，支持浏览、搜索与导出 — **完全离线**，无云端、无遥测。

[![Stars](https://img.shields.io/github/stars/wonderomg/claude-history-viewer?style=flat&color=yellow)](https://github.com/wonderomg/claude-history-viewer/stargazers)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**语言**: [中文 (简体)](README.md) | [English](README.en-US.md)

</div>

<p align="center">
  <img width="80%" alt="History" src="https://raw.githubusercontent.com/wonderomg/claude-history-viewer/master/claude-history-viewer.png" />
</p>

## 快速开始

需要 **Node.js 18+**。本机可选已有 `~/.claude` / `~/.cursor` 历史数据。

### 从 npm 使用（推荐）

```bash
npx claudecode-history-viewer
```

或全局安装后执行：

```bash
npm install -g claudecode-history-viewer
claudecode-history-viewer
```

浏览器访问 **http://localhost:3747**。禁用自动打开：`NO_OPEN_BROWSER=1 npx claudecode-history-viewer`

### 从 GitHub 克隆（开发 / 改代码）

```bash
git clone https://github.com/wonderomg/claude-history-viewer.git
cd claude-history-viewer
npm install
npm run build && npm start
```

开发调试（热更新）：在源码目录执行 `npm run dev` → http://localhost:5173

---

## 免责声明

独立开源项目，与 **Anthropic**、**Cursor** 无官方关系；相关名称为各自商标。仅只读本机历史文件。

---

## 功能

| 功能 | 说明 |
|------|------|
| 双来源 | 侧栏 **全部 / Claude Code / Cursor**，搜索随来源过滤 |
| 会话列表 | 按项目筛选、Sub-agent 树形展开 |
| 对话渲染 | 用户 / Markdown / Thinking / Tool Call & Result |
| 搜索 | 跨会话 + 会话内（高亮、`上一处/下一处`、回车定位） |
| 其他 | 原始 JSONL、导出 Markdown、深浅主题、中/英文界面 |

---

## 数据路径

| 来源 | 路径 | 内容 |
|------|------|------|
| Claude Code | `~/.claude/sessions/*.json` | 会话元数据 |
| Claude Code | `~/.claude/projects/{slug}/{sessionId}.jsonl` | 主对话 |
| Claude Code | `.../{sessionId}/subagents/*.jsonl` | Sub-agent |
| Cursor | `~/.cursor/projects/{slug}/agent-transcripts/{id}/{id}.jsonl` | Agent 对话 |
| Cursor | `.../subagents/*.jsonl` | Sub-agent |

项目 slug（如 `-Users-you-code-project`）会在界面中还原为可读路径。

---

## 配置

| 变量 | 默认 | 说明 |
|------|------|------|
| `HOST` | `127.0.0.1` | API 监听地址 |
| `PORT` | `3747` | API / 生产静态服务端口 |
| `VITE_PORT` | `5173` | Vite 开发端口 |
| `NO_OPEN_BROWSER` | — | `1` 禁用自动打开浏览器 |

---

## 本地 API

`GET /api/health` · `GET /api/sessions?source=` · `GET /api/sessions/:id` · `GET /api/sessions/:id/search?q=` · `GET /api/sessions/:id/raw` · `GET /api/sessions/:id/export` · `GET /api/search?q=&source=`

---

## 隐私与安全

- 仅读取 `~/.claude`、`~/.cursor`，不上传云端
- 对话中可能含密钥与内部信息，界面会如实展示
- API 无鉴权，默认仅本机；勿暴露到不可信网络

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 无法连接后端 | 确认已运行 `npx claudecode-history-viewer` 或 `npm start`，端口 `3747` 未被占用 |
| 列表为空 | 确认对应目录存在且已有工具产生的历史 |
| 搜索/高亮不准 | 会话内搜索按 **回车** 或等渲染后用 ◀ ▶ |

---

## 局限性

仅支持 Claude Code 与 Cursor；Web 界面；无 Token 统计、实时监听、会话增删改。

---

## 许可证

[MIT License](LICENSE)

---

<div align="center">

如果这个项目对您有帮助，请给它一个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=wonderomg/claude-history-viewer&type=Date)](https://star-history.com/#wonderomg/claude-history-viewer&Date)

</div>
