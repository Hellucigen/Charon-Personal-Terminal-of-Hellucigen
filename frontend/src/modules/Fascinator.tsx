import React, { useEffect, useRef, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Play, Square, RotateCcw, Send, Settings as Cog, Activity, Zap } from 'lucide-react'

type Status = {
  running: boolean
  pid?: number
  port?: number
  ping?: boolean
  uptime?: number
}

type ParsedNLP = {
  nodes: string[]
  edges: { src: string; dst: string; relation: string }[]
  speech_act: string
}

type Action = { activation: number; node_id: string }

export const Fascinator: React.FC = () => {
  const [status, setStatus] = useState<Status>({ running: false })
  const [logs, setLogs] = useState<string[]>([])
  const [nlpInput, setNlpInput] = useState('')
  const [nlpResult, setNlpResult] = useState<ParsedNLP | null>(null)
  const [topk, setTopk] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  const [actionQueue, setActionQueue] = useState<Action[]>([])
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'console' | 'nlp' | 'topk' | 'config'>('console')
  const [cfgText, setCfgText] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)

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
    const id = setInterval(tick, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const doStart = async () => {
    setBusy(true)
    try { await api.fascinator.start() } finally { setBusy(false) }
  }
  const doStop = async () => {
    setBusy(true)
    try { await api.fascinator.stop() } finally { setBusy(false) }
  }
  const doRestart = async () => {
    setBusy(true)
    try { await api.fascinator.restart() } finally { setBusy(false) }
  }

  const sendNLP = async () => {
    if (!nlpInput.trim()) return
    setBusy(true)
    try {
      const res = await api.fascinator.nlp(nlpInput)
      setNlpResult(res?.parsed ?? null)
      setNlpInput('')
      await loadTopK()
      await loadQueue()
    } finally {
      setBusy(false)
    }
  }

  const loadTopK = async () => {
    try {
      const r = await api.fascinator.topk()
      setTopk(r)
    } catch (_) {}
  }
  const loadQueue = async () => {
    try {
      const r = await api.fascinator.actionQueue()
      setActionQueue(r?.queue ?? [])
    } catch (_) {}
  }

  useEffect(() => {
    if (status.running) {
      loadTopK()
      loadQueue()
    }
  }, [status.running])

  const loadConfig = async () => {
    try {
      const c = await api.fascinator.readConfig()
      setCfgText(typeof c === 'string' ? c : JSON.stringify(c, null, 2))
    } catch (_) {}
  }
  const saveConfig = async () => {
    try {
      await api.fascinator.writeConfig(cfgText)
    } catch (_) {}
  }
  useEffect(() => { if (tab === 'config') loadConfig() }, [tab])

  const dot = status.running
    ? <span className="pt-dot pt-dot-live" />
    : <span className="pt-dot pt-dot-idle" />

  const StatusBlob = (
    <div className="flex items-center gap-2 pt-mono text-xs text-text-mid">
      {dot}
      <span>{status.running ? 'RUNNING' : 'STOPPED'}</span>
      {status.running && status.pid && <span className="text-text-lo">·</span>}
      {status.running && status.pid && <span>PID {status.pid}</span>}
      {status.running && status.port && <span className="text-text-lo">·</span>}
      {status.running && status.port && <span>:{status.port}</span>}
    </div>
  )

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <GlassPanel
        title="FASCINATOR"
        subtitle="认知架构 · 知识图谱 · 激活扩散引擎"
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
        <div className="grid grid-cols-4 gap-3 mt-4">
          <Tile label="STATE"     value={status.running ? 'LIVE' : 'IDLE'} accent={status.running} />
          <Tile label="PING"      value={status.ping ? 'OK' : '—'}        accent={!!status.ping} />
          <Tile label="TOP·NODES" value={String(topk?.nodes?.length ?? 0)} />
          <Tile label="QUEUE"     value={String(actionQueue.length)} />
        </div>
      </GlassPanel>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {(['console', 'nlp', 'topk', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'pt-section-label px-3 py-2 transition-colors',
              tab === t ? 'text-accent' : 'text-text-lo hover:text-text-mid',
            ].join(' ')}
          >
            {t === 'console' && 'CONSOLE'}
            {t === 'nlp' && 'NLP·INPUT'}
            {t === 'topk' && 'TOP-K'}
            {t === 'config' && 'CONFIG'}
          </button>
        ))}
      </div>

      {tab === 'console' && (
        <GlassPanel title="LOG STREAM" subtitle="进程标准输出 / 错误输出实时尾随" meta={StatusBlob}>
          <div
            ref={logRef}
            className="mt-3 h-[420px] overflow-auto pt-mono text-[12px] leading-relaxed bg-bg/60 border border-edge p-3"
          >
            {logs.length === 0 ? (
              <div className="text-text-lo">无日志输出 · 启动 Fascinator 后这里将实时滚动</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={l.includes('ERROR') ? 'text-sig-error' : 'text-text-mid'}>{l}</div>
              ))
            )}
          </div>
        </GlassPanel>
      )}

      {tab === 'nlp' && (
        <GlassPanel
          title="NATURAL LANGUAGE INPUT"
          subtitle="发送中文句子 → jieba 分词 → Claude 解析 → 图谱激活"
        >
          <div className="flex items-start gap-3 mt-3">
            <textarea
              className="pt-input flex-1 min-h-[100px] resize-y"
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              placeholder="例如：明天早上九点带笔记本去图书馆背单词。"
              disabled={!status.running}
            />
            <button
              className="pt-btn pt-btn-primary self-stretch px-5"
              disabled={busy || !status.running || !nlpInput.trim()}
              onClick={sendNLP}
            >
              <Send size={14} /> SEND
            </button>
          </div>
          {!status.running && (
            <div className="mt-2 text-xs text-sig-warn pt-mono">需要先启动 Fascinator 后端进程</div>
          )}

          {nlpResult && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <ParseCard label="NODES" count={nlpResult.nodes.length}>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {nlpResult.nodes.map((n, i) => (
                    <div key={i} className="pt-chip">{n}</div>
                  ))}
                </div>
              </ParseCard>
              <ParseCard label="EDGES" count={nlpResult.edges.length}>
                <div className="space-y-1 max-h-[200px] overflow-auto pt-mono text-[11px]">
                  {nlpResult.edges.map((e, i) => (
                    <div key={i} className="text-text-mid">
                      <span className="text-accent">{e.src}</span>
                      <span className="text-text-lo"> ─[{e.relation}]→ </span>
                      <span className="text-accent">{e.dst}</span>
                    </div>
                  ))}
                </div>
              </ParseCard>
              <ParseCard label="SPEECH·ACT" count={1}>
                <div className="text-xl pt-display text-accent">{nlpResult.speech_act}</div>
                <div className="text-xs text-text-lo mt-2">基于 Searle 言语行为五分类</div>
              </ParseCard>
            </div>
          )}
        </GlassPanel>
      )}

      {tab === 'topk' && (
        <div className="grid grid-cols-2 gap-3">
          <GlassPanel title="TOP-K NODES" subtitle="注意候选集 · 按激活度排序" meta={
            <button className="pt-btn pt-btn-ghost" onClick={loadTopK}>
              <Activity size={12} /> REFRESH
            </button>
          }>
            <div className="mt-3 space-y-1 max-h-[440px] overflow-auto">
              {topk?.nodes?.length ? topk.nodes.map((n: any, i: number) => (
                <div key={i} className="flex items-center justify-between border border-edge px-3 py-2 hover:border-accent transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-text-lo pt-mono text-[10px]">#{String(i + 1).padStart(2, '0')}</span>
                    <span className="truncate">{n.id}</span>
                    <span className="pt-chip">{n.label?.replace('declarative-', 'd·')}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-mono text-xs">
                    <span className="text-text-lo">w={Number(n.weight).toFixed(2)}</span>
                    <span className="text-accent">a={Number(n.activation).toFixed(3)}</span>
                  </div>
                </div>
              )) : <div className="text-text-lo">无激活节点。先在 NLP·INPUT 发送一句话试试。</div>}
            </div>
          </GlassPanel>

          <GlassPanel title="ACTION QUEUE" subtitle="程序性记忆 · 待执行队列" meta={
            <button className="pt-btn pt-btn-ghost" onClick={loadQueue}>
              <Zap size={12} /> REFRESH
            </button>
          }>
            <div className="mt-3 space-y-1 max-h-[440px] overflow-auto">
              {actionQueue.length ? actionQueue.map((a, i) => (
                <div key={i} className="flex items-center justify-between border border-edge px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-lo pt-mono text-[10px]">#{String(i + 1).padStart(2, '0')}</span>
                    <span>{a.node_id}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="pt-mono text-xs text-accent">a={a.activation.toFixed(3)}</span>
                    <button
                      className="pt-btn pt-btn-primary"
                      onClick={async () => { await api.fascinator.executeAction(a.node_id); await loadQueue() }}
                    >EXEC</button>
                  </div>
                </div>
              )) : <div className="text-text-lo">行动队列为空。</div>}
            </div>
          </GlassPanel>
        </div>
      )}

      {tab === 'config' && (
        <GlassPanel
          title="CONFIG EDITOR"
          subtitle="Fascinator 超参数 · YAML/JSON · 在此可视化编辑"
          meta={<span className="pt-mono text-[11px] text-text-lo">{api.platform()}</span>}
          actions={
            <div className="flex items-center gap-2">
              <button className="pt-btn pt-btn-ghost" onClick={loadConfig}><RotateCcw size={13} /> RELOAD</button>
              <button className="pt-btn pt-btn-primary" onClick={saveConfig}><Cog size={13} /> SAVE</button>
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
            常见字段：lambda_decay (衰减系数) · beta_spread (扩散增益) · theta_threshold (激活阈值) ·
            theta_action (行动触发阈值) · k_top (注意容量) · max_depth (最大扩散深度) · auto_interval (自动节拍)
          </div>
        </GlassPanel>
      )}
    </div>
  )
}

const Tile: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="border border-edge px-3 py-3">
    <div className="pt-section-label text-text-lo">{label}</div>
    <div className={['pt-display text-2xl mt-1 pt-mono', accent ? 'text-accent' : 'text-text-hi'].join(' ')}>{value}</div>
  </div>
)

const ParseCard: React.FC<{ label: string; count: number; children: React.ReactNode }> = ({ label, count, children }) => (
  <div className="border border-edge p-3">
    <div className="flex items-center justify-between mb-3">
      <span className="pt-section-label text-text-lo">{label}</span>
      <span className="pt-mono text-[10px] text-accent">×{count}</span>
    </div>
    {children}
  </div>
)
