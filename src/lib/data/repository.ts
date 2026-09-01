/**
 * Data access layer — the ONLY module that knows where data comes from.
 *
 * Today it reads the in-memory fixtures in `./fixtures.ts`. When Appwrite is
 * provisioned (docs/features/05-appwrite-data-layer.md), reimplement these
 * functions against the Appwrite SDK and nothing else in the app changes.
 *
 * Every function is async so the swap doesn't change any call site.
 *
 * NOTE: mutations here modify module state, which persists only for the life of
 * the dev server process. That is intentional for UI development — it makes the
 * screens interactive without a backend, and the real implementation will write
 * to Appwrite instead.
 */

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
  return platformFixtures;
}

export async function listDealerships(): Promise<Dealership[]> {
  return dealershipFixtures;
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export async function listJobs(filters: JobFilters = {}): Promise<JobView[]> {
  const { status = "all", platformId = "all", dealershipId = "all", q } = filters;
  const needle = q?.trim().toLowerCase();

  return store.jobs
    .filter((job) => (status === "all" ? true : job.status === status))
    .filter((job) => (platformId === "all" ? true : job.platformId === platformId))
    .filter((job) => (dealershipId === "all" ? true : job.dealershipId === dealershipId))
    .map(toView)
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
  return store.jobs.filter((j) => j.status === "deferred").map(toView);
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function getQueueStats(): Promise<QueueStats> {
  const count = (status: Job["status"]) => store.jobs.filter((j) => j.status === status).length;

  return {
    queued: count("queued"),
    publishing: count("publishing"),
    published: count("published"),
    failed: count("failed"),
    deferred: count("deferred"),
    total: store.jobs.length,
  };
}

export async function getPlatformBreakdown(): Promise<PlatformBreakdownRow[]> {
  return platformFixtures.map((platform) => {
    const forPlatform = store.jobs.filter((j) => j.platformId === platform.id);
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
  return store.worker;
}

export async function listOperatorGates(): Promise<OperatorGate[]> {
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
