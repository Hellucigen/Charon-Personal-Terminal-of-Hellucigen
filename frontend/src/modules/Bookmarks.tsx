import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import GlassPanel from '@/components/GlassPanel'
import { Plus, Globe, Download, Trash2, FolderOpen, ChevronRight } from 'lucide-react'

type Bookmark = {
  id: string
  title: string
  url: string
  folder: string
  tags: string[]
  snapshot_path?: string
  dead: boolean
  created_at: number
}

export const Bookmarks: React.FC = () => {
  const [items, setItems] = useState<Bookmark[]>([])
  const [folder, setFolder] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({ title: '', url: '', folder: '', tags: [] as string[] })

  const reload = useCallback(async () => {
    const list = (await api.bookmarks.list(folder)) ?? []
    setItems(list)
  }, [folder])

  useEffect(() => { reload() }, [reload])

  const folders = useMemo(() => {
    const set = new Set<string>([''])
    items.forEach(b => set.add(b.folder || ''))
    return Array.from(set).sort()
  }, [items])

  const add = async () => {
    if (!draft.url.trim()) return
    await api.bookmarks.add(draft)
    setDraft({ title: '', url: '', folder: '', tags: [] })
    setShowAdd(false)
    reload()
  }

  const importEdge = async () => {
    const path = prompt('输入 Edge 导出的 HTML 文件路径')
    if (!path) return
    const n = await api.bookmarks.importEdgeHTML(path)
    alert(`导入了 ${n} 条书签`)
    reload()
  }

  const remove = async (id: string) => { await api.bookmarks.remove(id); reload() }

  const filtered = folder ? items.filter(b => b.folder === folder) : items

  return (
    <div className="h-full flex gap-3 p-6">
      {/* Folder tree */}
      <div className="w-56 pt-glass p-3 overflow-y-auto shrink-0">
        <div className="pt-section-label text-text-lo mb-2">FOLDERS</div>
        <div className="space-y-0.5">
          {folders.map(f => (
            <button
              key={f || '_root'}
              onClick={() => setFolder(f)}
              className={[
                'w-full text-left px-2 py-1.5 flex items-center gap-2 border-l-2 transition-colors',
                folder === f
                  ? 'border-accent bg-surface text-text-hi'
                  : 'border-transparent text-text-mid hover:text-text-hi hover:bg-surface/40',
              ].join(' ')}
            >
              <ChevronRight size={11} className="text-text-lo" />
              <FolderOpen size={12} />
              <span className="text-xs truncate flex-1">{f || '根目录'}</span>
              <span className="pt-mono text-[9px] text-text-lo">
                {f ? items.filter(b => b.folder === f).length : items.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <GlassPanel
          title="BOOKMARKS"
          subtitle="网页书签 · 文件夹层级 · 离线快照（Chromedp 渲染）"
          meta={<span className="pt-mono text-xs text-text-lo">{filtered.length} 项 · {folder || '根目录'}</span>}
          actions={
            <div className="flex items-center gap-2">
              <button className="pt-btn pt-btn-ghost" onClick={importEdge}>
                <Download size={13} /> Edge·导入
              </button>
              <button className="pt-btn pt-btn-primary" onClick={() => setShowAdd(v => !v)}>
                <Plus size={13} /> 添加
              </button>
            </div>
          }
        >
          {showAdd && (
            <div className="mt-3 p-3 border border-edge space-y-2">
              <input className="pt-input w-full" placeholder="标题" value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <input className="pt-input w-full pt-mono text-xs" placeholder="https://..."
                value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} />
              <input className="pt-input w-full" placeholder="文件夹（如 Work/Reading）" value={draft.folder}
                onChange={e => setDraft({ ...draft, folder: e.target.value })} />
              <div className="flex items-center justify-end gap-2">
                <button className="pt-btn pt-btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
                <button className="pt-btn pt-btn-primary" onClick={add}>保存</button>
              </div>
            </div>
          )}
        </GlassPanel>

        {filtered.length === 0 ? (
          <div className="pt-glass p-12 text-center text-text-lo">
            <div className="pt-section-label mb-2">EMPTY</div>
            <div className="text-xs">添加书签，或从 Edge 导出 HTML 后点击 Edge·导入</div>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(b => (
              <div key={b.id} className="pt-glass p-3 group flex items-center gap-3 hover:border-accent transition-colors">
                <Globe size={14} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a className="text-sm text-text-hi truncate hover:text-accent" href={b.url} target="_blank" rel="noreferrer">
                      {b.title || b.url}
                    </a>
                    {b.dead && <span className="pt-chip text-sig-error">死链</span>}
                  </div>
                  <div className="pt-mono text-[10px] text-text-lo truncate">{b.url}</div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="pt-mono text-[10px] text-text-lo">
                    {new Date(b.created_at * 1000).toLocaleDateString()}
                  </span>
                  <button className="text-text-lo hover:text-sig-error" onClick={() => remove(b.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Bookmarks
