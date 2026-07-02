import { ReactNode } from "react";
import clsx from "clsx";

interface Props {
  title?: string;
  subtitle?: string;
  meta?: string;             // monospaced mini-info on the right (e.g. count)
  actions?: ReactNode;       // buttons rendered top-right
  scanline?: boolean;        // adds the running scan line accent
  variant?: "default" | "elevated";
  className?: string;
  children: ReactNode;
}

export default function GlassPanel({
  title, subtitle, meta, actions, scanline, variant = "default", className, children,
}: Props) {
  return (
    <section
      className={clsx(
        "relative rounded-soft overflow-hidden flex flex-col",
        variant === "elevated" ? "pt-glass-2" : "pt-glass",
        className
      )}
    >
      {scanline && <span className="pt-scan-overlay" />}
      {(title || subtitle || actions || meta) && (
        <header className="flex items-start justify-between px-5 py-4 border-b border-edge">
          <div>
            {title && <h2 className="pt-h2">{title}</h2>}
            {subtitle && <div className="text-[12px] text-text-mid mt-1">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            {meta && <span className="text-[11px] font-mono text-text-lo">{meta}</span>}
            {actions}
          </div>
        </header>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </section>
  );
}
