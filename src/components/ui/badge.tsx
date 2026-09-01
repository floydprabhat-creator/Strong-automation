import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink",
  accent: "bg-accent-soft text-accent-ink",
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-neutral-ink",
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Renders a leading status dot — useful for state, not for categories. */
  dot?: boolean;
  /** Adds a subtle pulse; reserved for genuinely in-progress states. */
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                DOTS[tone],
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOTS[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
