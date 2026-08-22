import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Send, Globe2, Binary, Regex } from 'lucide-react'

/* Network toolbox — IP/DNS/ping, a mini-Postman, encoders and a regex
 * tester. All stateless calls into the Go backend. */

export const Network: React.FC = () => {
  const [tab, setTab] = useState<'net' | 'http' | 'encode' | 'regex'>('net')
  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <GlassPanel title="NETWORK · 网络工具箱" subtitle="IP / DNS / Ping · Mini-Postman · 编码转换 · 正则测试" />
      <div className="flex items-center gap-1">
        {(['net', 'http', 'encode', 'regex'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={['pt-section-label px-3 py-2 transition-colors flex items-center gap-1.5',
              tab === t ? 'text-accent' : 'text-text-lo hover:text-text-mid'].join(' ')}>
            {t === 'net' && <Globe2 size={11} />}
            {t === 'encode' && <Binary size={11} />}
            {t === 'regex' && <Regex size={11} />}
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'net' && <NetTab />}
      {tab === 'http' && <HttpTab />}
      {tab === 'encode' && <EncodeTab />}
      {tab === 'regex' && <RegexTab />}
    </div>
  )
}

const NetTab: React.FC = () => {
  const [info, setInfo] = useState<any>(null)
  const [host, setHost] = useState('')
  const [pingOut, setPingOut] = useState('')
  const [ips, setIps] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.net.localInfo().then(setInfo).catch(() => {}) }, [])

  const ping = async () => {
    if (!host) return
    setBusy(true)
    try { setPingOut(await api.net.ping(host) || '(无输出)') }
    catch (e: any) { setPingOut(String(e?.message ?? e)) }
    finally { setBusy(false) }
  }
  const resolve = async () => {
    if (!host) return
    try { setIps(await api.net.lookup(host) ?? []) }
    catch (e: any) { setIps([String(e?.message ?? e)]) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-2">本机信息</div>
          <div className="text-sm pt-mono text-accent">{info?.outbound_ip || '…'}</div>
          <div className="text-xs text-text-lo pt-mono">{info?.hostname}</div>
          <div className="mt-2 max-h-32 overflow-auto space-y-0.5">
            {(info?.interfaces ?? []).map((i: any, n: number) => (
              <div key={n} className="text-[10px] text-text-lo pt-mono truncate">
                {i.name}: {(i.addrs ?? []).join(', ')}
              </div>
            ))}
          </div>
        </div>
        <div className="border border-edge p-3 space-y-2">
          <div className="pt-section-label text-text-lo">PING / DNS</div>
          <div className="flex gap-2">
            <input className="pt-input flex-1 pt-mono text-xs" placeholder="主机名或 IP（如 github.com）"
              value={host} onChange={e => setHost(e.target.value)} />
            <button className="pt-btn text-xs" disabled={busy || !host} onClick={ping}>PING</button>
            <button className="pt-btn text-xs" disabled={!host} onClick={resolve}>DNS</button>
          </div>
          {ips.length > 0 && (
            <div className="text-xs pt-mono text-accent space-y-0.5">
              {ips.map((ip, i) => <div key={i}>{ip}</div>)}
            </div>
          )}
        </div>
      </div>
      {pingOut && (
        <div className="border border-edge p-3">
          <div className="pt-section-label text-text-lo mb-2">PING OUTPUT</div>
          <pre className="pt-mono text-[11px] text-text-mid whitespace-pre-wrap max-h-72 overflow-auto">{pingOut}</pre>
        </div>
      )}
    </div>
  )
}

const HttpTab: React.FC = () => {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState('{"Content-Type": "application/json"}')
  const [body, setBody] = useState('')
  const [resp, setResp] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!url) return
    let hdrs: Record<string, string> = {}
    try { hdrs = JSON.parse(headers || '{}') } catch { alert('请求头必须是合法 JSON'); return }
    setBusy(true)
    try {
      setResp(await api.net.httpRequest(method, url, hdrs, body))
    } catch (e: any) {
      setResp({ error: String(e?.message ?? e) })
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className="pt-input pt-mono text-xs w-24" value={method} onChange={e => setMethod(e.target.value)}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(m => <option key={m}>{m}</option>)}
        </select>
        <input className="pt-input flex-1 pt-mono text-xs" placeholder="https://…（可直连本机 Fascinator http://127.0.0.1:5000/api/graph）"
          value={url} onChange={e => setUrl(e.target.value)} />
        <button className="pt-btn pt-btn-primary text-xs" disabled={busy || !url} onClick={send}>
          <Send size={12} /> {busy ? '…' : 'SEND'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <textarea className="pt-input pt-mono text-xs min-h-[70px]" placeholder='请求头 JSON' value={headers}
          onChange={e => setHeaders(e.target.value)} />
        <textarea className="pt-input pt-mono text-xs min-h-[70px]" placeholder="请求体（POST/PUT）" value={body}
          onChange={e => setBody(e.target.value)} />
      </div>
      {resp && (
        <div className="border border-edge p-3">
          <div className="flex items-center gap-3 mb-2">
            {resp.error
              ? <span className="pt-chip text-sig-error border-sig-error">{resp.error}</span>
              : <>
                  <span className={['pt-chip', resp.status < 400 ? 'text-accent border-accent' : 'text-sig-error border-sig-error'].join(' ')}>
                    {resp.status}
                  </span>
                  <span className="pt-mono text-xs text-text-lo">{resp.ms}ms</span>
                </>}
          </div>
          {resp.headers && (
            <details className="mb-2">
              <summary className="text-[10px] text-text-lo cursor-pointer pt-mono">RESPONSE HEADERS</summary>
              <pre className="pt-mono text-[10px] text-text-lo mt-1 max-h-32 overflow-auto">
                {JSON.stringify(resp.headers, null, 2)}
              </pre>
            </details>
          )}
          <pre className="pt-mono text-[11px] text-text-mid whitespace-pre-wrap max-h-80 overflow-auto">{resp.body ?? ''}</pre>
        </div>
      )}
    </div>
  )
}

const EncodeTab: React.FC = () => {
  const [kind, setKind] = useState('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const run = async () => {
    try { setOutput(await api.net.encode(kind, input) ?? '') }
    catch (e: any) { setOutput('错误: ' + String(e?.message ?? e)) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select className="pt-input pt-mono text-xs w-32" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="base64">Base64 编码</option>
          <option value="base64d">Base64 解码</option>
          <option value="urlencode">URL 编码</option>
          <option value="urldecode">URL 解码</option>
          <option value="md5">MD5</option>
          <option value="sha1">SHA1</option>
          <option value="sha256">SHA256</option>
          <option value="json">JSON 美化</option>
        </select>
        <button className="pt-btn pt-btn-primary text-xs" onClick={run}><Send size={12} /> CONVERT</button>
      </div>
      <textarea className="pt-input pt-mono text-xs min-h-[120px]" placeholder="输入…"
        value={input} onChange={e => setInput(e.target.value)} />
      <textarea className="pt-input pt-mono text-xs min-h-[120px] text-accent" placeholder="输出…" value={output} readOnly />
    </div>
  )
}

const RegexTab: React.FC = () => {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b')
  const [text, setText] = useState('联系 alice@example.com 或 bob@test.org 获取详情')
  const [result, setResult] = useState<any>(null)

  const run = async () => {
    try { setResult(await api.net.regexTest(pattern, text)) }
    catch (e: any) { setResult({ error: String(e?.message ?? e) }) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="pt-input flex-1 pt-mono text-xs" placeholder="正则表达式" value={pattern}
          onChange={e => setPattern(e.target.value)} />
        <button className="pt-btn pt-btn-primary text-xs" onClick={run}><Send size={12} /> TEST</button>
      </div>
      <textarea className="pt-input pt-mono text-xs min-h-[100px]" placeholder="测试文本" value={text}
        onChange={e => setText(e.target.value)} />
      {result && (
        <div className="border border-edge p-3">
          {result.error ? (
            <div className="text-xs text-sig-error pt-mono">{result.error}</div>
          ) : (
            <>
              <div className="pt-mono text-xs text-accent mb-2">{result.count} 个匹配</div>
              <div className="flex flex-wrap gap-1.5">
                {(result.matches ?? []).map((m: string, i: number) => (
                  <span key={i} className="pt-chip text-accent border-accent">{m}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Network
