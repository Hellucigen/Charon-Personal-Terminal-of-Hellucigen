import { useApp, type AccentColor } from "@/store/app";
import { MODULE_BY_ID } from "@/lib/modules";
import { Command, Menu } from "lucide-react";
import clsx from "clsx";

const ACCENTS: { id: AccentColor; color: string }[] = [
  { id: "orange",  color: "#ff6b00" },
  { id: "cyan",    color: "#009a9b" },
  { id: "violet",  color: "#7c4dff" },
  { id: "lime",    color: "#2e7d32" },
  { id: "amber",   color: "#ff8c3a" },
  { id: "rose",    color: "#e03030" },
];

export default function TopBar() {
  // 1. 引入 enabledPlugins 状态
  const { active, setPaletteOpen, toggleSidebar, accent, setAccent, enabledPlugins } = useApp();
  
  // 2. 尝试从内置模块和动态插件列表中分别查找
  const current = MODULE_BY_ID[active];
  const activePlugin = enabledPlugins?.[active];

  // 3. 计算最终安全的显示文本，杜绝 undefined.label 报错崩溃
  const displayLabel = current?.label || activePlugin?.name || active;
  const displayHint = current?.hint || activePlugin?.kind || "Panel";

  return (
    <header
      className="pt-glass flex items-center justify-between px-4 shrink-0"
      style={{
        height: "var(--pt-topbar-h)",
        borderBottom: "1px solid rgb(var(--pt-edge) / var(--pt-edge-a))",
      }}
    >
      {/* ── left: hamburger + breadcrumb ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="pt-btn-ghost pt-btn h-7 w-7 p-0 justify-center"
          title="侧栏"
        >
          <Menu size={14} />
        </button>
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="font-mono text-text-lo">~/</span>
          {/* 使用安全计算后的值进行渲染，替换原本直接读取 current.label */}
          <span className="text-text-mid">{displayLabel}</span>
          <span className="text-text-lo">·</span>
          <span className="text-text-lo">{displayHint}</span>
        </div>
      </div>

      {/* ── center: command palette trigger (this is THE chrome hero element) ── */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="group flex items-center gap-2 h-7 px-3 rounded-soft border border-edge bg-white hover:border-[#b0b0b0] transition"
        style={{ minWidth: 360 }}
      >
        <Command size={12} className="text-text-mid" />
        <span className="text-[12px] text-text-mid flex-1 text-left">搜索 / 命令 …</span>
        <span className="pt-kbd">⌃</span><span className="pt-kbd">K</span>
      </button>

      {/* ── right: accent + status ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              title={`accent: ${a.id}`}
              className={clsx(
                "w-3.5 h-3.5 rounded-sharp transition-transform",
                accent === a.id ? "scale-110 ring-1 ring-[#1a1a1a]/40" : "opacity-60 hover:opacity-100"
              )}
              style={{ background: a.color }}
            />
          ))}
        </div>
        <div className="pt-divider-vert h-4" />
        <div className="flex items-center gap-1.5">
          <span className="pt-dot live" />
          <span className="text-[10.5px] font-mono text-text-mid">SYS·OK</span>
        </div>
      </div>
    </header>
  );
}