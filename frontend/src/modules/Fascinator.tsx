import React, { useEffect, useRef, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import {
  Play, Square, RotateCcw, Send, Settings as Cog, Activity, Zap, Network,
  Brain, Boxes, Ear, MessageSquare, Heart, RefreshCw, Trash2, Plus, Link2,
} from 'lucide-react'

/* Fascinator console — the full control surface for the cognitive backend.
 *
 * Every capability of the Flask API (~80 routes) is reachable from here:
 * graph CRUD, activation, diffusion, top-k, action queue, self model,
 * episodic buffer, memory approval, knowledge packs, ear/vision, chat log,
 * exploration learning and the runtime config.
 *
 * Raw endpoints go through api.fascinator.call(method, path, body).
 */

type Status = { running: boolean; pid?: number; port?: number; ping?: boolean; healthy?: boolean }
type ParsedNLP = {
  nodes: string[]
  edges: { src: string; dst: string; relation: string }[]
  speech_act: string
}

const fas = (m: string, p: string, body?: any) => api.fascinator.call(m, p, body)

const TABS = [
  'console', 'graph', 'nlp', 'engine', 'actions', 'self',
  'memory', 'packs', 'sense', 'chat', 'config',
] as const
type Tab = typeof TABS[number]

const TAB_LABEL: Record<Tab, string> = {
  console: 'CONSOLE', graph: 'GRAPH', nlp: 'NLP', engine: 'ENGINE',
  actions: 'ACTIONS', self: 'SELF', memory: 'MEMORY', packs: 'PACKS',
  sense: 'SENSE', chat: 'CHAT', config: 'CONFIG',
}

export const Fascinator: React.FC = () => {
  const [status, setStatus] = useState<Status>({ running: false })
  const [logs, setLogs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('console')
  const [err, setErr] = useState('')

  // ── status polling ──
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const s = await api.fascinator.status()
        if (alive) setStatus(s)
        const l = await api.fascinator.logs()
        if (alive && Array.isArray(l)) setLogs(l)
      } catch (_) {}
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setErr('')
    try { return await fn() } catch (e: any) { setErr(String(e?.message ?? e)); return null }
    finally { setBusy(false) }
  }

  const doStart = () => run(() => api.fascinator.start())
  const doStop = () => run(() => api.fascinator.stop())
  const doRestart = () => run(() => api.fascinator.restart())

  const dot = status.running
    ? <span className="pt-dot pt-dot-live" />
    : <span className="pt-dot pt-dot-idle" />

  const StatusBlob = (
    <div className="flex items-center gap-2 pt-mono text-xs text-text-mid">
      {dot}
      <span>{status.running ? 'RUNNING' : 'STOPPED'}</span>
      {status.running && status.pid ? <><span className="text-text-lo">·</span><span>PID {status.pid}</span></> : null}
      {status.running && status.port ? <><span className="text-text-lo">·</span><span>:{status.port}</span></> : null}
    </div>
  )

  return (
    <div className="p-6 space-y-4 max-w-[1500px]">
      <GlassPanel
        title="FASCINATOR · 认知架构控制台"
        subtitle="知识图谱 · 激活扩散 · 程序性记忆 · 自我模型 · 感知通道"
        meta={StatusBlob}
        scanline
        actions={
          <div className="flex items-center gap-2">
            <button className="pt-btn pt-btn-primary" disabled={busy || status.running} onClick={doStart}>
              <Play size={13} /> 启动
            </button>
            <button className="pt-btn" disabled={busy || !status.running} onClick={doStop}>
              <Square size={13} /> 停止
            </button>
            <button className="pt-btn pt-btn-ghost" disabled={busy} onClick={doRestart}>
              <RotateCcw size={13} /> 重启
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-4 mt-3 text-xs text-text-lo">
          <span className="pt-mono">v0.2 · 80+ API 全量接管</span>
          <span>未启动时以下各页仅浏览本地缓存状态，启动后全功能可用</span>
        </div>
      </GlassPanel>

      {err && <div className="pt-glass p-3 text-xs text-sig-error pt-mono border-sig-error">{err}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'pt-section-label px-3 py-2 transition-colors',
              tab === t ? 'text-accent' : 'text-text-lo hover:text-text-mid',
            ].join(' ')}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'console' && <ConsoleTab status={status} logs={logs} />}
      {tab === 'graph' && <GraphTab running={status.running} />}
      {tab === 'nlp' && <NLPTab running={status.running} />}
      {tab === 'engine' && <EngineTab running={status.running} />}
      {tab === 'actions' && <ActionsTab running={status.running} />}
      {tab === 'self' && <SelfTab running={status.running} />}
      {tab === 'memory' && <MemoryTab running={status.running} />}
      {tab === 'packs' && <PacksTab running={status.running} />}
      {tab === 'sense' && <SenseTab running={status.running} />}
      {tab === 'chat' && <ChatTab running={status.running} />}
      {tab === 'config' && <ConfigTab />}
    </div>
  )
}

/* ── shared bits ──────────────────────────────────────────────────── */

const Tile: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="border border-edge px-3 py-3">
    <div className="pt-section-label text-text-lo">{label}</div>
    <div className={['pt-display text-2xl mt-1 pt-mono', accent ? 'text-accent' : 'text-text-hi'].join(' ')}>{value}</div>
  </div>
)

const Panel: React.FC<{ label: string; children: React.ReactNode; meta?: React.ReactNode }> = ({ label, children, meta }) => (
  <div className="border border-edge p-3">
    <div className="flex items-center justify-between mb-3">
      <span className="pt-section-label text-text-lo">{label}</span>
      {meta}
    </div>
    {children}
  </div>
)

const KV: React.FC<{ k: string; v: any }> = ({ k, v }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 border-b border-edge/50">
    <span className="text-xs text-text-lo">{k}</span>
    <span className="pt-mono text-xs text-text-mid truncate max-w-[70%]">{String(v ?? '—')}</span>
  </div>
)

const needRun = (running: boolean) =>
  !running ? <div className="pt-glass p-4 text-xs text-sig-warn pt-mono">需要先启动 Fascinator 后端进程</div> : null

/* ── CONSOLE ──────────────────────────────────────────────────────── */

const ConsoleTab: React.FC<{ status: Status; logs: string[] }> = ({ status, logs }) => {
  const logRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    if (!status.running) return
    fas('GET', '/api/evolution/stats').then(setStats).catch(() => {})
    fas('GET', '/api/llm/status').then(() => {}).catch(() => {})
  }, [status.running])

  return (
    <div className="space-y-3">
      {status.running && (
        <div className="grid grid-cols-4 gap-3">
          <Tile label="STATE" value="LIVE" accent />
          <Tile label="PING" value={status.ping ? 'OK' : '—'} accent={!!status.ping} />
          <Tile label="NODES" value={String(stats?.total_nodes ?? '—')} />
          <Tile label="EDGES" value={String(stats?.total_edges ?? '—')} />
        </div>
      )}
      <GlassPanel title="LOG STREAM" subtitle="进程标准输出 / 错误输出实时尾随">
        <div ref={logRef} className="pt-console mt-3 h-[420px] overflow-auto text-[12px] leading-relaxed p-3">
          {logs.length === 0
            ? <div className="text-[#888]">无日志输出 · 启动 Fascinator 后这里将实时滚动</div>
            : logs.map((l, i) => (
                <div key={i} className={l.includes('ERROR') ? 'text-[#ff8a80]' : 'text-[#c8c8c8]'}>{l}</div>
              ))}
        </div>
      </GlassPanel>
    </div>
  )
}

/* ── GRAPH — SVG force layout + node/edge CRUD ────────────────────── */

type GNode = { id: string; label?: string; weight?: number; activation?: number; confidence?: number; graph_space?: string; x?: number; y?: number }
type GEdge = { src?: string; dst?: string; source?: string; target?: string; relation?: string; weight?: number }

const GraphTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [nodes, setNodes] = useState<GNode[]>([])
  const [edges, setEdges] = useState<GEdge[]>([])
  const [selected, setSelected] = useState<GNode | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [newNode, setNewNode] = useState({ id: '', label: 'declarative-semantic', weight: 0.5 })
  const [relation, setRelation] = useState('related_to')
  const [filter, setFilter] = useState('')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const W = 960, H = 600

  const load = async () => {
    const r = await fas('GET', '/api/graph?full=true')
    if (!r) return
    const ns: GNode[] = (r.nodes ?? []).slice(0, 400)
    const es: GEdge[] = (r.edges ?? []).slice(0, 900)
    // seed positions on a circle, then a few force iterations
    const n = Math.max(ns.length, 1)
    ns.forEach((nd, i) => {
      const a = (i / n) * Math.PI * 2
      nd.x = W / 2 + Math.cos(a) * (W / 3)
      nd.y = H / 2 + Math.sin(a) * (H / 3)
    })
    const idx = new Map(ns.map((nd, i) => [nd.id, i]))
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j]
          let dx = b.x! - a.x!, dy = b.y! - a.y!
          let d2 = dx * dx + dy * dy || 1
          if (d2 < 160 * 160) {
            const f = 2400 / d2
            dx /= Math.sqrt(d2); dy /= Math.sqrt(d2)
            a.x! -= dx * f; a.y! -= dy * f
            b.x! += dx * f; b.y! += dy * f
          }
        }
      }
      for (const e of es) {
        const s = idx.get(e.src ?? e.source ?? ''), t = idx.get(e.dst ?? e.target ?? '')
        if (s === undefined || t === undefined) continue
        const a = ns[s], b = ns[t]
        const dx = b.x! - a.x!, dy = b.y! - a.y!
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = (d - 110) * 0.02
        const ux = dx / d, uy = dy / d
        a.x! += ux * f; a.y! += uy * f
        b.x! -= ux * f; b.y! -= uy * f
      }
      for (const nd of ns) {
        nd.x! += (W / 2 - nd.x!) * 0.005
        nd.y! += (H / 2 - nd.y!) * 0.005
        nd.x = Math.max(30, Math.min(W - 30, nd.x!))
        nd.y = Math.max(30, Math.min(H - 30, nd.y!))
      }
    }
    setNodes([...ns])
    setEdges([...es])
  }

  useEffect(() => { if (running) load() }, [running])

  const addNode = async () => {
    if (!newNode.id.trim()) return
    const ok = await fas('POST', '/api/nodes', {
      id: newNode.id.trim(), label: newNode.label, weight: Number(newNode.weight),
    })
    if (ok !== null) { setNewNode({ id: '', label: 'declarative-semantic', weight: 0.5 }); load() }
  }

  const updateSelected = async (patch: any) => {
    if (!selected) return
    const ok = await fas('PUT', `/api/nodes/${encodeURIComponent(selected.id)}`, patch)
    if (ok !== null) { setSelected({ ...selected, ...patch }); load() }
  }

  const deleteSelected = async () => {
    if (!selected) return
    const ok = await fas('DELETE', `/api/nodes/${encodeURIComponent(selected.id)}`)
    if (ok !== null) { setSelected(null); load() }
  }

  const onNodeClick = async (nd: GNode) => {
    if (linkFrom && linkFrom !== nd.id) {
      const ok = await fas('POST', '/api/edges', { src: linkFrom, dst: nd.id, relation })
      if (ok !== null) { setLinkFrom(null); load() }
      return
    }
    if (linkFrom === nd.id) { setLinkFrom(null); return }
    setSelected(nd)
  }

  const shown = nodes.filter(n => !filter || n.id.toLowerCase().includes(filter.toLowerCase()))
  const shownIds = new Set(shown.map(n => n.id))

  if (!running) return <>{needRun(running)}</>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="pt-btn pt-btn-ghost" onClick={load}><RefreshCw size={12} /> REFRESH</button>
        <input
          className="pt-input pt-mono text-xs w-44"
          placeholder="过滤节点 id…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button
          className={['pt-btn', linkFrom ? 'pt-btn-primary' : 'pt-btn-ghost'].join(' ')}
          onClick={() => setLinkFrom(linkFrom ? null : (selected?.id ?? null))}
        >
          <Link2 size={12} /> {linkFrom ? `连线中：${linkFrom} → 点击目标` : '连线模式'}
        </button>
        <select className="pt-input pt-mono text-xs w-36" value={relation} onChange={e => setRelation(e.target.value)}>
          {['related_to', 'causes', 'part_of', 'is_a', 'used_for', 'located_at'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-xs text-text-lo pt-mono">{shown.length} nodes · {edges.length} edges</span>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-3">
        <div className="border border-edge pt-dotmatrix bg-surface overflow-hidden relative">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 600 }}>
            {edges.map((e, i) => {
              const s = nodes.find(n => n.id === (e.src ?? e.source))
              const t = nodes.find(n => n.id === (e.dst ?? e.target))
              if (!s || !t || !shownIds.has(s.id) || !shownIds.has(t.id)) return null
              return (
                <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke="rgba(0,0,0,0.15)" strokeWidth={0.8} />
              )
            })}
            {shown.map(n => {
              const act = Math.min(1, Number(n.activation ?? 0))
              const r = 5 + Math.abs(Number(n.weight ?? 0)) * 6
              const isSel = selected?.id === n.id
              return (
                <g key={n.id} onClick={() => onNodeClick(n)} style={{ cursor: 'pointer' }}>
                  <circle cx={n.x} cy={n.y} r={r + (act > 0.05 ? 4 * act : 0)}
                    fill={act > 0.05 ? `rgba(255,107,0,${0.25 + act * 0.7})` : 'rgba(0,0,0,0.2)'}
                    stroke={isSel ? '#009a9b' : 'rgba(0,0,0,0.3)'} strokeWidth={isSel ? 2 : 1} />
                  {(act > 0.05 || isSel) && (
                    <text x={n.x} y={n.y - r - 6} textAnchor="middle" fontSize={10}
                      fill={isSel ? '#009a9b' : 'rgba(0,0,0,0.65)'} className="pt-mono">
                      {n.id.length > 16 ? n.id.slice(0, 15) + '…' : n.id}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <Panel label="ADD NODE">
            <div className="space-y-2">
              <input className="pt-input w-full pt-mono text-xs" placeholder="节点 ID（如 图书馆）"
                value={newNode.id} onChange={e => setNewNode({ ...newNode, id: e.target.value })} />
              <div className="flex gap-2">
                <input className="pt-input flex-1 pt-mono text-xs" placeholder="label"
                  value={newNode.label} onChange={e => setNewNode({ ...newNode, label: e.target.value })} />
                <input className="pt-input w-20 pt-mono text-xs" placeholder="w"
                  value={newNode.weight} onChange={e => setNewNode({ ...newNode, weight: Number(e.target.value) || 0 })} />
              </div>
              <button className="pt-btn pt-btn-primary w-full" onClick={addNode}><Plus size={12} /> CREATE</button>
            </div>
          </Panel>

          {selected ? (
            <Panel label="NODE DETAIL" meta={
              <button className="text-sig-error hover:text-red-400" onClick={deleteSelected}>
                <Trash2 size={13} />
              </button>
            }>
              <div className="space-y-1">
                <KV k="id" v={selected.id} />
                <KV k="label" v={selected.label} />
                <KV k="space" v={selected.graph_space} />
                <KV k="weight" v={Number(selected.weight ?? 0).toFixed(2)} />
                <KV k="activation" v={Number(selected.activation ?? 0).toFixed(4)} />
                <KV k="confidence" v={Number(selected.confidence ?? 0).toFixed(2)} />
              </div>
              <div className="flex gap-2 mt-3">
                <button className="pt-btn pt-btn-ghost flex-1 text-xs"
                  onClick={() => updateSelected({ weight: Number(selected.weight ?? 0) + 0.2 })}>w+0.2</button>
                <button className="pt-btn pt-btn-primary flex-1 text-xs"
                  onClick={() => fas('POST', '/api/activate', { node_id: selected.id, strength: 1.0 }).then(load)}>
                  <Zap size={12} /> ACTIVATE
                </button>
              </div>
            </Panel>
          ) : (
            <div className="border border-edge p-3 text-xs text-text-lo">点击画布中的节点查看详情 · 高亮青色 = 激活中</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── NLP ──────────────────────────────────────────────────────────── */

const NLPTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ParsedNLP | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!input.trim()) return
    setBusy(true)
    try {
      const res = await api.fascinator.nlp(input)
      setResult(res?.parsed ?? null)
      setInput('')
    } finally { setBusy(false) }
  }

  return (
    <GlassPanel title="NATURAL LANGUAGE INPUT" subtitle="中文句子 → 解析 → 图谱激活 → 言语行为分类">
      <div className="flex items-start gap-3 mt-3">
        <textarea
          className="pt-input flex-1 min-h-[100px] resize-y"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="例如：明天早上九点带笔记本去图书馆背单词。"
          disabled={!running}
        />
        <button className="pt-btn pt-btn-primary self-stretch px-5" disabled={busy || !running || !input.trim()} onClick={send}>
          <Send size={14} /> SEND
        </button>
      </div>
      {!running && <div className="mt-2 text-xs text-sig-warn pt-mono">需要先启动 Fascinator 后端进程</div>}
      {result && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Panel label={`NODES ×${result.nodes.length}`}>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {result.nodes.map((n, i) => <div key={i} className="pt-chip">{n}</div>)}
            </div>
          </Panel>
          <Panel label={`EDGES ×${result.edges.length}`}>
            <div className="space-y-1 max-h-[200px] overflow-auto pt-mono text-[11px]">
              {result.edges.map((e, i) => (
                <div key={i} className="text-text-mid">
                  <span className="text-accent">{e.src}</span>
                  <span className="text-text-lo"> ─[{e.relation}]→ </span>
                  <span className="text-accent">{e.dst}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel label="SPEECH·ACT">
            <div className="text-xl pt-display text-accent">{result.speech_act}</div>
            <div className="text-xs text-text-lo mt-2">基于 Searle 言语行为五分类</div>
          </Panel>
        </div>
      )}
    </GlassPanel>
  )
}

/* ── ENGINE — diffusion control + top-k ───────────────────────────── */

const EngineTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [status, setStatus] = useState<any>(null)
  const [topk, setTopk] = useState<any>(null)
  const [queue, setQueue] = useState<any[]>([])

  const load = async () => {
    const [s, t, q] = await Promise.all([
      fas('GET', '/api/diffuse/status'),
      fas('GET', '/api/topk'),
      fas('GET', '/api/actions/queue'),
    ])
    if (s) setStatus(s)
    if (t) setTopk(t)
    if (q) setQueue(q?.queue ?? [])
  }
  useEffect(() => { if (running) load() }, [running])
  useEffect(() => {
    if (!running) return
    const id = setInterval(load, 2500)
    return () => clearInterval(id)
  }, [running])

  if (!running) return <>{needRun(running)}</>

  const act = async () => { await fas('POST', '/api/diffuse/step'); load() }
  const round = async () => { await fas('POST', '/api/diffuse/round'); load() }
  const start = async () => { await fas('POST', '/api/diffuse/start'); load() }
  const stop = async () => { await fas('POST', '/api/diffuse/stop'); load() }
  const reset = async () => { await fas('POST', '/api/activate/reset'); load() }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <Tile label="AUTO" value={status?.running ? 'ON' : 'OFF'} accent={!!status?.running} />
        <Tile label="CYCLE" value={String(status?.cycle ?? status?.cycles ?? '—')} />
        <Tile label="TOP·K" value={String(topk?.nodes?.length ?? 0)} />
        <Tile label="QUEUE" value={String(queue.length)} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="pt-btn pt-btn-primary" onClick={act}><Zap size={12} /> STEP</button>
        <button className="pt-btn" onClick={round}><RefreshCw size={12} /> ROUND</button>
        <button className="pt-btn" onClick={start}><Play size={12} /> AUTO·START</button>
        <button className="pt-btn" onClick={stop}><Square size={12} /> AUTO·STOP</button>
        <button className="pt-btn pt-btn-ghost" onClick={reset}><RotateCcw size={12} /> RESET 激活</button>
        <button className="pt-btn pt-btn-ghost" onClick={load}><Activity size={12} /> REFRESH</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Panel label="TOP-K NODES" meta={<span className="pt-mono text-[10px] text-text-lo">按激活度</span>}>
          <div className="space-y-1 max-h-[440px] overflow-auto">
            {topk?.nodes?.length ? topk.nodes.map((n: any, i: number) => (
              <div key={i} className="flex items-center justify-between border border-edge px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-text-lo pt-mono text-[10px]">#{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate">{n.id}</span>
                </div>
                <div className="flex items-center gap-3 pt-mono text-xs">
                  <span className="text-text-lo">w={Number(n.weight).toFixed(2)}</span>
                  <span className="text-accent">a={Number(n.activation).toFixed(3)}</span>
                </div>
              </div>
            )) : <div className="text-text-lo">无激活节点。</div>}
          </div>
        </Panel>
        <Panel label="ACTION QUEUE" meta={<span className="pt-mono text-[10px] text-text-lo">程序性记忆</span>}>
          <div className="space-y-1 max-h-[440px] overflow-auto">
            {queue.length ? queue.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between border border-edge px-3 py-2">
                <span className="truncate">{a.node_id}</span>
                <div className="flex items-center gap-3">
                  <span className="pt-mono text-xs text-accent">a={Number(a.activation).toFixed(3)}</span>
                  <button className="pt-btn pt-btn-primary"
                    onClick={async () => { await api.fascinator.executeAction(a.node_id); load() }}>EXEC</button>
                </div>
              </div>
            )) : <div className="text-text-lo">行动队列为空。</div>}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ── ACTIONS — capabilities / intents / state / log ───────────────── */

const ActionsTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [caps, setCaps] = useState<any[]>([])
  const [intents, setIntents] = useState<any[]>([])
  const [state, setState] = useState<any>(null)
  const [log, setLog] = useState<any[]>([])
  const [registered, setRegistered] = useState<any[]>([])

  const load = async () => {
    const [c, i, s, l, r] = await Promise.all([
      fas('GET', '/api/action/capabilities'),
      fas('GET', '/api/action/intents'),
      fas('GET', '/api/action/state'),
      fas('GET', '/api/actions/log'),
      fas('GET', '/api/actions/registered'),
    ])
    if (c) setCaps(c.items ?? c.capabilities ?? c ?? [])
    if (i) setIntents(i.items ?? i.intents ?? i ?? [])
    if (s) setState(s)
    if (l) setLog(l.items ?? l.log ?? l ?? [])
    if (r) setRegistered(r.items ?? r.actions ?? r ?? [])
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel label="CAPABILITIES" meta={<button className="pt-btn pt-btn-ghost" onClick={load}><RefreshCw size={12} /></button>}>
        <div className="space-y-1 max-h-56 overflow-auto text-xs pt-mono text-text-mid">
          {caps.length ? caps.map((c: any, i) => (
            <div key={i} className="border border-edge px-2 py-1">{typeof c === 'string' ? c : JSON.stringify(c)}</div>
          )) : <div className="text-text-lo">无</div>}
        </div>
      </Panel>
      <Panel label="INTENTS">
        <div className="space-y-1 max-h-56 overflow-auto text-xs pt-mono text-text-mid">
          {intents.length ? intents.map((c: any, i) => (
            <div key={i} className="border border-edge px-2 py-1">{typeof c === 'string' ? c : JSON.stringify(c)}</div>
          )) : <div className="text-text-lo">无</div>}
        </div>
      </Panel>
      <Panel label="REGISTERED ACTIONS">
        <div className="space-y-1 max-h-56 overflow-auto text-xs pt-mono text-text-mid">
          {registered.length ? registered.map((c: any, i) => (
            <div key={i} className="border border-edge px-2 py-1">{typeof c === 'string' ? c : JSON.stringify(c)}</div>
          )) : <div className="text-text-lo">无</div>}
        </div>
      </Panel>
      <Panel label="STATE">
        <pre className="text-[11px] pt-mono text-text-mid max-h-56 overflow-auto whitespace-pre-wrap">
          {state ? JSON.stringify(state, null, 2) : '—'}
        </pre>
      </Panel>
      <div className="col-span-2">
        <Panel label="ACTION LOG">
          <div className="space-y-1 max-h-64 overflow-auto text-xs pt-mono">
            {log.length ? log.map((l: any, i) => (
              <div key={i} className="text-text-mid border-b border-edge/50 pb-1">
                {typeof l === 'string' ? l : JSON.stringify(l)}
              </div>
            )) : <div className="text-text-lo">暂无执行记录</div>}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ── SELF — the self model ────────────────────────────────────────── */

const SelfTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [emotion, setEmotion] = useState<any>(null)
  const [prefs, setPrefs] = useState<any>(null)
  const [goals, setGoals] = useState<any>(null)
  const [beliefs, setBeliefs] = useState<any>(null)
  const [dispositions, setDispositions] = useState<any>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [thought, setThought] = useState('')

  const load = async () => {
    const [e, p, g, b, d, c] = await Promise.all([
      fas('GET', '/api/self/emotion/current'),
      fas('GET', '/api/self/preferences'),
      fas('GET', '/api/self/goals'),
      fas('GET', '/api/self/model/beliefs'),
      fas('GET', '/api/self/dispositions'),
      fas('GET', '/api/self/reflection/candidates'),
    ])
    if (e) setEmotion(e)
    if (p) setPrefs(p)
    if (g) setGoals(g)
    if (b) setBeliefs(b)
    if (d) setDispositions(d)
    if (c) setCandidates(c.items ?? c.candidates ?? c ?? [])
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  const sendThought = async () => {
    if (!thought.trim()) return
    await fas('POST', '/api/self/thought', { text: thought })
    setThought('')
    load()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Panel label="EMOTION" meta={<Heart size={12} className="text-accent" />}>
          <div className="text-xl pt-display text-accent">{emotion?.emotion ?? emotion?.name ?? '—'}</div>
          {emotion?.intensity !== undefined && <KV k="intensity" v={Number(emotion.intensity).toFixed(2)} />}
        </Panel>
        <Panel label="GOALS">
          <div className="space-y-1 max-h-40 overflow-auto text-xs">
            {goals?.goals?.length ? goals.goals.map((g: any, i: number) => (
              <div key={i} className="border border-edge px-2 py-1">{typeof g === 'string' ? g : (g.text ?? g.description ?? JSON.stringify(g))}</div>
            )) : <div className="text-text-lo">无目标</div>}
          </div>
        </Panel>
        <Panel label="PREFERENCES">
          <div className="space-y-1 max-h-40 overflow-auto text-xs">
            {(prefs?.preferences && Object.entries(prefs.preferences).length > 0)
              ? Object.entries(prefs.preferences).map(([k, v]: any, i) => (
                  <div key={i} className="flex justify-between border border-edge px-2 py-1">
                    <span>{k}</span><span className="pt-mono text-accent">{Number(v).toFixed(2)}</span>
                  </div>
                ))
              : <div className="text-text-lo">无偏好数据</div>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="SELF·DIFFUSE" meta={
          <button className="pt-btn pt-btn-ghost"
            onClick={async () => { const r = await fas('POST', '/api/self/diffuse', { query: '自我状态' }); if (r) alert(JSON.stringify(r, null, 2)) }}>
            <Network size={12} /> RUN
          </button>
        }>
          <div className="text-xs text-text-mid leading-relaxed">
            以自我模型为中心跑一次扩散，返回与当前自我最相关的记忆节点（结果弹窗展示）。
          </div>
        </Panel>
        <Panel label="THOUGHT">
          <div className="flex gap-2">
            <input className="pt-input flex-1 pt-mono text-xs" placeholder="向自我注入一条想法…"
              value={thought} onChange={e => setThought(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendThought()} />
            <button className="pt-btn pt-btn-primary" onClick={sendThought}><Send size={12} /></button>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="BELIEFS">
          <pre className="text-[11px] pt-mono text-text-mid max-h-56 overflow-auto whitespace-pre-wrap">
            {beliefs ? JSON.stringify(beliefs, null, 2) : '—'}
          </pre>
        </Panel>
        <Panel label="DISPOSITIONS">
          <pre className="text-[11px] pt-mono text-text-mid max-h-56 overflow-auto whitespace-pre-wrap">
            {dispositions ? JSON.stringify(dispositions, null, 2) : '—'}
          </pre>
        </Panel>
      </div>

      <Panel label={`REFLECTION CANDIDATES ×${candidates.length}`} meta={
        <button className="pt-btn pt-btn-ghost" onClick={load}><RefreshCw size={12} /></button>
      }>
        <div className="space-y-1 max-h-56 overflow-auto">
          {candidates.length ? candidates.map((c: any, i) => (
            <div key={i} className="flex items-center justify-between border border-edge px-3 py-2 text-xs">
              <span className="truncate">{typeof c === 'string' ? c : (c.text ?? c.content ?? JSON.stringify(c))}</span>
              <button className="pt-btn pt-btn-primary text-xs"
                onClick={async () => { await fas('POST', '/api/self/reflection/approve', { id: c.id ?? i, candidate: c }); load() }}>
                APPROVE
              </button>
            </div>
          )) : <div className="text-text-lo text-xs">无待反思条目</div>}
        </div>
      </Panel>
    </div>
  )
}

/* ── MEMORY — episodic buffer + NLP logs + approve ────────────────── */

const MemoryTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [buffer, setBuffer] = useState<any[]>([])
  const [nlpLogs, setNlpLogs] = useState<any[]>([])

  const load = async () => {
    const [b, l] = await Promise.all([fas('GET', '/api/buffer'), fas('GET', '/api/nlp/logs')])
    if (b) setBuffer(b.items ?? b.buffer ?? b ?? [])
    if (l) setNlpLogs(l.items ?? l.logs ?? l ?? [])
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel label="EPISODIC BUFFER" meta={
        <div className="flex gap-2">
          <button className="pt-btn pt-btn-ghost" onClick={load}><RefreshCw size={12} /></button>
          <button className="pt-btn pt-btn-ghost"
            onClick={async () => { await fas('POST', '/api/buffer/clear'); load() }}><Trash2 size={12} /></button>
        </div>
      }>
        <div className="space-y-1 max-h-[420px] overflow-auto">
          {buffer.length ? buffer.map((b: any, i) => (
            <div key={i} className="border border-edge px-3 py-2">
              <div className="text-xs text-text-mid">{typeof b === 'string' ? b : (b.text ?? b.content ?? JSON.stringify(b))}</div>
              <div className="flex gap-2 mt-1">
                <button className="pt-btn pt-btn-primary text-[10px]"
                  onClick={async () => { await fas('POST', '/api/buffer/promote', { id: b.id ?? i, item: b }); load() }}>
                  PROMOTE 入图谱
                </button>
              </div>
            </div>
          )) : <div className="text-text-lo text-xs">情景缓冲区为空</div>}
        </div>
      </Panel>
      <Panel label="NLP LOGS">
        <div className="space-y-1 max-h-[420px] overflow-auto text-xs pt-mono">
          {nlpLogs.length ? nlpLogs.map((l: any, i) => (
            <div key={i} className="text-text-mid border-b border-edge/50 pb-1">
              {typeof l === 'string' ? l : JSON.stringify(l)}
            </div>
          )) : <div className="text-text-lo">无解析记录</div>}
        </div>
      </Panel>
    </div>
  )
}

/* ── PACKS — knowledge packs ──────────────────────────────────────── */

const PacksTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [packs, setPacks] = useState<any[]>([])
  const [name, setName] = useState('')

  const load = async () => {
    const r = await fas('GET', '/api/packs')
    if (r) setPacks(r.items ?? r.packs ?? r ?? [])
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input className="pt-input pt-mono text-xs w-56" placeholder="新知识包名称"
          value={name} onChange={e => setName(e.target.value)} />
        <button className="pt-btn pt-btn-primary"
          onClick={async () => {
            if (!name.trim()) return
            await fas('POST', '/api/packs/create', { name })
            setName(''); load()
          }}><Plus size={12} /> CREATE</button>
        <button className="pt-btn pt-btn-ghost" onClick={async () => { await fas('POST', '/api/packs/reload'); load() }}>
          <Boxes size={12} /> RELOAD ALL
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {packs.length ? packs.map((p: any, i) => {
          const pid = p.id ?? p.name ?? String(i)
          const enabled = p.enabled ?? false
          return (
            <div key={i} className="border border-edge p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="pt-mono text-sm text-text-hi">{p.name ?? p.id}</span>
                <span className={['pt-chip', enabled ? 'text-accent border-accent' : 'text-text-lo'].join(' ')}>
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              {p.description && <div className="text-xs text-text-lo line-clamp-2">{p.description}</div>}
              <div className="flex items-center justify-between text-xs text-text-lo pt-mono">
                <span>{p.nodes ?? '—'} nodes</span>
                <span>{p.edges ?? '—'} edges</span>
              </div>
              <div className="flex gap-2">
                <button className="pt-btn pt-btn-ghost flex-1 text-xs"
                  onClick={async () => { await fas('POST', '/api/packs/' + (enabled ? 'disable' : 'enable'), { id: pid, name: p.name }); load() }}>
                  {enabled ? 'DISABLE' : 'ENABLE'}
                </button>
                <button className="pt-btn pt-btn-ghost text-xs text-sig-error"
                  onClick={async () => { await fas('POST', '/api/packs/delete', { id: pid, name: p.name }); load() }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        }) : <div className="text-text-lo text-xs col-span-3">无知识包</div>}
      </div>
    </div>
  )
}

/* ── SENSE — ear & vision channels ────────────────────────────────── */

const SenseTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [ear, setEar] = useState<any>(null)
  const [vision, setVision] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [earText, setEarText] = useState('')

  const load = async () => {
    const [e, v, o] = await Promise.all([
      fas('GET', '/api/ear/status'), fas('GET', '/api/vision/status'), fas('GET', '/api/vision/objects'),
    ])
    if (e) setEar(e)
    if (v) setVision(v)
    if (o) setObjects(o.items ?? o.objects ?? o ?? [])
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  const earEnabled = ear?.enabled ?? ear?.active ?? false
  const visionEnabled = vision?.enabled ?? vision?.active ?? false

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Panel label="EAR · 听觉通道" meta={<Ear size={12} className="text-accent" />}>
          <div className="flex items-center gap-3">
            <span className={['pt-chip', earEnabled ? 'text-accent border-accent' : ''].join(' ')}>
              {earEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
            <button className="pt-btn pt-btn-ghost text-xs"
              onClick={async () => { await fas('POST', earEnabled ? '/api/ear/disable' : '/api/ear/enable'); load() }}>
              {earEnabled ? '关闭' : '开启'}
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <input className="pt-input flex-1 pt-mono text-xs" placeholder="手动送一段文本进听觉流…"
              value={earText} onChange={e => setEarText(e.target.value)} />
            <button className="pt-btn pt-btn-primary text-xs"
              onClick={async () => {
                if (!earText.trim()) return
                const r = await fas('POST', '/api/ear/process', { text: earText })
                if (r !== null) { setEarText(''); alert(JSON.stringify(r, null, 2)) }
              }}>PROCESS</button>
          </div>
        </Panel>
        <Panel label="VISION · 视觉通道" meta={<Brain size={12} className="text-accent" />}>
          <div className="flex items-center gap-3">
            <span className={['pt-chip', visionEnabled ? 'text-accent border-accent' : ''].join(' ')}>
              {visionEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
            <button className="pt-btn pt-btn-ghost text-xs"
              onClick={async () => { await fas('POST', visionEnabled ? '/api/vision/disable' : '/api/vision/enable'); load() }}>
              {visionEnabled ? '关闭' : '开启'}
            </button>
          </div>
          <div className="text-xs text-text-lo mt-3">识别对象经确认后进入知识图谱。</div>
        </Panel>
      </div>
      <Panel label={`VISION OBJECTS ×${objects.length}`} meta={
        <button className="pt-btn pt-btn-ghost" onClick={load}><RefreshCw size={12} /></button>
      }>
        <div className="grid grid-cols-4 gap-2">
          {objects.length ? objects.map((o: any, i) => (
            <div key={i} className="border border-edge p-2 text-xs">
              <div className="pt-mono text-text-hi">{typeof o === 'string' ? o : (o.name ?? o.label ?? JSON.stringify(o))}</div>
              <button className="pt-btn pt-btn-primary text-[10px] mt-2 w-full"
                onClick={async () => { await fas('POST', '/api/vision/confirm', { id: o.id ?? i, object: o }); load() }}>
                CONFIRM
              </button>
            </div>
          )) : <div className="text-text-lo text-xs col-span-4">暂无待确认对象</div>}
        </div>
      </Panel>
    </div>
  )
}

/* ── CHAT — conversation log + gaps ───────────────────────────────── */

const ChatTab: React.FC<{ running: boolean }> = ({ running }) => {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [q, setQ] = useState('')

  const load = async () => {
    const [l, s] = await Promise.all([fas('GET', '/api/chat/log'), fas('GET', '/api/chat/log/stats')])
    if (l) setLogs(l.items ?? l.logs ?? l ?? [])
    if (s) setStats(s)
  }
  useEffect(() => { if (running) load() }, [running])

  if (!running) return <>{needRun(running)}</>

  const search = async () => {
    if (!q.trim()) { load(); return }
    const r = await fas('GET', `/api/chat/log/search?q=${encodeURIComponent(q)}`)
    if (r) setLogs(r.items ?? r.results ?? r ?? [])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Tile label="MESSAGES" value={String(stats?.total ?? stats?.count ?? logs.length)} />
        <Tile label="SESSIONS" value={String(stats?.sessions ?? '—')} />
        <Tile label="GAPS" value={String(stats?.gaps ?? '—')} />
      </div>
      <Panel label="CONVERSATION LOG" meta={
        <div className="flex gap-2">
          <input className="pt-input pt-mono text-xs w-40" placeholder="搜索对话…"
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <button className="pt-btn pt-btn-ghost" onClick={load}><MessageSquare size={12} /></button>
          <button className="pt-btn pt-btn-ghost text-sig-error"
            onClick={async () => { await fas('POST', '/api/chat/log/clear'); load() }}><Trash2 size={12} /></button>
        </div>
      }>
        <div className="space-y-1 max-h-[460px] overflow-auto text-xs pt-mono">
          {logs.length ? logs.map((l: any, i) => (
            <div key={i} className="border-b border-edge/50 pb-1 text-text-mid">
              {typeof l === 'string' ? l : JSON.stringify(l)}
            </div>
          )) : <div className="text-text-lo">无对话记录</div>}
        </div>
      </Panel>
    </div>
  )
}

/* ── CONFIG ───────────────────────────────────────────────────────── */

const ConfigTab: React.FC = () => {
  const [cfgText, setCfgText] = useState('')

  const load = async () => {
    try {
      const c = await api.fascinator.readConfig()
      setCfgText(typeof c === 'string' ? c : JSON.stringify(c, null, 2))
    } catch (_) {}
  }
  const save = async () => { try { await api.fascinator.writeConfig(cfgText) } catch (_) {} }
  useEffect(() => { load() }, [])

  return (
    <GlassPanel
      title="CONFIG EDITOR"
      subtitle="Fascinator 超参数 · JSON · 直接写回 config 文件"
      actions={
        <div className="flex items-center gap-2">
          <button className="pt-btn pt-btn-ghost" onClick={load}><RotateCcw size={13} /> RELOAD</button>
          <button className="pt-btn pt-btn-primary" onClick={save}><Cog size={13} /> SAVE</button>
        </div>
      }
    >
      <textarea
        className="pt-input mt-3 w-full min-h-[420px] pt-mono text-[12px] leading-relaxed"
        value={cfgText}
        onChange={e => setCfgText(e.target.value)}
        spellCheck={false}
      />
      <div className="mt-2 text-xs text-text-lo">
        lambda_decay (衰减) · beta_spread (扩散增益) · theta_threshold (激活阈值) ·
        theta_action (行动阈值) · k_top (注意容量) · max_depth (扩散深度) · auto_interval (自动节拍)
      </div>
    </GlassPanel>
  )
}

export default Fascinator
