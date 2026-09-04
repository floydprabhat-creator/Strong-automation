import type { ReactNode } from "react";
import { AppFrame } from "@/components/layout/app-frame";
import type { NavItem } from "@/components/layout/sidebar-nav";
import { WorkerStatusPill } from "@/features/worker/components/worker-status-pill";
import { getQueueStats, getWorkerStatus } from "@/lib/data/repository";
import { relativeTime } from "@/lib/format/datetime";

/**
 * Application chrome. Async server component — it reads the counts the nav
 * badges need, so no page has to pass them in.
 *
 * Layout and the mobile drawer live in `AppFrame`, which is a client component;
 * everything resolved here crosses as serializable props or rendered children.
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
    <AppFrame
      items={items}
      dashlaneLabel={
        worker.dashlaneSessionExpiresAt
          ? `expires ${relativeTime(worker.dashlaneSessionExpiresAt)}`
          : "unknown"
      }
      vpnLabel={worker.vpnConnected ? "connected" : "not connected"}
      statusPill={<WorkerStatusPill status={worker} />}
    >
      {children}
    </AppFrame>
  );
}
