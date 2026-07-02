import { create } from "zustand";

export type ModuleID =
  | "dashboard"
  | "fascinator"
  | "notes"
  | "fleeting"
  | "todo"
  | "shortcuts"
  | "bookmarks"
  | "passwords"
  | "detective"
  | "travel"
  | "institute"
  | "learning"
  | "music"
  | "finance"
  | "health"
  | "creative"
  | "network"
  | "time"
  | "rpg"
  | "data"
  | "diary"
  | "plugins"
  | "settings"
  | string; // ← 添加 string 支持动态插件 ID

export type AccentColor = "cyan" | "magenta" | "violet" | "lime" | "amber" | "rose";

export type EnabledPlugin = {
  id: string;
  name: string;
  kind: string;
  entry: string;
  icon?: string;
  // ✨ 追加以下三个类型字段，完美对齐你的 plugin.json 配置
  version?: string;
  description?: string;
  permissions?: string[];
};

interface AppState {
  active: ModuleID;
  setActive: (m: ModuleID) => void;

  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;

  fleetingDrawerOpen: boolean;
  setFleetingDrawerOpen: (b: boolean) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  accent: AccentColor;
  setAccent: (c: AccentColor) => void;

  // 动态插件状态
  enabledPlugins: Record<string, EnabledPlugin>;
  setEnabledPlugins: (plugins: Record<string, EnabledPlugin>) => void;
  addEnabledPlugin: (plugin: EnabledPlugin) => void;
  removeEnabledPlugin: (id: string) => void;
}

export const useApp = create<AppState>((set) => ({
  active: "dashboard",
  setActive: (m) => set({ active: m }),

  paletteOpen: false,
  setPaletteOpen: (b) => set({ paletteOpen: b }),

  fleetingDrawerOpen: false,
  setFleetingDrawerOpen: (b) => set({ fleetingDrawerOpen: b }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  accent: "cyan",
  setAccent: (c) => {
    document.documentElement.setAttribute("data-accent", c);
    set({ accent: c });
  },

  // 动态插件
  enabledPlugins: {},
  setEnabledPlugins: (plugins) => set({ enabledPlugins: plugins }),
  addEnabledPlugin: (plugin) =>
    set((s) => ({
      enabledPlugins: { ...s.enabledPlugins, [plugin.id]: plugin },
    })),
  removeEnabledPlugin: (id) =>
    set((s) => {
      const next = { ...s.enabledPlugins };
      delete next[id];
      return { enabledPlugins: next };
    }),
}));