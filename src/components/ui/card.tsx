import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-surface shadow-card overflow-hidden",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  /** Turn off for edge-to-edge content such as tables. */
  padded?: boolean;
}) {
  return <div className={cn(padded && "px-4 py-3", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2.5",
        className,
      )}
    >
      {children}
    </footer>
  );
}
