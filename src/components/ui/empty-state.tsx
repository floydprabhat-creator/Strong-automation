import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-ink-subtle">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
      )}
      {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
