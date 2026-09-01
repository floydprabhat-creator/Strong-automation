"use client";

import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCheck } from "@/components/ui/icons";
import { BulkActionBar } from "@/features/attention/components/bulk-action-bar";
import { FailureCard } from "@/features/attention/components/failure-card";
import { dismissJobsAction, retryJobsAction } from "@/features/jobs/actions";
import {
  ErrorClassBadge,
  errorClassGuidance,
} from "@/features/jobs/components/error-class-badge";
import type { FailureGroup } from "@/lib/types/views";

/**
 * The failure review surface — the only place a failure is visible anywhere in
 * the system, since nothing is written to Podio on failure.
 *
 * Grouped by error class so one root cause can be fixed and requeued in a single
 * pass, which is the realistic shape of the work: many jobs, one cause, one fix.
 */
export function FailureQueue({ groups }: { groups: FailureGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(
    () => groups.flatMap((g) => g.rows.map((r) => r.job.id)),
    [groups],
  );

  if (!groups.length) {
    return (
      <EmptyState
        icon={<IconCheck size={28} />}
        title="Nothing needs attention"
        description="No failed jobs. Failures appear here only — they are never written back to Podio."
      />
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const run = (
    action: (ids: string[]) => Promise<{ ok: boolean; message: string }>,
    ids: string[],
  ) => {
    startTransition(async () => {
      const result = await action(ids);
      setMessage(result.message);
      setSelected(new Set());
    });
  };

  return (
    <div className="space-y-6">
      {message && (
        <p
          aria-live="polite"
          className="rounded-md border border-ok/30 bg-ok-soft px-3 py-2 text-sm text-ok-ink"
        >
          {message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {allIds.length} job{allIds.length === 1 ? "" : "s"} awaiting your decision
        </p>
        <button
          type="button"
          onClick={() => setSelected(new Set(allIds))}
          className="text-xs text-accent hover:underline"
        >
          Select all
        </button>
      </div>

      {groups.map((group) => {
        const ids = group.rows.map((r) => r.job.id);
        const allSelected = ids.every((id) => selected.has(id));

        return (
          <section key={group.errorClass} className="space-y-2">
            <header className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
              <ErrorClassBadge errorClass={group.errorClass} />
              <span className="text-sm font-medium text-ink">
                {group.rows.length} job{group.rows.length === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-ink-muted">
                {errorClassGuidance(group.errorClass)}
              </span>
              <button
                type="button"
                onClick={() => toggleGroup(ids)}
                className="ml-auto text-xs text-accent hover:underline"
              >
                {allSelected ? "Deselect group" : "Select group"}
              </button>
            </header>

            <div className="space-y-2">
              {group.rows.map((row) => (
                <FailureCard
                  key={row.job.id}
                  row={row}
                  selected={selected.has(row.job.id)}
                  pending={pending}
                  onToggle={() => toggle(row.job.id)}
                  onRetry={() => run(retryJobsAction, [row.job.id])}
                  onDismiss={() => run(dismissJobsAction, [row.job.id])}
                />
              ))}
            </div>
          </section>
        );
      })}

      <BulkActionBar
        selectedCount={selected.size}
        pending={pending}
        onRetry={() => run(retryJobsAction, [...selected])}
        onDismiss={() => run(dismissJobsAction, [...selected])}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}
