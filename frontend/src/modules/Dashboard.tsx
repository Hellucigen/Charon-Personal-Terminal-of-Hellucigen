import { useEffect, useState } from "react";
import GlassPanel from "@/components/GlassPanel";
import { api } from "@/lib/api";
import { Activity, CalendarClock, Flame, Sparkles, ListChecks, Cpu, ArrowUpRight } from "lucide-react";
import { useApp } from "@/store/app";

export default function Dashboard() {
  const { setActive } = useApp();
  const [todoCount, setTodoCount] = useState(0);
  const [fleetingCount, setFleetingCount] = useState(0);
  const [fascinatorRunning, setFascinatorRunning] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const todos = (await api.todo.list("today")) || [];
      setTodoCount(todos.filter((t: any) => !t.done).length);

      const fl = (await api.fleeting.stream(50)) || [];
      setFleetingCount(fl.length);
      setRecent(fl.slice(0, 5));

      const s = await api.fascinator.status();
      setFascinatorRunning(!!s?.running);
    })();
  }, []);

  return (
    <div className="p-7 space-y-6 pt-stagger">
      {/* ─── hero — terminal-style greeting ─── */}
      <div className="pt-glass rounded-soft px-6 py-7 relative overflow-hidden">
        <span className="pt-scan-overlay" />
        <div className="relative flex items-end justify-between gap-6">
          <div>
            <div className="pt-section-label mb-2">SESSION · {new Date().toISOString().slice(0,10)}</div>
            <h1 className="pt-h1 mb-1">
              {greeting()}, operator<span className="pt-cursor" />
            </h1>
            <div className="text-text-mid text-[14px] max-w-[60ch]">
              Personal Terminal · 一个本地优先的「人生操作系统」。
              所有数据在 <span className="pt-mono text-text-hi">~/.personal-terminal</span> 落盘,
              核心模块互通,可装插件。
            </div>
          </div>
          <pre
            className="pt-ascii hidden md:block text-right opacity-70"
            style={{ fontSize: 9, lineHeight: 1.15 }}
          >{ASCII_BIG}</pre>
        </div>
      </div>

      {/* ─── stat tiles ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<ListChecks  size={14}/>} label="Today · Todo"      value={todoCount.toString().padStart(2,"0")} accent onClick={() => setActive("todo")}/>
        <StatTile icon={<Sparkles    size={14}/>} label="Fleeting Captures" value={fleetingCount.toString().padStart(2,"0")} onClick={() => setActive("fleeting")}/>
        <StatTile icon={<Cpu         size={14}/>} label="Fascinator"        value={fascinatorRunning ? "RUNNING" : "STOPPED"} status={fascinatorRunning ? "live" : "idle"} onClick={() => setActive("fascinator")}/>
        <StatTile icon={<Flame       size={14}/>} label="Streak · Days"     value="—"/>
      </div>

      {/* ─── two-column ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <GlassPanel
          title="Recent fleeting thoughts"
          meta={`${recent.length} latest`}
          className="lg:col-span-2 min-h-[280px]"
        >
          {recent.length === 0 ? (
            <EmptyHint hint="按 ⌃⌥N 抓一个想法 · 或在 Fleeting 模块写一条" />
          ) : (
            <ul className="divide-y divide-edge">
              {recent.map(f => (
                <li key={f.id} className="px-5 py-3 hover:bg-[#f0f0f0] transition group">
                  <div className="flex items-start gap-3">
                    <span className="pt-num text-[10.5px] text-text-lo mt-0.5">
                      {new Date(f.created_at * 1000).toISOString().slice(5,16).replace("T"," ")}
                    </span>
                    <p className="flex-1 text-[13px] leading-relaxed">{f.body}</p>
                    <ArrowUpRight size={12} className="text-text-lo opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  {f.tags?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 ml-[60px]">
                      {f.tags.map((t: string) => <span key={t} className="pt-chip">{t}</span>)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel title="Upcoming" meta="next 24h">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3 text-[12.5px]">
              <CalendarClock size={14} className="text-accent" />
              <span className="text-text-mid">no calendar source linked yet</span>
            </div>
            <div className="flex items-center gap-3 text-[12.5px]">
              <Activity size={14} className="text-accent" />
              <span className="text-text-mid">habits: idle</span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return "深夜了";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 23) return "Good evening";
  return "Late night";
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  status?: "live" | "idle" | "warn" | "error";
  onClick?: () => void;
}
function StatTile({ icon, label, value, accent, status, onClick }: StatTileProps) {
  return (
    <button
      onClick={onClick}
      className="pt-glass rounded-soft px-4 py-3.5 text-left flex flex-col gap-2 transition hover:border-white/20"
      style={{ borderColor: accent ? "rgb(var(--pt-accent) / 0.4)" : undefined }}
    >
      <div className="flex items-center justify-between text-text-mid">
        <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-widest">
          {icon}<span>{label}</span>
        </div>
        {status && <span className={`pt-dot ${status}`} />}
      </div>
      <div className={`pt-num text-[26px] font-display font-semibold ${accent ? "text-accent" : "text-text-hi"}`}>
        {value}
      </div>
    </button>
  );
}

function EmptyHint({ hint }: { hint: string }) {
  return (
    <div className="px-5 py-10 text-center text-[12px] font-mono text-text-lo">
      {hint}
    </div>
  );
}

const ASCII_BIG = `
███╗   ██╗ ██████╗ ██╗    ██╗
████╗  ██║██╔═══██╗██║    ██║
██╔██╗ ██║██║   ██║██║ █╗ ██║
██║╚██╗██║██║   ██║██║███╗██║
██║ ╚████║╚██████╔╝╚███╔███╔╝
╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝
`.trim();
