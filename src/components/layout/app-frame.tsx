"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { IconMenu, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

/**
 * The shell's layout and its one piece of client state: whether the sidebar
 * drawer is open on small screens.
 *
 * Sizing: the frame owns the viewport (`h-dvh`, no page scroll), so the sidebar
 * always reaches the bottom of the screen and the main column scrolls on its
 * own. `dvh` rather than `vh` because mobile browser chrome makes `vh` overshoot.
 *
 * Server data arrives as serializable props; `children` and `statusPill` are
 * server-rendered nodes passed straight through.
 */
export function AppFrame({
  items,
  dashlaneLabel,
  vpnLabel,
  statusPill,
  children,
}: {
  items: NavItem[];
  dashlaneLabel: string;
  vpnLabel: string;
  statusPill: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The drawer remembers which route it was opened on, so a navigation closes it
  // by derivation rather than by an effect that would render twice.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Scrim. Mobile only — on md+ the sidebar is part of the layout, not a layer. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface transition-[transform,visibility] duration-200 md:static md:w-56 md:translate-x-0 md:visible",
          // `invisible` when closed keeps the offscreen links out of the tab order.
          open ? "translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-white">
            S
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            Strong Automation
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="-mr-1 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <SidebarNav items={items} />
        </div>

        <div className="shrink-0 border-t border-line px-3 py-3">
          <p className="text-xs font-medium text-ink-muted">Dashlane session</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{dashlaneLabel}</p>
          <p className="mt-2 text-xs font-medium text-ink-muted">VPN</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{vpnLabel}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={open}
            className="-ml-1 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <IconMenu size={18} />
          </button>

          <span className="text-sm font-medium text-ink md:hidden">Strong Automation</span>

          <div className="ml-auto flex items-center gap-2">
            {statusPill}
            <ThemeToggle />
          </div>
        </header>

        {/* The only scroll container in the app. */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
