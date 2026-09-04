/**
 * Maps raw Podio items onto the domain types the dashboard renders.
 *
 * IMPORTANT — this is a *projection*, not engine state. Appwrite is the system
 * of record for job status, attempts, leases and failures
 * (docs/features/05-appwrite-data-layer.md); Podio knows only its own workflow
 * status. So `status` here is derived from the Podio category, and fields the
 * engine owns (`attemptCount`, `leaseOwner`, `errorClass`, …) read as empty
 * until the worker exists. Nothing in this file should ever be treated as proof
 * that a publish was attempted.
 *
 * Field external IDs below were read off the live app, not guessed
 * (docs/features/01-podio-integration.md).
 */

import type {
  AdapterKey,
  Dealership,
  Job,
  JobStatus,
  Platform,
} from "@/lib/types/domain";
import type { PodioItem } from "./client";

/* -------------------------------------------------------------------------- */
/* Field access                                                               */
/* -------------------------------------------------------------------------- */

type FieldId =
  | "title"
  | "platform"
  | "status"
  | "assigned-to"
  | "due-by"
  | "final-page-url"
  | "client-url"
  | "client-code"
  | "client"
  | "page-type"
  | "geo"
  | "meta-title"
  | "meta-description"
  | "h1-title"
  | "slug";

function field(item: PodioItem, id: FieldId) {
  return item.fields?.find((f) => f.external_id === id)?.values?.[0];
}

/** Text-ish fields: plain text, and the `{ text }` shape category/app fields use. */
export function text(item: PodioItem, id: FieldId): string | null {
  const value = field(item, id)?.value;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { text?: string; title?: string; name?: string };
    return record.text ?? record.title ?? record.name ?? null;
  }
  return null;
}

export function date(item: PodioItem, id: FieldId): string | null {
  const value = field(item, id);
  return value?.start ?? null;
}

/* -------------------------------------------------------------------------- */
/* Platforms                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * THE scope boundary: the five platforms this tool works with, keyed by the
 * exact text of the Podio `Platform` dropdown option.
 *
 * The dropdown holds 27 options. Everything absent from this map is out of
 * scope by decision, not by omission — jobs on those platforms are filtered out
 * of the Podio query itself (`src/lib/data/podio-source.ts`), so they are never
 * fetched, displayed, counted, or published to. Widening scope means adding a
 * line here *and* building the adapter behind it
 * (docs/features/06-platform-adapters.md).
 *
 * Note the option text is `AutoGo`, not `Auto Go`, and the dropdown's separate
 * generic `WordPress` option is NOT one of the five.
 */
const ADAPTER_BY_PLATFORM: Record<string, AdapterKey> = {
  "Dealer.com": "dealercom",
  Apollo: "apollo",
  "Dealer eProcess": "eprocess",
  AutoGo: "wordpress",
  "Fox Dealer": "wordpress",
};

/** Podio option texts for the five in-scope platforms. */
export const SUPPORTED_PLATFORM_NAMES = Object.keys(ADAPTER_BY_PLATFORM);

export function isSupportedPlatform(name: string | null): boolean {
  return name !== null && name in ADAPTER_BY_PLATFORM;
}

/** Dealerships share one login domain here, so Dashlane autofill is ambiguous. */
const SHARED_PORTAL: AdapterKey[] = ["dealercom", "apollo", "eprocess"];

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toPlatform(name: string): Platform {
  const adapterKey = ADAPTER_BY_PLATFORM[name];
  // Reaching here with an out-of-scope platform means the query filter failed
  // open — louder is better than quietly publishing somewhere we don't support.
  if (!adapterKey) {
    throw new Error(`Platform "${name}" is out of scope; it should have been filtered out.`);
  }

  return {
    id: `plat_${slug(name)}`,
    name,
    adapterKey,
    publishMode: "playwright",
    // Real login URLs live in Appwrite's `platforms` records once provisioned.
    loginUrl: "",
    requiresVpn: adapterKey === "eprocess",
    sharedLoginPortal: SHARED_PORTAL.includes(adapterKey),
    codeMapping: { html: null, css: null, js: null },
  };
}

export function toDealership(item: PodioItem): Dealership {
  const clientCode = text(item, "client-code") ?? "UNKNOWN";
  const name = text(item, "client") ?? clientCode;
  return {
    id: `deal_${slug(clientCode)}`,
    name,
    clientCode,
    clientUrl: text(item, "client-url") ?? "",
    platformIds: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Podio workflow status → the status the dashboard shows.
 *
 * `Code Review` maps to `published` because that is the automation's terminal
 * state: the pipeline publishes, writes `Final Page URL`, and hands off to human
 * QA (docs/features/01-podio-integration.md). Statuses that belong to the
 * upstream coding workflow map to `null` and are not surfaced as jobs at all.
 */
const STATUS_PROJECTION: Record<string, JobStatus | null> = {
  "Ready to Post": "ready",
  "Code Review": "published",
  Alert: "failed",
};

export function projectStatus(podioStatus: string | null): JobStatus | null {
  return podioStatus ? (STATUS_PROJECTION[podioStatus] ?? null) : null;
}

export const AUTOMATION_ASSIGNEE = "Rubico";

/**
 * True when the assignee rule in 01-podio-integration.md admits this item:
 * unassigned (free to claim) or already claimed by the automation.
 */
export function isClaimable(item: PodioItem): boolean {
  const assignee = text(item, "assigned-to");
  return assignee === null || assignee === AUTOMATION_ASSIGNEE;
}

/** Jobs the automation itself holds — its own handed-off work, not a human's. */
export function isAutomationOwned(item: PodioItem): boolean {
  return text(item, "assigned-to") === AUTOMATION_ASSIGNEE;
}

export function toJob(item: PodioItem, status: JobStatus): Job {
  const attachment = item.files?.[0] ?? null;

  return {
    id: `podio_${item.item_id}`,
    podioItemId: String(item.item_id),
    title: item.title,
    dealershipId: toDealership(item).id,
    // Derived, not resolved: callers filter out unsupported platforms before
    // this point, and `toPlatform` would throw on one.
    platformId: `plat_${slug(text(item, "platform") ?? "unknown")}`,
    pageType: text(item, "page-type") ?? "—",
    dueBy: date(item, "due-by") ?? item.created_on,
    podioAssignee: text(item, "assigned-to"),
    status,
    // Git is not the source when the Kiosk HTML is attached to the item, so
    // there is no commit to pin — the file ID is the audit record instead.
    gitCommitHash: null,
    sourceFile: attachment?.name ?? null,
    attemptCount: 0,
    publishedUrl: text(item, "final-page-url"),
    errorSummary: null,
    errorClass: null,
    failedStep: null,
    deferredReason: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: item.created_on,
    updatedAt: item.last_event_on ?? item.created_on,
  };
}
