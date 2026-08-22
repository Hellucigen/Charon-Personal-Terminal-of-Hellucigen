import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, Building2 } from 'lucide-react'

/* Institute — the "company of one" (Fallout 4 flavour).
 * Departments = functions of your future self; actions = what's moving
 * now; phases = milestones on the road. */

const STATUSES = ['active', 'hold', 'done'] as const
const STATUS_LABEL: Record<string, string> = { active: '进行中', hold: '搁置', done: '完成' }
const COLORS = ['cyan', 'magenta', 'violet', 'lime', 'amber', 'rose']

export const Institute: React.FC = () => {
  const [depts, setDepts] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [phases, setPhases] = useState<any[]>([])
  const [deptForm, setDeptForm] = useState({ name: '', function: '', vision: '' })
  const [actForm, setActForm] = useState({ title: '', dept_id: '' })
  const [phaseForm, setPhaseForm] = useState({ title: '', dept_id: '' })

  const load = async () => {
    setDepts(await api.institute.depts() ?? [])
    setActions(await api.institute.actions() ?? [])
    setPhases(await api.institute.phases() ?? [])
  }
  useEffect(() => { load() }, [])

  const addDept = async () => {
    if (!deptForm.name.trim()) return
    await api.institute.saveDept({ ...deptForm, color: COLORS[depts.length % COLORS.length] })
    setDeptForm({ name: '', function: '', vision: '' })
    load()
  }
  const addAction = async () => {
    if (!actForm.title.trim()) return
    await api.institute.saveAction({ ...actForm, status: 'active' })
    setActForm({ title: '', dept_id: actForm.dept_id })
    load()
  }
  const addPhase = async () => {
    if (!phaseForm.title.trim()) return
    await api.institute.savePhase({ ...phaseForm, milestones: [] })
    setPhaseForm({ title: '', dept_id: phaseForm.dept_id })
    load()
  }
  const moveAction = async (a: any, status: string) => {
    await api.institute.saveAction({ ...a, status })
    load()
  }
  const bumpProgress = async (a: any, d: number) => {
    const p = Math.max(0, Math.min(100, (a.progress ?? 0) + d))
    await api.institute.saveAction({ ...a, progress: p, status: p >= 100 ? 'done' : a.status })
    load()
  }

  const deptName = (id: string) => depts.find(d => d.id === id)?.name ?? '—'
  const deptColor = (id: string) => depts.find(d => d.id === id)?.color ?? 'cyan'

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="INSTITUTE · 「学院」" subtitle="个人远期梦想的组织化：部门 · 行动 · 阶段 · 完成行动奖励 XP" />

      {/* departments */}
      <div>
        <div className="pt-section-label text-text-lo mb-2">DEPARTMENTS · 部门</div>
        <div className="grid grid-cols-4 gap-3">
          {depts.map(d => (
            <div key={d.id} className="border border-edge p-3 group relative">
              <button className="absolute top-2 right-2 text-sig-error opacity-0 group-hover:opacity-100"
                onClick={async () => { await api.institute.deleteDept(d.id); load() }}>
                <Trash2 size={11} />
              </button>
              <div className="flex items-center gap-2">
                <Building2 size={13} className="text-accent" />
                <span className="text-sm text-text-hi">{d.name}</span>
              </div>
              {d.function && <div className="text-xs text-text-mid mt-1.5">{d.function}</div>}
              {d.vision && <div className="text-xs text-text-lo mt-1 italic">「{d.vision}」</div>}
              <div className="flex items-center gap-2 mt-2 text-[10px] pt-mono text-text-lo">
                <span className="w-2 h-2 rounded-full" style={{ background: `var(--accent-${d.color}, #ff6b00)` }} />
                {actions.filter(a => a.dept_id === d.id && a.status === 'active').length} 行动进行中
              </div>
            </div>
          ))}
          <div className="border border-dashed border-edge p-3 space-y-2">
            <input className="pt-input w-full pt-mono text-xs" placeholder="部门名 *（如：研究部）"
              value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} />
            <input className="pt-input w-full pt-mono text-xs" placeholder="职能"
              value={deptForm.function} onChange={e => setDeptForm({ ...deptForm, function: e.target.value })} />
            <input className="pt-input w-full pt-mono text-xs" placeholder="愿景"
              value={deptForm.vision} onChange={e => setDeptForm({ ...deptForm, vision: e.target.value })} />
            <button className="pt-btn pt-btn-primary w-full text-xs" onClick={addDept}><Plus size={12} /> 新建部门</button>
          </div>
        </div>
      </div>

      {/* actions kanban */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="pt-section-label text-text-lo">ACTIONS · 行动看板</div>
          <div className="flex gap-2">
            <select className="pt-input pt-mono text-xs w-36" value={actForm.dept_id}
              onChange={e => setActForm({ ...actForm, dept_id: e.target.value })}>
              <option value="">归属部门…</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="pt-input pt-mono text-xs w-52" placeholder="新行动 *"
              value={actForm.title} onChange={e => setActForm({ ...actForm, title: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && addAction()} />
            <button className="pt-btn pt-btn-primary text-xs" onClick={addAction}><Plus size={12} /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {STATUSES.map(st => (
            <div key={st} className="border border-edge p-2 min-h-[120px] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="pt-section-label text-text-lo">{STATUS_LABEL[st]}</span>
                <span className="pt-mono text-[10px] text-accent">{actions.filter(a => a.status === st).length}</span>
              </div>
              {actions.filter(a => a.status === st).map(a => (
                <div key={a.id} className="border border-edge bg-bg/50 px-2 py-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs">{a.title}</span>
                    <button className="text-sig-error opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={async () => { await api.institute.deleteAction(a.id); load() }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="pt-chip text-[9px]" style={{ color: `var(--accent-${deptColor(a.dept_id)}, #aaa)` }}>
                      {deptName(a.dept_id)}
                    </span>
                    <div className="flex-1 h-1 bg-edge/60">
                      <div className="h-full bg-accent" style={{ width: `${a.progress ?? 0}%` }} />
                    </div>
                    <span className="pt-mono text-[9px] text-text-lo">{a.progress ?? 0}%</span>
                  </div>
                  {st !== 'done' && (
                    <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="pt-btn pt-btn-ghost text-[9px] px-1.5 py-0.5" onClick={() => bumpProgress(a, 25)}>+25%</button>
                      {st === 'active' && <button className="pt-btn pt-btn-ghost text-[9px] px-1.5 py-0.5" onClick={() => moveAction(a, 'hold')}>搁置</button>}
                      {st === 'hold' && <button className="pt-btn pt-btn-ghost text-[9px] px-1.5 py-0.5" onClick={() => moveAction(a, 'active')}>恢复</button>}
                      <button className="pt-btn pt-btn-ghost text-[9px] px-1.5 py-0.5 text-accent" onClick={() => moveAction(a, 'done')}>完成</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* phases */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="pt-section-label text-text-lo">PHASES · 阶段里程碑</div>
          <div className="flex gap-2">
            <select className="pt-input pt-mono text-xs w-36" value={phaseForm.dept_id}
              onChange={e => setPhaseForm({ ...phaseForm, dept_id: e.target.value })}>
              <option value="">归属部门…</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="pt-input pt-mono text-xs w-52" placeholder="新阶段 *"
              value={phaseForm.title} onChange={e => setPhaseForm({ ...phaseForm, title: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && addPhase()} />
            <button className="pt-btn pt-btn-primary text-xs" onClick={addPhase}><Plus size={12} /></button>
          </div>
        </div>
        <div className="space-y-1">
          {phases.map(p => (
            <div key={p.id} className="flex items-center gap-3 border border-edge px-3 py-2 group">
              <button onClick={async () => { await api.institute.savePhase({ ...p, done: !p.done }); load() }}
                className={['w-4 h-4 border flex items-center justify-center text-[10px] shrink-0',
                  p.done ? 'border-accent text-accent bg-accent/10' : 'border-edge text-transparent'].join(' ')}>
                ✓
              </button>
              <span className={['text-xs', p.done ? 'text-text-lo line-through' : 'text-text-hi'].join(' ')}>{p.title}</span>
              <span className="pt-chip text-[9px]">{deptName(p.dept_id)}</span>
              <div className="flex-1" />
              <button className="text-sig-error opacity-0 group-hover:opacity-100"
                onClick={async () => { await api.institute.deletePhase(p.id); load() }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {phases.length === 0 && <div className="text-xs text-text-lo">暂无阶段 · 把大目标拆成里程碑</div>}
        </div>
      </div>
    </div>
  )
}

export default Institute
