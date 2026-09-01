"use client";

import { Button } from "@/components/ui/button";
import { IconArchive, IconRetry } from "@/components/ui/icons";

/**
 * Sticky bar for acting on a multi-select.
 *
 * Bulk retry is a requirement rather than a nicety: one environmental cause (a
 * lapsed Dashlane session) can flag many jobs at once, and re-releasing them one
 * at a time after a single fix is the obvious friction case
 * (docs/features/10-frontend-dashboard.md).
 */
export function BulkActionBar({
  selectedCount,
  pending,
  onRetry,
  onDismiss,
  onClear,
}: {
  selectedCount: number;
  pending: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-line-strong bg-surface px-4 py-2 shadow-pop">
      <span className="text-sm font-medium text-ink tabular">
        {selectedCount} selected
      </span>

      <span className="h-4 w-px bg-line" aria-hidden />

      <Button variant="primary" size="sm" onClick={onRetry} disabled={pending}>
        <IconRetry size={13} />
        {pending ? "Working…" : "Retry"}
      </Button>

      <Button variant="danger" size="sm" onClick={onDismiss} disabled={pending}>
        <IconArchive size={13} />
        Dismiss
      </Button>

      <button
        type="button"
        onClick={onClear}
        className="text-xs text-ink-muted hover:text-ink"
      >
        Clear
      </button>
    </div>
  );
}
