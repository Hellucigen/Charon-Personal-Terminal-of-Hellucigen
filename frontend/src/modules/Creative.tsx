import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, PenLine, Palette } from 'lucide-react'

/* Creative studio — moodboards (colors / text / image refs) and a
 * writing-mode log with a daily word goal. */

export const Creative: React.FC = () => {
  const [tab, setTab] = useState<'mood' | 'writing'>('mood')

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="CREATIVE · 创意工作台" subtitle="情绪板 · 专注写作 · 字数目标" />
      <div className="flex items-center gap-1">
        {(['mood', 'writing'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={['pt-section-label px-3 py-2 transition-colors', tab === t ? 'text-accent' : 'text-text-lo hover:text-text-mid'].join(' ')}>
            {t === 'mood' ? 'MOODBOARD' : 'WRITING'}
          </button>
        ))}
      </div>
      {tab === 'mood' ? <Moodboard /> : <Writing />}
    </div>
  )
}

const Moodboard: React.FC = () => {
  const [boards, setBoards] = useState<any[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [item, setItem] = useState({ type: 'color', value: '#ff6b00', label: '' })

  const load = async () => {
    const bs = await api.creative.boards('moodboard') ?? []
    setBoards(bs)
    if (!cur && bs.length) setCur(bs[0].id)
  }
  useEffect(() => { load() }, [])

  const curBoard = boards.find(b => b.id === cur)

  const addBoard = async () => {
    if (!name.trim()) return
    const b = await api.creative.saveBoard({ name, kind: 'moodboard', items: [] })
    setName('')
    await load()
    if (b?.id) setCur(b.id)
  }

  const addItem = async () => {
    if (!curBoard || !item.value) return
    await api.creative.saveBoard({
      ...curBoard, items: [...(curBoard.items ?? []), { ...item }],
    })
    setItem({ ...item, value: item.type === 'color' ? '#ff6b00' : '', label: '' })
    load()
  }

  const delItem = async (i: number) => {
    if (!curBoard) return
    await api.creative.saveBoard({ ...curBoard, items: curBoard.items.filter((_: any, j: number) => j !== i) })
    load()
  }

  return (
    <div className="grid grid-cols-[240px_1fr] gap-3">
      <div className="space-y-2">
        <div className="border border-edge p-3 space-y-2">
          <div className="pt-section-label text-text-lo flex items-center gap-1.5"><Palette size={12} /> NEW BOARD</div>
          <input className="pt-input w-full pt-mono text-xs" placeholder="情绪板名 *"
            value={name} onChange={e => setName(e.target.value)} />
          <button className="pt-btn pt-btn-primary w-full text-xs" onClick={addBoard}><Plus size={12} /> 创建</button>
        </div>
        {boards.map(b => (
          <div key={b.id}
            className={['border px-3 py-2 cursor-pointer flex items-center justify-between transition-colors',
              cur === b.id ? 'border-accent bg-surface' : 'border-edge hover:border-accent/50'].join(' ')}
            onClick={() => setCur(b.id)}>
            <span className="text-sm truncate">{b.name}</span>
            <button className="text-sig-error shrink-0"
              onClick={async e => { e.stopPropagation(); await api.creative.deleteBoard(b.id); if (cur === b.id) setCur(null); load() }}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {curBoard ? (
        <div className="space-y-3">
          <div className="border border-edge p-3 flex gap-2 flex-wrap items-center">
            <select className="pt-input pt-mono text-xs w-20" value={item.type}
              onChange={e => setItem({ ...item, type: e.target.value, value: e.target.value === 'color' ? '#ff6b00' : '' })}>
              <option value="color">颜色</option>
              <option value="text">文字</option>
              <option value="image">图片</option>
            </select>
            {item.type === 'color'
              ? <input type="color" className="pt-input w-12 h-8 p-0.5" value={item.value}
                  onChange={e => setItem({ ...item, value: e.target.value })} />
              : <input className="pt-input pt-mono text-xs w-56" placeholder={item.type === 'text' ? '文字内容' : '图片路径 / URL'}
                  value={item.value} onChange={e => setItem({ ...item, value: e.target.value })} />}
            <input className="pt-input pt-mono text-xs w-32" placeholder="标签"
              value={item.label} onChange={e => setItem({ ...item, label: e.target.value })} />
            <button className="pt-btn pt-btn-primary text-xs" onClick={addItem}><Plus size={12} /> 加入</button>
          </div>

          <div className="border border-edge p-4 grid grid-cols-4 gap-3 min-h-[300px] content-start"
            style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {(curBoard.items ?? []).map((it: any, i: number) => (
              <div key={i} className="group relative">
                {it.type === 'color' && (
                  <div className="h-20 border border-edge" style={{ background: it.value }}>
                    <span className="pt-mono text-[10px] text-black/60 absolute bottom-1 left-1.5">{it.value}</span>
                  </div>
                )}
                {it.type === 'text' && (
                  <div className="border border-edge p-3 h-20 flex items-center justify-center text-center text-sm text-text-mid">
                    {it.value}
                  </div>
                )}
                {it.type === 'image' && (
                  <div className="border border-edge p-3 h-20 flex flex-col items-center justify-center text-[10px] text-text-lo pt-mono break-all">
                    <span className="text-accent">IMG</span>
                    <span className="truncate w-full text-center">{it.value.split(/[\\/]/).pop()}</span>
                  </div>
                )}
                {it.label && <div className="text-[10px] text-text-lo mt-1 truncate">{it.label}</div>}
                <button className="absolute -top-1.5 -right-1.5 text-sig-error opacity-0 group-hover:opacity-100 bg-bg rounded-full"
                  onClick={() => delItem(i)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {(curBoard.items ?? []).length === 0 && (
              <div className="col-span-4 text-xs text-text-lo text-center py-16">配色 / 文案 / 灵感图 · 拼出你的下一件事的气质</div>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-edge p-8 text-center text-xs text-text-lo">左侧创建或选择一个情绪板</div>
      )}
    </div>
  )
}

const Writing: React.FC = () => {
  const [stats, setStats] = useState<any>(null)
  const [words, setWords] = useState('')
  const [note, setNote] = useState('')

  const load = async () => setStats(await api.creative.writingStats(500))
  useEffect(() => { load() }, [])

  const log = async () => {
    const w = Number(words)
    if (!w) return
    await api.creative.logWriting(w, note)
    setWords(''); setNote('')
    load()
  }

  const pct = Math.min(100, ((stats?.today ?? 0) / (stats?.goal ?? 500)) * 100)
  const days: any[] = stats?.days ?? []
  const maxW = Math.max(1, ...days.map(d => d.words))

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="border border-edge p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="pt-section-label text-text-lo flex items-center gap-1.5"><PenLine size={12} /> 今日字数</div>
          <span className="pt-mono text-xs text-text-lo">目标 {stats?.goal ?? 500}</span>
        </div>
        <div className="pt-display text-3xl pt-mono text-accent">{stats?.today ?? 0}</div>
        <div className="h-2 bg-edge/40 mt-3">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-text-lo pt-mono mt-1">{pct.toFixed(0)}% · 写作自动换算 XP（每 100 字 = 1 XP · 创造属性）</div>
      </div>

      <div className="border border-edge p-3 flex gap-2 items-center">
        <input className="pt-input pt-mono text-xs w-24" placeholder="字数 *" inputMode="numeric"
          value={words} onChange={e => setWords(e.target.value.replace(/\D/g, ''))} />
        <input className="pt-input pt-mono text-xs flex-1" placeholder="写了什么（可选）"
          value={note} onChange={e => setNote(e.target.value)} />
        <button className="pt-btn pt-btn-primary text-xs" onClick={log}><Plus size={12} /> 记录</button>
      </div>

      <div className="border border-edge p-3">
        <div className="pt-section-label text-text-lo mb-3">近 30 天</div>
        <div className="flex items-end gap-1 h-24">
          {days.map((d, i) => (
            <div key={i} className="flex-1 bg-accent/70 min-w-[3px]" title={`${d.day}: ${d.words} 字`}
              style={{ height: `${(d.words / maxW) * 100}%` }} />
          ))}
          {days.length === 0 && <div className="text-xs text-text-lo w-full text-center self-center">还没有写作记录</div>}
        </div>
      </div>
    </div>
  )
}

export default Creative
