import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, Upload, Repeat } from 'lucide-react'

/* Finance — transactions, Alipay/WeChat CSV import, monthly & category
 * summaries drawn as plain SVG bars, subscriptions. */

export const Finance: React.FC = () => {
  const [txs, setTxs] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [subs, setSubs] = useState<any[]>([])
  const [form, setForm] = useState({ amount: '', category: '', note: '' })
  const [subForm, setSubForm] = useState({ name: '', cost: '', cycle: 'monthly', next_at: '' })
  const [imp, setImp] = useState({ path: '', kind: 'alipay' })
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const load = async () => {
    setTxs(await api.finance.transactions(month) ?? [])
    setSummary(await api.finance.summary(6))
    setSubs(await api.finance.subscriptions() ?? [])
  }
  useEffect(() => { load() }, [month])

  const addTx = async (sign: 1 | -1) => {
    const v = Number(form.amount)
    if (!v) return
    await api.finance.saveTx({
      amount: sign * v, category: form.category || (sign > 0 ? 'income' : 'misc'),
      note: form.note, source: 'manual',
    })
    setForm({ amount: '', category: '', note: '' })
    load()
  }
  const doImport = async () => {
    if (!imp.path) return
    const n = await api.finance.importCSV(imp.path, imp.kind)
    setImp({ ...imp, path: '' })
    load()
    alert(`导入 ${n} 笔`)
  }
  const addSub = async () => {
    if (!subForm.name) return
    await api.finance.saveSubscription({
      name: subForm.name, cost: Number(subForm.cost) || 0, cycle: subForm.cycle,
      next_at: subForm.next_at ? Math.floor(new Date(subForm.next_at).getTime() / 1000) : 0,
    })
    setSubForm({ name: '', cost: '', cycle: 'monthly', next_at: '' })
    load()
  }

  const months: any[] = summary?.by_month ?? []
  const cats: any[] = summary?.by_category ?? []
  const maxM = Math.max(1, ...months.map((m: any) => Math.max(m.income, m.expense)))
  const maxC = Math.max(1, ...cats.map((c: any) => c.expense))
  const monthTx = txs.filter(t => new Date(t.occurred_at * 1000).toISOString().slice(0, 7) === month)
  const inSum = monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const outSum = -monthTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="FINANCE · 个人财务"
        subtitle="收支记录 · 支付宝/微信 CSV 导入 · 月度/类别汇总 · 订阅提醒" />

      {/* month picker + tiles */}
      <div className="flex items-center gap-3">
        <input type="month" className="pt-input pt-mono text-xs w-32" value={month}
          onChange={e => setMonth(e.target.value)} />
        <div className="grid grid-cols-3 gap-3 flex-1">
          <div className="border border-edge px-3 py-2">
            <div className="pt-section-label text-text-lo">当月收入</div>
            <div className="pt-display text-xl pt-mono text-accent mt-0.5">+¥{inSum.toFixed(2)}</div>
          </div>
          <div className="border border-edge px-3 py-2">
            <div className="pt-section-label text-text-lo">当月支出</div>
            <div className="pt-display text-xl pt-mono text-sig-warn mt-0.5">-¥{outSum.toFixed(2)}</div>
          </div>
          <div className="border border-edge px-3 py-2">
            <div className="pt-section-label text-text-lo">当月净额</div>
            <div className={['pt-display text-xl pt-mono mt-0.5', inSum - outSum >= 0 ? 'text-accent' : 'text-sig-error'].join(' ')}>
              ¥{(inSum - outSum).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* charts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-3">月度对比 · 近 6 月</div>
          <svg viewBox="0 0 400 140" className="w-full">
            {months.map((m: any, i: number) => {
              const bw = 400 / Math.max(months.length, 1)
              const ih = (m.income / maxM) * 100
              const eh = (m.expense / maxM) * 100
              return (
                <g key={i}>
                  <rect x={i * bw + bw * 0.15} y={120 - ih} width={bw * 0.3} height={Math.max(ih, 1)} fill="#009a9b" opacity={0.85} />
                  <rect x={i * bw + bw * 0.5} y={120 - eh} width={bw * 0.3} height={Math.max(eh, 1)} fill="#ff6b00" opacity={0.85} />
                  <text x={i * bw + bw / 2} y={134} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.45)" className="pt-mono">
                    {String(m.month).slice(5)}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="flex gap-4 text-[10px] text-text-lo pt-mono mt-1">
            <span><span className="text-accent">■</span> 收入</span>
            <span><span className="text-sig-warn">■</span> 支出</span>
          </div>
        </div>
        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-3">类别支出 TOP</div>
          <div className="space-y-1.5">
            {cats.slice(0, 8).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-right truncate text-text-mid pt-mono">{c.category}</span>
                <div className="flex-1 h-3 bg-edge/40">
                  <div className="h-full bg-accent" style={{ width: `${(c.expense / maxC) * 100}%` }} />
                </div>
                <span className="w-16 text-text-lo pt-mono">¥{Number(c.expense).toFixed(0)}</span>
              </div>
            ))}
            {cats.length === 0 && <div className="text-xs text-text-lo">暂无数据</div>}
          </div>
        </div>
      </div>

      {/* add + import */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-edge p-3 space-y-2">
          <div className="pt-section-label text-text-lo">记一笔</div>
          <div className="grid grid-cols-3 gap-2">
            <input className="pt-input pt-mono text-xs" placeholder="金额 *" inputMode="decimal"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })} />
            <input className="pt-input pt-mono text-xs col-span-2" placeholder="类别（food/transport/…）"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <input className="pt-input pt-mono text-xs col-span-3" placeholder="备注"
              value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="pt-btn pt-btn-primary text-xs flex-1" onClick={() => addTx(1)}><Plus size={12} /> 收入</button>
            <button className="pt-btn text-xs flex-1" onClick={() => addTx(-1)}><Plus size={12} /> 支出</button>
          </div>
        </div>
        <div className="border border-edge p-3 space-y-2">
          <div className="pt-section-label text-text-lo">CSV 导入</div>
          <div className="flex gap-2">
            <select className="pt-input pt-mono text-xs w-24" value={imp.kind} onChange={e => setImp({ ...imp, kind: e.target.value })}>
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
              <option value="manual">通用</option>
            </select>
            <input className="pt-input flex-1 pt-mono text-xs" placeholder="账单 CSV 路径"
              value={imp.path} onChange={e => setImp({ ...imp, path: e.target.value })} />
            <button className="pt-btn text-xs" onClick={doImport}><Upload size={12} /></button>
          </div>
          <div className="text-[10px] text-text-lo">支付宝/微信导出为 GBK 编码会自动转码 · 通用格式：日期,金额,类别,备注</div>
        </div>
      </div>

      {/* subscriptions */}
      <div className="border border-edge p-3">
        <div className="pt-section-label text-text-lo mb-2 flex items-center gap-1.5">
          <Repeat size={12} /> 订阅服务
        </div>
        <div className="flex gap-2 mb-3">
          <input className="pt-input pt-mono text-xs w-32" placeholder="名称 *"
            value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} />
          <input className="pt-input pt-mono text-xs w-20" placeholder="¥/期"
            value={subForm.cost} onChange={e => setSubForm({ ...subForm, cost: e.target.value.replace(/[^\d.]/g, '') })} />
          <select className="pt-input pt-mono text-xs w-20" value={subForm.cycle}
            onChange={e => setSubForm({ ...subForm, cycle: e.target.value })}>
            <option value="weekly">周付</option>
            <option value="monthly">月付</option>
            <option value="yearly">年付</option>
          </select>
          <input type="date" className="pt-input pt-mono text-xs w-32" value={subForm.next_at}
            onChange={e => setSubForm({ ...subForm, next_at: e.target.value })} />
          <button className="pt-btn pt-btn-primary text-xs" onClick={addSub}><Plus size={12} /></button>
        </div>
        <div className="space-y-1">
          {subs.map(s => (
            <div key={s.id} className="flex items-center gap-3 border border-edge px-3 py-1.5 text-xs group">
              <span className="flex-1">{s.name}</span>
              <span className="pt-mono text-accent">¥{Number(s.cost).toFixed(2)}/{s.cycle === 'monthly' ? '月' : s.cycle === 'yearly' ? '年' : '周'}</span>
              {s.next_at > 0 && (
                <span className={['pt-mono', s.next_at * 1000 - Date.now() < 7 * 86400000 ? 'text-sig-warn' : 'text-text-lo'].join(' ')}>
                  下期 {new Date(s.next_at * 1000).toLocaleDateString('zh-CN')}
                </span>
              )}
              <button className="text-sig-error opacity-0 group-hover:opacity-100"
                onClick={async () => { await api.finance.deleteSubscription(s.id); load() }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {subs.length === 0 && <div className="text-xs text-text-lo">Netflix / 服务器 / 域名 · 添加后到期前 7 天变黄提醒</div>}
        </div>
      </div>

      {/* transactions */}
      <div className="border border-edge">
        <div className="px-3 py-2 pt-section-label text-text-lo border-b border-edge">
          TRANSACTIONS · {month}
        </div>
        <div className="max-h-[300px] overflow-auto">
          {monthTx.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-edge/40 group">
              <span className={['pt-mono w-20', t.amount > 0 ? 'text-accent' : 'text-sig-warn'].join(' ')}>
                {t.amount > 0 ? '+' : ''}{Number(t.amount).toFixed(2)}
              </span>
              <span className="pt-chip text-[10px]">{t.category}</span>
              <span className="flex-1 truncate text-text-mid">{t.note || '—'}</span>
              <span className="pt-mono text-[10px] text-text-lo">{new Date(t.occurred_at * 1000).toLocaleDateString('zh-CN')}</span>
              <span className="pt-mono text-[9px] text-text-lo">{t.source}</span>
              <button className="text-sig-error opacity-0 group-hover:opacity-100"
                onClick={async () => { await api.finance.deleteTx(t.id); load() }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {monthTx.length === 0 && <div className="px-3 py-3 text-xs text-text-lo">本月暂无记录</div>}
        </div>
      </div>
    </div>
  )
}

export default Finance
