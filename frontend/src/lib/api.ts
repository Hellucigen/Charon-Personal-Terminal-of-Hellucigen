/* Bridge between React and the Go backend.
 *
 * In a real Wails build, calling window.go.<package>.<App|Service>.<Method>
 * returns a Promise. During pure browser dev (no Wails wrapper), we provide
 * a stub that records calls and returns deterministic mock data, so the UI
 * remains fully usable for design iteration.
 */

type AnyFn = (...args: any[]) => any;

const isWails = typeof (window as any).go !== "undefined";

// ───────────────────────────────────────────────────────────────────
// MOCK LAYER (browser-only) — keeps the UI alive without a running Go
// process. Touch this when you add a new binding so design work isn't
// blocked by the backend.
// ───────────────────────────────────────────────────────────────────
const mockState = {
  fascinator: {
    running: false,
    pid: 0,
    port: 5000,
    healthy: false,
    url: "http://127.0.0.1:5000",
    logs: "[mock] fascinator not started\n",
  },
  notes: [] as any[],
  todos: [
    { id: "t_demo1", title: "回顾本周梦境记录", list: "today",
      due_at: Math.floor(Date.now()/1000)+3600, done: false, important: true,
      tags: ["梦境"], notes: "", created_at: Date.now()/1000, updated_at: Date.now()/1000 },
    { id: "t_demo2", title: "把零碎想法整理进笔记", list: "inbox",
      done: false, important: false, tags: [], notes: "",
      created_at: Date.now()/1000, updated_at: Date.now()/1000 },
  ] as any[],
  fleeting: [
    { id: "f_demo1", body: "今天梦到自己在沙漠里捡到一台坏掉的同步辐射加速器",
      tags: ["梦境","碎片"], created_at: Math.floor(Date.now()/1000)-3600 },
    { id: "f_demo2", body: "Fascinator 的扩散公式 a(v, t+1) 加一个温度项会不会更稳？",
      tags: ["fascinator","想法"], created_at: Math.floor(Date.now()/1000)-7200 },
  ] as any[],
  shortcuts: [
    { id: "s_demo1", label: "Fascinator 源码", target: "~/code/fascinator",
      pinned: true, open_count: 42, created_at: Date.now()/1000 },
    { id: "s_demo2", label: "Steam 库", target: "steam://nav/library",
      pinned: false, open_count: 11, created_at: Date.now()/1000 },
  ] as any[],
  bookmarks: [] as any[],
};

const mock: Record<string, AnyFn> = {
  // App
  "App.Greet":   async () => "Welcome, operator. (mock)",
  "App.Version": async () => "0.1.0-mock",

  // Fascinator
  "FascinatorService.Status":     async () => ({
    running: mockState.fascinator.running,
    pid:     mockState.fascinator.pid,
    port:    mockState.fascinator.port,
    ping:    mockState.fascinator.healthy,
  }),
  "FascinatorService.Configure":  async () => {},
  "FascinatorService.Start":      async () => {
    mockState.fascinator.running = true;
    mockState.fascinator.pid = 12345;
    mockState.fascinator.healthy = true;
    mockState.fascinator.logs += `[mock] starting flask on :${mockState.fascinator.port}\n`;
  },
  "FascinatorService.Stop":       async () => {
    mockState.fascinator.running = false;
    mockState.fascinator.healthy = false;
    mockState.fascinator.pid = 0;
  },
  "FascinatorService.Restart":    async () => { /* no-op */ },
  "FascinatorService.Call":       async (_m: string, _p: string) => ({ items: [] }),
  "FascinatorService.SendNLP":    async (text: string) => ({
    parsed: { nodes: text.split(/\s+/).filter(Boolean), edges: [], speech_act: "断言类" },
  }),
  "FascinatorService.Logs":       async () => mockState.fascinator.logs.split("\n").filter(Boolean),
  "FascinatorService.TopK":       async () => ({ nodes: [], edges: [] }),
  "FascinatorService.ActionQueue":   async () => ({ queue: [] }),
  "FascinatorService.ExecuteAction": async (_id: string) => ({ success: true, output: "[mock]" }),
  "FascinatorService.ReadConfig":    async () => JSON.stringify({
    lambda_decay: 0.05, beta_spread: 1.0, theta_threshold: 0.01,
    theta_action: 0.5, k_top: 5, max_depth: 6, auto_interval: 1.5,
  }, null, 2),
  "FascinatorService.WriteConfig":   async (_text: string) => {},

  // Notes
  "NotesService.List":   async (template = "", _limit = 200) =>
    mockState.notes.filter(n => !template || n.template === template),
  "NotesService.Get":    async (id: string) => mockState.notes.find(n => n.id === id),
  "NotesService.Create": async (n: any) => {
    const row = { ...n, id: `n_${Math.random().toString(16).slice(2,10)}`,
      created_at: Date.now()/1000, updated_at: Date.now()/1000 };
    mockState.notes.unshift(row);
    return row;
  },
  "NotesService.Update": async (n: any) => {
    const i = mockState.notes.findIndex(x => x.id === n.id);
    if (i >= 0) mockState.notes[i] = { ...n, updated_at: Date.now()/1000 };
  },
  "NotesService.Delete": async (id: string) => {
    mockState.notes = mockState.notes.filter(n => n.id !== id);
  },
  "NotesService.Search": async (q: string) =>
    mockState.notes.filter(n =>
      (n.title || "").includes(q) || (n.body || "").includes(q)),

  // Todos
  "TodoService.List":     async (name = "") =>
    name === "today"     ? mockState.todos.filter(t => t.list === "today") :
    name === "important" ? mockState.todos.filter(t => t.important) :
    name === ""          ? mockState.todos :
                           mockState.todos.filter(t => t.list === name),
  "TodoService.Create":   async (t: any) => {
    const row = { ...t, id: `t_${Math.random().toString(16).slice(2,10)}`,
      created_at: Date.now()/1000, updated_at: Date.now()/1000 };
    mockState.todos.unshift(row);
    return row;
  },
  "TodoService.Toggle":   async (id: string) => {
    const t = mockState.todos.find(x => x.id === id); if (t) t.done = !t.done;
  },
  "TodoService.Delete":   async (id: string) => {
    mockState.todos = mockState.todos.filter(t => t.id !== id);
  },
  "TodoService.DueSoon":  async () => [],
  "TodoService.Lists":    async () => [
    { name: "today",     count: mockState.todos.filter(t => t.list === "today" && !t.done).length },
    { name: "important", count: mockState.todos.filter(t => t.important && !t.done).length },
    { name: "inbox",     count: mockState.todos.filter(t => t.list === "inbox" && !t.done).length },
  ],

  // Fleeting
  "FleetingService.Capture": async (body: string, tags: string[], media = "") => {
    const row = { id: `f_${Math.random().toString(16).slice(2,10)}`,
      body, tags: tags || [], media_path: media, created_at: Math.floor(Date.now()/1000) };
    mockState.fleeting.unshift(row);
    return row;
  },
  "FleetingService.Stream":  async () => mockState.fleeting,
  "FleetingService.Delete":  async (id: string) => {
    mockState.fleeting = mockState.fleeting.filter(f => f.id !== id);
  },
  "FleetingService.Promote": async (id: string, title: string) => {
    const f = mockState.fleeting.find(x => x.id === id);
    if (!f) throw new Error("not found");
    const n: any = { id: `n_${Math.random().toString(16).slice(2,10)}`,
      title, template: "blank", body: f.body, tags: ["from-fleeting"],
      created_at: Date.now()/1000, updated_at: Date.now()/1000 };
    mockState.notes.unshift(n);
    return n.id;
  },

  // Shortcuts
  "ShortcutsService.List":   async () => mockState.shortcuts,
  "ShortcutsService.Add":    async (s: any) => {
    const row = { ...s, id: `s_${Math.random().toString(16).slice(2,10)}`,
      open_count: 0, created_at: Date.now()/1000, pinned: !!s.pinned };
    mockState.shortcuts.unshift(row); return row;
  },
  "ShortcutsService.Open":   async (id: string) => {
    const s = mockState.shortcuts.find(x => x.id === id); if (s) s.open_count++;
  },
  "ShortcutsService.Delete": async (id: string) => {
    mockState.shortcuts = mockState.shortcuts.filter(s => s.id !== id);
  },

  // Bookmarks
  "BookmarksService.List":            async () => mockState.bookmarks,
  "BookmarksService.Add":             async (b: any) => {
    const row = { ...b, id: `b_${Math.random().toString(16).slice(2,10)}`,
      dead: false, created_at: Date.now()/1000 };
    mockState.bookmarks.unshift(row); return row;
  },
  "BookmarksService.Delete":          async (id: string) => {
    mockState.bookmarks = mockState.bookmarks.filter(b => b.id !== id);
  },
  "BookmarksService.ImportEdgeHTML":  async () => 0,

  // Plugins
  "PluginsService.List":      async () => [],
  "PluginsService.LoadEntry": async () => "",
};

// ───────────────────────────────────────────────────────────────────
// Public surface
// ───────────────────────────────────────────────────────────────────
export async function call<T = any>(method: string, ...args: any[]): Promise<T> {
  if (isWails) {
    const [pkg, fn] = method.split(".");
    // Wails binds to window.go.main.<App>.<Method> for the App struct
    // and window.go.modules.<Service>.<Method> for module services.
    const root = (window as any).go;
    const target =
      root?.main?.[pkg]?.[fn] ??
      root?.modules?.[pkg]?.[fn];
    if (!target) throw new Error(`binding not found: ${method}`);
    return target(...args);
  }
  const fn = mock[method];
  if (!fn) {
    console.warn("[mock] unknown method", method);
    return undefined as any;
  }
  return fn(...args);
}

export const api = {
  app: {
    greet:   () => call<string>("App.Greet"),
    version: () => call<string>("App.Version"),
  },
  fascinator: {
    status:    () => call("FascinatorService.Status"),
    configure: (py: string, app: string, port: number) =>
      call("FascinatorService.Configure", py, app, port),
    start:   () => call("FascinatorService.Start"),
    stop:    () => call("FascinatorService.Stop"),
    restart: () => call("FascinatorService.Restart"),
    call:    (m: string, p: string, body?: any) =>
      call("FascinatorService.Call", m, p, body),
    nlp:     (text: string) => call("FascinatorService.SendNLP", text),
    logs:    () => call<string[]>("FascinatorService.Logs"),
    topk:    () => call<{ nodes: any[]; edges: any[] }>("FascinatorService.TopK"),
    actionQueue:   () => call<{ queue: { activation: number; node_id: string }[] }>(
      "FascinatorService.ActionQueue"),
    executeAction: (id: string) => call("FascinatorService.ExecuteAction", id),
    readConfig:    () => call<string>("FascinatorService.ReadConfig"),
    writeConfig:   (text: string) => call("FascinatorService.WriteConfig", text),
  },
  notes: {
    list:   (template = "", limit = 200) => call<any[]>("NotesService.List", template, limit),
    get:    (id: string) => call<any>("NotesService.Get", id),
    create: (n: any) => call<any>("NotesService.Create", n),
    update: (n: any) => call("NotesService.Update", n),
    remove: (id: string) => call("NotesService.Delete", id),
    search: (q: string) => call<any[]>("NotesService.Search", q),
  },
  todo: {
    list:    (name = "") => call<any[]>("TodoService.List", name),
    create:  (t: any) => call<any>("TodoService.Create", t),
    toggle:  (id: string) => call("TodoService.Toggle", id),
    remove:  (id: string) => call("TodoService.Delete", id),
    dueSoon: (mins = 15) => call<any[]>("TodoService.DueSoon", mins),
    lists:   () => call<{name:string,count:number}[]>("TodoService.Lists"),
  },
  fleeting: {
    capture: (body: string, tags: string[] = [], media = "") =>
      call<any>("FleetingService.Capture", body, tags, media),
    stream:  (limit = 200) => call<any[]>("FleetingService.Stream", limit),
    remove:  (id: string) => call("FleetingService.Delete", id),
    promote: (id: string, title: string, template = "blank") =>
      call<string>("FleetingService.Promote", id, title, template),
  },
  shortcuts: {
    list:   () => call<any[]>("ShortcutsService.List"),
    add:    (s: any) => call<any>("ShortcutsService.Add", s),
    open:   (id: string) => call("ShortcutsService.Open", id),
    remove: (id: string) => call("ShortcutsService.Delete", id),
  },
  bookmarks: {
    list:           (folder = "") => call<any[]>("BookmarksService.List", folder),
    add:            (b: any) => call<any>("BookmarksService.Add", b),
    remove:         (id: string) => call("BookmarksService.Delete", id),
    importEdgeHTML: (path: string) => call<number>("BookmarksService.ImportEdgeHTML", path),
  },
  plugins: {
    list:      () => call<any[]>("PluginsService.List"),
    loadEntry: (id: string, path: string) =>
      call<string>("PluginsService.LoadEntry", id, path),
  },
  platform: (): "wails" | "browser" => (isWails ? "wails" : "browser"),
};

export type API = typeof api;
