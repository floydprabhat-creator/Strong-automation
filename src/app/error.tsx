"use client";

// Error boundaries must be Client Components.
// In Next.js 16.3 the stable prop is `retry` (it re-fetches and re-renders);
// `reset` only clears error state without re-fetching.

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { IconAlert } from "@/components/ui/icons";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <Banner
        tone="danger"
        icon={<IconAlert size={18} />}
        title="Something went wrong loading this view"
        actions={
          <Button variant="primary" size="sm" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        <p>
          This is a dashboard error, not a publishing failure — no job state was
          changed.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[0.6875rem] text-ink-subtle">
            digest: {error.digest}
          </p>
        )}
      </Banner>
    </div>
  );
}
