import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type StatTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";

const ACCENTS: Record<StatTone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
};

interface StatTileProps {
  label: string;
  value: number | string;
  tone?: StatTone;
  /** Short clarifying line — say what the number means operationally. */
  hint?: ReactNode;
  href?: string;
}

/**
 * Single metric. Kept deliberately plain: no sparkline, no delta — this dashboard
 * answers "what needs my attention right now", not "how are trends moving".
 */
export function StatTile({ label, value, tone = "neutral", hint, href }: StatTileProps) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular", ACCENTS[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs leading-snug text-ink-subtle">{hint}</p>}
    </>
  );

  const base = "block rounded-lg border border-line bg-surface px-4 py-3 shadow-card";

  if (href) {
    return (
      <Link href={href} className={cn(base, "transition-colors hover:bg-surface-2")}>
        {body}
      </Link>
    );
  }

  return <div className={base}>{body}</div>;
}
