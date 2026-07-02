import React, { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import GlassPanel from '@/components/GlassPanel'
import { Plus, Folder, FolderOpen, Terminal, Code2, Trash2, Pin, ExternalLink } from 'lucide-react'

type Shortcut = {
  id: string
  label: string
  target: string
  icon?: string
  pinned: boolean
  open_count: number
  created_at: number
  tags?: string[]
}

export const Shortcuts: React.FC = () => {
  const [items, setItems] = useState<Shortcut[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({ label: '', target: '', pinned: false })

  const reload = useCallback(async () => {
    const list = (await api.shortcuts.list()) ?? []
    list.sort((a: Shortcut, b: Shortcut) =>
      Number(b.pinned) - Number(a.pinned) ||
      (b.open_count || 0) - (a.open_count || 0)
    )
    setItems(list)
  }, [])

  useEffect(() => { reload() }, [reload])

  const add = async () => {
    if (!draft.label.trim() || !draft.target.trim()) return
    await api.shortcuts.add(draft)
    setDraft({ label: '', target: '', pinned: false })
    setShowAdd(false)
    reload()
  }

  const open = async (id: string) => { await api.shortcuts.open(id); reload() }
  const remove = async (id: string) => { await api.shortcuts.remove(id); reload() }

  const pinned = items.filter(s => s.pinned)
  const rest = items.filter(s => !s.pinned)

  return (
    <div className="p-6 space-y-4">
      <GlassPanel
        title="SHORTCUTS · 文件夹与快捷方式"
        subtitle="一键打开资源管理器 / 终端 / VSCode · 支持 .lnk 导入"
        meta={<span className="pt-mono text-xs text-text-lo">{items.length} 项</span>}
        actions={
          <button className="pt-btn pt-btn-primary" onClick={() => setShowAdd(v => !v)}>
            <Plus size={13} /> 添加
          </button>
        }
      >
        {showAdd && (
          <div className="mt-4 p-3 border border-edge space-y-2">
            <input
              className="pt-input w-full"
              placeholder="名称（如：Fascinator 源码）"
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
            />
            <input
              className="pt-input w-full pt-mono text-xs"
              placeholder="路径或 URL（如：~/code/fascinator 或 steam://nav/library）"
              value={draft.target}
              onChange={e => setDraft({ ...draft, target: e.target.value })}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
                <input type="checkbox" checked={draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} />
                置顶
              </label>
              <div className="flex items-center gap-2">
                <button className="pt-btn pt-btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
                <button className="pt-btn pt-btn-primary" onClick={add}>保存</button>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {pinned.length > 0 && (
        <>
          <div className="pt-section-label text-text-lo">PINNED · {pinned.length}</div>
          <Grid items={pinned} onOpen={open} onRemove={remove} />
        </>
      )}
      {rest.length > 0 && (
        <>
          <div className="pt-section-label text-text-lo">ALL · {rest.length}</div>
          <Grid items={rest} onOpen={open} onRemove={remove} />
        </>
      )}
      {items.length === 0 && (
        <div className="pt-glass p-12 text-center text-text-lo">
          <div className="pt-section-label mb-2">EMPTY</div>
          <div className="text-xs">点击右上角 + 添加你的第一个快捷方式</div>
        </div>
      )}
    </div>
  )
}

const Grid: React.FC<{ items: Shortcut[]; onOpen: (id: string) => void; onRemove: (id: string) => void }> = ({ items, onOpen, onRemove }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
    {items.map(s => {
      const isURL = /^[a-z]+:\/\//i.test(s.target)
      const Icon = isURL ? ExternalLink : (s.target.endsWith('/') ? Folder : FolderOpen)
      return (
        <div key={s.id} className="pt-glass p-4 group hover:border-accent transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 border border-accent text-accent flex items-center justify-center">
              <Icon size={16} />
            </div>
            <div className="flex items-center gap-1">
              {s.pinned && <Pin size={11} className="text-accent" />}
              <span className="pt-mono text-[10px] text-text-lo">×{s.open_count}</span>
            </div>
          </div>
          <button onClick={() => onOpen(s.id)} className="block w-full text-left">
            <div className="text-sm text-text-hi truncate group-hover:text-accent transition-colors">{s.label}</div>
            <div className="pt-mono text-[10px] text-text-lo truncate mt-1">{s.target}</div>
          </button>
          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="pt-btn pt-btn-ghost" onClick={() => onOpen(s.id)}>打开</button>
            <button className="pt-btn pt-btn-ghost" title="资源管理器"><FolderOpen size={11} /></button>
            <button className="pt-btn pt-btn-ghost" title="终端"><Terminal size={11} /></button>
            <button className="pt-btn pt-btn-ghost" title="VSCode"><Code2 size={11} /></button>
            <button className="pt-btn pt-btn-ghost text-sig-error ml-auto" onClick={() => onRemove(s.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )
    })}
  </div>
)

export default Shortcuts
