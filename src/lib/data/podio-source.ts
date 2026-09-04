/**
 * Reads the dashboard's job list straight from Podio.
 *
 * A deliberate stepping stone, not the destination. The architecture has `web`
 * talking only to Appwrite, with the worker owning every integration
 * (docs/features/11-runtime-architecture.md) — but Appwrite isn't provisioned
 * yet, and seeing real jobs on the screen is worth more right now than
 * preserving that boundary in an app with no worker. Selected with
 * `DATA_SOURCE=podio`; the fixtures remain the default.
 *
 * What this can't show, by construction: attempts, logs, failure evidence,
 * leases, retries. Those exist only in Appwrite. The screens that need them
 * render empty in this mode rather than inventing data.
 */

import {
  categoryOptionIds,
  filterItems,
  getItem,
  type PodioItem,
} from "@/lib/integrations/podio/client";
import {
  SUPPORTED_PLATFORM_NAMES,
  isAutomationOwned,
  isClaimable,
  isSupportedPlatform,
  projectStatus,
  text,
  toDealership,
  toJob,
  toPlatform,
} from "@/lib/integrations/podio/map";
import type { Dealership, Platform } from "@/lib/types/domain";
import type { JobView } from "@/lib/types/views";

/** Podio statuses worth surfacing, in the order they matter operationally. */
const SURFACED_STATUSES = ["Ready to Post", "Alert", "Code Review"] as const;

/** Cap per status — the app holds ~15k items, nearly all historical. */
const PER_STATUS_LIMIT = 100;

/**
 * Server-render fan-out means several components ask for the same data within
 * one request. A short TTL keeps that to one round trip without going stale
 * enough to mislead an operator watching a queue drain.
 */
const CACHE_TTL_MS = 30_000;

interface Snapshot {
  jobs: JobView[];
  platforms: Platform[];
  dealerships: Dealership[];
  fetchedAt: number;
}

let cached: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

export async function podioSnapshot(): Promise<Snapshot> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  // Collapse concurrent callers onto one fetch rather than stampeding Podio.
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function load(): Promise<Snapshot> {
  const appId = process.env.PODIO_APP_ID?.trim();
  if (!appId) throw new Error("PODIO_APP_ID is not set.");

  const statusIds = await categoryOptionIds(appId, "status");
  const platformIds = await categoryOptionIds(appId, "platform");

  // Scope is enforced in the query, not just the render: jobs on the other 22
  // platform options are never fetched (docs/features/06-platform-adapters.md).
  const inScopePlatformIds = SUPPORTED_PLATFORM_NAMES.map((name) => platformIds.get(name)).filter(
    (id): id is number => id !== undefined,
  );
  if (inScopePlatformIds.length === 0) {
    throw new Error(
      "None of the supported platform names matched the Podio dropdown — the option text may have changed.",
    );
  }

  const batches = await Promise.all(
    SURFACED_STATUSES.map(async (label) => {
      const optionId = statusIds.get(label);
      if (optionId === undefined) return [];
      const result = await filterItems(appId, {
        limit: PER_STATUS_LIMIT,
        sort_by: "last_edit_on",
        sort_desc: true,
        filters: { status: [optionId], platform: inScopePlatformIds },
      });
      return result.items ?? [];
    }),
  );

  const jobs: JobView[] = [];
  const platforms = new Map<string, Platform>();
  const dealerships = new Map<string, Dealership>();

  for (const item of batches.flat()) {
    const view = toJobView(item);
    if (!view) continue;
    jobs.push(view);
    platforms.set(view.platform.id, view.platform);
    dealerships.set(view.dealership.id, view.dealership);
  }

  cached = {
    jobs: jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    platforms: [...platforms.values()].sort((a, b) => a.name.localeCompare(b.name)),
    dealerships: [...dealerships.values()].sort((a, b) => a.name.localeCompare(b.name)),
    fetchedAt: Date.now(),
  };
  return cached;
}

function toJobView(item: PodioItem): JobView | null {
  const status = projectStatus(text(item, "status"));
  if (!status) return null;

  // Belt and braces: the query already excludes these, but a job whose platform
  // we don't support must never render, be counted, or become publishable.
  const platformName = text(item, "platform");
  if (!isSupportedPlatform(platformName)) return null;

  // A `Ready to Post` item assigned to a human is somebody else's work, and a
  // `Code Review` item is only ours if the automation's claim is still on it
  // (docs/features/01-podio-integration.md).
  if (status === "ready" && !isClaimable(item)) return null;
  if (status === "published" && !isAutomationOwned(item)) return null;

  return {
    ...toJob(item, status),
    platform: toPlatform(platformName!),
    dealership: toDealership(item),
  };
}

/**
 * One job, read in full.
 *
 * Podio's filter endpoint omits `files`, so the attached Kiosk HTML — the
 * artifact that actually gets published (docs/features/02-git-integration.md) —
 * is invisible in list results. The detail page is the one place worth spending
 * an extra round trip to show it, rather than fetching 100 full items for a table.
 */
export async function podioJobDetail(jobId: string): Promise<JobView | null> {
  const itemId = jobId.replace(/^podio_/, "");
  if (!/^\d+$/.test(itemId)) return null;

  return toJobView(await getItem(itemId));
}
