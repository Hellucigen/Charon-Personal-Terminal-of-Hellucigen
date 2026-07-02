import React, { useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { useApp } from '@/store/app'
import { Palette, Globe, Key, FolderCog } from 'lucide-react'

const ACCENTS = ['cyan', 'magenta', 'violet', 'lime', 'amber', 'rose'] as const

export const Settings: React.FC = () => {
  const { accent, setAccent } = useApp()
  const [locale, setLocale] = useState<'zh' | 'en'>('zh')
  const [aiKey, setAiKey] = useState('')

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

      <Section icon={<FolderCog size={13} />} label="FASCINATOR · 路径配置" hint="在 Fascinator 模块的 Config 标签页编辑超参数 · 这里仅设置启动器路径">
        <div className="space-y-2">
          <input className="pt-input w-full pt-mono text-xs" placeholder="Python 解释器路径（留空则自动探测）" />
          <input className="pt-input w-full pt-mono text-xs" placeholder="app.py 路径，例如 ~/code/fascinator/app.py" />
          <input className="pt-input w-full pt-mono text-xs" placeholder="端口（默认 5000）" />
        </div>
      </Section>

      <div className="pt-glass p-4">
        <div className="pt-section-label text-text-lo mb-2">ABOUT</div>
        <div className="text-sm text-text-mid leading-relaxed">
          Personal Terminal · 个人终端 v0.1.0 · 本地优先 · 开源 ·{' '}
          <span className="pt-mono text-accent">Wails v2 · Go + React</span>
        </div>
        <div className="text-xs text-text-lo mt-2">
          数据：<span className="pt-mono">~/.personal-terminal/data.db</span> ·
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
