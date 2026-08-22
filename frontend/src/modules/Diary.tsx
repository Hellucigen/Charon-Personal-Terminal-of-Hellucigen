import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { BookHeart, History, BarChart3 } from 'lucide-react'

/* Diary — one line a day (upsert), history, "on this day", and
 * auto-summaries that aggregate the other modules. */

const MOOD = ['😫', '😕', '😐', '🙂', '🤩']

export const Diary: React.FC = () => {
  const [today, setToday] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  const [onThisDay, setOnThisDay] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [period, setPeriod] = useState('week')
  const [line, setLine] = useState('')
  const [mood, setMood] = useState(4)

  const load = async () => {
    const all = await api.diary.list(90) ?? []
    setList(all)
    const t = new Date().toISOString().slice(0, 10)
    setToday(all.find(e => e.day === t) ?? null)
    setOnThisDay(await api.diary.onThisDay() ?? [])
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!line.trim()) return
    await api.diary.save({ day: today?.day, line, mood })
    setLine('')
    load()
  }
  const loadSummary = async (p: string) => {
    setPeriod(p)
    setSummary(await api.diary.summary(p))
  }
  useEffect(() => { loadSummary('week') }, [])

  const editing = today && line === ''
  const fmt = (d: string) => d.slice(5).replace('-', '/')

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <GlassPanel title="DIARY · 日记 / 总结" subtitle="One-Line a Day · 每天 +5 XP（智力）· 周/月自动汇总" />

      {/* today */}
      <div className="border border-accent/40 bg-surface p-4">
        <div className="pt-section-label text-text-lo mb-2">
          TODAY · {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          {editing && <span className="ml-2 text-text-lo normal-case">（今日已写 · 继续编辑会覆盖）</span>}
        </div>
        <div className="flex gap-2 items-start">
          <textarea className="pt-input flex-1 min-h-[56px] text-sm" placeholder="用一句话形容今天…"
            value={editing ? (today?.line ?? '') : line}
            onChange={e => setLine(e.target.value)} />
          <div className="flex flex-col gap-1">
            {[5, 4, 3, 2, 1].map(m => (
              <button key={m} className={['text-lg leading-none w-8 h-7 border transition-all',
                (editing ? today?.mood : mood) === m ? 'border-accent bg-accent/10' : 'border-edge opacity-40'].join(' ')}
                onClick={() => setMood(m)}>
                {MOOD[m - 1]}
              </button>
            ))}
          </div>
        </div>
        <button className="pt-btn pt-btn-primary mt-3" onClick={save}>
          <BookHeart size={13} /> {editing ? '更新今日' : '写下今日一句'}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-3">
        {/* history */}
        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-2 flex items-center gap-1.5">
            <History size={12} /> 近 90 天
          </div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {list.map(e => (
              <div key={e.id} className="flex items-center gap-3 border border-edge/60 px-3 py-1.5 text-xs">
                <span className="pt-mono text-text-lo shrink-0 w-14">{e.day.slice(5)}</span>
                <span>{MOOD[(e.mood || 3) - 1]}</span>
                <span className="flex-1 truncate text-text-mid">{e.line}</span>
                <button className="text-sig-error opacity-0 hover:opacity-100"
                  onClick={async () => { await api.diary.remove(e.id); load() }}>×</button>
              </div>
            ))}
            {list.length === 0 && <div className="text-xs text-text-lo py-6 text-center">还没有日记 · 从今天的一句开始</div>}
          </div>
        </div>

        {/* on this day + summary */}
        <div className="space-y-3">
          <div className="border border-edge p-3">
            <div className="pt-section-label text-text-lo mb-2">历史上的今天</div>
            {onThisDay.length ? onThisDay.map(e => (
              <div key={e.id} className="text-xs border-b border-edge/40 pb-1.5 mb-1.5">
                <span className="pt-mono text-accent">{e.day.slice(0, 4)}</span>
                <span> {MOOD[(e.mood || 3) - 1]} {e.line}</span>
              </div>
            )) : <div className="text-xs text-text-lo">往年的今天还没有记录</div>}
          </div>

          <div className="border border-edge p-3">
            <div className="pt-section-label text-text-lo mb-2 flex items-center gap-1.5">
              <BarChart3 size={12} /> 自动汇总
            </div>
            <div className="flex gap-1 mb-2">
              {(['week', 'month', 'year'] as const).map(p => (
                <button key={p} className={['pt-btn text-[10px] px-2 py-1', period === p ? 'pt-btn-primary' : 'pt-btn-ghost'].join(' ')}
                  onClick={() => loadSummary(p)}>
                  {p === 'week' ? '周' : p === 'month' ? '月' : '年'}
                </button>
              ))}
            </div>
            {summary && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <Row k="日记" v={`${summary.diary_days} 天`} />
                <Row k="笔记" v={`${summary.notes} 篇`} />
                <Row k="碎片" v={`${summary.fleeting} 条`} />
                <Row k="待办✓" v={`${summary.todos_done} 个`} />
                <Row k="番茄" v={`${summary.pomodoros} 个`} />
                <Row k="XP" v={summary.xp} accent />
                <Row k="均心情" v={Number(summary.avg_mood).toFixed(1)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const Row: React.FC<{ k: string; v: any; accent?: boolean }> = ({ k, v, accent }) => (
  <div className="flex items-baseline justify-between">
    <span className="text-text-lo">{k}</span>
    <span className={['pt-mono', accent ? 'text-accent' : 'text-text-hi'].join(' ')}>{v}</span>
  </div>
)

export default Diary
