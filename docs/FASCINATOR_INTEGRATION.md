# FASCINATOR INTEGRATION · Fascinator 集成指南

Personal Terminal ships with first-class support for **Fascinator** — the cognitive-architecture project (unified knowledge graph + spreading activation + procedural action queue + Searle-style speech-act classification). This document explains how the integration works end to end, how to configure it, and how to extend it.

---

## 1. The shape of Fascinator

Fascinator is a Python project. The relevant pieces:

| File | Role |
|------|------|
| `app.py` | Flask backend exposing `/api/*` endpoints |
| `graph_model.py` | `Node` / `Edge` / `KnowledgeGraph`, JSON persistence |
| `diffusion_engine.py` | Spreading activation `a(v,t+1) = (1-λ)·a(v,t) + Σ a(u,t)·w̃_uv·β / |N⁺(u)|`, plus action-queue logic |
| `nlp_processor.py` | jieba 分词 + Claude API → `{ nodes, edges, speech_act }` |
| `config.py` | Defaults: `lambda_decay`, `beta_spread`, `k_top`, `theta_action`, … |

Endpoints exposed by `app.py`:

| Method · Path | Purpose |
|----|----|
| `GET /api/graph` | Full graph snapshot (nodes + edges + activations) |
| `GET/POST /api/nodes` · `/<id>` | Node CRUD |
| `GET/POST/PUT/DELETE /api/edges` | Edge CRUD |
| `POST /api/activate` | Inject initial activation: `{nodes, edges}` |
| `POST /api/diffuse/step` · `/round` · `/start` · `/stop` | Manual & auto diffusion |
| `GET /api/diffuse/status` | Auto-diffusion running? |
| `GET /api/topk` | Top-k attentional candidate set |
| `GET /api/actions/queue` | Procedural-memory action queue |
| `POST /api/actions/execute` | Run one action node |
| `GET /api/actions/log` | Execution log |
| `POST /api/nlp` | Chinese sentence → parsed + activated |
| `GET /api/nlp/logs` | NLP call history |
| `GET/PUT /api/config` | Live hyperparameters |

The paper (`Final.pdf`) describes the broader cognitive architecture, including the self-cognition subgraph, event frames, and reinforcement-learning-policy-driven action nodes. **Treat the paper as a reference; the source-of-truth is the current `app.py` implementation.** When the two disagree, the code wins.

---

## 2. How Personal Terminal hooks in

Inside the Go process, [`backend/modules/fascinator.go`](../backend/modules/fascinator.go) defines `FascinatorService`. It does five things:

1. **Process control.** `Start` / `Stop` / `Restart` launch `python app.py` as a subprocess via `exec.CommandContext`, capturing stdout/stderr into a 4 KB ring buffer for the log viewer.
2. **Status check.** `Status()` reports `running`, `pid`, `port`, plus a `ping` flag set by hitting `GET /api/graph` with a 600 ms timeout.
3. **REST proxy.** `Call(method, path, payload)` issues an HTTP request to `http://127.0.0.1:<port><path>` and unmarshals the JSON. This bypasses CORS and saves the frontend from juggling fetch logic.
4. **High-frequency wrappers.** `SendNLP(text)`, `TopK()`, `ActionQueue()`, `ExecuteAction(id)`, and `Logs()` are typed conveniences over `Call`.
5. **Config editing.** `ReadConfig()` / `WriteConfig(text)` write to the file path set via `SetConfigPath`, or, if no path is set, PUT to `/api/config` so the live engine picks up changes immediately.

The frontend module at [`frontend/src/modules/Fascinator.tsx`](../frontend/src/modules/Fascinator.tsx) consumes all of this:

- **Hero card** — start/stop/restart + LIVE/IDLE dot.
- **CONSOLE tab** — tails the ring buffer every 2 seconds.
- **NLP·INPUT tab** — textarea → `SendNLP`; renders parsed nodes, edges, and Searle speech-act tag.
- **TOP-K tab** — two columns: candidate nodes (with `w` and `a`) and the action queue (with one-click EXEC).
- **CONFIG tab** — round-trip text editor for the JSON config.

---

## 3. First-time setup

1. **Clone Fascinator and install deps.**
   ```bash
   git clone <fascinator-repo> ~/code/fascinator
   cd ~/code/fascinator
   python -m venv .venv
   source .venv/bin/activate            # Windows: .venv\Scripts\activate
   pip install flask flask-cors jieba sentence-transformers anthropic
   ```

2. **Set the Anthropic key** so the NLP processor can call Claude:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Or put it in `~/.personal-terminal/config.json` — Personal Terminal will export it before spawning the subprocess.)

3. **Configure Personal Terminal.**
   Open Settings → FASCINATOR · 路径配置, then fill in:
   - Python executable — `~/code/fascinator/.venv/bin/python`
   - app.py — `~/code/fascinator/app.py`
   - Port — `5000` (default)

   Save. Navigate to the Fascinator module and click `启动`. The status dot turns LIVE and the log stream starts scrolling.

---

## 4. The data flow, end to end

When a user types `明天早上九点带笔记本去图书馆背单词。` into the NLP·INPUT field:

```
┌───────────────┐    SendNLP(text)          ┌────────────────────┐
│ React (TS)    │ ────────────────────────▶ │ FascinatorService  │
│ Fascinator.tsx│                           │ (Go)               │
└───────────────┘                           └──────────┬─────────┘
                                                       │ POST /api/nlp
                                                       ▼
                                          ┌────────────────────────┐
                                          │ Flask app.py           │
                                          │  nlp.process(text)     │
                                          │    → jieba 分词         │
                                          │    → Claude messages   │
                                          │    → {nodes,edges,act} │
                                          │  engine.activate(...)  │
                                          │    → DiffusionEngine   │
                                          │       updates KG       │
                                          └─────────┬──────────────┘
                                                    │ {parsed, graph}
                                                    ▼
                                          ┌────────────────────────┐
                                          │ Go proxies the JSON    │
                                          │ back to the frontend   │
                                          └─────────┬──────────────┘
                                                    │
                                                    ▼
                                          ┌────────────────────────┐
                                          │ React renders three    │
                                          │ panels: NODES / EDGES  │
                                          │ / SPEECH·ACT           │
                                          └────────────────────────┘
```

A subsequent poll to `/api/topk` and `/api/actions/queue` reveals which procedural-memory nodes the spreading activation pushed above `theta_action`. Clicking `EXEC` on one of them POSTs to `/api/actions/execute`, which runs the node's `execution` Python code and writes the result back into the graph as new nodes — closing the perception → cognition → action loop the paper describes (§5 in `Final.pdf`).

---

## 5. Plugins can use Fascinator too

A plugin that declares the `fascinator:call` permission can issue arbitrary proxied calls:

```js
export default function activate(pt) {
  return {
    async mount(root) {
      const topk = await pt.fascinator.call("GET", "/api/topk");
      const items = topk.nodes.map(n => `<li>${n.id} · a=${n.activation.toFixed(2)}</li>`).join("");
      root.innerHTML = `<ul>${items}</ul>`;
    }
  };
}
```

Useful patterns:

- **Subscribe to the log stream.** Declare `event:host` and `pt.event.on("fascinator.log", ...)`.
- **Inject custom action nodes.** `pt.fascinator.call("POST", "/api/nodes", { id, label: "procedural", execution: "result['output']=42" })`. Once activated, your code runs inside the Python `exec()` sandbox.
- **Embed a graph viz.** Use the `/api/graph` payload with d3-force or cytoscape; it's plain JSON.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Status dot stays IDLE even after click 启动 | `python` not on `PATH`, or `app.py` path wrong. Check Settings → FASCINATOR. |
| Log shows `ANTHROPIC_API_KEY` missing | Set it in env or in `~/.personal-terminal/config.json`. NLP falls back to jieba-only segmentation otherwise — usable but lower quality. |
| `sentence-transformers` slow on first launch | First call downloads `paraphrase-multilingual-MiniLM-L12-v2` (~470 MB). Subsequent launches use cache. |
| `cosine_threshold` matches the wrong nodes | Raise it in CONFIG tab (default 0.6 → try 0.75). |
| Auto-diffusion thrashes CPU | Increase `auto_interval` (default 1.5 s). |
| Action `exec()` fails silently | Check `/api/actions/log` — also surfaced in the CONSOLE tab. |
| Port 5000 occupied | Change in Settings; Personal Terminal sets `PORT` env when spawning. |

---

## 7. What's deliberately *not* integrated yet

- The paper's `self-cognition subgraph` (emotion + personality + gland/receptor/hormone modulation) is described in §3.3 of `Final.pdf` but is not exposed by the current `app.py`. Once it lands, the Fascinator module will grow an `EMOTION` tab.
- Reinforcement-learning-policy-driven action nodes (paper §3.5) are not yet implementable through the JSON-only `execution` field; this will likely require a new node-type label.
- Multimodal perception (paper §4) — image / audio embedding into event frames — is out of scope for now.

These are roadmap items; the current integration covers the closed-loop the paper validates in §7 (input → graph write → spreading → top-k → action execution → write-back).

---

## 8. Reverse Bridge — Fascinator 操作 Charon（v0.2 新增）

Charon 不只是 Fascinator 的前端：它内嵌了一个 **反向 HTTP API（Bridge）**，
让 Fascinator 的动作引擎（或任何本机脚本）直接读写 Charon 的数据。

- 监听地址：`http://127.0.0.1:17734`（仅本机回环，可在 `config.json` 的 `bridge_port` 修改）
- 鉴权：每个请求必须携带 `X-Charon-Token` 头，token 在首次启动时自动生成，
  存于 `~/.personal-terminal/config.json` 的 `bridge_token` 字段
- 开关：`bridge_enabled`（默认 true）

### 端点一览

| Method · Path | Body | 作用 |
|----|----|----|
| `GET /health` | — | 存活检查 |
| `POST /api/notes` | `{title, body, tags[], template?}` | 创建笔记 |
| `GET /api/notes/search?q=` | — | FTS 全文检索笔记 |
| `POST /api/todos` | `{title, list?, due_at?, important?}` | 创建待办 |
| `POST /api/fleeting` | `{body, tags[]}` | 捕捉碎片想法 |
| `POST /api/health` | `{habit, value, unit?, note?}` | 记录健康/习惯数据 |
| `POST /api/finance` | `{amount, category?, note?}` | 记账（负数=支出） |
| `POST /api/diary` | `{line, mood?}` | 写今日一句 |
| `POST /api/detective/nodes` | `{kind, label, note?, x?, y?}` | 钉卡片到侦探板 |
| `GET /api/summary` | — | 跨模块统计（today/week/month/year） |
| `POST /api/events` | `{topic, payload}` | 向 UI 推送任意事件 |
| `POST /api/notify` | `{title, message}` | 在 Charon 窗口弹 toast |

### Python 调用示例

```python
import requests

BRIDGE = "http://127.0.0.1:17734"
TOKEN  = "<bridge_token from ~/.personal-terminal/config.json>"
H = {"X-Charon-Token": TOKEN}

# 动作引擎把「提醒」落成一条 Charon 待办
requests.post(f"{BRIDGE}/api/todos", headers=H,
              json={"title": "复习「图书馆」相关记忆节点", "list": "today"})

# 图谱产生值得留档的结论时写进笔记
requests.post(f"{BRIDGE}/api/notes", headers=H,
              json={"title": "Fascinator 洞察", "body": "...", "tags": ["fas"]})

# 提醒用户看一眼
requests.post(f"{BRIDGE}/api/notify", headers=H,
              json={"title": "Fascinator", "message": "行动队列有新任务待执行"})
```

在 Fascinator 侧建议把上述调用封装为 `charon_client.py`，并在 `capability_registry`
中注册对应能力（如 `charon.create_todo`、`charon.notify`），即可让 `/api/actions/queue`
中的程序性记忆节点直接操作 Charon。
