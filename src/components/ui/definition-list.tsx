import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Label/value pairs for record detail panels. */
export function DefinitionList({
  className,
  children,
  columns = 1,
}: {
  className?: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Definition({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  /** Use for hashes, paths, IDs. */
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm break-words text-ink",
          mono && "font-mono text-[0.8125rem]",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
