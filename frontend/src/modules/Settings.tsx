import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { useApp } from '@/store/app'
import { api } from '@/lib/api'
import { Palette, Globe, Key, FolderCog } from 'lucide-react'

const ACCENTS = ['orange', 'cyan', 'violet', 'lime', 'amber', 'rose'] as const

export const Settings: React.FC = () => {
  const { accent, setAccent } = useApp()
  const [locale, setLocale] = useState<'zh' | 'en'>('zh')
  const [aiKey, setAiKey] = useState('')

  const [fs, setFs] = useState({ python: '', app: '', config: '', port: '5000' })
  const [fsState, setFsState] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    api.fascinatorSettings.get()
      .then(s => setFs({ python: s.python, app: s.app, config: s.config, port: String(s.port || 5000) }))
      .catch(() => {})
  }, [])

  const saveFascinator = async () => {
    try {
      await api.fascinatorSettings.save({
        python: fs.python, app: fs.app, config: fs.config,
        port: parseInt(fs.port, 10) || 5000,
      })
      setFsState('saved')
    } catch {
      setFsState('error')
    }
    setTimeout(() => setFsState('idle'), 2500)
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <GlassPanel
        title="SETTINGS · 设置"
        subtitle="个人终端的全局配置 · 数据存于 ~/.personal-terminal/config.json"
        meta={<span className="pt-mono text-xs text-text-lo">v0.1.0</span>}
      />

      <Section icon={<Palette size={13} />} label="THEME · 主题色" hint="左侧导航、链接、活跃状态都将切换为此色">
        <div className="flex items-center gap-2 flex-wrap">
          {ACCENTS.map(c => (
            <button
              key={c}
              onClick={() => setAccent(c)}
              className={[
                'flex items-center gap-2 px-3 py-2 border transition-colors',
                accent === c ? 'border-accent text-accent bg-surface' : 'border-edge text-text-mid hover:text-text-hi',
              ].join(' ')}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: `var(--accent-${c})` }} />
              <span className="pt-mono text-xs uppercase">{c}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Globe size={13} />} label="LOCALE · 语言">
        <div className="flex items-center gap-2">
          {(['zh', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={[
                'px-3 py-1.5 border transition-colors pt-mono text-xs',
                locale === l ? 'border-accent text-accent bg-surface' : 'border-edge text-text-mid',
              ].join(' ')}
            >
              {l === 'zh' ? '中文' : 'EN'}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Key size={13} />} label="AI · API KEY" hint="Anthropic / OpenAI key · 用于命令面板 AI 副驾 · 仅本地保存">
        <input
          type="password"
          className="pt-input w-full pt-mono text-xs"
          placeholder="sk-ant-..."
          value={aiKey}
          onChange={e => setAiKey(e.target.value)}
        />
      </Section>

      <Section icon={<FolderCog size={13} />} label="FASCINATOR · 路径配置" hint="启动器路径 · 保存后于下次启动 Fascinator 生效 · 引擎超参数在 Fascinator 模块的 Config 标签页编辑">
        <div className="space-y-2">
          <input
            className="pt-input w-full pt-mono text-xs"
            placeholder="Python 解释器路径（留空则自动探测）"
            value={fs.python}
            onChange={e => setFs({ ...fs, python: e.target.value })}
          />
          <input
            className="pt-input w-full pt-mono text-xs"
            placeholder="app.py 路径，例如 E:\Fascinator\app.py"
            value={fs.app}
            onChange={e => setFs({ ...fs, app: e.target.value })}
          />
          <input
            className="pt-input w-full pt-mono text-xs"
            placeholder="config.json 路径（可选 · 留空则通过 API 读写）"
            value={fs.config}
            onChange={e => setFs({ ...fs, config: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <input
              className="pt-input pt-mono text-xs w-28"
              placeholder="端口"
              value={fs.port}
              onChange={e => setFs({ ...fs, port: e.target.value.replace(/\D/g, '') })}
            />
            <button
              onClick={saveFascinator}
              className="px-3 py-1.5 border border-edge pt-mono text-xs text-text-mid hover:text-accent hover:border-accent transition-colors"
            >
              SAVE
            </button>
            {fsState === 'saved' && <span className="text-xs pt-mono text-accent">已保存</span>}
            {fsState === 'error' && <span className="text-xs pt-mono text-rose-400">保存失败</span>}
          </div>
        </div>
      </Section>

      <div className="pt-glass p-4">
        <div className="pt-section-label text-text-lo mb-2">ABOUT</div>
        <div className="text-sm text-text-mid leading-relaxed">
          Personal Terminal · 个人终端 v0.1.0 · 本地优先 · 开源 ·{' '}
          <span className="pt-mono text-accent">Wails v2 · Go + React</span>
        </div>
        <div className="text-xs text-text-lo mt-2">
          数据：<span className="pt-mono">~/.personal-terminal/terminal.db</span> ·
          媒体：<span className="pt-mono">~/.personal-terminal/media/</span> ·
          插件：<span className="pt-mono">~/.personal-terminal/plugins/</span>
        </div>
      </div>
    </div>
  )
}

const Section: React.FC<{
  icon: React.ReactNode
  label: string
  hint?: string
  children: React.ReactNode
}> = ({ icon, label, hint, children }) => (
  <div className="pt-glass p-4">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <span className="pt-section-label">{label}</span>
    </div>
    {hint && <div className="text-xs text-text-lo mb-3">{hint}</div>}
    {children}
  </div>
)

export default Settings
