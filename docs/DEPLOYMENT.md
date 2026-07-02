# DEPLOYMENT · 部署指南

Personal Terminal is a Wails v2 application. The deliverable is a single platform-native executable that bundles the Go binary, the SQLite driver, and the React/TS frontend assets.

---

## 1. Prerequisites

| Tool | Minimum | Notes |
|------|---------|-------|
| Go | **1.22** | `go version` |
| Node.js | **18 LTS** | `node -v` — only needed during build |
| npm or pnpm | latest | npm 9+ ships with Node 18 |
| Wails CLI | **v2.9+** | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| Platform toolchain | see below | needed for the webview backend |

After installing Wails, run:

```bash
wails doctor
```

`wails doctor` prints a green/red status per dependency. Fix everything red before continuing.

### Platform-specific toolchains

- **Windows 10/11**
  - WebView2 Runtime (preinstalled on Win11; the installer prompts on Win10).
  - For toast notifications: nothing extra — `go-toast` ships with the binary.
  - Optional but recommended: Visual Studio Build Tools (for cgo / `mattn/go-sqlite3`).
- **macOS 12+**
  - Xcode command-line tools: `xcode-select --install`.
- **Linux**
  - `webkit2gtk-4.0-dev` and `libgtk-3-dev` (Debian/Ubuntu). For Fedora/Arch see the Wails docs.

---

## 2. Development loop

```bash
git clone <repo> personal-terminal
cd personal-terminal/frontend
npm install
cd ..
wails dev
```

`wails dev` runs the Vite dev server, embeds it in a native window, and hot-reloads both Go and React on save. Open the developer tools with `F12` / `Cmd+Opt+I` inside the window.

If you only want to iterate on the UI without Go bindings, run the frontend on its own:

```bash
cd frontend
npm run dev      # http://localhost:5173 with a mock backend (see src/lib/api.ts)
```

The bridge in `frontend/src/lib/api.ts` automatically detects whether `window.go` exists. If not, every backend call is satisfied by the in-memory mock, so the entire UI stays usable for design work without a running Go process.

---

## 3. Production build

```bash
# from the repo root
wails build
```

Output:

| Platform | Path | Notes |
|----------|------|-------|
| Windows | `build/bin/personal-terminal.exe` | ~28 MB, self-contained |
| macOS | `build/bin/personal-terminal.app` | unsigned by default |
| Linux | `build/bin/personal-terminal` | AppImage with `wails build -upx` |

Useful flags:

- `wails build -clean` — wipe `build/` first.
- `wails build -obfuscated` — Garble the Go binary (no symbols).
- `wails build -upx` — UPX-pack on Linux/Windows (3-5× smaller binary, slower cold-start).
- `wails build -nsis` — emit a Windows NSIS installer alongside the EXE.

---

## 4. Signing & distribution

### Windows
- Sign with `signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a personal-terminal.exe`.
- Without a code-signing certificate Windows SmartScreen will block first-launch. Either purchase an EV cert or instruct users to click "More info → Run anyway".

### macOS
- Sign: `codesign --deep --force --options runtime --sign "Developer ID Application: Your Name" personal-terminal.app`.
- Notarize via `xcrun notarytool submit ... --wait`.
- Distribute as a DMG: `hdiutil create -volname "Personal Terminal" -srcfolder personal-terminal.app -ov out.dmg`.

### Linux
- AppImage works out of the box for most distros. For deb/rpm see Wails' [docs/reference/cli](https://wails.io/docs/reference/cli).

---

## 5. First-run filesystem layout

On first launch Personal Terminal creates this tree in the user's home directory. Everything is local-first.

```
~/.personal-terminal/
  ├─ config.json          # workspace, paths, AI key, theme, locale
  ├─ data.db              # SQLite (WAL mode, FTS5 enabled)
  ├─ media/               # images, audio, video, files referenced by notes
  ├─ plugins/             # drop plugin folders here
  └─ logs/                # rolling app log
```

To migrate to a new machine, copy the whole `~/.personal-terminal/` tree. Nothing else is needed.

---

## 6. Fascinator deployment

The Fascinator backend is a separate Python process. Personal Terminal launches it as a subprocess via the `FascinatorService`. See [`FASCINATOR_INTEGRATION.md`](FASCINATOR_INTEGRATION.md) for the full integration story; the deployment-relevant bits:

```bash
# install Fascinator's Python deps once
cd ~/code/fascinator
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Then in Personal Terminal → Settings → Fascinator, point at:

- Python executable (e.g. `~/code/fascinator/.venv/bin/python`)
- `app.py` (e.g. `~/code/fascinator/app.py`)
- Port (default 5000)

Click the Fascinator module's `启动` button and you're done.

---

## 7. Troubleshooting

- **`wails build` fails with "cgo: C compiler not found"** — install your platform's build tools (above).
- **`mattn/go-sqlite3` won't compile** — same as above. Ensure `CGO_ENABLED=1`.
- **Windows toast notifications don't show** — check that "Notifications" is enabled for the app in Windows Settings → System → Notifications.
- **Webview shows blank screen on Win10** — install the latest WebView2 Runtime from Microsoft.
- **`wails dev` hot-reload not working on Linux** — `webkit2gtk` 2.40+ ships a bug; downgrade or wait for 2.42.
