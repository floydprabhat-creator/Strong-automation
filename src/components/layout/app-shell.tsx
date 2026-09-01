import type { ReactNode } from "react";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";
import { WorkerStatusPill } from "@/features/worker/components/worker-status-pill";
import { getQueueStats, getWorkerStatus } from "@/lib/data/repository";
import { relativeTime } from "@/lib/format/datetime";

/**
 * Application chrome: fixed sidebar, sticky top bar, scrolling content column.
 *
 * Async server component — it reads the counts the nav badges need, so no page
 * has to pass them in.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const [stats, worker] = await Promise.all([getQueueStats(), getWorkerStatus()]);

  const items: NavItem[] = [
    { href: "/", label: "Overview", icon: "gauge" },
    { href: "/jobs", label: "Jobs", icon: "layers", count: stats.queued },
    {
      href: "/attention",
      label: "Needs attention",
      icon: "alert",
      count: stats.failed,
      countTone: "danger",
    },
    { href: "/config", label: "Platforms", icon: "code" },
  ];

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-white">
            S
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">Strong Automation</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <SidebarNav items={items} />
        </div>

        <div className="border-t border-line px-3 py-3">
          <p className="text-xs font-medium text-ink-muted">Dashlane session</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {worker.dashlaneSessionExpiresAt
              ? `expires ${relativeTime(worker.dashlaneSessionExpiresAt)}`
              : "unknown"}
          </p>
          <p className="mt-2 text-xs font-medium text-ink-muted">VPN</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {worker.vpnConnected ? "connected" : "not connected"}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
          <span className="text-sm font-medium text-ink md:hidden">Strong Automation</span>
          <div className="hidden text-xs text-ink-subtle md:block">
            Dealership page publishing
          </div>
          <WorkerStatusPill status={worker} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
