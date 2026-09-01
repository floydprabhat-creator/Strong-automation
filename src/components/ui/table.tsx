import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Thin styled table primitives. Wide tables must stay scrollable inside their own
 * container rather than forcing the page to scroll sideways — `TableScroll`
 * enforces that.
 */

export function TableScroll({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}

export function Table({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface-2 text-left">{children}</thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({
  className,
  children,
  interactive = false,
}: {
  className?: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <tr className={cn(interactive && "transition-colors hover:bg-surface-2", className)}>
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={cn("px-3 py-2.5 align-middle text-ink", className)} {...rest}>
      {children}
    </td>
  );
}
