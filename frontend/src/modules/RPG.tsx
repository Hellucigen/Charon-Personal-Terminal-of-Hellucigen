import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, Sparkles, CheckCircle2 } from 'lucide-react'

/* RPG — XP, level curve (100·N²), six life stats radar, achievements.
 * XP flows in automatically from todos / reviews / pomodoros / writing… */

const STAT_ZH: Record<string, string> = {
  body: '体力', mind: '智力', create: '创造', social: '社交', wealth: '财力', will: '意志',
}
const STAT_KEYS = Object.keys(STAT_ZH)

export const RPG: React.FC = () => {
  const [profile, setProfile] = useState<any>(null)
  const [achievements, setAchievements] = useState<any[]>([])
  const [awardForm, setAwardForm] = useState({ amount: '10', source: '', stat: 'will' })
  const [achForm, setAchForm] = useState({ title: '', description: '' })

  const load = async () => {
    setProfile(await api.rpg.profile())
    setAchievements(await api.rpg.achievements() ?? [])
  }
  useEffect(() => { load() }, [])

  const award = async () => {
    const v = Number(awardForm.amount)
    if (!v || !awardForm.source) return
    await api.rpg.award(v, awardForm.source, awardForm.stat)
    setAwardForm({ ...awardForm, source: '' })
    load()
  }
  const addAch = async () => {
    if (!achForm.title) return
    await api.rpg.saveAchievement({ ...achForm, unlocked: false })
    setAchForm({ title: '', description: '' })
    load()
  }
  const check = async () => {
    const unlocked = await api.rpg.check() ?? []
    load()
    alert(unlocked.length ? `新解锁成就：\n${unlocked.join('\n')}` : '暂无新成就')
  }

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? 1
  const nextXp = profile?.next_level_xp ?? 100
  const prevXp = 100 * (level - 1) * (level - 1)
  const pct = Math.min(100, ((xp - prevXp) / Math.max(nextXp - prevXp, 1)) * 100)

  // radar geometry
  const R = 88, CX = 110, CY = 105
  const stats = profile?.stats ?? {}
  const maxStat = Math.max(10, ...STAT_KEYS.map(k => stats[k] ?? 0))
  const radarPt = (k: string, scale = 1) => {
    const i = STAT_KEYS.indexOf(k)
    const a = (i / STAT_KEYS.length) * Math.PI * 2 - Math.PI / 2
    const v = ((stats[k] ?? 0) / maxStat) * R * scale
    return `${CX + Math.cos(a) * v},${CY + Math.sin(a) * v}`
  }
  const ring = (scale: number) =>
    STAT_KEYS.map((_, i) => {
      const a = (i / STAT_KEYS.length) * Math.PI * 2 - Math.PI / 2
      return `${CX + Math.cos(a) * R * scale},${CY + Math.sin(a) * R * scale}`
    }).join(' ')

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <GlassPanel
        title="RPG · 人生游戏"
        subtitle={`Lv.${level} ${profile?.title ?? ''} · 完成待办/复习/番茄/写作自动获得 XP`}
        meta={<button className="pt-btn pt-btn-ghost text-xs" onClick={check}><Sparkles size={12} /> 检查成就</button>}
      >
        <div className="grid grid-cols-[1fr_260px] gap-4 mt-3">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="pt-display text-4xl pt-mono text-accent">{xp}</span>
              <span className="text-xs text-text-lo pt-mono">XP · 距下一级还需 {Math.max(nextXp - xp, 0)}</span>
            </div>
            <div className="h-2 bg-edge/40 mt-2">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-6 gap-2 mt-4">
              {STAT_KEYS.map(k => (
                <div key={k} className="border border-edge px-2 py-2 text-center">
                  <div className="text-[10px] text-text-lo">{STAT_ZH[k]}</div>
                  <div className="pt-mono text-lg text-accent">{stats[k] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 220 210" className="w-full">
            {[1, 0.66, 0.33].map(s => (
              <polygon key={s} points={ring(s)} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
            ))}
            {STAT_KEYS.map(k => {
              const a = (STAT_KEYS.indexOf(k) / STAT_KEYS.length) * Math.PI * 2 - Math.PI / 2
              return (
                <g key={k}>
                  <line x1={CX} y1={CY} x2={CX + Math.cos(a) * R} y2={CY + Math.sin(a) * R}
                    stroke="rgba(0,0,0,0.08)" />
                  <text x={CX + Math.cos(a) * (R + 14)} y={CY + Math.sin(a) * (R + 14) + 3}
                    textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.45)" className="pt-mono">
                    {STAT_ZH[k]}
                  </text>
                </g>
              )
            })}
            <polygon points={STAT_KEYS.map(k => radarPt(k)).join(' ')}
              fill="rgba(255,107,0,0.15)" stroke="#ff6b00" strokeWidth={1.5} />
            {STAT_KEYS.map(k => {
              const [x, y] = radarPt(k).split(',')
              return <circle key={k} cx={x} cy={y} r={2.5} fill="#ff6b00" />
            })}
          </svg>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-edge p-3 space-y-2">
          <div className="pt-section-label text-text-lo">手动奖励 XP</div>
          <div className="flex gap-2">
            <input className="pt-input pt-mono text-xs w-20" placeholder="数量" inputMode="numeric"
              value={awardForm.amount} onChange={e => setAwardForm({ ...awardForm, amount: e.target.value.replace(/\D/g, '') })} />
            <select className="pt-input pt-mono text-xs w-20" value={awardForm.stat}
              onChange={e => setAwardForm({ ...awardForm, stat: e.target.value })}>
              {STAT_KEYS.map(k => <option key={k} value={k}>{STAT_ZH[k]}</option>)}
            </select>
            <input className="pt-input pt-mono text-xs flex-1" placeholder="事由 *（如 跑了三公里）"
              value={awardForm.source} onChange={e => setAwardForm({ ...awardForm, source: e.target.value })} />
            <button className="pt-btn pt-btn-primary text-xs" onClick={award}><Plus size={12} /></button>
          </div>
          <div className="pt-mono text-[10px] text-text-lo space-y-0.5 mt-1">
            {(profile?.recent ?? []).slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="truncate">+{r.amount} {STAT_ZH[r.stat] ?? r.stat} · {r.source}</div>
            ))}
          </div>
        </div>

        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-2">ACHIEVEMENTS · {achievements.filter(a => a.unlocked).length}/{achievements.length}</div>
          <div className="flex gap-2 mb-2">
            <input className="pt-input pt-mono text-xs flex-1" placeholder="新成就名 *"
              value={achForm.title} onChange={e => setAchForm({ ...achForm, title: e.target.value })} />
            <input className="pt-input pt-mono text-xs flex-1" placeholder="描述"
              value={achForm.description} onChange={e => setAchForm({ ...achForm, description: e.target.value })} />
            <button className="pt-btn pt-btn-primary text-xs" onClick={addAch}><Plus size={12} /></button>
          </div>
          <div className="space-y-1 max-h-52 overflow-auto">
            {achievements.map(a => (
              <div key={a.id} className="flex items-center gap-2 border border-edge px-2 py-1.5 text-xs group">
                {a.unlocked
                  ? <CheckCircle2 size={12} className="text-accent shrink-0" />
                  : <button className="w-3.5 h-3.5 border border-edge shrink-0 hover:border-accent"
                      onClick={async () => { await api.rpg.unlockAchievement(a.id); load() }} />}
                <span className={['flex-1 truncate', a.unlocked ? 'text-text-hi' : 'text-text-lo'].join(' ')}>
                  {a.title}
                </span>
                <span className="text-text-lo truncate max-w-[120px] hidden xl:inline text-[10px]">{a.description}</span>
                <button className="text-sig-error opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={async () => { await api.rpg.deleteAchievement(a.id); load() }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {achievements.length === 0 && <div className="text-xs text-text-lo">「连续记梦 7 天」「收集 10 种武器」… 点上方检查自动解锁</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RPG
