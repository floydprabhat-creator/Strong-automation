"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconSearch } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import type { Dealership, JobStatus, Platform } from "@/lib/types/domain";

/**
 * Filters live in the URL rather than component state, so a filtered view is
 * shareable, survives reload, and works with the back button.
 */

const STATUSES: Array<{ value: JobStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "publishing", label: "Publishing" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
  { value: "deferred", label: "Deferred" },
  { value: "draft", label: "Dismissed / draft" },
];

const selectClasses =
  "h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink";

export function JobFilters({
  platforms,
  dealerships,
}: {
  platforms: Platform[];
  dealerships: Dealership[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);

    startTransition(() => {
      router.replace(`/jobs?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center",
        pending && "opacity-70",
      )}
    >
      <div className="relative flex-1 sm:max-w-xs">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-subtle">
          <IconSearch size={14} />
        </span>
        <input
          type="search"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Search title, client code, Podio ID…"
          aria-label="Search jobs"
          className="h-9 w-full rounded-md border border-line-strong bg-surface pr-2.5 pl-8 text-sm text-ink placeholder:text-ink-subtle"
        />
      </div>

      <select
        aria-label="Filter by status"
        className={selectClasses}
        defaultValue={params.get("status") ?? "all"}
        onChange={(e) => setParam("status", e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by platform"
        className={selectClasses}
        defaultValue={params.get("platform") ?? "all"}
        onChange={(e) => setParam("platform", e.target.value)}
      >
        <option value="all">All platforms</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by dealership"
        className={selectClasses}
        defaultValue={params.get("dealership") ?? "all"}
        onChange={(e) => setParam("dealership", e.target.value)}
      >
        <option value="all">All dealerships</option>
        {dealerships.map((d) => (
          <option key={d.id} value={d.id}>
            {d.clientCode} — {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
