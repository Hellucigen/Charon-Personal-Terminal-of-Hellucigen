import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Play, FolderOpen, Plus, Trash2, RefreshCw, Rss } from 'lucide-react'

/* Music & podcasts — local library scan (opened in the system player;
 * the webview sandbox can't stream arbitrary local files) and podcast
 * RSS subscriptions with episode lists. */

export const Music: React.FC = () => {
  const [dir, setDir] = useState('')
  const [tracks, setTracks] = useState<any[]>([])
  const [scanning, setScanning] = useState(false)
  const [podcasts, setPodcasts] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [podForm, setPodForm] = useState({ title: '', url: '' })

  const loadPods = async () => setPodcasts(await api.music.podcasts() ?? [])
  useEffect(() => { loadPods() }, [])

  const scan = async () => {
    if (!dir) return
    setScanning(true)
    try { setTracks(await api.music.scan(dir) ?? []) }
    finally { setScanning(false) }
  }

  const addPod = async () => {
    if (!podForm.url) return
    await api.music.addPodcast(podForm.title, podForm.url)
    setPodForm({ title: '', url: '' })
    loadPods()
  }
  const refresh = async (id: string) => {
    const p = await api.music.refresh(id)
    setPodcasts(ps => ps.map(x => x.id === id ? p : x))
    setExpanded(id)
  }

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="MUSIC · 音乐 / 播客" subtitle="本地库扫描 · 系统播放器打开 · 播客 RSS 订阅" />

      {/* local library */}
      <GlassPanel title="LIBRARY · 本地音乐" subtitle="mp3 / flac / m4a / wav / ogg">
        <div className="flex gap-2 mt-3">
          <input className="pt-input flex-1 pt-mono text-xs" placeholder="音乐文件夹绝对路径（如 D:\\Music）"
            value={dir} onChange={e => setDir(e.target.value)} />
          <button className="pt-btn pt-btn-primary" disabled={scanning || !dir} onClick={scan}>
            <FolderOpen size={13} /> {scanning ? '扫描中…' : '扫描'}
          </button>
        </div>
        {tracks.length > 0 && (
          <>
            <div className="text-xs text-text-lo pt-mono mt-2">{tracks.length} 首 · 点击用系统默认播放器打开</div>
            <div className="mt-2 space-y-1 max-h-[360px] overflow-auto">
              {tracks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 border border-edge px-3 py-1.5 text-xs group hover:border-accent/50">
                  <button className="text-accent shrink-0" onClick={() => api.music.play(t.path, 'play')}>
                    <Play size={12} />
                  </button>
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-text-lo truncate max-w-[160px]">{t.artist}</span>
                  <span className="pt-mono text-[10px] text-text-lo">{(t.size / 1048576).toFixed(1)}MB · {t.ext.slice(1)}</span>
                  <button className="text-text-lo hover:text-accent opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => api.music.play(t.path, 'reveal')}>
                    <FolderOpen size={11} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassPanel>

      {/* podcasts */}
      <GlassPanel title="PODCASTS · 播客订阅" subtitle="RSS 源 · 单集在浏览器 / 播放器中打开">
        <div className="flex gap-2 mt-3">
          <input className="pt-input pt-mono text-xs w-40" placeholder="播客名"
            value={podForm.title} onChange={e => setPodForm({ ...podForm, title: e.target.value })} />
          <input className="pt-input flex-1 pt-mono text-xs" placeholder="RSS 地址 *（https://…/feed.xml）"
            value={podForm.url} onChange={e => setPodForm({ ...podForm, url: e.target.value })} />
          <button className="pt-btn pt-btn-primary" disabled={!podForm.url} onClick={addPod}><Plus size={13} /> 订阅</button>
        </div>

        <div className="mt-4 space-y-2">
          {podcasts.map(p => (
            <div key={p.id} className="border border-edge">
              <div className="flex items-center gap-2 px-3 py-2">
                <Rss size={13} className="text-accent shrink-0" />
                <span className="text-sm flex-1 truncate cursor-pointer" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  {p.title}
                </span>
                <span className="pt-mono text-[10px] text-text-lo">{(p.episodes ?? []).length} 集</span>
                <button className="pt-btn pt-btn-ghost text-xs" onClick={() => refresh(p.id)}><RefreshCw size={11} /></button>
                <button className="text-sig-error" onClick={async () => { await api.music.deletePodcast(p.id); loadPods() }}>
                  <Trash2 size={12} />
                </button>
              </div>
              {expanded === p.id && (
                <div className="border-t border-edge max-h-64 overflow-auto">
                  {(p.episodes ?? []).map((ep: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface">
                      <button className="text-accent shrink-0" onClick={() => api.music.play(ep.url, 'play')}>
                        <Play size={11} />
                      </button>
                      <span className="flex-1 truncate">{ep.title}</span>
                      {ep.date && <span className="pt-mono text-[10px] text-text-lo shrink-0">{String(ep.date).slice(0, 16)}</span>}
                    </div>
                  ))}
                  {(p.episodes ?? []).length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-lo">暂无单集 · 点击 ↻ 拉取 RSS</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {podcasts.length === 0 && <div className="text-xs text-text-lo">暂无订阅</div>}
        </div>
      </GlassPanel>
    </div>
  )
}

export default Music
