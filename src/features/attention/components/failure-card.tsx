import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconArchive, IconRetry } from "@/components/ui/icons";
import { ArtifactGallery } from "@/features/jobs/components/artifact-gallery";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { PodioLink } from "@/features/jobs/components/podio-link";
import { relativeTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils/cn";
import type { FailureRow } from "@/lib/types/views";

const STEP_LABELS: Record<string, string> = {
  select: "selection",
  claim: "claiming in Podio",
  "resolve-source": "resolving the Git source",
  normalize: "metadata normalization",
  credentials: "credential retrieval",
  login: "login",
  publish: "publishing",
  verify: "verification",
  "write-back": "Podio write-back",
};

/**
 * One failed job, with everything needed to decide on a retry without re-running
 * it: the summary, the failing step, the evidence, and a link to the Podio item.
 */
export function FailureCard({
  row,
  selected,
  pending,
  onToggle,
  onRetry,
  onDismiss,
}: {
  row: FailureRow;
  selected: boolean;
  pending: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { job, latestAttempt } = row;

  return (
    <article
      className={cn(
        "rounded-lg border bg-surface p-4 transition-colors",
        selected ? "border-accent bg-accent-soft/30" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${job.title}`}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${job.id}`}
              className="truncate text-sm font-semibold text-ink hover:text-accent"
            >
              {job.title}
            </Link>
            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
              {job.dealership.clientCode}
            </span>
            <PlatformTag platform={job.platform} />
            {job.attemptCount > 0 && (
              <Badge tone="neutral">
                {job.attemptCount} retr{job.attemptCount === 1 ? "y" : "ies"}
              </Badge>
            )}
            <span className="ml-auto text-xs whitespace-nowrap text-ink-subtle">
              failed {relativeTime(job.updatedAt)}
            </span>
          </div>

          {job.failedStep && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Failed during{" "}
              <span className="font-medium text-ink">
                {STEP_LABELS[job.failedStep] ?? job.failedStep}
              </span>
            </p>
          )}

          {job.errorSummary && (
            <p className="mt-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink">
              {job.errorSummary}
            </p>
          )}

          {latestAttempt?.artifacts.length ? (
            <div className="mt-3">
              <ArtifactGallery artifacts={latestAttempt.artifacts} />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRetry} disabled={pending}>
              <IconRetry size={13} />
              Retry
            </Button>
            <Button variant="danger" size="sm" onClick={onDismiss} disabled={pending}>
              <IconArchive size={13} />
              Dismiss
            </Button>
            <Link
              href={`/jobs/${job.id}`}
              className="text-xs text-ink-muted hover:text-ink hover:underline"
            >
              Full history
            </Link>
            <PodioLink podioItemId={job.podioItemId} className="ml-auto text-xs" />
          </div>
        </div>
      </div>
    </article>
  );
}
