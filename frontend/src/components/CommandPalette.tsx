import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app";
import { MODULES, GROUP_LABEL } from "@/lib/modules";
import { Search, ArrowRight } from "lucide-react";
import clsx from "clsx";

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  shortcut?: string;
  perform: () => void;
}

export default function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setActive, setFleetingDrawerOpen, setAccent } = useApp();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the items list once per render — small enough not to memoize hard.
  const items: PaletteItem[] = useMemo(() => {
    const navItems: PaletteItem[] = MODULES.map(m => ({
      id: `goto:${m.id}`,
      group: `GOTO · ${GROUP_LABEL[m.group]}`,
      label: m.label,
      hint: m.hint,
      shortcut: m.shortcut,
      perform: () => { setActive(m.id); setPaletteOpen(false); },
    }));
    const actions: PaletteItem[] = [
      {
        id: "fleeting:capture",
        group: "ACTION",
        label: "捕获零碎想法",
        hint: "Open fleeting drawer",
        shortcut: "⌃⌥ N",
        perform: () => { setFleetingDrawerOpen(true); setPaletteOpen(false); },
      },
      {
        id: "accent:cyan",    group: "ACCENT", label: "Accent · Cyan",    perform: () => { setAccent("cyan");    setPaletteOpen(false); },
      },
      {
        id: "accent:magenta", group: "ACCENT", label: "Accent · Magenta", perform: () => { setAccent("magenta"); setPaletteOpen(false); },
      },
      {
        id: "accent:violet",  group: "ACCENT", label: "Accent · Violet",  perform: () => { setAccent("violet");  setPaletteOpen(false); },
      },
      {
        id: "accent:lime",    group: "ACCENT", label: "Accent · Lime",    perform: () => { setAccent("lime");    setPaletteOpen(false); },
      },
      {
        id: "accent:amber",   group: "ACCENT", label: "Accent · Amber",   perform: () => { setAccent("amber");   setPaletteOpen(false); },
      },
      {
        id: "accent:rose",    group: "ACCENT", label: "Accent · Rose",    perform: () => { setAccent("rose");    setPaletteOpen(false); },
      },
    ];
    return [...actions, ...navItems];
  }, [setActive, setPaletteOpen, setFleetingDrawerOpen, setAccent]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it =>
      it.label.toLowerCase().includes(needle) ||
      (it.hint  ?? "").toLowerCase().includes(needle) ||
      it.group.toLowerCase().includes(needle)
    );
  }, [items, q]);

  useEffect(() => { setSelected(0); }, [q, paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [paletteOpen]);

  // Global keymap: Ctrl/Cmd+K to open; ESC closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      } else if (paletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelected(s => Math.min(filtered.length - 1, s + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected(s => Math.max(0, s - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          filtered[selected]?.perform();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, filtered, selected, setPaletteOpen]);

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        className="pt-glass-elevated w-[640px] max-w-[92vw] rounded-soft overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* search row */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-edge">
          <Search size={14} className="text-text-mid" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="跳转、命令、设置 …"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-text-lo"
          />
          <span className="pt-kbd">ESC</span>
        </div>

        {/* results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-text-lo font-mono">
              no results — try `goto:notes` or just `fascinator`
            </div>
          ) : (
            renderGroups(filtered, selected, (it) => it.perform())
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-4 h-9 border-t border-edge text-[10.5px] font-mono text-text-lo">
          <div className="flex items-center gap-3">
            <span><span className="pt-kbd">↑</span><span className="pt-kbd ml-1">↓</span> navigate</span>
            <span><span className="pt-kbd">↵</span> select</span>
          </div>
          <span>{filtered.length} item{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

function renderGroups(items: PaletteItem[], selectedIdx: number, onPick: (it: PaletteItem) => void) {
  // Group preserving the order of first appearance.
  const groups: Record<string, PaletteItem[]> = {};
  const order: string[] = [];
  items.forEach(it => {
    if (!groups[it.group]) { groups[it.group] = []; order.push(it.group); }
    groups[it.group].push(it);
  });

  let runningIdx = 0;
  return order.map(g => (
    <div key={g} className="mb-1">
      <div className="px-4 pt-2 pb-1 pt-section-label">{g}</div>
      <ul>
        {groups[g].map(it => {
          const myIdx = runningIdx++;
          const isSel = myIdx === selectedIdx;
          return (
            <li key={it.id}>
              <button
                onClick={() => onPick(it)}
                className={clsx(
                  "w-full px-4 py-2 flex items-center gap-3 text-left transition",
                  isSel ? "bg-white/[0.06] text-white" : "text-text-mid hover:bg-white/[0.04]"
                )}
              >
                <ArrowRight size={12} className={isSel ? "text-accent" : "text-text-lo"} />
                <span className="text-[13px] flex-1">{it.label}</span>
                {it.hint && <span className="text-[11px] text-text-lo">{it.hint}</span>}
                {it.shortcut && (
                  <span className="font-mono text-[10px] text-text-lo">{it.shortcut}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}
