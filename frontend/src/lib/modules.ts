import {
  LayoutDashboard, Cpu, FileText, Sparkles, ListTodo, Folder, Bookmark,
  KeyRound, Network, Map, Building2, GraduationCap, Music, Wallet,
  Activity, Palette, Cable, Timer, Trophy, BarChart3, BookHeart,
  Puzzle, Settings,
} from "lucide-react";
import type { ModuleID } from "@/store/app";
import type { LucideIcon } from "lucide-react";

export interface ModuleEntry {
  id: ModuleID;
  label: string;
  hint: string;
  icon: LucideIcon;
  group: "core" | "knowledge" | "ops" | "life" | "system";
  shortcut?: string;
}

// Ordered by group, then by the cognitive priority the user described.
// Keep this list as the canonical registry — nav, palette, dashboard tiles,
// and plugin scopes all read from it.
export const MODULES: ModuleEntry[] = [
  // core
  { id: "dashboard", label: "Dashboard",  hint: "总览仪表盘",   icon: LayoutDashboard, group: "core", shortcut: "G D" },
  { id: "fascinator",label: "Fascinator", hint: "认知图谱启动器", icon: Cpu,            group: "core", shortcut: "G F" },

  // knowledge
  { id: "notes",     label: "Notes",      hint: "块编辑器笔记",  icon: FileText,       group: "knowledge", shortcut: "G N" },
  { id: "fleeting",  label: "Fleeting",   hint: "零碎想法",      icon: Sparkles,       group: "knowledge", shortcut: "G S" },
  { id: "detective", label: "Detective",  hint: "侦探线索板",    icon: Network,        group: "knowledge" },
  { id: "travel",    label: "Travel Log", hint: "旅游日记",      icon: Map,            group: "knowledge" },
  { id: "institute", label: "Institute",  hint: "「学院」构想",  icon: Building2,      group: "knowledge" },

  // ops
  { id: "todo",      label: "Todo",       hint: "待办事项",      icon: ListTodo,       group: "ops", shortcut: "G T" },
  { id: "shortcuts", label: "Shortcuts",  hint: "快捷方式",      icon: Folder,         group: "ops" },
  { id: "bookmarks", label: "Bookmarks",  hint: "书签管理",      icon: Bookmark,       group: "ops" },
  { id: "passwords", label: "Vault",      hint: "密码管理器",    icon: KeyRound,       group: "ops" },
  { id: "network",   label: "Net Tools",  hint: "网络工具箱",    icon: Cable,          group: "ops" },

  // life
  { id: "learning",  label: "Learning",   hint: "背单词 / 题库", icon: GraduationCap,  group: "life" },
  { id: "music",     label: "Music",      hint: "音乐 · 播客",   icon: Music,          group: "life" },
  { id: "finance",   label: "Finance",    hint: "财务管理",      icon: Wallet,         group: "life" },
  { id: "health",    label: "Health",     hint: "健康追踪",      icon: Activity,       group: "life" },
  { id: "creative",  label: "Studio",     hint: "创意工作台",    icon: Palette,        group: "life" },
  { id: "time",      label: "Time",       hint: "时间追踪",      icon: Timer,          group: "life" },
  { id: "rpg",       label: "RPG",        hint: "人生 RPG",      icon: Trophy,         group: "life" },
  { id: "data",      label: "Data",       hint: "个人数据中心",  icon: BarChart3,      group: "life" },
  { id: "diary",     label: "Diary",      hint: "日记 / 总结",   icon: BookHeart,      group: "life" },

  // system
  { id: "plugins",   label: "Plugins",    hint: "插件",          icon: Puzzle,         group: "system" },
  { id: "settings",  label: "Settings",   hint: "设置",          icon: Settings,       group: "system" },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m])) as Record<ModuleID, ModuleEntry>;

export const GROUP_LABEL: Record<ModuleEntry["group"], string> = {
  core:       "CORE",
  knowledge:  "KNOWLEDGE",
  ops:        "OPS",
  life:       "LIFE",
  system:     "SYSTEM",
};
