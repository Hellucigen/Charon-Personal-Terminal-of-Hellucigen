import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, MapPin } from 'lucide-react'

/* Travel log — trips, daily entries with mood / spend / GPS, and a
 * mini-map plotting each entry's coordinates. */

const fmtDay = (ts: number) => new Date(ts * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
const MOOD = ['😫', '😕', '😐', '🙂', '🤩']

export const Travel: React.FC = () => {
  const [trips, setTrips] = useState<any[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [tripForm, setTripForm] = useState({ title: '', note: '' })
  const [form, setForm] = useState({ title: '', body: '', mood: 4, spend: 0, lat: '', lng: '' })

  const loadTrips = async () => {
    const t = await api.travel.trips()
    setTrips(t ?? [])
    if (!cur && t?.length) setCur(t[0].id)
  }
  const loadEntries = async () => {
    if (!cur) { setEntries([]); return }
    setEntries(await api.travel.entries(cur) ?? [])
  }
  useEffect(() => { loadTrips() }, [])
  useEffect(() => { loadEntries() }, [cur])

  const addTrip = async () => {
    if (!tripForm.title.trim()) return
    const t = await api.travel.saveTrip({ ...tripForm, start_at: Math.floor(Date.now() / 1000) })
    setTripForm({ title: '', note: '' })
    await loadTrips()
    if (t?.id) setCur(t.id)
  }
  const addEntry = async () => {
    if (!cur) return
    await api.travel.saveEntry({
      trip_id: cur, title: form.title, body: form.body, mood: Number(form.mood),
      spend: Number(form.spend) || 0,
      lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null,
    })
    setForm({ title: '', body: '', mood: 4, spend: 0, lat: '', lng: '' })
    loadEntries()
  }

  const withGPS = entries.filter(e => e.lat && e.lng)
  const totalSpend = entries.reduce((s, e) => s + Number(e.spend || 0), 0)

  // mini-map bounds
  let bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null = null
  if (withGPS.length) {
    bounds = withGPS.reduce((b, e) => ({
      minLat: Math.min(b.minLat, e.lat), maxLat: Math.max(b.maxLat, e.lat),
      minLng: Math.min(b.minLng, e.lng), maxLng: Math.max(b.maxLng, e.lng),
    }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 })
  }
  const MW = 360, MH = 240
  const proj = (lat: number, lng: number) => {
    const b = bounds!
    const spanLat = b.maxLat - b.minLat || 0.01
    const spanLng = b.maxLng - b.minLng || 0.01
    return { x: 20 + ((lng - b.minLng) / spanLng) * (MW - 40), y: MH - 20 - ((lat - b.minLat) / spanLat) * (MH - 40) }
  }

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="TRAVEL · 旅游日记" subtitle={`${trips.length} 次行程 · 时间轴 + 坐标小地图 · 消费自动入账 Finance`} />

      <div className="grid grid-cols-[260px_1fr] gap-3">
        {/* trips sidebar */}
        <div className="space-y-2">
          <div className="border border-edge p-3 space-y-2">
            <div className="pt-section-label text-text-lo">NEW TRIP</div>
            <input className="pt-input w-full pt-mono text-xs" placeholder="行程名 *（如：敦煌三日）"
              value={tripForm.title} onChange={e => setTripForm({ ...tripForm, title: e.target.value })} />
            <input className="pt-input w-full pt-mono text-xs" placeholder="备注"
              value={tripForm.note} onChange={e => setTripForm({ ...tripForm, note: e.target.value })} />
            <button className="pt-btn pt-btn-primary w-full text-xs" onClick={addTrip}><Plus size={12} /> 创建行程</button>
          </div>
          {trips.map(t => (
            <div key={t.id}
              className={['border px-3 py-2 cursor-pointer transition-colors', cur === t.id ? 'border-accent bg-surface' : 'border-edge hover:border-accent/50'].join(' ')}
              onClick={() => setCur(t.id)}>
              <div className="flex items-center justify-between">
                <span className="text-sm truncate">{t.title}</span>
                <button className="text-sig-error hover:text-red-400 shrink-0"
                  onClick={async e => { e.stopPropagation(); await api.travel.deleteTrip(t.id); if (cur === t.id) setCur(null); loadTrips() }}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="text-xs text-text-lo pt-mono">{fmtDay(t.start_at)}{t.end_at ? ` → ${fmtDay(t.end_at)}` : ''}</div>
            </div>
          ))}
        </div>

        {/* entries */}
        <div className="space-y-3">
          {cur ? (
            <>
              <div className="flex items-center gap-4 text-xs pt-mono text-text-lo">
                <span>{entries.length} 条记录</span>
                <span>总支出 ¥{totalSpend.toFixed(2)}</span>
                <span>{withGPS.length} 个坐标点</span>
              </div>

              <div className="grid grid-cols-[1fr_360px] gap-3">
                {/* timeline */}
                <div className="space-y-2">
                  <div className="border border-edge p-3 space-y-2">
                    <div className="pt-section-label text-text-lo">NEW ENTRY</div>
                    <input className="pt-input w-full pt-mono text-xs" placeholder="今天去了哪？"
                      value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <textarea className="pt-input w-full pt-mono text-xs min-h-[60px]" placeholder="游记正文…"
                      value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                    <div className="grid grid-cols-4 gap-2">
                      <select className="pt-input pt-mono text-xs" value={form.mood}
                        onChange={e => setForm({ ...form, mood: Number(e.target.value) })}>
                        {[1, 2, 3, 4, 5].map(m => <option key={m} value={m}>{MOOD[m - 1]}</option>)}
                      </select>
                      <input className="pt-input pt-mono text-xs" placeholder="花费¥"
                        value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value.replace(/[^\d.]/g, '') })} />
                      <input className="pt-input pt-mono text-xs" placeholder="lat"
                        value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} />
                      <input className="pt-input pt-mono text-xs" placeholder="lng"
                        value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} />
                    </div>
                    <button className="pt-btn pt-btn-primary w-full text-xs" onClick={addEntry}><Plus size={12} /> 记一笔</button>
                  </div>

                  {entries.map(e => (
                    <div key={e.id} className="border border-edge px-3 py-2 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{MOOD[(e.mood || 3) - 1]}</span>
                          <span className="text-sm">{e.title || '（无标题）'}</span>
                          {e.spend > 0 && <span className="pt-chip text-xs">¥{Number(e.spend).toFixed(0)}</span>}
                          {e.lat && <span className="pt-chip text-xs text-accent border-accent"><MapPin size={10} /></span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-lo pt-mono">{fmtDay(e.logged_at)}</span>
                          <button className="text-sig-error opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async () => { await api.travel.deleteEntry(e.id); loadEntries() }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {e.body && <div className="text-xs text-text-mid mt-1 whitespace-pre-wrap">{e.body}</div>}
                    </div>
                  ))}
                </div>

                {/* mini map */}
                <div className="border border-edge p-3">
                  <div className="pt-section-label text-text-lo mb-2">MINI·MAP</div>
                  <svg viewBox={`0 0 ${MW} ${MH}`} className="w-full border border-edge/50 bg-surface">
                    <defs>
                      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width={MW} height={MH} fill="url(#grid)" />
                    {withGPS.length > 1 && (
                      <path d={withGPS.map((e, i) => {
                        const p = proj(e.lat, e.lng)
                        return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`
                      }).join(' ')} fill="none" stroke="#009a9b" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.7} />
                    )}
                    {withGPS.map((e, i) => {
                      const p = proj(e.lat, e.lng)
                      return (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r={5} fill="#009a9b" opacity={0.9} />
                          <circle cx={p.x} cy={p.y} r={10} fill="none" stroke="#009a9b" opacity={0.3} />
                          <text x={p.x + 12} y={p.y + 3} fontSize={9} fill="rgba(0,0,0,0.55)" className="pt-mono">
                            {(e.title || '').slice(0, 8)}
                          </text>
                        </g>
                      )
                    })}
                    {withGPS.length === 0 && (
                      <text x={MW / 2} y={MH / 2} textAnchor="middle" fontSize={11} fill="rgba(0,0,0,0.3)" className="pt-mono">
                        记录条目时填入 lat/lng 出现足迹
                      </text>
                    )}
                  </svg>
                  {bounds && (
                    <div className="text-[10px] text-text-lo pt-mono mt-2">
                      lat {bounds.minLat.toFixed(3)}~{bounds.maxLat.toFixed(3)} · lng {bounds.minLng.toFixed(3)}~{bounds.maxLng.toFixed(3)}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-edge p-8 text-center text-text-lo text-xs">
              左侧创建或选择一次行程开始记录
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Travel
