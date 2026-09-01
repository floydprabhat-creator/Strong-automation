/**
 * View models — shapes assembled for the UI, distinct from the raw persistence
 * types in `./domain.ts`. Components consume these so no component has to know
 * how to join a job to its dealership/platform.
 */

import type {
  Attempt,
  Dealership,
  ErrorClass,
  Job,
  JobStatus,
  LogEntry,
  Platform,
  SourceReview,
} from "./domain";

/** A job with its related records resolved — the row shape for every job list. */
export interface JobView extends Job {
  dealership: Dealership;
  platform: Platform;
}

/** Everything the job detail page needs, in one fetch. */
export interface JobDetailView {
  job: JobView;
  attempts: Attempt[];
  logs: LogEntry[];
  sourceReview: SourceReview | null;
}

export interface JobFilters {
  status?: JobStatus | "all";
  platformId?: string | "all";
  dealershipId?: string | "all";
  /** Free-text match against title, client code, and Podio item id. */
  q?: string;
}

/** Counts driving the overview tiles and sidebar badges. */
export interface QueueStats {
  queued: number;
  publishing: number;
  published: number;
  failed: number;
  deferred: number;
  total: number;
}

export interface PlatformBreakdownRow {
  platform: Platform;
  queued: number;
  failed: number;
  published: number;
  total: number;
}

/** A failed job plus the attempt that produced the evidence to review. */
export interface FailureRow {
  job: JobView;
  latestAttempt: Attempt | null;
}

/**
 * Grouping used by the Needs Attention screen. Failures are grouped by cause
 * because one environmental root cause (a lapsed Dashlane session) typically
 * flags many jobs at once, and they should be fixed and requeued together.
 */
export interface FailureGroup {
  errorClass: ErrorClass;
  rows: FailureRow[];
}
