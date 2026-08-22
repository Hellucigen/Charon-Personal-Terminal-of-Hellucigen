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
  "App.GetFascinatorSettings": async () => ({ python: "", app: "", config: "", port: 5000 }),
  "App.SaveFascinatorSettings": async () => {},

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

  // ── v0.2 modules (browser mocks return empty states) ──────────────
  "PasswordService.Status":     async () => ({ created: false, unlocked: false, entries: 0 }),
  "PasswordService.List":       async () => [],
  "PasswordService.Save":       async (e: any) => e,
  "PasswordService.Reveal":     async () => ({ password: "mock-password" }),
  "PasswordService.ImportCSV":  async () => 0,
  "DetectiveService.Board":     async () => ({ nodes: [], edges: [] }),
  "DetectiveService.SaveNode":  async (n: any) => n,
  "DetectiveService.Export":    async () => "{}",
  "TravelService.Trips":        async () => [],
  "TravelService.Entries":      async () => [],
  "TravelService.SaveTrip":     async (t: any) => t,
  "TravelService.SaveEntry":    async (e: any) => e,
  "InstituteService.Depts":     async () => [],
  "InstituteService.Actions":   async () => [],
  "InstituteService.Phases":    async () => [],
  "InstituteService.SaveDept":  async (d: any) => d,
  "InstituteService.SaveAction":async (a: any) => a,
  "InstituteService.SavePhase": async (p: any) => p,
  "LearningService.Decks":      async () => [],
  "LearningService.Cards":      async () => [],
  "LearningService.SaveDeck":   async (name: string) => ({ id: "dk_mock", name }),
  "LearningService.SaveCard":   async (c: any) => c,
  "LearningService.Review":     async () => ({ interval_d: 1, due_at: 0 }),
  "LearningService.Import":     async () => 0,
  "LearningService.Quiz":       async () => [],
  "MusicService.Scan":          async () => [],
  "MusicService.Podcasts":      async () => [],
  "MusicService.AddPodcast":    async (t: string, u: string) => ({ id: "pc_mock", title: t, url: u, episodes: [] }),
  "MusicService.Refresh":       async (id: string) => ({ id, episodes: [] }),
  "FinanceService.Transactions":async () => [],
  "FinanceService.Summary":     async () => ({ by_month: [], by_category: [] }),
  "FinanceService.SaveTransaction": async (t: any) => t,
  "FinanceService.ImportCSV":   async () => 0,
  "FinanceService.Subscriptions": async () => [],
  "FinanceService.SaveSubscription": async (s: any) => s,
  "HealthService.Overview":     async () => [],
  "HealthService.Series":       async () => [],
  "HealthService.Log":          async (h: string, v: number) => ({ habit: h, value: v }),
  "CreativeService.Boards":     async () => [],
  "CreativeService.SaveBoard":  async (b: any) => b,
  "CreativeService.LogWriting": async (w: number) => ({ words: w }),
  "CreativeService.WritingStats": async () => ({ today: 0, goal: 500, days: [] }),
  "NetService.LocalInfo":       async () => ({ outbound_ip: "127.0.0.1", hostname: "mock", interfaces: [] }),
  "NetService.Lookup":          async () => ["127.0.0.1"],
  "NetService.Ping":            async () => "[mock] ping disabled in browser",
  "NetService.HTTPRequest":     async () => { throw new Error("browser mock") },
  "NetService.Encode":          async (k: string, t: string) => k === "base64" ? btoa(t) : t,
  "NetService.RegexTest":       async (p: string, t: string) => ({ valid: true, matches: t.match(new RegExp(p, "g")) || [], groups: [] }),
  "TimeService.Stats":          async () => [],
  "TimeService.Blocks":         async () => [],
  "TimeService.SaveBlock":      async (b: any) => b,
  "TimeService.SavePomodoro":   async (p: any) => p,
  "TimeService.Usage":          async () => [],
  "TimeService.TrackingOn":     async () => false,
  "TimeService.StartTracking":  async () => {},
  "TimeService.StopTracking":   async () => {},
  "RPGService.Profile":         async () => ({ xp: 0, level: 1, next_level_xp: 100, title: "旁观者", stats: {}, stat_labels: {}, recent: [] }),
  "RPGService.Achievements":    async () => [],
  "RPGService.SaveAchievement": async (a: any) => a,
  "RPGService.CheckAchievements": async () => [],
  "DataService.Overview":       async () => ({}),
  "DataService.Heatmap":        async () => [],
  "DataService.YearReview":     async () => "（mock）年度回顾",
  "DataService.ExportAll":      async () => "{}",
  "DiaryService.List":          async () => [],
  "DiaryService.OnThisDay":     async () => [],
  "DiaryService.Save":          async (e: any) => e,
  "DiaryService.Summary":       async () => ({}),
  "App.BridgeInfo":             async () => ({ enabled: true, port: 17734, url: "http://127.0.0.1:17734", token: "mock" }),
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

export interface FascinatorSettings {
  python: string
  app: string
  config: string
  port: number
}

export const api = {
  app: {
    greet:   () => call<string>("App.Greet"),
    version: () => call<string>("App.Version"),
  },
  fascinatorSettings: {
    get: () => call<FascinatorSettings>("App.GetFascinatorSettings"),
    save: (s: FascinatorSettings) => call("App.SaveFascinatorSettings", s),
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
  passwords: {
    status:  () => call<{ created: boolean; unlocked: boolean; entries: number }>("PasswordService.Status"),
    init:    (master: string) => call("PasswordService.Init", master),
    unlock:  (master: string) => call<boolean>("PasswordService.Unlock", master),
    lock:    () => call("PasswordService.Lock"),
    list:    () => call<any[]>("PasswordService.List"),
    save:    (e: any) => call<any>("PasswordService.Save", e),
    reveal:  (id: string) => call<{ password: string; notes?: string }>("PasswordService.Reveal", id),
    remove:  (id: string) => call("PasswordService.Delete", id),
    importCSV: (path: string) => call<number>("PasswordService.ImportCSV", path),
  },
  detective: {
    board:      () => call<{ nodes: any[]; edges: any[] }>("DetectiveService.Board"),
    saveNode:   (n: any) => call<any>("DetectiveService.SaveNode", n),
    move:       (id: string, x: number, y: number) => call("DetectiveService.Move", id, x, y),
    deleteNode: (id: string) => call("DetectiveService.DeleteNode", id),
    addEdge:    (from: string, to: string, relation: string) => call("DetectiveService.AddEdge", from, to, relation),
    deleteEdge: (id: string) => call("DetectiveService.DeleteEdge", id),
    exportBoard: () => call<string>("DetectiveService.Export"),
  },
  travel: {
    trips:       () => call<any[]>("TravelService.Trips"),
    saveTrip:    (t: any) => call<any>("TravelService.SaveTrip", t),
    deleteTrip:  (id: string) => call("TravelService.DeleteTrip", id),
    entries:     (tripId: string) => call<any[]>("TravelService.Entries", tripId),
    saveEntry:   (e: any) => call<any>("TravelService.SaveEntry", e),
    deleteEntry: (id: string) => call("TravelService.DeleteEntry", id),
  },
  institute: {
    depts:        () => call<any[]>("InstituteService.Depts"),
    saveDept:     (d: any) => call<any>("InstituteService.SaveDept", d),
    deleteDept:   (id: string) => call("InstituteService.DeleteDept", id),
    actions:      (deptId = "") => call<any[]>("InstituteService.Actions", deptId),
    saveAction:   (a: any) => call<any>("InstituteService.SaveAction", a),
    deleteAction: (id: string) => call("InstituteService.DeleteAction", id),
    phases:       (deptId = "") => call<any[]>("InstituteService.Phases", deptId),
    savePhase:    (p: any) => call<any>("InstituteService.SavePhase", p),
    deletePhase:  (id: string) => call("InstituteService.DeletePhase", id),
  },
  learning: {
    decks:      () => call<any[]>("LearningService.Decks"),
    saveDeck:   (name: string) => call<any>("LearningService.SaveDeck", name),
    deleteDeck: (id: string) => call("LearningService.DeleteDeck", id),
    cards:      (deckId: string, dueOnly = false) => call<any[]>("LearningService.Cards", deckId, dueOnly),
    saveCard:   (c: any) => call<any>("LearningService.SaveCard", c),
    deleteCard: (id: string) => call("LearningService.DeleteCard", id),
    review:     (id: string, grade: number) => call<any>("LearningService.Review", id, grade),
    importFile: (deckId: string, path: string) => call<number>("LearningService.Import", deckId, path),
    quiz:       (deckId: string, n = 10) => call<any[]>("LearningService.Quiz", deckId, n),
  },
  music: {
    scan:          (dir: string) => call<any[]>("MusicService.Scan", dir),
    play:          (path: string, action = "play") => call("MusicService.Play", path, action),
    podcasts:      () => call<any[]>("MusicService.Podcasts"),
    addPodcast:    (title: string, url: string) => call<any>("MusicService.AddPodcast", title, url),
    deletePodcast: (id: string) => call("MusicService.DeletePodcast", id),
    refresh:       (id: string) => call<any>("MusicService.Refresh", id),
  },
  finance: {
    transactions: (month = "", category = "", limit = 300) =>
      call<any[]>("FinanceService.Transactions", month, category, limit),
    saveTx:   (t: any) => call<any>("FinanceService.SaveTransaction", t),
    deleteTx: (id: string) => call("FinanceService.DeleteTransaction", id),
    summary:  (months = 6) => call<any>("FinanceService.Summary", months),
    importCSV: (path: string, kind: string) => call<number>("FinanceService.ImportCSV", path, kind),
    subscriptions:    () => call<any[]>("FinanceService.Subscriptions"),
    saveSubscription: (s: any) => call<any>("FinanceService.SaveSubscription", s),
    deleteSubscription: (id: string) => call("FinanceService.DeleteSubscription", id),
  },
  health: {
    log:     (habit: string, value: number, unit = "", note = "") =>
      call<any>("HealthService.Log", habit, value, unit, note),
    series:  (habit: string, limit = 30) => call<any[]>("HealthService.Series", habit, limit),
    overview: () => call<any[]>("HealthService.Overview"),
    remove:  (id: string) => call("HealthService.Delete", id),
  },
  creative: {
    boards:      (kind = "") => call<any[]>("CreativeService.Boards", kind),
    saveBoard:   (b: any) => call<any>("CreativeService.SaveBoard", b),
    deleteBoard: (id: string) => call("CreativeService.DeleteBoard", id),
    logWriting:  (words: number, note = "") => call<any>("CreativeService.LogWriting", words, note),
    writingStats: (goal = 500) => call<any>("CreativeService.WritingStats", goal),
  },
  net: {
    localInfo: () => call<any>("NetService.LocalInfo"),
    lookup:    (host: string) => call<string[]>("NetService.Lookup", host),
    ping:      (host: string) => call<string>("NetService.Ping", host),
    httpRequest: (method: string, url: string, headers: Record<string, string>, body: string) =>
      call<any>("NetService.HTTPRequest", method, url, headers, body),
    encode:    (kind: string, text: string) => call<string>("NetService.Encode", kind, text),
    regexTest: (pattern: string, text: string) => call<any>("NetService.RegexTest", pattern, text, ""),
  },
  time: {
    savePomodoro: (task: string, durationS: number, kind = "focus") =>
      call<any>("TimeService.SavePomodoro", { task, duration_s: durationS, kind }),
    stats:         (days = 14) => call<any[]>("TimeService.Stats", days),
    blocks:        (day = "") => call<any[]>("TimeService.Blocks", day),
    saveBlock:     (b: any) => call<any>("TimeService.SaveBlock", b),
    deleteBlock:   (id: string) => call("TimeService.DeleteBlock", id),
    trackingOn:    () => call<boolean>("TimeService.TrackingOn"),
    startTracking: () => call("TimeService.StartTracking"),
    stopTracking:  () => call("TimeService.StopTracking"),
    usage:         (day = "") => call<any[]>("TimeService.Usage", day),
  },
  rpg: {
    profile:      () => call<any>("RPGService.Profile"),
    award:        (amount: number, source: string, stat = "will") =>
      call("RPGService.Award", amount, source, stat),
    achievements: () => call<any[]>("RPGService.Achievements"),
    saveAchievement: (a: any) => call<any>("RPGService.SaveAchievement", a),
    unlockAchievement: (id: string) => call("RPGService.UnlockAchievement", id),
    deleteAchievement: (id: string) => call("RPGService.DeleteAchievement", id),
    check:        () => call<string[]>("RPGService.CheckAchievements"),
  },
  data: {
    overview:  () => call<any>("DataService.Overview"),
    heatmap:   (days = 182) => call<any[]>("DataService.Heatmap", days),
    yearReview: (year = 0) => call<string>("DataService.YearReview", year),
    exportAll: () => call<string>("DataService.ExportAll"),
  },
  diary: {
    save:      (e: any) => call<any>("DiaryService.Save", e),
    list:      (daysBack = 60) => call<any[]>("DiaryService.List", daysBack),
    remove:    (id: string) => call("DiaryService.Delete", id),
    onThisDay: () => call<any[]>("DiaryService.OnThisDay"),
    summary:   (period = "week") => call<any>("DiaryService.Summary", period),
  },
  bridge: {
    info: () => call<{ enabled: boolean; port: number; url: string; token: string }>("App.BridgeInfo"),
  },
  platform: (): "wails" | "browser" => (isWails ? "wails" : "browser"),
};

export type API = typeof api;
