import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/store/app'
import { Enable, OpenFolder, IsEnabled } from '@wails/go/modules/PluginsService'
import GlassPanel from '@/components/GlassPanel'
import { Package, FileCode, Activity, Power, PowerOff, Folder as FolderIcon } from 'lucide-react'

type Manifest = {
    id: string
    name: string
    version: string
    kind: string
    entry: string
    permissions?: string[]
    icon?: string
    host_min?: string
    path?: string
}

export const Plugins: React.FC = () => {
    const [items, setItems] = useState<Manifest[]>([])
    const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({})
    const { addEnabledPlugin, removeEnabledPlugin } = useApp()

    const reload = async () => {
        const list = (await api.plugins.list()) ?? []
        setItems(list)

        const map: Record<string, boolean> = {}
        for (const p of list) {
            map[p.id] = await IsEnabled(p.id)
        }
        setEnabledMap(map)
    }

    useEffect(() => { reload() }, [])

    const handleEnable = async (p: Manifest) => {
        const newState = !enabledMap[p.id]
        await Enable(p.id, newState)
        setEnabledMap(prev => ({ ...prev, [p.id]: newState }))

        if (newState && p.kind === 'panel') {
            addEnabledPlugin({
                id: p.id,
                name: p.name,
                kind: p.kind,
                entry: p.entry,
                icon: p.icon,
            })
        } else if (!newState) {
            removeEnabledPlugin(p.id)
        }
    }

    const handleOpenFolder = async (id: string) => {
        await OpenFolder(id)
    }

    const kindBadge = (k: string) => {
        const color = ({
            panel:      'border-accent text-accent',
            command:    'border-sig-info text-sig-info',
            background: 'border-text-mid text-text-mid',
            block:      'border-sig-warn text-sig-warn',
        } as Record<string, string>)[k] || 'border-edge text-text-mid'
        return <span className={['pt-chip', color].join(' ')}>{k.toUpperCase()}</span>
    }

    return (
        <div className="p-6 space-y-4">
            <GlassPanel
                title="PLUGINS · 插件中心"
                subtitle={`已安装 ${items.length} 个插件 · 拖拽 plugin.json 文件夹到工作区即可装载`}
                meta={<span className="pt-mono text-xs text-text-lo">~/.personal-terminal/plugins</span>}
                scanline
                actions={
                    <button className="pt-btn pt-btn-ghost" onClick={reload}>
                        <Activity size={12} /> RESCAN
                    </button>
                }
            />

            {items.length === 0 ? (
                <div className="pt-glass p-12 text-center text-text-lo">
                    <Package size={32} className="mx-auto mb-3 opacity-40" />
                    <div className="pt-section-label mb-2">NO PLUGINS</div>
                    <div className="text-xs max-w-md mx-auto">
                        将插件文件夹（包含 plugin.json）放到{' '}
                        <span className="pt-mono text-accent">~/.personal-terminal/plugins/</span> 即可。
                        参考 docs/PLUGIN_DEVELOPMENT.md 学习如何制作插件。
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {items.map(p => {
                        const isEnabled = enabledMap[p.id] || false
                        return (
                            <div key={p.id} className="pt-glass p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 border border-accent text-accent flex items-center justify-center">
                                        <FileCode size={16} />
                                    </div>
                                    {kindBadge(p.kind)}
                                </div>
                                <div className="text-text-hi font-medium truncate">{p.name}</div>
                                <div className="pt-mono text-[10px] text-text-lo mt-1">
                                    {p.id} · v{p.version}
                                </div>
                                {p.permissions && p.permissions.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {p.permissions.map(perm => (
                                            <span key={perm} className="pt-chip text-text-lo">{perm}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge">
                                    <button
                                        className={`pt-btn pt-btn-ghost ${isEnabled ? 'text-accent' : ''}`}
                                        onClick={() => handleEnable(p)}
                                    >
                                        {isEnabled ? <PowerOff size={11} /> : <Power size={11} />}
                                        {isEnabled ? 'DISABLE' : 'ENABLE'}
                                    </button>
                                    <button
                                        className="pt-btn pt-btn-ghost"
                                        onClick={() => handleOpenFolder(p.id)}
                                    >
                                        <FolderIcon size={11} /> OPEN
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default Plugins