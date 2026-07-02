import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import GlassPanel from '@/components/GlassPanel'
import { BlockEditor } from './BlockEditor'
import { Plus, Search, Trash2, Tag } from 'lucide-react'

type Note = {
  id: string
  title: string
  template: string
  body: string
  tags: string[]
  created_at: number
  updated_at: number
}

const TEMPLATES: { id: string; label: string; hint: string }[] = [
  { id: '',          label: 'ALL',         hint: '全部' },
  { id: 'blank',     label: 'BLANK',       hint: '空白' },
  { id: 'dream',     label: 'DREAM',       hint: '梦境' },
  { id: 'weapon',    label: 'WEAPONS',     hint: '武器' },
  { id: 'anime',     label: 'ANIME',       hint: '番剧' },
  { id: 'game',      label: 'GAMES',       hint: '游戏' },
  { id: 'movie',     label: 'MOVIES',      hint: '电影' },
  { id: 'book',      label: 'BOOKS',       hint: '书 / 漫画' },
  { id: 'poem',      label: 'POEMS',       hint: '诗句' },
  { id: 'plant',     label: 'PLANTS',      hint: '植物' },
  { id: 'wantbuy',   label: 'WISHLIST',    hint: '想买的东西' },
  { id: 'wantgame',  label: 'WANT·GAMES',  hint: '想买的游戏' },
  { id: 'password',  label: 'PASSWORDS',   hint: '密码' },
  { id: 'detective', label: 'DETECTIVE',   hint: '线索板' },
  { id: 'travel',    label: 'TRAVEL',      hint: '旅游' },
  { id: 'institute', label: 'INSTITUTE',   hint: '学院' },
  { id: 'study',     label: 'STUDY',       hint: '学习笔记' },
]

export const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [template, setTemplate] = useState('')
  const [active, setActive] = useState<Note | null>(null)
  const [query, setQuery] = useState('')

  const reload = useCallback(async () => {
    const list = (await api.notes.list(template, 500)) ?? []
    setNotes(list)
    if (list.length && (!active || !list.find(n => n.id === active.id))) {
      const next = await api.notes.get(list[0].id)
      if (next) setActive(next)
    }
    if (list.length === 0) setActive(null)
  }, [template, active])

  useEffect(() => { reload() }, [template])

  const filtered = useMemo(() => {
    if (!query.trim()) return notes
    const q = query.toLowerCase()
    return notes.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q))
  }, [notes, query])

  const create = async () => {
    const n = await api.notes.create({
      title: '未命名笔记',
      template: template || 'blank',
      body: '{"type":"doc","content":[{"type":"paragraph"}]}',
      tags: [],
    })
    if (n) { setActive(n); reload() }
  }

  const update = async (next: Partial<Note>) => {
    if (!active) return
    const merged = { ...active, ...next, updated_at: Math.floor(Date.now() / 1000) }
    setActive(merged)
    await api.notes.update(merged)
  }

  const remove = async (id: string) => {
    await api.notes.remove(id)
    if (active?.id === id) setActive(null)
    reload()
  }

  return (
    <div className="h-full flex gap-3 p-6">
      {/* Template tree */}
      <div className="w-48 pt-glass p-3 overflow-y-auto shrink-0">
        <div className="pt-section-label text-text-lo mb-2">TEMPLATES</div>
        <div className="space-y-0.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={[
                'w-full text-left px-2 py-1.5 flex items-center justify-between border-l-2 transition-colors',
                template === t.id
                  ? 'border-accent bg-surface text-text-hi'
                  : 'border-transparent text-text-mid hover:text-text-hi hover:bg-surface/40',
              ].join(' ')}
            >
              <div className="flex flex-col">
                <span className="pt-mono text-[11px] tracking-wider">{t.label}</span>
                <span className="text-[10px] text-text-lo">{t.hint}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note list */}
      <div className="w-72 pt-glass p-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 px-2 border border-edge">
            <Search size={12} className="text-text-lo" />
            <input
              className="bg-transparent outline-none flex-1 py-1.5 text-xs"
              placeholder="搜索笔记..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button className="pt-btn pt-btn-primary" onClick={create} title="新建笔记">
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.length === 0 && (
            <div className="text-text-lo text-xs pt-mono px-1 py-4">没有笔记。按 + 新建一条。</div>
          )}
          {filtered.map(n => (
            <button
              key={n.id}
              onClick={async () => { const full = await api.notes.get(n.id); if (full) setActive(full) }}
              className={[
                'w-full text-left p-2 border transition-colors',
                active?.id === n.id
                  ? 'border-accent bg-surface'
                  : 'border-edge hover:border-text-lo',
              ].join(' ')}
            >
              <div className="text-sm text-text-hi truncate">{n.title || '未命名'}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="pt-mono text-[10px] text-text-lo uppercase">{n.template}</span>
                <span className="pt-mono text-[10px] text-text-lo">
                  {new Date(n.updated_at * 1000).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        {active ? (
          <GlassPanel
            title={active.title || '未命名笔记'}
            subtitle={`${active.template.toUpperCase()} · ${active.tags.join(' · ') || '无标签'}`}
            meta={
              <span className="pt-mono text-[10px] text-text-lo">
                UPDATED {new Date(active.updated_at * 1000).toLocaleString()}
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  className="pt-btn pt-btn-ghost"
                  onClick={() => {
                    const tag = prompt('添加标签')
                    if (tag) update({ tags: Array.from(new Set([...(active.tags || []), tag])) })
                  }}
                >
                  <Tag size={12} /> TAG
                </button>
                <button className="pt-btn pt-btn-ghost text-sig-error" onClick={() => remove(active.id)}>
                  <Trash2 size={12} /> DELETE
                </button>
              </div>
            }
          >
            <div className="mt-3 space-y-3">
              <input
                className="pt-input text-2xl pt-display w-full"
                value={active.title}
                onChange={e => update({ title: e.target.value })}
                placeholder="标题"
              />
              <BlockEditor
                value={active.body}
                onChange={body => update({ body })}
              />
            </div>
          </GlassPanel>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-lo">
              <div className="pt-section-label mb-2">NO NOTE SELECTED</div>
              <div className="text-xs">从左侧选择一条笔记，或按 <span className="pt-kbd">+</span> 新建</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Notes
