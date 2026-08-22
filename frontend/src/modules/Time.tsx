import React, { useEffect, useRef, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Play, Pause, Square, Plus, Trash2, MonitorSmartphone } from 'lucide-react'

/* Time tracking — pomodoro timer (auto-saved to the backend on finish),
 * time blocks for the day, and Windows foreground-app usage tracking. */

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export const Time: React.FC = () => {
  const [tab, setTab] = useState<'pomo' | 'blocks' | 'usage'>('pomo')
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <GlassPanel title="TIME · 时间追踪" subtitle="番茄钟 · Time Blocking · 前台应用统计（RescueTime 风格）" />
      <div className="flex items-center gap-1">
        {(['pomo', 'blocks', 'usage'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={['pt-section-label px-3 py-2 transition-colors', tab === t ? 'text-accent' : 'text-text-lo hover:text-text-mid'].join(' ')}>
            {t === 'pomo' ? 'POMODORO' : t === 'blocks' ? 'TIME BLOCKS' : 'APP USAGE'}
          </button>
        ))}
      </div>
      {tab === 'pomo' && <Pomodoro />}
      {tab === 'blocks' && <Blocks />}
      {tab === 'usage' && <Usage />}
    </div>
  )
}

const Pomodoro: React.FC = () => {
  const [focusMin, setFocusMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [left, setLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [task, setTask] = useState('')
  const [stats, setStats] = useState<any[]>([])
  const timerRef = useRef<number | null>(null)

  const loadStats = async () => setStats(await api.time.stats(14) ?? [])
  useEffect(() => { loadStats() }, [])

  const total = (mode === 'focus' ? focusMin : breakMin) * 60

  useEffect(() => {
    if (!running) return
    timerRef.current = window.setInterval(() => {
      setLeft(l => {
        if (l <= 1) {
          finish()
          return 0
        }
        return l - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, mode])

  const finish = async () => {
    setRunning(false)
    await api.time.savePomodoro(task, total, mode)
    loadStats()
    const next = mode === 'focus' ? 'break' : 'focus'
    setMode(next)
    setLeft((next === 'focus' ? focusMin : breakMin) * 60)
    try {
      new Notification(mode === 'focus' ? '🍅 番茄完成！' : '☕ 休息结束', {
        body: mode === 'focus' ? `已记录 ${focusMin} 分钟专注 · 换取 XP` : '回到专注模式',
      })
    } catch { /* notification API unavailable */ }
  }

  const reset = () => {
    setRunning(false)
    setMode('focus')
    setLeft(focusMin * 60)
  }

  const pct = 1 - left / (total || 1)
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = stats.find(s => s.day === todayStr)
  const maxS = Math.max(1, ...stats.map(s => s.focus_s ?? 0))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[300px_1fr] gap-4">
        <div className="border border-edge p-6 flex flex-col items-center">
          <div className={['pt-chip mb-4', mode === 'focus' ? 'text-accent border-accent' : 'text-sig-warn border-sig-warn'].join(' ')}>
            {mode === 'focus' ? 'FOCUS' : 'BREAK'}
          </div>
          <div className="pt-display text-6xl pt-mono text-text-hi tabular-nums">{fmt(left)}</div>
          <svg viewBox="0 0 120 120" className="w-32 h-32 -mt-28 mb-[-4.5rem] pointer-events-none">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={mode === 'focus' ? '#ff6b00' : '#c77700'}
              strokeWidth="4" strokeDasharray={`${pct * 339} 339`} transform="rotate(-90 60 60)" strokeLinecap="round" />
          </svg>
          <div className="flex gap-2 mt-24">
            {!running
              ? <button className="pt-btn pt-btn-primary" onClick={() => setRunning(true)}><Play size={13} /> 开始</button>
              : <button className="pt-btn" onClick={() => setRunning(false)}><Pause size={13} /> 暂停</button>}
            <button className="pt-btn pt-btn-ghost" onClick={reset}><Square size={13} /> 重置</button>
          </div>
          <input className="pt-input mt-3 w-full pt-mono text-xs text-center" placeholder="在做什么？"
            value={task} onChange={e => setTask(e.target.value)} />
        </div>

        <div className="space-y-3">
          <div className="border border-edge p-3 flex gap-3 items-center text-xs">
            <span className="text-text-lo">专注</span>
            <input className="pt-input pt-mono w-16 text-center" value={focusMin}
              onChange={e => {
                const v = Number(e.target.value.replace(/\D/g, '')) || 25
                setFocusMin(v)
                if (!running && mode === 'focus') setLeft(v * 60)
              }} />
            <span className="text-text-lo">分钟 · 休息</span>
            <input className="pt-input pt-mono w-16 text-center" value={breakMin}
              onChange={e => {
                const v = Number(e.target.value.replace(/\D/g, '')) || 5
                setBreakMin(v)
                if (!running && mode === 'break') setLeft(v * 60)
              }} />
            <span className="text-text-lo">分钟</span>
          </div>
          <div className="border border-edge p-3">
            <div className="pt-section-label text-text-lo mb-2">
              今日专注 {Math.round((today?.focus_s ?? 0) / 60)} 分钟
            </div>
            <div className="flex items-end gap-1 h-28">
              {stats.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${s.day}: ${Math.round(s.focus_s / 60)}min`}>
                  <div className="w-full bg-accent/70" style={{ height: `${((s.focus_s ?? 0) / maxS) * 88}px` }} />
                  <span className="text-[8px] text-text-lo pt-mono">{String(s.day).slice(8)}</span>
                </div>
              ))}
              {stats.length === 0 && <div className="text-xs text-text-lo w-full text-center self-center">完成第一个番茄后出现柱状图</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Blocks: React.FC = () => {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))
  const [blocks, setBlocks] = useState<any[]>([])
  const [form, setForm] = useState({ label: '', start: '09:00', end: '10:00', color: 'cyan' })
  const COLORS = ['cyan', 'magenta', 'violet', 'lime', 'amber', 'rose']

  const load = async () => setBlocks(await api.time.blocks(day) ?? [])
  useEffect(() => { load() }, [day])

  const add = async () => {
    if (!form.label || !form.start || !form.end) return
    await api.time.saveBlock({ ...form, day })
    setForm({ ...form, label: '' })
    load()
  }
  const toY = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return ((h * 60 + m) / (24 * 60)) * 100
  }

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3">
      <div className="border border-edge p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="pt-section-label text-text-lo">DAY VIEW · {day}</div>
          <input type="date" className="pt-input pt-mono text-xs w-36" value={day} onChange={e => setDay(e.target.value)} />
        </div>
        <div className="relative h-[480px] border border-edge/50">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-edge/30 pt-mono text-[9px] text-text-lo"
              style={{ top: `${(i / 24) * 100}%` }}>
              <span className="bg-bg pl-1 pr-1">{String(i * 2).padStart(2, '0')}:00</span>
            </div>
          ))}
          {blocks.map(b => (
            <div key={b.id} className="absolute left-12 right-2 border px-2 py-1 text-xs group overflow-hidden"
              style={{
                top: `${toY(b.start)}%`, height: `${Math.max(toY(b.end) - toY(b.start), 1.5)}%`,
                borderColor: `var(--accent-${b.color}, #ff6b00)`,
                background: `color-mix(in srgb, var(--accent-${b.color}, #ff6b00) 12%, transparent)`,
              }}>
              <span className="pt-mono text-[10px]">{b.start}–{b.end}</span> {b.label}
              <button className="absolute top-0.5 right-1 text-sig-error opacity-0 group-hover:opacity-100"
                onClick={async () => { await api.time.deleteBlock(b.id); load() }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-edge p-3 space-y-2 self-start">
        <div className="pt-section-label text-text-lo">NEW BLOCK</div>
        <input className="pt-input w-full pt-mono text-xs" placeholder="事项 *（如：写周报）"
          value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        <div className="flex gap-2">
          <input type="time" className="pt-input pt-mono text-xs flex-1" value={form.start}
            onChange={e => setForm({ ...form, start: e.target.value })} />
          <input type="time" className="pt-input pt-mono text-xs flex-1" value={form.end}
            onChange={e => setForm({ ...form, end: e.target.value })} />
        </div>
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button key={c} className={['w-6 h-6 border', form.color === c ? 'border-text-hi' : 'border-edge'].join(' ')}
              style={{ background: `var(--accent-${c})` }} onClick={() => setForm({ ...form, color: c })} />
          ))}
        </div>
        <button className="pt-btn pt-btn-primary w-full text-xs" onClick={add}><Plus size={12} /> 添加时间块</button>
      </div>
    </div>
  )
}

const Usage: React.FC = () => {
  const [on, setOn] = useState(false)
  const [rows, setRows] = useState<any[]>([])

  const load = async () => {
    setOn(await api.time.trackingOn() ?? false)
    setRows(await api.time.usage() ?? [])
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  const toggle = async () => {
    if (on) await api.time.stopTracking()
    else await api.time.startTracking()
    load()
  }

  const total = rows.reduce((s, r) => s + (r.seconds ?? 0), 0)
  const maxS = Math.max(1, ...rows.map(r => r.seconds ?? 0))

  return (
    <div className="space-y-3">
      <div className="border border-edge p-3 flex items-center gap-3">
        <MonitorSmartphone size={14} className="text-accent" />
        <span className={['pt-chip', on ? 'text-accent border-accent' : ''].join(' ')}>
          {on ? 'TRACKING' : 'OFF'}
        </span>
        <button className={['pt-btn', 'text-xs', on ? '' : 'pt-btn-primary'].join(' ')} onClick={toggle}>
          {on ? '停止统计' : '开始统计前台应用'}
        </button>
        <span className="text-xs text-text-lo pt-mono">
          今日合计 {Math.round(total / 60)} 分钟 · 每 5 秒采样，切换窗口时记入
        </span>
      </div>
      <div className="border border-edge p-3 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="w-40 truncate pt-mono text-text-mid">{r.app}</span>
            <div className="flex-1 h-2.5 bg-edge/40">
              <div className="h-full bg-accent" style={{ width: `${((r.seconds ?? 0) / maxS) * 100}%` }} />
            </div>
            <span className="w-16 text-right pt-mono text-text-lo">{Math.round((r.seconds ?? 0) / 60)}min</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-xs text-text-lo py-4 text-center">
            开启统计后（Windows 下轮询 GetForegroundWindow），这里显示今天每个前台应用的使用时长
          </div>
        )}
      </div>
    </div>
  )
}

export default Time
