
>
> **Cyberpunk-lite · Linear.app aesthetic · Arc Browser polish · keyboard-first · dark with neon accents · glassmorphism but restrained · ASCII / line icons only · monospaced numerals.**

```
▟█▙ PERSONAL
▜█▛ TERMINAL  v0.1
```

---

## What it is

Personal Terminal is a single cross-platform desktop app that consolidates ~22 personal-knowledge and life-OS modules behind one Ctrl+K palette. Everything is **local-first** — SQLite + FTS5 for structured data, a workspace folder for media. No cloud unless you opt in.

It also acts as the launcher and control surface for **[Fascinator](docs/FASCINATOR_INTEGRATION.md)**, a separate Python cognitive-architecture project (knowledge graph + spreading activation + procedural-memory action queue). Personal Terminal launches the Flask backend, tails its logs, edits its config, and lets you fire natural-language input at the spreading-activation engine right from the UI.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Desktop shell | **Wails v2** (Go + WebView) |
| Backend | Go 1.22, `mattn/go-sqlite3` (WAL + FTS5), `go-toast` for Windows notifications |
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| State | Zustand |
| Editor | Tiptap (StarterKit + TaskList + Image + Link) |
| Icons | Lucide (line-icons only — no emoji clutter in UI) |
| Anim | Framer Motion + CSS keyframes |
| Fonts | Inter · JetBrains Mono · Source Han Sans · Space Grotesk (display) |

---

## Module map

### Core
- **Dashboard** — greeting, today's overview, Fascinator status, recent fleeting stream
- **Fascinator** — launcher, log tail, NLP input, Top-k & action queue, config editor

### Knowledge
- **Notes** — Notion-style block editor (Tiptap) with sub-templates: blank · dream · weapon · anime · game · movie · book · poem · plant · wishlist · want-game · password · detective · travel · institute · study. Wiki-links (`[[title]]`), full-text search, backlinks.
- **Fleeting** — Ctrl+Alt+N hotkey, waterfall stream, promote-to-note workflow
- **Detective Board** *(stub)* — free canvas, red-string node graph
- **Travel** *(stub)* — timeline + map view + EXIF photo placement
- **Institute** *(stub)* — Fallout 4 inspired "company of one" with departments / actions / phases

### Ops
- **Todo** — MS-Todo-style lists (Today / Important / Planned / Inbox), Windows toast reminders
- **Shortcuts** — folder/URL/.lnk launcher, one-click open in Explorer / Terminal / VSCode
- **Bookmarks** — folder tree + Edge HTML import + offline snapshot (Chromedp)
- **Passwords** *(stub)* — AES-256-GCM, Edge CSV import, 30 s clipboard auto-clear
- **Network** *(stub)* — IP/DNS/Ping, Base64/JSON/regex tools, mini-Postman

### Life
- **Learning** *(stub)* — flashcards, driving test, AI quiz; 320×200 always-on-top window
- **Music** *(stub)* — local library, Last.fm scrobble, podcast RSS
- **Finance** *(stub)* — Alipay / WeChat CSV import, subscriptions, sankey diagrams
- **Health** *(stub)* — weight / sleep / habit toasts; sleep ↔ dream-journal sync
- **Creative** *(stub)* — Excalidraw, moodboard, focused-writing mode
- **Time** *(stub)* — Pomodoro, time-blocking, RescueTime-style app-time
- **RPG** *(stub)* — XP, six-dimensional life stats, achievements
- **Data** *(stub)* — cross-module dashboards, year-in-review, heatmaps
- **Diary** *(stub)* — one-line-a-day, weekly/monthly auto-summaries

### System
- **Plugins** — drop a folder into `~/.personal-terminal/plugins/` and it loads
- **Settings** — theme accent (cyan · magenta · violet · lime · amber · rose), locale, AI key, Fascinator paths

Modules marked *(stub)* have placeholder UIs; the backend hooks and data tables are scaffolded so plugins can fill them in immediately.

---

## Quick start

```bash
# prerequisites: Go 1.22+, Node 18+, Wails CLI (go install github.com/wailsapp/wails/v2/cmd/wails@latest)

git clone <repo> personal-terminal
cd personal-terminal/frontend
npm install
cd ..
wails dev          # hot-reload dev window
# or
wails build        # → build/bin/personal-terminal{.exe|.app|}
```

For platform toolchain notes, signing, and distribution, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Global UX

- **`Ctrl+K`** — command palette. Jump to any module, switch theme accent, fire AI questions.
- **`Ctrl+Alt+N`** — capture a fleeting thought without leaving what you're doing.
- **Tray menu** — quick access to today's todos, Pomodoro state, Fascinator on/off.
- **Toast** — `go-toast` for due-soon todos and habit reminders.

---

## Plugin system

Personal Terminal is built to be extended. Plugins are simple folders with a `plugin.json` manifest and an `index.js` entry, loaded into a sandboxed iframe and given a frozen `pt` host object:

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

Four kinds — `panel`, `command`, `background`, `block` — cover full-page UI, palette commands, headless workers, and custom notes-editor blocks. The host enforces permissions declared in the manifest (`notes:read`, `fleeting:capture`, `fascinator:call`, etc).

Full reference: [`docs/PLUGIN_DEVELOPMENT.md`](docs/PLUGIN_DEVELOPMENT.md). Working example: [`plugins/example-plugin/`](plugins/example-plugin/).

---

## Fascinator integration

Personal Terminal is a first-class control surface for the Fascinator cognitive architecture (the Python project bundled separately). Once configured under Settings, you can:

- Start, stop, restart the Flask process from the UI.
- Tail stdout/stderr in real time, 2-second refresh.
- Send Chinese sentences at `/api/nlp` and see parsed nodes / edges / Searle speech-act tags.
- Watch the spreading-activation Top-k candidate set update live.
- Single-click execute action-queue items (procedural-memory nodes).
- Edit the engine's hyperparameters (`lambda_decay`, `beta_spread`, `theta_action`, `k_top`, `max_depth`, ...) in a round-trip text editor.

The diagram, endpoint list, and step-by-step setup are all in [`docs/FASCINATOR_INTEGRATION.md`](docs/FASCINATOR_INTEGRATION.md). The TL;DR setup:

```bash
cd ~/code/fascinator
python -m venv .venv && source .venv/bin/activate
pip install flask flask-cors jieba sentence-transformers anthropic
export ANTHROPIC_API_KEY=sk-ant-...
# then in Personal Terminal → Settings → FASCINATOR, point at .venv/bin/python and app.py
```

---

## Filesystem layout (after first run)

```
~/.personal-terminal/
  ├─ config.json
  ├─ data.db          # SQLite, WAL, FTS5
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
│  └─ modules/              # Service structs bound to the frontend
│     ├─ fascinator.go      # Fascinator process control + REST proxy
│     ├─ notes.go           # CRUD + FTS + backlinks
│     ├─ todo.go            # lists + due-soon polling
│     ├─ fleeting.go        # capture + stream + promote-to-note
│     ├─ shortcuts.go       # add/open/delete + cross-platform open
│     ├─ bookmarks.go       # CRUD + Edge HTML import
│     └─ plugins.go         # scan ~/.personal-terminal/plugins/
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

## Design principles

1. **Local-first.** Your data lives on your disk in formats you can read with `cat` and `sqlite3`. Cloud is opt-in per module.
2. **Keyboard-first.** Every action is reachable through Ctrl+K. The mouse is a convenience, not a requirement.
3. **Restrained glassmorphism.** Panels use `backdrop-filter: blur(20px)` over a 5% white tint with a 1 px edge. No giant rounds, no drop shadows, no neon glow except on accent-only elements.
4. **ASCII over emoji.** Headers and section labels use uppercase mono with letter-spacing 0.18em. Status dots are tiny coloured circles, not 🟢.
5. **Monospaced numerals.** Counts, timestamps, durations, hashes — anything numeric — use JetBrains Mono `font-variant-numeric: tabular-nums`.
6. **Extensible by default.** Anything outside the core (notes / todo / fleeting / Fascinator launcher) is a candidate for being moved into a plugin.

---

## Acknowledgments

- **Fascinator** — see the bundled paper. Personal Terminal is its operator's console.
- **Wails** — for making Go-based desktop apps actually pleasant.
- **Lucide** — the only icon family with the right line weight for this aesthetic.
- The general design vocabulary owes to Linear, Arc, Vercel's docs, and every cyberpunk terminal that ever scrolled green text in a movie.

---

## License

MIT. See `LICENSE` (TBD before public release).
