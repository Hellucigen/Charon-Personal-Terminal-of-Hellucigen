import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Lock, Unlock, Plus, Copy, Trash2, Upload, ShieldCheck } from 'lucide-react'

/* Password vault — AES-256-GCM behind a master passphrase.
 * Secrets stay encrypted on disk; reveal copies to the clipboard and
 * auto-clears it 30 seconds later. */

const STRENGTH = ['危', '弱', '一般', '强', '极强']
const STRENGTH_CLS = ['text-sig-error', 'text-sig-error', 'text-sig-warn', 'text-accent', 'text-accent']

export const Passwords: React.FC = () => {
  const [st, setSt] = useState<{ created: boolean; unlocked: boolean; entries: number } | null>(null)
  const [master, setMaster] = useState('')
  const [err, setErr] = useState('')
  const [list, setList] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', url: '', username: '', password: '', notes: '' })
  const [csvPath, setCsvPath] = useState('')
  const [copied, setCopied] = useState('')

  const load = async () => {
    const s = await api.passwords.status()
    setSt(s)
    if (s.unlocked) setList(await api.passwords.list())
  }
  useEffect(() => { load() }, [])

  const doInit = async () => {
    setErr('')
    try { await api.passwords.init(master); setMaster(''); load() }
    catch (e: any) { setErr(String(e?.message ?? e)) }
  }
  const doUnlock = async () => {
    setErr('')
    try { await api.passwords.unlock(master); setMaster(''); load() }
    catch (e: any) { setErr(String(e?.message ?? e)) }
  }
  const doLock = async () => { await api.passwords.lock(); setList([]); load() }

  const copySecret = async (id: string) => {
    try {
      const r = await api.passwords.reveal(id)
      await navigator.clipboard.writeText(r.password)
      setCopied(id)
      setTimeout(async () => {
        await navigator.clipboard.writeText(' ').catch(() => {})
        setCopied('')
      }, 30000)
    } catch (e: any) { setErr(String(e?.message ?? e)) }
  }

  const save = async () => {
    if (!form.name) return
    await api.passwords.save(form)
    setForm({ name: '', url: '', username: '', password: '', notes: '' })
    load()
  }

  const importCSV = async () => {
    if (!csvPath) return
    try {
      const n = await api.passwords.importCSV(csvPath)
      setCsvPath('')
      load()
      setErr(n > 0 ? `已导入 ${n} 条` : '未导入任何条目')
    } catch (e: any) { setErr(String(e?.message ?? e)) }
  }

  if (!st) return <div className="p-6 text-text-lo pt-mono text-xs">LOADING ······</div>

  if (!st.created || !st.unlocked) {
    return (
      <div className="p-6 max-w-md mx-auto mt-16">
        <GlassPanel title="VAULT · 密码库" subtitle={st.created ? '输入主密码解锁' : '首次使用 · 设置主密码'} scanline>
          <div className="mt-4 space-y-3">
            <input type="password" className="pt-input w-full pt-mono text-sm" placeholder="主密码"
              value={master} onChange={e => setMaster(e.target.value)} autoFocus />
            {st.created
              ? <button className="pt-btn pt-btn-primary w-full" disabled={!master} onClick={doUnlock}>
                  <Unlock size={13} /> 解锁
                </button>
              : <button className="pt-btn pt-btn-primary w-full" disabled={master.length < 4} onClick={doInit}>
                  <ShieldCheck size={13} /> 创建密码库（PBKDF2 · AES-256-GCM）
                </button>}
            {err && <div className="text-xs text-sig-error pt-mono">{err}</div>}
            <div className="text-xs text-text-lo leading-relaxed">
              主密码不落盘。密钥由 PBKDF2-HMAC-SHA256（21 万轮）派生，数据库只存校验哈希与密文。
              忘记主密码 = 数据不可恢复。
            </div>
          </div>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <GlassPanel
        title="VAULT · 密码库"
        subtitle={`AES-256-GCM · ${st.entries} 条 · 复制后 30 秒自动清空剪贴板`}
        meta={<span className="pt-chip text-accent border-accent pt-mono">UNLOCKED</span>}
        actions={<button className="pt-btn pt-btn-ghost" onClick={doLock}><Lock size={13} /> 锁定</button>}
      />

      {err && <div className="pt-glass p-2 text-xs text-accent pt-mono">{err}</div>}

      <GlassPanel title="NEW ENTRY · 新增" subtitle="保存后密码即加密入库，列表不再显示明文">
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input className="pt-input pt-mono text-xs" placeholder="名称 *（如 GitHub）"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="pt-input pt-mono text-xs" placeholder="URL"
            value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <input className="pt-input pt-mono text-xs" placeholder="用户名"
            value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          <input className="pt-input pt-mono text-xs" placeholder="密码"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <input className="pt-input pt-mono text-xs col-span-2" placeholder="备注（2FA 备份码 / 安全问题…）"
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className="pt-btn pt-btn-primary mt-3" disabled={!form.name} onClick={save}>
          <Plus size={13} /> SAVE
        </button>
      </GlassPanel>

      <GlassPanel title="IMPORT · Edge/Chrome CSV" subtitle="列：name,url,username,password">
        <div className="flex gap-2 mt-3">
          <input className="pt-input flex-1 pt-mono text-xs" placeholder="CSV 文件绝对路径"
            value={csvPath} onChange={e => setCsvPath(e.target.value)} />
          <button className="pt-btn" disabled={!csvPath} onClick={importCSV}><Upload size={13} /> IMPORT</button>
        </div>
      </GlassPanel>

      <div className="space-y-1">
        {list.map(e => (
          <div key={e.id} className="flex items-center justify-between border border-edge px-3 py-2 hover:border-accent/60 transition-colors">
            <div className="min-w-0 flex items-center gap-3">
              <span className="truncate text-sm">{e.name}</span>
              <span className="text-xs text-text-lo truncate">{e.username}</span>
              {e.duplicate && <span className="pt-chip text-sig-warn border-sig-warn text-[10px]">重复</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className={['text-xs pt-mono', STRENGTH_CLS[e.strength ?? 0]].join(' ')}>
                {STRENGTH[e.strength ?? 0]}
              </span>
              <button className="pt-btn pt-btn-ghost text-xs" onClick={() => copySecret(e.id)}>
                <Copy size={12} /> {copied === e.id ? '29s…' : '复制'}
              </button>
              <button className="pt-btn pt-btn-ghost text-xs text-sig-error"
                onClick={async () => { await api.passwords.remove(e.id); load() }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-text-lo text-xs pt-mono">密码库为空</div>}
      </div>
    </div>
  )
}

export default Passwords
