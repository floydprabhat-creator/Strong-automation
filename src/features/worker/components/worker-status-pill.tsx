import { Badge, type BadgeTone } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format/datetime";
import type { WorkerStatus } from "@/lib/types/domain";

const STATE_META: Record<
  WorkerStatus["state"],
  { label: string; tone: BadgeTone; pulse: boolean }
> = {
  running: { label: "Worker running", tone: "ok", pulse: true },
  idle: { label: "Worker idle", tone: "neutral", pulse: false },
  stopped: { label: "Worker stopped", tone: "danger", pulse: false },
  "waiting-for-operator": { label: "Waiting for you", tone: "warn", pulse: true },
};

/**
 * Always-visible worker state.
 *
 * This exists because a stopped worker and an empty queue look identical
 * otherwise — and with an auth circuit breaker that deliberately stops the
 * worker, "nothing is happening" needs to be distinguishable from "nothing is
 * wrong" (docs/features/07-publishing-job-engine.md).
 */
export function WorkerStatusPill({ status }: { status: WorkerStatus }) {
  const meta = STATE_META[status.state];

  return (
    <div className="flex items-center gap-3">
      <Badge tone={meta.tone} dot pulse={meta.pulse}>
        {meta.label}
      </Badge>
      {status.lastPollAt && (
        <span className="hidden text-xs text-ink-subtle sm:inline">
          polled {relativeTime(status.lastPollAt)}
        </span>
      )}
    </div>
  );
}
