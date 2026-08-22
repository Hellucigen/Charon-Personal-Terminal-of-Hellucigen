import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Download, CalendarDays } from 'lucide-react'

/* Data center — cross-module overview tiles, a GitHub-style activity
 * heatmap, auto year-in-review and full JSON export. */

export const Data: React.FC = () => {
  const [overview, setOverview] = useState<any>(null)
  const [heat, setHeat] = useState<any[]>([])
  const [review, setReview] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  const load = async () => {
    setOverview(await api.data.overview())
    setHeat(await api.data.heatmap(182) ?? [])
  }
  useEffect(() => { load() }, [])

  const genReview = async () => {
    setReview(await api.data.yearReview(year) || '')
  }
  const exportAll = async () => {
    const json = await api.data.exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `charon-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const buckets = overview
    ? [['today', '今日'], ['week', '本周'], ['month', '本月'], ['year', '本年']] as const
    : []

  // heatmap: 26 weeks × 7 rows
  const weeks: any[][] = []
  for (let i = 0; i < heat.length; i += 7) weeks.push(heat.slice(i, i + 7))
  const maxScore = Math.max(1, ...heat.map(d => d.score ?? 0))
  const scoreColor = (s: number) => {
    if (!s) return 'rgba(0,0,0,0.06)'
    const level = Math.min(1, s / maxScore)
    return `rgba(255,107,0,${0.25 + level * 0.75})`
  }

  return (
    <div className="p-6 space-y-4">
      <GlassPanel
        title="DATA · 个人数据中心"
        subtitle="跨模块仪表盘 · 活动热力图 · 年度回顾 · 全量导出"
        actions={
          <button className="pt-btn pt-btn-ghost" onClick={exportAll}><Download size={13} /> EXPORT JSON</button>
        }
      />

      {/* overview */}
      <div className="grid grid-cols-4 gap-3">
        {buckets.map(([k, label]) => {
          const o = overview?.[k] ?? {}
          return (
            <div key={k} className="border border-edge p-3">
              <div className="pt-section-label text-text-lo mb-2">{label}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Stat label="笔记" v={o.notes} />
                <Stat label="碎片" v={o.fleeting} />
                <Stat label="待办✓" v={o.todos_done} />
                <Stat label="番茄" v={o.pomodoros} />
                <Stat label="日记" v={o.diary} />
                <Stat label="XP" v={o.xp} accent />
              </div>
            </div>
          )
        })}
      </div>

      {/* heatmap */}
      <div className="border border-edge p-3 overflow-x-auto">
        <div className="pt-section-label text-text-lo mb-3">ACTIVITY · 近 26 周</div>
        <svg viewBox={`0 0 ${weeks.length * 15} ${7 * 15}`} className="min-w-[680px]">
          {weeks.map((w, wi) => w.map((d, di) => (
            <rect key={`${wi}-${di}`} x={wi * 15} y={di * 15} width={11} height={11} rx={1.5}
              fill={scoreColor(d?.score ?? 0)}>
              <title>{d?.day}: {d?.score ?? 0} 分</title>
            </rect>
          )))}
        </svg>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-text-lo pt-mono">
          <span>少</span>
          {[0, 0.25, 0.5, 0.75, 1].map(s => (
            <span key={s} className="w-2.5 h-2.5" style={{ background: s === 0 ? 'rgba(0,0,0,0.06)' : `rgba(255,107,0,${0.25 + s * 0.75})` }} />
          ))}
          <span>多 · 记分：笔记×3 + 碎片×1 + 待办×2 + 番茄×2 + 日记×2</span>
        </div>
      </div>

      {/* year review */}
      <div className="border border-edge p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="pt-section-label text-text-lo flex items-center gap-1.5">
            <CalendarDays size={12} /> YEAR IN REVIEW
          </div>
          <input type="number" className="pt-input pt-mono text-xs w-20" value={year}
            onChange={e => setYear(Number(e.target.value) || new Date().getFullYear())} />
          <button className="pt-btn pt-btn-primary text-xs" onClick={genReview}>生成 {year} 年度回顾</button>
        </div>
        {review
          ? <pre className="pt-mono text-xs text-text-mid whitespace-pre-wrap leading-relaxed">{review}</pre>
          : <div className="text-xs text-text-lo">聚合笔记/待办/番茄/日记/XP/支出 · 一键生成这一年的数字画像</div>}
      </div>
    </div>
  )
}

const Stat: React.FC<{ label: string; v: any; accent?: boolean }> = ({ label, v, accent }) => (
  <div className="flex items-baseline justify-between">
    <span className="text-text-lo">{label}</span>
    <span className={['pt-mono', accent ? 'text-accent' : 'text-text-hi'].join(' ')}>{v ?? 0}</span>
  </div>
)

export default Data
