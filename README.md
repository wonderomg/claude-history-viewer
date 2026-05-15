<div align="center">

# claude-history-viewer

**轻量级本地 Web 查看器，用于浏览 Claude Code 与 Cursor 会话历史。**

从 `~/.claude` 与 `~/.cursor` 读取对话记录，支持浏览、搜索与定位 — **完全离线**，无云端、无遥测。

[![Stars](https://img.shields.io/github/stars/wonderomg/claude-history-viewer?style=flat&color=yellow)](https://github.com/wonderomg/claude-history-viewer/stargazers)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**语言**: [中文 (简体)](README.md) | [English](README.en-US.md)

</div>

---

<p align="center">
  <img width="49%" alt="History" src="https://raw.githubusercontent.com/wonderomg/claude-history-viewer/master/claude-history-viewer.png" />
</p>



## 快速开始

```bash
cd claude-history-viewer
npm install
npm run dev
```

| 模式 | 地址 | 说明 |
|------|------|------|
| 开发 | http://localhost:5173 | Vite 前端；`/api` 代理到后端 |
| API（后端） | http://localhost:3747 | Express 扫描本地文件 |

启动后会自动打开浏览器（macOS / Windows / Linux）。禁用：`NO_OPEN_BROWSER=1 npm run dev`。

**生产环境**

```bash
npm run build
npm start
# → http://localhost:3747
```

或者在仓库目录 `claude-history-viewer/` 下也可：

```bash
npm run dev    # 转发到 claude-history-viewer
```

---

## 为什么做这个

各类 AI 助手会把大量对话写在本地磁盘上，但缺少一个统一界面来**回顾 Claude Code 与 Cursor 的历史**。本工具直接读取 JSONL 转录文件，以对话流形式展示，并支持搜索与导出 ，采用更精简的 **Vue + Express** 栈，便于本地快速使用。

| 来源 | 数据位置 | 可查看内容 |
|------|----------|------------|
| **Claude Code** | `~/.claude/sessions/`、`~/.claude/projects/` | 会话元数据、主对话、Sub-agent |
| **Cursor** | `~/.cursor/projects/.../agent-transcripts/` | Agent 转录、Sub-agent |

查看过程不依赖云端：文件留在本机，应用仅本地只读访问。

---

## 免责声明

本项目为独立开源工具，与 **Anthropic**、**Cursor** 及其关联方**无隶属、赞助或官方关系**。Claude、Cursor 等名称均为各自所有者的商标。本工具仅只读访问您本机上的历史文件，不提供、不代理上述产品的任何官方服务。

---

## 目录

- [功能特性](#功能特性)
- [数据路径](#数据路径)
- [安装](#安装)
- [使用方法](#使用方法)
- [配置](#配置)
- [技术栈](#技术栈)
- [数据隐私](#数据隐私)
- [常见问题](#常见问题)
- [局限性](#局限性)
- [许可证](#许可证)

---

## 功能特性

### 核心

| 功能 | 说明 |
|------|------|
| **双来源** | 侧栏切换 **全部 / Claude Code / Cursor**；跨会话搜索随来源过滤 |
| **会话列表** | 按项目筛选、标题/路径搜索、可隐藏 Sub-agent；主会话下树形展开 Sub-agent |
| **对话渲染** | 用户气泡、助手 Markdown、Thinking（可折叠）、Tool Call / Tool Result |
| **原始 JSONL** | 按行浏览 JSON，支持类型筛选 |
| **导出** | 当前会话导出为 Markdown |
| **主题** | 浅色 / 深色切换，过渡动画 |
| **多语言** | 界面 **中文** / **English**（设置 → 语言） |

### 搜索

| 功能 | 说明 |
|------|------|
| **跨会话搜索** | 顶栏搜索；点击结果打开会话并定位到首个匹配 |
| **会话内搜索** | 显示 `当前 / 总数`；**上一处 / 下一处** 箭头；**回车** 重新检索并滚动定位 |
| **关键词高亮** | 用户文本、Markdown、Thinking、工具输出中高亮；当前匹配项加强显示 |

### 其他

- 代码高亮（highlight.js，离线打包）
- 代码块一键复制
- 对话区「仅 Tool Calls」过滤
- 顶栏显示当前数据目录（`~/.claude` 或 `~/.cursor`）

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

## 安装

### 环境要求

- **Node.js** 18+
- **npm**（或兼容的包管理器）
- 本机已有 `~/.claude` 和/或 `~/.cursor` 数据（可选；无数据时显示空状态）

### 步骤

```bash
git clone https://github.com/wonderomg/claude-history-viewer.git
cd claude-history-viewer   # 或 board/claude-history-viewer
npm install
```

---

## 使用方法

1. 执行 `npm run dev` 或构建后 `npm start`。
2. 在侧栏选择 **Claude Code**、**Cursor** 或 **全部**。
3. 在列表中点击会话（主会话与 Sub-agent 均可）。
4. 使用顶栏 **跨会话搜索** 查找关键词。
5. 使用 **会话内搜索**，配合 ◀ ▶ 在每一处匹配间跳转。
6. 可切换 **对话 / 原始 JSON**、导出 Markdown，或在顶栏切换主题与语言。

### 本地 API

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 健康检查与数据目录路径 |
| `GET /api/sessions?source=all\|claude\|cursor` | 会话列表 |
| `GET /api/sessions/:id` | 解析后的消息与元数据 |
| `GET /api/sessions/:id/search?q=` | 会话内搜索（`matches`、`hits`、`total`） |
| `GET /api/sessions/:id/raw` | 原始 JSONL 行 |
| `GET /api/sessions/:id/export` | 下载 Markdown |
| `GET /api/search?q=&source=` | 跨会话搜索 |

---

## 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOST` | `127.0.0.1` | API 监听地址；仅本机访问请保持默认，局域网访问可设为 `0.0.0.0` |
| `PORT` | `3747` | Express API / 生产静态服务端口 |
| `VITE_PORT` | `5173` | Vite 开发端口（见 `vite.config.js`） |
| `NODE_ENV` | — | `npm start` 时设为 `production` |
| `NO_OPEN_BROWSER` | — | 设为 `1` 或 `true` 则不自动打开浏览器 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Vue 3、Vite、Tailwind CSS、markdown-it、highlight.js |
| **后端** | Node.js、Express（只读本地文件系统） |
| **国际化** | `messages.js` + `useLocale` |

---

## 数据隐私

**完全本地运行。** 服务仅读取用户目录下的 `~/.claude`、`~/.cursor`，不会由本应用主动上传到第三方。

**请注意**

- 对话文件中可能包含**曾在聊天中粘贴的密钥**、内部路径与业务代码，查看器会如实展示。
- API **无鉴权**，默认绑定 `127.0.0.1`；请勿在未加反向代理与认证的情况下将服务暴露到不可信网络。
- 导出 Markdown 会将会话内容写入你选择的文件，请按敏感文档妥善保管。

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 提示「无法连接后端」 | 在 `claude-history-viewer` 目录执行 `npm run dev`；确认 `3747` 端口未被占用 |
| 列表为空 | 确认 `~/.claude` 或 `~/.cursor` 存在且已有对应工具产生的历史 |
| 跨会话结果面板不出现 | 再次点击搜索框（按下鼠标会重新检索）；点击页面其他区域会关闭面板 |
| 高亮或滚动不准 | 在会话内搜索框按 **回车**，或等 Markdown 渲染后用 ◀ ▶ |
| 禁止自动打开浏览器 | `NO_OPEN_BROWSER=1 npm run dev` |

---

## 局限性

与完整桌面版查看器相比：

- 仅支持 **Claude Code** 与 **Cursor**（不含 Gemini、Codex、Cline 等）
- 仅 **Web 界面**，无原生安装包
- 无 Token/成本统计、分析仪表板、SSE 实时监听
- 不支持删除/重命名会话、长截图导出等

本项目侧重 **代码量小、易改** 的本地查阅与搜索场景。

---

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

<div align="center">

如果这个项目对您有帮助，请给它一个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=wonderomg/claude-history-viewer&type=Date)](https://star-history.com/#wonderomg/claude-history-viewer&Date)

</div>
