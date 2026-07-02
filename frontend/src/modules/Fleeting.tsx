import React, { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import GlassPanel from '@/components/GlassPanel'
import { useApp } from '@/store/app'
import { Sparkles, Trash2, ArrowUpRight, Hash } from 'lucide-react'

type Fleet = {
  id: string
  body: string
  tags: string[]
  media_path?: string
  created_at: number
}

const TEMPLATES = [
  { id: 'blank', label: '空白笔记' },
  { id: 'dream', label: '梦境' },
  { id: 'poem',  label: '诗句 / 摘录' },
  { id: 'book',  label: '书 / 漫画' },
  { id: 'movie', label: '电影 / 番剧' },
  { id: 'game',  label: '游戏' },
  { id: 'study', label: '学习笔记' },
]

export const Fleeting: React.FC = () => {
  const setDrawer = useApp(s => s.setFleetingDrawerOpen)
  const openDrawer = () => setDrawer(true)
  const [items, setItems] = useState<Fleet[]>([])
  const [filter, setFilter] = useState<string>('')

  const reload = useCallback(async () => {
    const list = (await api.fleeting.stream(500)) ?? []
    setItems(list)
  }, [])

  useEffect(() => { reload() }, [reload])

  const remove = async (id: string) => { await api.fleeting.remove(id); reload() }

  const promote = async (f: Fleet) => {
    const title = prompt('为这条想法命名（创建为正式笔记）', f.body.slice(0, 24))
    if (!title) return
    const template = prompt(`选择模板: ${TEMPLATES.map(t => t.id).join(' / ')}`, 'blank') || 'blank'
    await api.fleeting.promote(f.id, title, template)
    reload()
  }

  const allTags = Array.from(new Set(items.flatMap(i => i.tags || []))).sort()
  const filtered = filter ? items.filter(i => (i.tags || []).includes(filter)) : items

  return (
    <div className="p-6 space-y-4">
      <GlassPanel
        title="FLEETING · 零碎想法"
        subtitle="按 ⌃⌥N 唤起捕获面板 · 自动时间戳 · 后续可升级为正式笔记"
        meta={<span className="pt-mono text-xs text-text-lo">{items.length} 条</span>}
        scanline
        actions={
          <button className="pt-btn pt-btn-primary" onClick={openDrawer}>
            <Sparkles size={13} /> 新捕获
            <span className="pt-kbd ml-2">⌃⌥N</span>
          </button>
        }
      >
        {allTags.length > 0 && (
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            <Hash size={11} className="text-text-lo" />
            <button
              className={['pt-chip', !filter ? 'border-accent text-accent' : ''].join(' ')}
              onClick={() => setFilter('')}
            >全部</button>
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={['pt-chip', filter === t ? 'border-accent text-accent' : ''].join(' ')}
              >{t}</button>
            ))}
          </div>
        )}
      </GlassPanel>

      {filtered.length === 0 ? (
        <div className="pt-glass p-12 text-center text-text-lo">
          <div className="pt-section-label mb-2">EMPTY</div>
          <div className="text-xs">按 <span className="pt-kbd">⌃⌥N</span> 抓一个想法 · 文字、图片、歌词、摘录都可以</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(f => (
            <div key={f.id} className="pt-glass p-4 group hover:border-accent transition-colors flex flex-col">
              <div className="pt-mono text-[10px] text-text-lo mb-2">
                {new Date(f.created_at * 1000).toLocaleString('zh-CN')}
              </div>
              <div className="text-sm text-text-hi whitespace-pre-wrap flex-1 leading-relaxed">{f.body}</div>
              {f.tags && f.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {f.tags.map(t => <span key={t} className="pt-chip">{t}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="pt-btn pt-btn-ghost" onClick={() => promote(f)}>
                  <ArrowUpRight size={11} /> PROMOTE
                </button>
                <button className="pt-btn pt-btn-ghost text-sig-error" onClick={() => remove(f.id)}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Fleeting
