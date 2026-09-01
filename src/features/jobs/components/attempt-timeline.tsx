import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorClassBadge } from "@/features/jobs/components/error-class-badge";
import { ArtifactGallery } from "@/features/jobs/components/artifact-gallery";
import { dateTime, duration } from "@/lib/format/datetime";
import type { Attempt } from "@/lib/types/domain";

const STEP_LABELS: Record<string, string> = {
  select: "Select",
  claim: "Claim in Podio",
  "resolve-source": "Resolve Git source",
  normalize: "Normalize metadata",
  credentials: "Retrieve credentials",
  login: "Log in",
  publish: "Publish",
  verify: "Verify",
  "write-back": "Write back to Podio",
};

/**
 * Attempt history for a job.
 *
 * `attemptCount` is a record of operator-initiated retries, not an automatic
 * budget — so each entry shows whether a human started it.
 */
export function AttemptTimeline({ attempts }: { attempts: Attempt[] }) {
  if (!attempts.length) {
    return (
      <EmptyState
        title="No attempts yet"
        description="This job has not been picked up by the worker."
      />
    );
  }

  return (
    <ol className="divide-y divide-line">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              Attempt {attempt.attemptNumber}
            </span>

            {attempt.outcome === "success" && <Badge tone="ok">Success</Badge>}
            {attempt.outcome === "failure" && <Badge tone="danger">Failure</Badge>}
            {attempt.outcome === "running" && (
              <Badge tone="warn" dot pulse>
                Running
              </Badge>
            )}

            {attempt.errorClass && <ErrorClassBadge errorClass={attempt.errorClass} />}

            {attempt.operatorInitiated ? (
              <Badge tone="accent">Operator retry</Badge>
            ) : (
              <Badge tone="neutral">Automatic pickup</Badge>
            )}

            <span className="ml-auto text-xs whitespace-nowrap text-ink-subtle">
              {dateTime(attempt.startedAt)} · {duration(attempt.startedAt, attempt.finishedAt)}
            </span>
          </div>

          {attempt.failedStep && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Failed at step:{" "}
              <span className="font-medium text-ink">
                {STEP_LABELS[attempt.failedStep] ?? attempt.failedStep}
              </span>
            </p>
          )}

          {attempt.errorDetail && (
            <p className="mt-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-xs leading-relaxed text-ink-muted">
              {attempt.errorDetail}
            </p>
          )}

          {attempt.verificationResult && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Verification: <span className="text-ink">{attempt.verificationResult}</span>
            </p>
          )}

          {attempt.artifacts.length > 0 && (
            <div className="mt-3">
              <ArtifactGallery artifacts={attempt.artifacts} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
