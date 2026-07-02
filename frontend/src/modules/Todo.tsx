import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import GlassPanel from '@/components/GlassPanel'
import { Plus, Star, Calendar as Cal, Inbox, Sun, Trash2 } from 'lucide-react'

type Todo = {
  id: string
  title: string
  list: string
  due_at?: number
  done: boolean
  important: boolean
  tags: string[]
  notes: string
  created_at: number
  updated_at: number
}

type ListMeta = { name: string; count: number }

const BUILT_IN_LISTS: { id: string; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'today',     label: 'TODAY',     hint: '我的一天',  icon: <Sun size={13} /> },
  { id: 'important', label: 'IMPORTANT', hint: '重要',     icon: <Star size={13} /> },
  { id: 'planned',   label: 'PLANNED',   hint: '计划内',    icon: <Cal size={13} /> },
  { id: 'inbox',     label: 'INBOX',     hint: '收件箱',    icon: <Inbox size={13} /> },
  { id: '',          label: 'ALL',       hint: '全部',     icon: null },
]

export const Todo: React.FC = () => {
  const [active, setActive] = useState('today')
  const [items, setItems] = useState<Todo[]>([])
  const [lists, setLists] = useState<ListMeta[]>([])
  const [newTitle, setNewTitle] = useState('')

  const reload = useCallback(async () => {
    const its = (await api.todo.list(active)) ?? []
    setItems(its)
    const ls = (await api.todo.lists()) ?? []
    setLists(ls)
  }, [active])

  useEffect(() => { reload() }, [reload])

  // Poll for due-soon reminders every 60s — backend issues toast via Wails runtime.
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try { await api.todo.dueSoon(15) } catch (_) {}
      if (alive) setTimeout(tick, 60_000)
    }
    tick()
    return () => { alive = false }
  }, [])

  const add = async () => {
    const title = newTitle.trim()
    if (!title) return
    await api.todo.create({
      title,
      list: active || 'inbox',
      done: false,
      important: active === 'important',
      due_at: active === 'today' ? Math.floor(Date.now() / 1000) + 8 * 3600 : undefined,
      tags: [],
      notes: '',
    })
    setNewTitle('')
    reload()
  }

  const toggle = async (id: string) => { await api.todo.toggle(id); reload() }
  const remove = async (id: string) => { await api.todo.remove(id); reload() }

  const open = useMemo(() => items.filter(t => !t.done), [items])
  const done = useMemo(() => items.filter(t => t.done), [items])
  const meta = lists.find(l => l.name === active)

  return (
    <div className="h-full flex gap-3 p-6">
      {/* Sidebar */}
      <div className="w-56 pt-glass p-3 overflow-y-auto shrink-0">
        <div className="pt-section-label text-text-lo mb-2">LISTS</div>
        <div className="space-y-0.5">
          {BUILT_IN_LISTS.map(l => {
            const m = lists.find(x => x.name === l.id)
            return (
              <button
                key={l.id || 'all'}
                onClick={() => setActive(l.id)}
                className={[
                  'w-full text-left px-2 py-2 flex items-center justify-between border-l-2 transition-colors',
                  active === l.id
                    ? 'border-accent bg-surface text-text-hi'
                    : 'border-transparent text-text-mid hover:text-text-hi hover:bg-surface/40',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  {l.icon}
                  <span className="flex flex-col">
                    <span className="pt-mono text-[11px] tracking-wider">{l.label}</span>
                    <span className="text-[10px] text-text-lo">{l.hint}</span>
                  </span>
                </span>
                {m && m.count > 0 && (
                  <span className="pt-mono text-[10px] text-accent">{m.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <GlassPanel
          title={(BUILT_IN_LISTS.find(l => l.id === active)?.hint) || '全部'}
          subtitle={meta ? `${meta.count} 项未完成` : '无统计'}
          meta={
            <span className="pt-mono text-[10px] text-text-lo">
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </span>
          }
          scanline
        >
          <div className="mt-4 flex items-center gap-2">
            <input
              className="pt-input flex-1"
              placeholder="添加任务（回车提交）..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
            />
            <button className="pt-btn pt-btn-primary" onClick={add}><Plus size={13} /> ADD</button>
          </div>

          <div className="mt-5 space-y-1">
            {open.length === 0 && done.length === 0 && (
              <div className="text-text-lo text-sm py-8 text-center">该列表为空。</div>
            )}
            {open.map(t => (
              <Row key={t.id} item={t} onToggle={toggle} onDelete={remove} />
            ))}
            {done.length > 0 && (
              <div className="pt-section-label text-text-lo mt-6 mb-1">DONE · {done.length}</div>
            )}
            {done.map(t => (
              <Row key={t.id} item={t} onToggle={toggle} onDelete={remove} />
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

const Row: React.FC<{ item: Todo; onToggle: (id: string) => void; onDelete: (id: string) => void }> = ({ item, onToggle, onDelete }) => {
  const due = item.due_at ? new Date(item.due_at * 1000) : null
  const overdue = due && !item.done && due.getTime() < Date.now()
  return (
    <div className="group flex items-center gap-3 px-3 py-2 border border-edge hover:border-text-lo transition-colors">
      <button
        onClick={() => onToggle(item.id)}
        className={[
          'w-4 h-4 border flex items-center justify-center shrink-0',
          item.done ? 'border-accent bg-accent text-bg' : 'border-text-lo',
        ].join(' ')}
        aria-label="toggle"
      >
        {item.done && <span className="text-[10px] leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={['truncate', item.done ? 'line-through text-text-lo' : 'text-text-hi'].join(' ')}>
          {item.important && <span className="text-accent mr-1">★</span>}
          {item.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.tags?.map(t => <span key={t} className="pt-chip">{t}</span>)}
          {due && (
            <span className={['pt-mono text-[10px]', overdue ? 'text-sig-error' : 'text-text-lo'].join(' ')}>
              ⏱ {due.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-lo hover:text-sig-error"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default Todo
