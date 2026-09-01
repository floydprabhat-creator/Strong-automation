import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types/domain";

const META: Record<
  JobStatus,
  { label: string; tone: BadgeTone; pulse?: boolean; title?: string }
> = {
  draft: { label: "Draft", tone: "neutral" },
  ready: { label: "Ready", tone: "neutral" },
  queued: { label: "Queued", tone: "info" },
  publishing: { label: "Publishing", tone: "warn", pulse: true },
  published: {
    label: "Published",
    tone: "ok",
    // The engine's terminal state is not the business's. Podio moves to
    // "Code Review" and a human still QAs the page — don't let the badge
    // imply the work is closed.
    title: "Published and handed to Code Review in Podio — awaiting human QA",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    title: "Terminal until you retry — the engine never retries on its own",
  },
  deferred: {
    label: "Deferred",
    tone: "accent",
    title: "Waiting on a precondition (VPN or Dashlane) — not a failure",
  },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = META[status];
  return (
    <span title={meta.title}>
      <Badge tone={meta.tone} dot pulse={meta.pulse}>
        {meta.label}
      </Badge>
    </span>
  );
}
