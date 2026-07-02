# PLUGIN DEVELOPMENT · 插件开发指南

Personal Terminal is designed to be extended. Anything that isn't a core "life-OS" primitive (notes, todos, fleeting, fascinator, etc.) is a candidate for a plugin. This document is the contract.

---

## 1. Anatomy of a plugin

```
my-plugin/
├─ plugin.json       # manifest (required)
├─ index.js          # entry (required) — ES module with default export
└─ ... whatever else you need
```

Drop the folder into `~/.personal-terminal/plugins/` and click `RESCAN` in the Plugins module. The manifest is parsed, the entry is loaded into a sandboxed `<iframe srcdoc>` (no Node, no Electron globals), and the plugin's `activate(pt)` is called with the host object.

---

## 2. The manifest — `plugin.json`

```jsonc
{
  "id":          "com.example.hello-world",   // reverse-DNS, globally unique
  "name":        "Hello World",                // human-readable
  "version":     "0.1.0",                      // semver
  "kind":        "panel",                      // see §3
  "entry":       "index.js",                   // relative to the plugin folder
  "icon":        "sparkles",                   // lucide icon name; optional
  "permissions": ["notes:read", "fleeting:capture"],
  "host_min":    "0.1.0",                      // minimum Personal Terminal version
  "description": "Optional one-liner shown in the plugin browser."
}
```

Required fields: `id`, `name`, `version`, `kind`, `entry`. Everything else is optional but recommended.

### Field rules

- `id` — must be unique; conventionally reverse-DNS. The folder name does not need to match.
- `version` — strict semver. The host respects `host_min` when deciding whether to load.
- `kind` — must be one of `panel | command | background | block`. See §3.
- `entry` — a relative path. Must not escape the plugin folder; path traversal is rejected by `PluginsService.LoadEntry`.

---

## 3. Plugin kinds

| Kind | Where it shows up | Lifecycle |
|------|-------------------|-----------|
| **`panel`** | Becomes a full-page module the user can navigate to via the sidebar or Ctrl+K. Receives a root `<div>` and renders into it. | `activate → mount(root) → unmount` |
| **`command`** | Adds entries to the Ctrl+K palette. No UI of its own; runs a function when invoked. | `activate → onInvoke(args)` |
| **`background`** | Headless. Runs an event-loop or timer. Cannot mount UI. Good for sync, watchers, scheduled jobs. | `activate → start() → stop()` |
| **`block`** | Custom block type for the Tiptap notes editor (e.g. a Twitter embed, a math plot, a Spotify card). | `activate → renderBlock(node)` |

The example plugin in `plugins/example-plugin/` is a `panel`.

---

## 4. The host API — what `pt` exposes

Every plugin's `activate(pt)` receives a frozen object. Calls return Promises.

### `pt.notes`
```ts
pt.notes.list({ template?: string; limit?: number }): Promise<Note[]>
pt.notes.get(id: string): Promise<Note | null>
pt.notes.create({ title, template, body, tags }): Promise<Note>
pt.notes.update(note: Note): Promise<void>
pt.notes.search(query: string): Promise<Note[]>
```
Requires permission: `notes:read` or `notes:write`.

### `pt.fleeting`
```ts
pt.fleeting.capture(body: string, tags?: string[], mediaPath?: string): Promise<{id: string}>
pt.fleeting.stream(limit?: number): Promise<Fleet[]>
```
Permission: `fleeting:read` / `fleeting:capture`.

### `pt.todo`
```ts
pt.todo.list(listName?: string): Promise<Todo[]>
pt.todo.create(todo: Partial<Todo>): Promise<Todo>
pt.todo.toggle(id: string): Promise<void>
```
Permission: `todo:read` / `todo:write`.

### `pt.fascinator`
```ts
pt.fascinator.nlp(text: string): Promise<{parsed, graph}>
pt.fascinator.call(method, path, body?): Promise<any>     // arbitrary /api/* proxy
pt.fascinator.status(): Promise<Status>
```
Permission: `fascinator:call`.

### `pt.event`
```ts
pt.event.on(topic: string, handler: (payload: any) => void): () => void   // returns unsubscribe
pt.event.publish(topic: string, payload: any): void
```
No permission required — events are scoped to the plugin's own namespace by default. Subscribing to host topics (e.g. `fascinator.log`) requires `event:host`.

### `pt.ui` (panel kind only)
```ts
pt.ui.toast(message: string, level?: 'info' | 'warn' | 'error'): void
pt.ui.confirm(message: string): Promise<boolean>
pt.ui.openFleetingDrawer(): void
```

### `pt.storage`
```ts
pt.storage.get(key: string): Promise<any>
pt.storage.set(key: string, value: any): Promise<void>
pt.storage.keys(): Promise<string[]>
```
Each plugin gets a private key-value store backed by a row in the host SQLite db. No permission needed; isolated by plugin id.

---

## 5. Permission model

Permissions are declared in the manifest and presented to the user on first launch. The host enforces them at every API call — calling something without the right permission throws.

| Permission | Grants |
|------------|--------|
| `notes:read` | `pt.notes.list/get/search` |
| `notes:write` | `pt.notes.create/update` + everything in `notes:read` |
| `fleeting:read` | `pt.fleeting.stream` |
| `fleeting:capture` | `pt.fleeting.capture` |
| `todo:read` | `pt.todo.list` |
| `todo:write` | `pt.todo.create/toggle/remove` + read |
| `fascinator:call` | All `pt.fascinator.*` |
| `shortcuts:open` | `pt.shortcuts.open` (no plugin can *add* shortcuts) |
| `event:host` | Subscribe to system topics like `fascinator.log`, `todo.due`, `fleeting.captured` |
| `net:fetch` | Make outbound HTTP requests (sandbox proxied) |

Plugins can declare nothing — they can still use `pt.ui`, `pt.storage`, and same-namespace events.

---

## 6. Writing a `panel` plugin — full walkthrough

```js
// index.js
export default function activate(pt) {
  let unsub;

  return {
    title: "My Panel",

    async mount(root) {
      const todos = await pt.todo.list("today");
      root.innerHTML = `<div>${todos.length} tasks today</div>`;
      unsub = pt.event.on("todo.toggled", () => this.mount(root));
    },

    unmount() {
      unsub?.();
    },
  };
}
```

Notes:
- `mount` may be async.
- The host strips `<script>` from any HTML you inject. Use real listeners (`addEventListener`) on elements you created yourself.
- React is **not** bundled into the sandbox. If you need it, ship it in your own `index.js` (the example shows vanilla JS, but you can `import("react")` from a CDN if `net:fetch` is granted).

---

## 7. Writing a `command` plugin

```js
export default function activate(pt) {
  return {
    commands: [
      {
        id:    "screenshot",
        label: "Take screenshot of region",
        hint:  "select & save to ~/Pictures",
        kbd:   ["ctrl", "shift", "4"],
        async invoke() {
          await pt.fascinator.call("POST", "/api/screenshot", {});
        },
      },
    ],
  };
}
```

Commands appear in the Ctrl+K palette under the section `PLUGIN` and respect the keyboard shortcut declared in `kbd`.

---

## 8. Best practices

- **Treat the host as the source of truth.** Don't keep parallel state — call `pt.notes.list` again instead of caching.
- **Subscribe to events sparingly.** Each event subscription holds a reference until `unmount`. Remember to call the returned unsubscribe.
- **Be a good citizen with `pt.fascinator.call`.** The Flask backend is single-threaded; don't issue dozens of calls per second.
- **Test in mock mode.** Run `npm run dev` in `frontend/` and your plugin will run against the in-memory mock. Way faster than restarting Wails.

---

## 9. Distributing your plugin

There is no central registry yet. For now:

1. Tag a release on GitHub: `git tag v0.1.0 && git push --tags`.
2. Attach a ZIP of the plugin folder to the release.
3. Users download, unzip into `~/.personal-terminal/plugins/`, click RESCAN.

A registry/marketplace is on the roadmap; it will reuse the manifest format unchanged.
