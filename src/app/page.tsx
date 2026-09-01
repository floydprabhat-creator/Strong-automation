import Link from "next/link";
import { Banner } from "@/components/ui/banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAlert, IconPause } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { PlatformBreakdown } from "@/features/overview/components/platform-breakdown";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { OperatorGateBanner } from "@/features/worker/components/operator-gate-banner";
import {
  getPlatformBreakdown,
  getQueueStats,
  getWorkerStatus,
  listDeferredJobs,
  listOperatorGates,
} from "@/lib/data/repository";

export default async function OverviewPage() {
  const [stats, breakdown, gates, deferred, worker] = await Promise.all([
    getQueueStats(),
    getPlatformBreakdown(),
    listOperatorGates(),
    listDeferredJobs(),
    getWorkerStatus(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Current queue state, and anything blocking throughput."
      />

      {/* Operator gates come first: the worker is blocked until they're answered. */}
      {gates.map((gate) => (
        <OperatorGateBanner key={gate.id} gate={gate} />
      ))}

      {worker.state === "stopped" && (
        <Banner
          tone="danger"
          icon={<IconPause size={18} />}
          title="Worker stopped"
          actions={
            <Link
              href="/attention"
              className="text-sm font-medium text-danger-ink hover:underline"
            >
              Review failures
            </Link>
          }
        >
          {worker.stoppedReason ??
            "An auth failure tripped the circuit breaker — the worker stopped rather than draining the queue into failures."}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Queued"
          value={stats.queued}
          tone="info"
          hint="waiting on the worker"
          href="/jobs?status=queued"
        />
        <StatTile
          label="Publishing"
          value={stats.publishing}
          tone="warn"
          hint="serial — one at a time"
          href="/jobs?status=publishing"
        />
        <StatTile
          label="Needs attention"
          value={stats.failed}
          tone="danger"
          hint="visible only here"
          href="/attention"
        />
        <StatTile
          label="Deferred"
          value={stats.deferred}
          tone="accent"
          hint="waiting on VPN"
          href="/jobs?status=deferred"
        />
        <StatTile
          label="Published"
          value={stats.published}
          tone="ok"
          hint="handed to Code Review"
          href="/jobs?status=published"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Queue by platform"
            description="Jobs run serially and are batched by platform."
          />
          <CardBody padded={false}>
            <PlatformBreakdown rows={breakdown} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Deferred jobs"
            description="Blocked by a precondition — not failures, and needing no retry."
          />
          <CardBody padded={false}>
            {deferred.length === 0 ? (
              <EmptyState
                title="Nothing deferred"
                description="No jobs are waiting on the VPN or a Dashlane re-auth."
              />
            ) : (
              <ul className="divide-y divide-line">
                {deferred.map((job) => (
                  <li key={job.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="truncate text-sm font-medium text-ink hover:text-accent"
                      >
                        {job.title}
                      </Link>
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                        {job.dealership.clientCode}
                      </span>
                      <PlatformTag platform={job.platform} />
                    </div>
                    {job.deferredReason && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-muted">
                        <IconAlert size={12} className="mt-0.5 shrink-0" />
                        {job.deferredReason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
