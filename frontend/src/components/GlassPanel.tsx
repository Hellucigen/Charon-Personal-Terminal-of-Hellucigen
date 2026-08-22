import { ReactNode } from "react";
import clsx from "clsx";

/* Module card — the rack-equipment container of the industrial theme:
 * solid #fafafa face, 1px border, gray nameplate header with a status
 * dot. No blur, no scanline, 2px radius. */

interface Props {
  title?: string;
  subtitle?: string;
  meta?: string | ReactNode;    // monospaced mini-info on the right (e.g. count)
  actions?: ReactNode;          // buttons rendered top-right
  scanline?: boolean;           // retired with the dark theme (accepted, ignored)
  variant?: "default" | "elevated";
  className?: string;
  children: ReactNode;
}

export default function GlassPanel({
  title, subtitle, meta, actions, scanline, variant = "default", className, children,
}: Props) {
  void scanline;
  return (
    <section
      className={clsx(
        "relative rounded-soft overflow-hidden flex flex-col",
        variant === "elevated" ? "pt-glass-elevated" : "pt-glass",
        className
      )}
    >
      {(title || subtitle || actions || meta) && (
        <header className="pt-module-header">
          <span className="pt-dot live shrink-0" />
          {title && <h2 className="pt-h2 truncate">{title}</h2>}
          {subtitle && (
            <span className="font-normal normal-case tracking-normal text-[11px] text-text-mid truncate ml-1">
              {subtitle}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto min-w-0 shrink-0">
            {meta && <span className="pt-tag">{meta}</span>}
            {actions}
          </div>
        </header>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </section>
  );
}
