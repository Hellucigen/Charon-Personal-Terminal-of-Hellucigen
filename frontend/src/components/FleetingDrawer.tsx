import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { X, Sparkles } from "lucide-react";

export default function FleetingDrawer() {
  const { fleetingDrawerOpen, setFleetingDrawerOpen } = useApp();
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Global hotkey Ctrl+Alt+N
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setFleetingDrawerOpen(true);
      } else if (e.key === "Escape" && fleetingDrawerOpen) {
        setFleetingDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fleetingDrawerOpen, setFleetingDrawerOpen]);

  useEffect(() => {
    if (fleetingDrawerOpen) setTimeout(() => ref.current?.focus(), 30);
  }, [fleetingDrawerOpen]);

  if (!fleetingDrawerOpen) return null;

  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    try {
      await api.fleeting.capture(body.trim(), tags);
      setBody(""); setTagsInput("");
      setFleetingDrawerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-end"
      onClick={() => setFleetingDrawerOpen(false)}
    >
      <div
        className="pt-glass-elevated h-full w-[420px] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ borderLeft: "1px solid rgb(var(--pt-edge) / var(--pt-edge-hot-a))" }}
      >
        <div className="flex items-center justify-between h-12 px-4 border-b border-edge">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-[13px] font-medium">捕获零碎想法</span>
            <span className="pt-chip">FLEETING</span>
          </div>
          <button onClick={() => setFleetingDrawerOpen(false)} className="pt-btn-ghost pt-btn h-7 w-7 p-0 justify-center">
            <X size={14} />
          </button>
        </div>

        <textarea
          ref={ref}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="一闪而过的念头、歌词摘录、文档片段…"
          className="flex-1 bg-transparent outline-none p-4 text-[14px] leading-relaxed resize-none placeholder:text-text-lo"
        />

        <div className="px-4 py-2 border-t border-edge">
          <input
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder="tags · 用逗号分隔"
            className="pt-input"
          />
        </div>

        <div className="flex items-center justify-between px-4 h-12 border-t border-edge text-[11px] font-mono text-text-lo">
          <div>{body.length} chars</div>
          <div className="flex items-center gap-2">
            <span><span className="pt-kbd">⌘</span><span className="pt-kbd ml-1">↵</span> save</span>
            <button
              onClick={submit}
              disabled={saving || !body.trim()}
              className="pt-btn pt-btn-primary"
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
            >
              {saving ? "saving…" : "capture"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
