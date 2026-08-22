import React, { useEffect, useRef, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Link2, Download, Trash2 } from 'lucide-react'

/* Detective board — a red-string corkboard on an SVG canvas.
 * Drag nodes freely, link them with one of three relations, pin notes. */

const KIND_COLOR: Record<string, string> = {
  person: '#ff6b00', place: '#009a9b', event: '#7c4dff',
  evidence: '#2e7d32', theory: '#c2185b',
}
const KINDS = Object.keys(KIND_COLOR)
const REL_COLOR: Record<string, string> = {
  confirmed: '#f87171', suspect: '#fbbf24', 'ruled-out': '#6b7280',
}

export const Detective: React.FC = () => {
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [sel, setSel] = useState<any | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [rel, setRel] = useState('suspect')
  const [form, setForm] = useState({ kind: 'person', label: '', note: '' })
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const W = 1100, H = 640

  const load = async () => {
    const b = await api.detective.board()
    setNodes(b?.nodes ?? [])
    setEdges(b?.edges ?? [])
  }
  useEffect(() => { load() }, [])

  const toSVG = (e: React.MouseEvent) => {
    const svg = svgRef.current!
    const r = svg.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }

  const onMouseDown = (e: React.MouseEvent, n: any) => {
    e.stopPropagation()
    const p = toSVG(e)
    dragRef.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y }
    setSel(n)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const p = toSVG(e)
    const id = dragRef.current.id
    const x = Math.max(60, Math.min(W - 60, p.x - dragRef.current.dx))
    const y = Math.max(30, Math.min(H - 30, p.y - dragRef.current.dy))
    setNodes(ns => ns.map(n => n.id === id ? { ...n, x, y } : n))
  }
  const onMouseUp = () => {
    if (dragRef.current) {
      const n = nodes.find(n => n.id === dragRef.current!.id)
      if (n) api.detective.move(n.id, n.x, n.y)
    }
    dragRef.current = null
  }

  const addNode = async () => {
    if (!form.label.trim()) return
    await api.detective.saveNode({
      kind: form.kind, label: form.label, note: form.note,
      x: 120 + Math.random() * (W - 240), y: 80 + Math.random() * (H - 160),
    })
    setForm({ kind: form.kind, label: '', note: '' })
    load()
  }

  const onNodeClick = async (n: any) => {
    if (linkFrom && linkFrom !== n.id) {
      await api.detective.addEdge(linkFrom, n.id, rel)
      setLinkFrom(null)
      load()
      return
    }
    if (linkFrom === n.id) { setLinkFrom(null); return }
    setSel(n)
  }

  const deleteNode = async (id: string) => {
    await api.detective.deleteNode(id)
    setSel(null); setLinkFrom(null); load()
  }

  const exportBoard = async () => {
    const json = await api.detective.exportBoard()
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'detective-board.json'
    a.click()
  }

  const selEdges = edges.filter(e => e.from_id === sel?.id || e.to_id === sel?.id)

  return (
    <div className="p-6 space-y-4">
      <GlassPanel
        title="DETECTIVE BOARD · 侦探线索板"
        subtitle={`${nodes.length} 节点 · ${edges.length} 红绳 · 拖拽移动 · 连线模式画关系`}
        actions={
          <div className="flex items-center gap-2">
            <button className="pt-btn pt-btn-ghost" onClick={exportBoard}><Download size={13} /> EXPORT</button>
          </div>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <select className="pt-input pt-mono text-xs w-24" value={form.kind}
          onChange={e => setForm({ ...form, kind: e.target.value })}>
          {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input className="pt-input pt-mono text-xs w-44" placeholder="节点标题 *"
          value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addNode()} />
        <input className="pt-input pt-mono text-xs flex-1 min-w-[160px]" placeholder="备注"
          value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <button className="pt-btn pt-btn-primary" onClick={addNode}><Plus size={12} /> ADD</button>
        <span className="w-px h-6 bg-edge mx-1" />
        <select className="pt-input pt-mono text-xs w-28" value={rel} onChange={e => setRel(e.target.value)}>
          <option value="confirmed">confirmed</option>
          <option value="suspect">suspect</option>
          <option value="ruled-out">ruled-out</option>
        </select>
        <button className={['pt-btn', linkFrom ? 'pt-btn-primary' : 'pt-btn-ghost'].join(' ')}
          onClick={() => setLinkFrom(linkFrom ? null : (sel?.id ?? null))}>
          <Link2 size={12} /> {linkFrom ? '选择目标节点…' : '连线'}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-3">
        <div className="border border-edge bg-[#f0ece9] relative overflow-hidden"
          style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none"
            style={{ cursor: dragRef.current ? 'grabbing' : 'default' }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            {edges.map(e => {
              const s = nodes.find(n => n.id === e.from_id)
              const t = nodes.find(n => n.id === e.to_id)
              if (!s || !t) return null
              const mx = (s.x + t.x) / 2 + (t.y - s.y) * 0.12
              const my = (s.y + t.y) / 2 - (t.x - s.x) * 0.12
              return (
                <path key={e.id} d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`}
                  fill="none" stroke={REL_COLOR[e.relation] ?? '#f87171'} strokeWidth={1.6} strokeDasharray="6 3"
                  opacity={0.8} style={{ cursor: 'pointer' }}
                  onClick={async () => { await api.detective.deleteEdge(e.id); load() }} />
              )
            })}
            {nodes.map(n => {
              const c = KIND_COLOR[n.kind] ?? '#009a9b'
              const isSel = sel?.id === n.id
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}
                  onMouseDown={e => onMouseDown(e, n)}
                  onClick={() => { if (!dragRef.current) onNodeClick(n) }}
                  style={{ cursor: 'grab' }}>
                  <rect x={-70} y={-22} width={140} height={44}
                    fill="rgba(250,250,250,0.95)" stroke={c} strokeWidth={isSel ? 2.5 : 1.4} />
                  <circle cx={-70} cy={-22} r={4} fill={c} />
                  <circle cx={70} cy={22} r={4} fill={c} />
                  <text x={0} y={-4} textAnchor="middle" fontSize={11} fill="#1a1a1a" className="pt-mono">
                    {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
                  </text>
                  <text x={0} y={12} textAnchor="middle" fontSize={9} fill={c} opacity={0.8} className="pt-mono">
                    {n.kind}
                  </text>
                  {linkFrom === n.id && (
                    <rect x={-74} y={-26} width={148} height={52} fill="none" stroke="#009a9b" strokeDasharray="4 3" />
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="space-y-3">
          {sel ? (
            <div className="border border-edge p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="pt-section-label text-text-lo">NODE</span>
                <button className="text-sig-error hover:text-red-400" onClick={() => deleteNode(sel.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="text-sm text-text-hi pt-mono">{sel.label}</div>
              <div className="text-xs text-text-lo mt-1">{sel.note || '无备注'}</div>
              <div className="mt-3 space-y-1">
                {selEdges.map(e => {
                  const other = e.from_id === sel.id ? e.to_id : e.from_id
                  const otherNode = nodes.find(n => n.id === other)
                  return (
                    <div key={e.id} className="flex items-center justify-between text-xs border border-edge px-2 py-1">
                      <span style={{ color: REL_COLOR[e.relation] }}>— {e.relation} —</span>
                      <span className="pt-mono text-text-mid truncate max-w-[110px]">{otherNode?.label ?? other}</span>
                    </div>
                  )
                })}
                {selEdges.length === 0 && <div className="text-xs text-text-lo">无边 · 用连线模式连接</div>}
              </div>
              <input className="pt-input w-full pt-mono text-xs mt-3" placeholder="更新备注…"
                onKeyDown={async ev => {
                  if (ev.key === 'Enter') {
                    await api.detective.saveNode({ ...sel, note: (ev.target as HTMLInputElement).value })
                    load()
                  }
                }} />
            </div>
          ) : (
            <div className="border border-edge p-3 text-xs text-text-lo leading-relaxed">
              点击卡片查看关系；拖拽画布移动卡片；点击红色曲线删除连线。
            </div>
          )}
          <div className="border border-edge p-3 space-y-1.5">
            <div className="pt-section-label text-text-lo mb-2">LEGEND</div>
            {Object.entries(KIND_COLOR).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 border" style={{ borderColor: c }} /> {k}
              </div>
            ))}
            <div className="h-2" />
            {Object.entries(REL_COLOR).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-6 border-t-2 border-dashed" style={{ borderColor: c }} /> {k}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Detective
