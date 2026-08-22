import { useApp } from "@/store/app";
import { MODULES, GROUP_LABEL } from "@/lib/modules";
import { ChevronsLeft } from "lucide-react";
import clsx from "clsx";

const ASCII_LOGO = `
  ▟█▙   PERSONAL
  ▜█▛   TERMINAL  v0.1
`;

export default function Sidebar() {
  // 解构出包含原始样式控制的所有状态以及新增加的 enabledPlugins
  const { active, setActive, sidebarCollapsed, toggleSidebar, enabledPlugins } = useApp();

  // 严格继承原版对内置菜单的分组归类逻辑
  const groups: Record<string, typeof MODULES> = {};
  for (const m of MODULES) {
    (groups[m.group] = groups[m.group] || []).push(m);
  }

  return (
    <aside
      className={clsx(
        "pt-glass relative flex flex-col h-full transition-[width] duration-200",
        sidebarCollapsed ? "w-[56px]" : "w-[240px]"
      )}
      style={{ borderRight: "1px solid rgb(var(--pt-edge) / var(--pt-edge-a))" }}
    >
      {/* ───── header / brand ───── */}
      <div className="h-[60px] px-4 flex items-center justify-between border-b border-edge">
        {!sidebarCollapsed ? (
          <pre className="pt-ascii leading-tight">{ASCII_LOGO.trim()}</pre>
        ) : (
          <pre className="pt-ascii text-center w-full leading-tight">▟█▙{"\n"}▜█▛</pre>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="pt-btn-ghost pt-btn h-7 w-7 p-0 justify-center"
            title="折叠侧栏"
          >
            <ChevronsLeft size={14} />
          </button>
        )}
      </div>

      {/* ───── nav ───── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {Object.entries(groups).map(([groupKey, items]) => (
          <div key={groupKey}>
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 pt-section-label">
                {GROUP_LABEL[groupKey as keyof typeof GROUP_LABEL]}
              </div>
            )}
            <ul>
              {items.map(m => {
                const Icon = m.icon;
                const isActive = m.id === active;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setActive(m.id)}
                      className={clsx(
                        "group w-full h-9 px-3 flex items-center gap-3 rounded-soft transition-colors relative",
                        isActive
                          ? "text-text-hi bg-[#fff5ee]"
                          : "text-text-mid hover:text-text-hi hover:bg-[#f0f0f0]"
                      )}
                      title={sidebarCollapsed ? m.label : undefined}
                    >
                      <span
                        className={clsx(
                          "absolute left-0 top-1.5 bottom-1.5 w-[2px] transition-all",
                          isActive ? "bg-accent" : "bg-transparent"
                        )}
                      />
                      <Icon size={15} className={clsx("shrink-0", isActive ? "text-accent" : "")} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="text-[13px] font-medium flex-1 text-left">
                            {m.label}
                          </span>
                          {m.shortcut && (
                            <span className="text-[10px] font-mono text-text-lo opacity-0 group-hover:opacity-100 transition">
                              {m.shortcut}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* ── 动态插件列表：在底层完美套用原版 button 的全部样式类名与高亮发光条 ── */}
        {/* ── 动态插件列表：剔除原生占位插件，只显示真正的第三方纯动态插件 ── */}
        {enabledPlugins && Object.values(enabledPlugins).length > 0 && (
            <div>
              {/* 使用 size 计算，只有当存在“非内置”插件时才渲染这个 PLUGINS 标签 */}
              {!sidebarCollapsed && Object.values(enabledPlugins).some((p: any) => p.id !== "com.hellucigen.passwords") && (
                  <div className="px-3 pb-1.5 pt-section-label">
                    PLUGINS
                  </div>
              )}
              <ul>
                {Object.values(enabledPlugins).map((plugin: any) => {
                  // 💡 核心改动：如果插件 ID 对应的是原生的 passwords 占位，则侧边栏独立插件列表不重复显示它
                  if (plugin.id === "com.hellucigen.passwords") return null;

                  const isActive = plugin.id === active;
                  return (
                      <li key={plugin.id}>
                        <button
                            onClick={() => setActive(plugin.id)}
                            className={clsx(
                                "group w-full h-9 px-3 flex items-center gap-3 rounded-soft transition-colors relative",
                                isActive ? "text-text-hi bg-[#fff5ee]" : "text-text-mid hover:text-text-hi hover:bg-[#f0f0f0]"
                            )}
                            title={sidebarCollapsed ? plugin.name : undefined}
                        >
                          <span
                              className={clsx(
                                  "absolute left-0 top-1.5 bottom-1.5 w-[2px] transition-all",
                                  isActive ? "bg-accent" : "bg-transparent"
                              )}
                          />
                          <span className={clsx("shrink-0 text-[15px] w-[15px] h-[15px] flex items-center justify-center", isActive ? "text-accent" : "")}>
                {plugin.icon || '🔌'}
              </span>
                          {!sidebarCollapsed && (
                              <span className="text-[13px] font-medium flex-1 text-left truncate">
                  {plugin.name}
                </span>
                          )}
                        </button>
                      </li>
                  );
                })}
              </ul>
            </div>
        )}
      </nav>

      {/* ───── footer ───── */}
      <div className="border-t border-edge p-3 text-[10px] font-mono text-text-lo">
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between">
            <span>SYS · OK</span>
            <span className="pt-num">{new Date().toISOString().slice(11,19)}</span>
          </div>
        ) : (
          <div className="text-center"><span className="pt-dot live" /></div>
        )}
      </div>
    </aside>
  );
}