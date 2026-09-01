import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BannerTone = "info" | "warn" | "danger" | "ok";

const TONES: Record<BannerTone, string> = {
  info: "border-info/30 bg-info-soft",
  warn: "border-warn/30 bg-warn-soft",
  danger: "border-danger/30 bg-danger-soft",
  ok: "border-ok/30 bg-ok-soft",
};

const TITLE_TONES: Record<BannerTone, string> = {
  info: "text-info-ink",
  warn: "text-warn-ink",
  danger: "text-danger-ink",
  ok: "text-ok-ink",
};

/**
 * Prominent, page-level message. Used for operator gates (VPN / Dashlane
 * re-auth) and worker-level conditions — things that block throughput and must
 * not be missed.
 */
export function Banner({
  tone = "info",
  icon,
  title,
  children,
  actions,
  className,
}: {
  tone?: BannerTone;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        TONES[tone],
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className={cn("mt-0.5 shrink-0", TITLE_TONES[tone])}>{icon}</span>}
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", TITLE_TONES[tone])}>{title}</p>
          {children && (
            <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{children}</div>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 sm:ml-4">{actions}</div>}
    </div>
  );
}
