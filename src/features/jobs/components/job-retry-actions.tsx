"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { IconArchive, IconRetry } from "@/components/ui/icons";
import { dismissJobsAction, retryJobsAction } from "@/features/jobs/actions";

/**
 * Retry / dismiss for a single job on the detail page.
 *
 * Retry is the only transition out of `failed` — the engine never requeues on
 * its own (docs/features/07-publishing-job-engine.md).
 */
export function JobRetryActions({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: (ids: string[]) => Promise<{ message: string }>) => {
    startTransition(async () => {
      const result = await action([jobId]);
      setMessage(result.message);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => run(retryJobsAction)}
          disabled={pending}
        >
          <IconRetry size={13} />
          {pending ? "Working…" : "Retry job"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => run(dismissJobsAction)}
          disabled={pending}
        >
          <IconArchive size={13} />
          Dismiss
        </Button>
      </div>
      {message && (
        <p aria-live="polite" className="text-xs text-ok-ink">
          {message}
        </p>
      )}
    </div>
  );
}
