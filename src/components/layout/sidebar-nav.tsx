"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconAlert, IconCode, IconGauge, IconLayers } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Client component purely so the active route can be highlighted. Nav data is
 * passed in from the server shell as serializable props — icons are resolved
 * here by key rather than passed as elements, since components can't cross the
 * server/client boundary as props.
 */

export type NavIconKey = "gauge" | "layers" | "alert" | "code";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  /** Optional count badge, e.g. jobs needing attention. */
  count?: number;
  /** Draw the count in the danger tone when it represents a problem. */
  countTone?: "danger" | "neutral";
}

const ICONS: Record<NavIconKey, (props: { size?: number }) => ReactNode> = {
  gauge: (p) => <IconGauge {...p} />,
  layers: (p) => <IconLayers {...p} />,
  alert: (p) => <IconAlert {...p} />,
  code: (p) => <IconCode {...p} />,
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((item) => {
        // Exact match for the root, prefix match for sections, so /jobs/123
        // still highlights "Jobs".
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent-ink"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <span className={cn("shrink-0", active ? "text-accent" : "text-ink-subtle")}>
              {ICONS[item.icon]({ size: 16 })}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular",
                  item.countTone === "danger"
                    ? "bg-danger-soft text-danger-ink"
                    : "bg-surface-3 text-ink-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
