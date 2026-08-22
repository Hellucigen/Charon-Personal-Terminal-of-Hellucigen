# 🖥️ Personal Terminal · 个人终端

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go" alt="Go version">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React version">
  <img src="https://img.shields.io/badge/Wails-v2-DF0000?logo=wails" alt="Wails">
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <b>一个本地优先的桌面 "Life OS"</b> — 第二大脑 + 生活仪表盘 + 工具箱，<br/>
  全部装在一个 Wails 构建的原生窗口中。
</p>

<p align="center">
  <i>工业分析仪表盘 · 浅色基底 · 橙 + 青绿双强调 · Share Tech Mono 数据语言 · 键盘优先 · 细边框无圆角 · 网格纹理 · 等宽数字</i>
</p>

```
▟█▙ PERSONAL
▜█▛ TERMINAL  v0.1
```

---

## 📋 项目简介

Personal Terminal 是一个跨平台桌面应用，将约 22 个个人知识管理和生活操作系统模块整合在 `Ctrl+K` 命令面板背后。**一切数据本地优先** — SQLite + FTS5 管理结构化数据，本地工作区文件夹存放媒体文件。不上云，除非你主动选择。

> 🧠 **AI 项目实践 (AI Project Practicum)**：本项目同时也是 **Fascinator** 认知架构的操作控制台。Fascinator 是一个独立的 Python AI 项目，实现了统一知识图谱 + 扩散激活 + 程序性记忆动作队列 + Searle 言语行为分类。Personal Terminal 负责启动 Flask 后端、追踪日志、编辑配置，并让你从 UI 中直接向扩散激活引擎发送自然语言输入。


---

## 🏗️ 三个子项目（架构分层）

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| **🔧 Go 后端** (`backend/`) | Go 1.25 + SQLite (WAL/FTS5) + Wails v2 | 数据库层、事件总线、REST 代理、Fascinator 进程管控、插件扫描 |
| **🎨 React 前端** (`frontend/`) | React 18 + TypeScript + Vite + Tailwind + Zustand + Tiptap | 22 个功能模块、命令面板、工业仪表盘 UI、Framer Motion 动画 |
| **🧩 插件系统** (`plugins/`) | 沙盒化 iframe + `plugin.json` 清单 | 面板/命令/后台/块四种插件类型，权限模型隔离 |

---

## Module map · v0.2 全模块可用

### Core
- **Dashboard** — greeting, today's overview, Fascinator status, recent fleeting stream
- **Fascinator** — full cognitive console: 80+ API endpoints across 11 tabs (graph canvas with node/edge CRUD, NLP, diffusion engine, action queue, self model, episodic buffer, knowledge packs, ear/vision, chat log, config)

### Knowledge
- **Notes** — Notion-style block editor (Tiptap) with sub-templates: blank · dream · weapon · anime · game · movie · book · poem · plant · wishlist · want-game · password · detective · travel · institute · study. Wiki-links (`[[title]]`), full-text search, backlinks.
- **Fleeting** — Ctrl+Alt+N hotkey, waterfall stream, promote-to-note workflow
- **Detective Board** — red-string corkboard on an SVG canvas: draggable person/place/event/evidence/theory cards, confirmed/suspect/ruled-out relations, JSON export
- **Travel** — trips + daily entries (mood / spend / GPS), mini-map footprint, spending auto-posts to Finance
- **Institute** — Fallout-4-flavoured "company of one": departments, action kanban (active/hold/done + progress), phase milestones; completing actions awards XP

### Ops
- **Todo** — MS-Todo-style lists (Today / Important / Planned / Inbox), due-soon polling for toasts
- **Shortcuts** — folder/URL/.lnk launcher, one-click open in Explorer / Terminal / VSCode
- **Bookmarks** — folder tree + Edge HTML import
- **Passwords** — AES-256-GCM vault behind a PBKDF2 master passphrase, Edge CSV import, strength/duplicate flags, clipboard auto-clear
- **Network** — IP/DNS/ping, Base64/URL/MD5/SHA/JSON encoders, regex tester, mini-Postman

### Life
- **Learning** — SRS flashcards (simplified SM-2), JSON/CSV import, graded review, due counts; reviews award XP
- **Music** — local library scan (mp3/flac/m4a/wav), system-player playback, podcast RSS subscriptions with episode lists
- **Finance** — manual + Alipay/WeChat CSV import (GBK auto-detected), monthly & category summaries, subscriptions with next-due warnings
- **Health** — ad-hoc habits (weight/sleep/water/exercise), streaks, latest values, trend sparklines
- **Creative** — moodboards (colors / text / image refs) + writing sessions with daily word goal (words → XP)
- **Time** — pomodoro timer (auto-saved, XP on focus), time-block day view, Windows foreground-app usage tracking
- **RPG** — XP + level curve, six life stats radar (体力/智力/创造/社交/财力/意志), achievements incl. auto-check
- **Data** — cross-module overview tiles, GitHub-style activity heatmap, auto year-in-review, full JSON export
- **Diary** — one-line-a-day with mood, history, on-this-day, week/month/year auto-summaries

### System
- **Plugins** — drop a folder into `~/.personal-terminal/plugins/` and it loads
- **Settings** — theme accent (cyan · magenta · violet · lime · amber · rose), locale, AI key, Fascinator paths, bridge info

### Reverse Bridge（让 Fascinator 操作 Charon）
Charon 内嵌 token 鉴权的本机 HTTP API（`127.0.0.1:17734`）：创建笔记/待办/碎片、记账、写日记、
钉侦探板卡片、弹 toast、推送事件、跨模块统计。Fascinator 的动作引擎可以直接调用。
详见 [`docs/FASCINATOR_INTEGRATION.md`](docs/FASCINATOR_INTEGRATION.md) §8。

---

## 🚀 快速开始

### 环境要求

| 工具 | 最低版本 | 检查命令 |
|------|---------|----------|
| Go | 1.22+ | `go version` |
| Node.js | 18 LTS | `node -v` |
| Wails CLI | v2.9+ | `wails doctor` |

### 安装运行

```bash
# 1. 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 2. 检查系统依赖
wails doctor

# 3. 克隆仓库
git clone https://github.com/Hellucigen/Charon-Personal-Terminal-of-Hellucigen.git
cd Charon-Personal-Terminal-of-Hellucigen

# 4. 安装前端依赖
cd frontend && npm install && cd ..

# 5. 开发模式（Go + React 热重载）
wails dev

# 6. 生产构建
wails build          # → build/bin/PersonalTerminal.exe
```

📖 平台工具链、签名、分发详见 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## ⌨️ 全局快捷键

- **`Ctrl+K`** — 命令面板：跳转到任意模块、切换主题色、触发 AI 查询
- **`Ctrl+Alt+N`** — 捕捉碎片想法，无需离开当前工作
- **托盘菜单** — 快速访问今日待办、番茄钟状态、Fascinator 开关
- **Toast 通知** — `go-toast` 驱动的到期待办和习惯提醒

---

## 🔌 插件系统

Personal Terminal 天生可扩展。插件是包含 `plugin.json` 清单和 `index.js` 入口的简单文件夹，加载到沙盒化 iframe 中运行：

```js
export default function activate(pt) {
  return {
    async mount(root) {
      const notes = await pt.notes.list({ limit: 5 });
      root.innerHTML = `<ul>${notes.map(n => `<li>${n.title}</li>`).join("")}</ul>`;
    }
  };
}
```

四种插件类型：`panel`（全页面）· `command`（命令面板）· `background`（后台服务）· `block`（编辑器块）。宿主根据清单中声明的权限强制执行访问控制（`notes:read`、`fleeting:capture`、`fascinator:call` 等）。

📖 完整参考：[`docs/PLUGIN_DEVELOPMENT.md`](docs/PLUGIN_DEVELOPMENT.md)

---

## 🤖 Fascinator AI 集成

Fascinator 是一个独立的 Python 认知架构项目，实现了：

| 组件 | 文件 | 功能 |
|------|------|------|
| Flask API | `app.py` | `/api/*` 端点 |
| 知识图谱 | `graph_model.py` | Node/Edge + JSON 持久化 |
| 扩散激活引擎 | `diffusion_engine.py` | `a(v,t+1) = (1-λ)·a(v,t) + Σ a(u,t)·w̃_uv·β / |N⁺(u)|` |
| NLP 处理器 | `nlp_processor.py` | jieba 分词 + Claude API → 节点/边/言语行为分类 |
| 配置 | `config.py` | λ_decay, β_spread, k_top, θ_action 等超参数 |

Personal Terminal 作为操作控制台：启动/停止子进程 → 追踪日志 → 查看 Top-k 候选节点和动作队列 → 编辑引擎配置 → 向图谱发送中文 NLP 输入。

📖 详见：[`docs/FASCINATOR_INTEGRATION.md`](docs/FASCINATOR_INTEGRATION.md)

```bash
# 一次性配置 Fascinator 环境
cd ~/code/fascinator
python -m venv .venv && source .venv/bin/activate
pip install flask flask-cors jieba sentence-transformers anthropic
export ANTHROPIC_API_KEY=sk-ant-...
# 然后在 Personal Terminal → Settings → FASCINATOR 中配置 Python 和 app.py 路径
```

---

## Filesystem layout (after first run)

```
~/.personal-terminal/
  ├─ config.json
  ├─ terminal.db       # SQLite, WAL, FTS5
  ├─ media/           # everything referenced by notes
  ├─ plugins/         # drop plugin folders here
  └─ logs/
```

To move to a new machine, copy the whole folder. No registry, no AppData, no leftover state.

---

## Project layout

```
personal-terminal/
├─ main.go                  # Wails entry point
├─ app.go                   # App struct: startup, migrations, shutdown
├─ wails.json               # Wails project config
├─ go.mod
├─ backend/
│  ├─ core/                 # Config, EventBus, plugin manifest types
│  ├─ db/                   # SQLite open + migrations
│  ├─ bridge/               # reverse HTTP API — Fascinator operates Charon
│  └─ modules/              # Service structs bound to the frontend
│     ├─ fascinator.go      # Fascinator process control + REST proxy
│     ├─ notes.go           # CRUD + FTS + backlinks
│     ├─ todo.go            # lists + due-soon polling
│     ├─ fleeting.go        # capture + stream + promote-to-note
│     ├─ shortcuts.go       # add/open/delete + cross-platform open
│     ├─ bookmarks.go       # CRUD + Edge HTML import
│     ├─ plugins.go         # scan ~/.personal-terminal/plugins/
│     ├─ passwords.go       # AES-256-GCM vault + Edge CSV import
│     ├─ detective.go       # red-string board nodes/edges
│     ├─ travel.go          # trips + entries (+ posts spend to finance)
│     ├─ institute.go       # departments / actions / phases
│     ├─ learning.go        # SM-2 flashcards + import
│     ├─ music.go           # library scan + podcast RSS
│     ├─ finance.go         # transactions + CSV import + subscriptions
│     ├─ health.go          # habit logs, streaks, overview
│     ├─ diary.go           # one-line-a-day + auto summaries
│     ├─ creative.go        # moodboards + writing sessions
│     ├─ nettools.go        # ping/DNS/encode/regex/mini-postman
│     ├─ timetrack.go       # pomodoro + blocks + foreground polling
│     ├─ rpg.go             # XP / levels / achievements (awardXP hook)
│     └─ analytics.go       # overview / heatmap / year review / export
├─ frontend/
│  ├─ index.html
│  ├─ src/
│  │  ├─ main.tsx · App.tsx
│  │  ├─ components/        # Sidebar · TopBar · CommandPalette · FleetingDrawer · GlassPanel
│  │  ├─ modules/           # Dashboard · Fascinator · Notes · Todo · Fleeting · ... · Stubs
│  │  ├─ lib/               # api bridge, module catalogue
│  │  ├─ store/             # Zustand
│  │  └─ styles/            # design-tokens.css + globals.css
│  └─ package.json
├─ plugins/
│  ├─ example-plugin/       # minimal panel plugin
│  └─ README.md
└─ docs/
   ├─ DEPLOYMENT.md             ← read this to ship
   ├─ PLUGIN_DEVELOPMENT.md     ← read this to extend
   └─ FASCINATOR_INTEGRATION.md ← read this to wire Fascinator
```

---

## 🛠️ 技术栈

| 层级 | 技术选型 |
|------|----------|
| 桌面壳 | **Wails v2** (Go + WebView2) |
| 后端 | Go 1.25, `modernc.org/sqlite` (纯 Go SQLite, WAL + FTS5), `go-toast` |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 富文本编辑器 | Tiptap (StarterKit + TaskList + Image + Link + CodeBlock) |
| 图标 | Lucide React（仅线性图标） |
| 动画 | Framer Motion + CSS keyframes |
| 字体 | Share Tech Mono（数据）· Barlow Semi Condensed（界面）· Noto Sans SC |

---

## 🎨 设计原则

1. **本地优先** — 数据在你的磁盘上，格式可用 `cat` 和 `sqlite3` 直接读取。云端为可选模块。
2. **键盘优先** — 每个操作都可通过 `Ctrl+K` 触达。鼠标是便利，不是必需。
3. **工业仪表盘（对齐 Fascinator STYLE_GUIDE.md）** — 浅色基底 `#f4f4f4` + 32px 线网格；模块卡片 `#fafafa` + 1px 边框；全局圆角仅 2px，阴影只出现在模态框。
4. **双强调色** — 橙 `#ff6b00` = 动作/用户/高激活；青绿 `#00d2d3` = 焦点/系统侧。输入焦点一律青绿边框，主按钮为唯一橙色实心。
5. **铭牌排版** — 界面标签全部大写 + 字距（Share Tech Mono 做数据语言 / Barlow Semi Condensed 做界面语言）；状态灯为方形指示灯。
6. **等宽数字** — 计数、时间戳、时长、哈希——所有数字 `font-variant-numeric: tabular-nums`。
7. **默认可扩展** — 核心模块之外（笔记/Todo/Fleeting/Fascinator）都可以被迁移为插件。

---

## 🙏 致谢

- **Fascinator** — 本项目是其操作控制台
- **Wails** — 让 Go 桌面应用开发变得愉快
- **Lucide** — 唯一适合此美学风格的图标库
- 设计语言参考了 Linear、Arc、Vercel 文档，以及每一部在银幕上滚动绿字的赛博朋克终端

---

## 📄 License

MIT License — 详见 `LICENSE` 文件。
