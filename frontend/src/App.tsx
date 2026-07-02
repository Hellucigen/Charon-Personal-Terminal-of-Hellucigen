import React, { Suspense, lazy, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import CommandPalette from '@/components/CommandPalette'
import FleetingDrawer from '@/components/FleetingDrawer'
import { useApp } from '@/store/app'
import Dashboard from '@/modules/Dashboard'
import { PluginPanel } from '@/components/PluginPanel'
import { List, IsEnabled } from './wailsjs/go/modules/PluginsService'

const Fascinator = lazy(() => import('@/modules/Fascinator').then(m => ({ default: m.Fascinator })))
const Notes      = lazy(() => import('@/modules/Notes').then(m => ({ default: m.Notes })))
const Todo       = lazy(() => import('@/modules/Todo').then(m => ({ default: m.Todo })))
const Fleeting   = lazy(() => import('@/modules/Fleeting').then(m => ({ default: m.Fleeting })))
const Shortcuts  = lazy(() => import('@/modules/Shortcuts').then(m => ({ default: m.Shortcuts })))
const Bookmarks  = lazy(() => import('@/modules/Bookmarks').then(m => ({ default: m.Bookmarks })))
const Plugins    = lazy(() => import('@/modules/Plugins').then(m => ({ default: m.Plugins })))
const Settings   = lazy(() => import('@/modules/Settings').then(m => ({ default: m.Settings })))

// Stubs
const Passwords  = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Passwords })))
const Detective  = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Detective })))
const Travel     = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Travel })))
const Institute  = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Institute })))
const Learning   = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Learning })))
const Music      = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Music })))
const Finance    = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Finance })))
const Health     = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Health })))
const Creative   = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Creative })))
const Network    = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Network })))
const Time       = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Time })))
const RPG        = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.RPG })))
const Data       = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Data })))
const Diary      = lazy(() => import('@/modules/Stubs').then(m => ({ default: m.Diary })))

const Fallback: React.FC = () => (
    <div className="flex items-center justify-center h-full">
      <div className="pt-section-label text-text-lo">LOADING ······</div>
    </div>
)

export default function App() {
  const { active, enabledPlugins, setEnabledPlugins } = useApp()

  // 启动时加载已启用的插件
  useEffect(() => {
    const loadEnabled = async () => {
      const plugins = await List()
      const enabled: Record<string, any> = {}
      for (const p of plugins) {
        if (await IsEnabled(p.id) && p.kind === 'panel') {
          enabled[p.id] = p
        }
      }
      setEnabledPlugins(enabled)
    }
    loadEnabled()
  }, [])

// ───── 核心视图网关切换 ─────
  let content: React.ReactNode;

// 1. 优先拦截：如果当前激活项是启用的“非原生内置占位”的第三方动态插件
  if (enabledPlugins[active] && active !== "passwords") {
    content = <PluginPanel pluginId={active} />;
  } else {
    // 2. 走你原生的固定核心路由开关
    switch (active) {
      case 'dashboard':  content = <Dashboard />; break;
      case 'fascinator': content = <Fascinator />; break;
      case 'notes':      content = <Notes />; break;
      case 'todo':       content = <Todo />; break;
      case 'fleeting':   content = <Fleeting />; break;
      case 'shortcuts':  content = <Shortcuts />; break;
      case 'bookmarks':  content = <Bookmarks />; break;

        // 💡 优雅无缝接管：当点击原生 Vault 菜单时进行识别检测
      case 'passwords':
        if (enabledPlugins["com.hellucigen.passwords"]) {
          // 如果系统后端识别到了该扩展，则原地接管，用 PluginPanel 刷出功能 UI
          content = <PluginPanel pluginId="com.hellucigen.passwords" />;
        } else {
          // 未加载或未启用时，仍然回退展示原汁原味的施工占位 Stub 界面
          content = <Passwords />;
        }
        break;

      case 'plugins':    content = <Plugins />; break;
      case 'settings':   content = <Settings />; break;
      default:           content = <Dashboard />;
    }
  }

  return (
      <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-hi">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto pt-stagger">
            <Suspense fallback={<Fallback />}>{content}</Suspense>
          </main>
        </div>
        <CommandPalette />
        <FleetingDrawer />
      </div>
  )
}