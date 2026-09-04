/**
 * Data access layer — the ONLY module that knows where data comes from.
 *
 * Two sources today, chosen by `DATA_SOURCE`:
 *  - `fixtures` (default) — the in-memory data in `./fixtures.ts`
 *  - `podio` — live jobs read from Podio via `./podio-source.ts`
 *
 * When Appwrite is provisioned (docs/features/05-appwrite-data-layer.md), it
 * becomes the third and final source, and both of these go away.
 *
 * Every function is async so the swap doesn't change any call site.
 *
 * NOTE: mutations here modify module state, which persists only for the life of
 * the dev server process. That is intentional for UI development — it makes the
 * screens interactive without a backend, and the real implementation will write
 * to Appwrite instead.
 */

import { podioJobDetail, podioSnapshot } from "./podio-source";
import {
  attempts as attemptFixtures,
  dealerships as dealershipFixtures,
  jobs as jobFixtures,
  logs as logFixtures,
  operatorGates as gateFixtures,
  platforms as platformFixtures,
  sourceReviews as sourceReviewFixtures,
  workerStatus as workerStatusFixture,
} from "./fixtures";
import type {
  Attempt,
  Dealership,
  ErrorClass,
  Job,
  OperatorGate,
  Platform,
  WorkerStatus,
} from "@/lib/types/domain";
import type {
  FailureGroup,
  FailureRow,
  JobDetailView,
  JobFilters,
  JobView,
  PlatformBreakdownRow,
  QueueStats,
} from "@/lib/types/views";

/**
 * Live Podio mode. It can serve job lists and counts, but not attempts, logs,
 * failure evidence or any mutation — those live in Appwrite, which doesn't
 * exist yet. Screens needing them render empty rather than fabricating state.
 */
const usePodio = process.env.DATA_SOURCE?.trim() === "podio";

function requiresAppwrite(action: string): never {
  throw new Error(
    `${action} needs the Appwrite job store, which isn't provisioned yet. ` +
      `Unset DATA_SOURCE=podio to use fixtures.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Mutable store                                                              */
/* -------------------------------------------------------------------------- */

const store = {
  jobs: [...jobFixtures],
  attempts: [...attemptFixtures],
  logs: [...logFixtures],
  gates: [...gateFixtures],
  worker: { ...workerStatusFixture } as WorkerStatus,
};

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

const platformById = new Map(platformFixtures.map((p) => [p.id, p]));
const dealershipById = new Map(dealershipFixtures.map((d) => [d.id, d]));

function toView(job: Job): JobView {
  const platform = platformById.get(job.platformId);
  const dealership = dealershipById.get(job.dealershipId);

  // A job referencing a missing platform/dealership is a data integrity problem,
  // not something to paper over with a placeholder — surface it loudly.
  if (!platform) throw new Error(`Job ${job.id} references unknown platform ${job.platformId}`);
  if (!dealership) throw new Error(`Job ${job.id} references unknown dealership ${job.dealershipId}`);

  return { ...job, platform, dealership };
}

/* -------------------------------------------------------------------------- */
/* Reference data                                                             */
/* -------------------------------------------------------------------------- */

export async function listPlatforms(): Promise<Platform[]> {
  if (usePodio) return (await podioSnapshot()).platforms;
  return platformFixtures;
}

export async function listDealerships(): Promise<Dealership[]> {
  if (usePodio) return (await podioSnapshot()).dealerships;
  return dealershipFixtures;
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export async function listJobs(filters: JobFilters = {}): Promise<JobView[]> {
  const { status = "all", platformId = "all", dealershipId = "all", q } = filters;
  const needle = q?.trim().toLowerCase();

  const rows = usePodio ? (await podioSnapshot()).jobs : store.jobs.map(toView);

  return rows
    .filter((job) => (status === "all" ? true : job.status === status))
    .filter((job) => (platformId === "all" ? true : job.platformId === platformId))
    .filter((job) => (dealershipId === "all" ? true : job.dealershipId === dealershipId))
    .filter((job) => {
      if (!needle) return true;
      return (
        job.title.toLowerCase().includes(needle) ||
        job.dealership.name.toLowerCase().includes(needle) ||
        job.dealership.clientCode.toLowerCase().includes(needle) ||
        job.podioItemId.includes(needle)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getJobDetail(id: string): Promise<JobDetailView | null> {
  if (usePodio) {
    // Read the item in full so the attachment name is populated, falling back to
    // the cached list row if the item has gone (deleted, or no longer in scope).
    const job =
      (await podioJobDetail(id)) ?? (await podioSnapshot()).jobs.find((j) => j.id === id);
    // Attempts, logs and the source diff are Appwrite records; there are none yet.
    return job ? { job, attempts: [], logs: [], sourceReview: null } : null;
  }

  const job = store.jobs.find((j) => j.id === id);
  if (!job) return null;

  return {
    job: toView(job),
    attempts: store.attempts
      .filter((a) => a.jobId === id)
      .sort((a, b) => b.attemptNumber - a.attemptNumber),
    logs: store.logs
      .filter((l) => l.jobId === id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    sourceReview: sourceReviewFixtures.find((s) => s.jobId === id) ?? null,
  };
}

function latestAttemptFor(jobId: string): Attempt | null {
  return (
    store.attempts
      .filter((a) => a.jobId === jobId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null
  );
}

/** Failed jobs grouped by error class — one root cause usually spans several. */
export async function listFailureGroups(): Promise<FailureGroup[]> {
  if (usePodio) {
    // Podio keeps no record of why anything failed — an `Alert` item is all we
    // can see, with no attempt behind it (docs/features/01-podio-integration.md).
    const rows: FailureRow[] = (await podioSnapshot()).jobs
      .filter((job) => job.status === "failed")
      .map((job) => ({ job, latestAttempt: null }));
    return rows.length > 0 ? [{ errorClass: "unknown", rows }] : [];
  }

  const rows: FailureRow[] = store.jobs
    .filter((j) => j.status === "failed")
    .map((job) => ({ job: toView(job), latestAttempt: latestAttemptFor(job.id) }));

  const byClass = new Map<ErrorClass, FailureRow[]>();
  for (const row of rows) {
    const key = row.job.errorClass ?? "unknown";
    const bucket = byClass.get(key);
    if (bucket) bucket.push(row);
    else byClass.set(key, [row]);
  }

  // Ordered by operational urgency: auth blocks everything, transient is cheapest.
  const order: ErrorClass[] = ["auth", "config", "content", "verification", "unknown", "transient"];

  return order
    .filter((c) => byClass.has(c))
    .map((errorClass) => ({ errorClass, rows: byClass.get(errorClass)! }));
}

export async function listDeferredJobs(): Promise<JobView[]> {
  if (usePodio) return [];
  return store.jobs.filter((j) => j.status === "deferred").map(toView);
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function getQueueStats(): Promise<QueueStats> {
  const jobs = usePodio ? (await podioSnapshot()).jobs : store.jobs;
  const count = (status: Job["status"]) => jobs.filter((j) => j.status === status).length;

  return {
    queued: count("queued"),
    publishing: count("publishing"),
    published: count("published"),
    failed: count("failed"),
    deferred: count("deferred"),
    total: jobs.length,
  };
}

export async function getPlatformBreakdown(): Promise<PlatformBreakdownRow[]> {
  const snapshot = usePodio ? await podioSnapshot() : null;
  const platforms = snapshot ? snapshot.platforms : platformFixtures;
  const jobs = snapshot ? snapshot.jobs : store.jobs;

  return platforms.map((platform) => {
    const forPlatform = jobs.filter((j) => j.platformId === platform.id);
    return {
      platform,
      queued: forPlatform.filter((j) => j.status === "queued").length,
      failed: forPlatform.filter((j) => j.status === "failed").length,
      published: forPlatform.filter((j) => j.status === "published").length,
      total: forPlatform.length,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Worker & gates                                                             */
/* -------------------------------------------------------------------------- */

export async function getWorkerStatus(): Promise<WorkerStatus> {
  if (usePodio) {
    // There is no worker process yet; saying so beats showing a fixture's idle state.
    return {
      state: "stopped",
      stoppedReason: "Worker not implemented yet — dashboard is reading Podio directly.",
      lastPollAt: null,
      currentJobId: null,
      dashlaneSessionExpiresAt: null,
      vpnConnected: false,
    };
  }
  return store.worker;
}

export async function listOperatorGates(): Promise<OperatorGate[]> {
  if (usePodio) return [];
  return store.gates.filter((g) => !g.verifiedAt);
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

function touch(job: Job) {
  job.updatedAt = new Date().toISOString();
}

/**
 * Return a failed job to the queue. This is the ONLY path from `failed` back to
 * `queued` — the engine never does it on its own.
 */
export async function retryJobs(ids: string[]): Promise<number> {
  if (usePodio) requiresAppwrite("Retrying a job");

  let moved = 0;

  for (const id of ids) {
    const job = store.jobs.find((j) => j.id === id);
    if (!job || job.status !== "failed") continue;

    job.status = "queued";
    job.attemptCount += 1;
    job.errorSummary = null;
    job.errorClass = null;
    job.failedStep = null;
    touch(job);
    moved += 1;
  }

  return moved;
}

/** Permanently exclude jobs from selection — for work a human will finish by hand. */
export async function dismissJobs(ids: string[]): Promise<number> {
  if (usePodio) requiresAppwrite("Dismissing a job");

  let dismissed = 0;

  for (const id of ids) {
    const job = store.jobs.find((j) => j.id === id);
    if (!job || job.status !== "failed") continue;

    job.status = "draft";
    job.errorSummary = "Dismissed by operator — will be completed manually in Podio.";
    touch(job);
    dismissed += 1;
  }

  return dismissed;
}

/**
 * Operator confirms a gate (VPN enabled, Dashlane re-authed).
 *
 * The real implementation must then have the worker INDEPENDENTLY verify the
 * precondition before publishing — a confirmation is a prompt answer, not proof
 * (docs/features/11-runtime-architecture.md).
 */
export async function confirmGate(gateId: string): Promise<void> {
  if (usePodio) requiresAppwrite("Confirming an operator gate");

  const gate = store.gates.find((g) => g.id === gateId);
  if (!gate) return;

  gate.verifiedAt = new Date().toISOString();

  if (gate.kind === "vpn") {
    store.worker.vpnConnected = true;
    // Deferred jobs rejoin the queue; they were never failures.
    for (const job of store.jobs) {
      if (job.status === "deferred") {
        job.status = "queued";
        job.deferredReason = null;
        touch(job);
      }
    }
  }

  const remaining = store.gates.filter((g) => !g.verifiedAt);
  store.worker.state = remaining.length ? "waiting-for-operator" : "running";
}
