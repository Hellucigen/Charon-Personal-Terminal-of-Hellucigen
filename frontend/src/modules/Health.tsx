import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus } from 'lucide-react'

/* Health — lightweight habit & metric tracking. Habits are ad-hoc
 * (weight / sleep / water / exercise / anything), each with latest
 * value, today's count, streak and a sparkline. */

const PRESETS = [
  { habit: 'weight', label: '体重', unit: 'kg', step: '0.1' },
  { habit: 'sleep', label: '睡眠', unit: 'h', step: '0.5' },
  { habit: 'water', label: '喝水', unit: '杯', step: '1' },
  { habit: 'exercise', label: '运动', unit: 'min', step: '10' },
]

const fmtTime = (ts: number) => new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export const Health: React.FC = () => {
  const [overview, setOverview] = useState<any[]>([])
  const [form, setForm] = useState({ habit: 'weight', value: '', unit: 'kg', note: '' })
  const [detail, setDetail] = useState<string | null>(null)
  const [series, setSeries] = useState<any[]>([])

  const load = async () => setOverview(await api.health.overview() ?? [])
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!detail) { setSeries([]); return }
    api.health.series(detail, 30).then(s => setSeries(s ?? []))
  }, [detail])

  const log = async () => {
    const v = Number(form.value)
    if (!form.habit || isNaN(v)) return
    await api.health.log(form.habit, v, form.unit, form.note)
    setForm({ ...form, value: '', note: '' })
    load()
    if (detail === form.habit) api.health.series(detail, 30).then(s => setSeries(s ?? []))
  }

  const preset = PRESETS.find(p => p.habit === form.habit)
  const values = [...series].reverse().map(s => Number(s.value))
  const minV = Math.min(...values), maxV = Math.max(...values)
  const spark = (v: number, i: number) => {
    const W = 320, H = 60
    if (values.length < 2) return null
    const x = (i / (values.length - 1)) * W
    const y = H - 6 - ((v - minV) / (maxV - minV || 1)) * (H - 12)
    return `${x},${y}`
  }
  const detailHabit = overview.find(o => o.habit === detail)

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <GlassPanel title="HEALTH · 健康追踪" subtitle="体重 / 睡眠 / 习惯 · 连续打卡 · 趋势曲线" />

      {/* quick log */}
      <div className="border border-edge p-3">
        <div className="pt-section-label text-text-lo mb-2">QUICK LOG · 记录</div>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="pt-input pt-mono text-xs w-24" value={form.habit}
            onChange={e => {
              const p = PRESETS.find(x => x.habit === e.target.value)
              setForm({ ...form, habit: e.target.value, unit: p?.unit ?? '' })
            }}>
            {PRESETS.map(p => <option key={p.habit} value={p.habit}>{p.label}</option>)}
            <option value="">自定义…</option>
          </select>
          {form.habit === '' && (
            <input className="pt-input pt-mono text-xs w-24" placeholder="习惯名"
              onChange={e => setForm({ ...form, habit: e.target.value })} />
          )}
          <input className="pt-input pt-mono text-xs w-20" placeholder="数值" inputMode="decimal"
            value={form.value} onChange={e => setForm({ ...form, value: e.target.value.replace(/[^\d.\-]/g, '') })} />
          <input className="pt-input pt-mono text-xs w-16" placeholder="单位"
            value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
          <input className="pt-input pt-mono text-xs flex-1 min-w-[120px]" placeholder="备注（可选）"
            value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && log()} />
          <button className="pt-btn pt-btn-primary text-xs" onClick={log}><Plus size={12} /> 记录</button>
          {preset && <span className="text-[10px] text-text-lo pt-mono">{preset.label}默认单位 {preset.unit}</span>}
        </div>
      </div>

      {/* habit cards */}
      <div className="grid grid-cols-4 gap-3">
        {overview.map(o => (
          <div key={o.habit}
            className={['border p-3 cursor-pointer transition-colors',
              detail === o.habit ? 'border-accent bg-surface' : 'border-edge hover:border-accent/50'].join(' ')}
            onClick={() => setDetail(detail === o.habit ? null : o.habit)}>
            <div className="text-sm text-text-hi">{o.habit}</div>
            {o.latest ? (
              <div className="pt-display text-xl pt-mono text-accent mt-1">
                {Number(o.latest.value).toFixed(1)}
                <span className="text-xs text-text-lo ml-1">{o.latest.unit}</span>
              </div>
            ) : <div className="text-xl text-text-lo mt-1">—</div>}
            <div className="flex items-center gap-2 mt-2 text-[10px] pt-mono text-text-lo">
              <span>今日 ×{o.today}</span>
              <span className={o.streak >= 3 ? 'text-accent' : ''}>连击 {o.streak}d</span>
              <span>共 {o.logs}</span>
            </div>
          </div>
        ))}
        {overview.length === 0 && (
          <div className="col-span-4 border border-dashed border-edge p-6 text-center text-xs text-text-lo">
            还没有任何记录 · 用上方 QUICK LOG 记第一笔（睡眠联动梦境笔记模板）
          </div>
        )}
      </div>

      {/* series detail */}
      {detail && (
        <div className="border border-edge p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="pt-section-label text-text-lo">{detail.toUpperCase()} · 近 {series.length} 次</div>
            {detailHabit?.latest && (
              <span className="text-[10px] text-text-lo pt-mono">
                最近 {fmtTime(detailHabit.latest.logged_at)}
              </span>
            )}
          </div>
          {values.length >= 2 ? (
            <svg viewBox="0 0 320 60" className="w-full max-w-xl">
              <polyline fill="none" stroke="#009a9b" strokeWidth="1.6"
                points={values.map(spark).filter(Boolean).join(' ')} />
              {values.map((v, i) => {
                const p = spark(v, i)
                return p ? <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r={2} fill="#009a9b" /> : null
              })}
            </svg>
          ) : (
            <div className="text-xs text-text-lo py-3">记录 2 次以上显示趋势曲线</div>
          )}
          <div className="mt-2 max-h-40 overflow-auto space-y-0.5">
            {series.map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs border-b border-edge/40 py-1">
                <span className="pt-mono text-accent">{Number(l.value).toFixed(1)} {l.unit}</span>
                <span className="text-text-lo truncate max-w-[50%]">{l.note}</span>
                <span className="pt-mono text-[10px] text-text-lo">{fmtTime(l.logged_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Health
