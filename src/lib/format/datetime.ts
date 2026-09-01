/**
 * Date/time formatting.
 *
 * All helpers accept ISO strings because that is what Appwrite returns, and are
 * deterministic given a `now` argument so they can be unit-tested and rendered
 * on the server without hydration drift.
 */

const RELATIVE_UNITS: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60_000, divisor: 1_000, unit: "second" },
  { limit: 3_600_000, divisor: 60_000, unit: "minute" },
  { limit: 86_400_000, divisor: 3_600_000, unit: "hour" },
  { limit: 604_800_000, divisor: 86_400_000, unit: "day" },
  { limit: 2_629_800_000, divisor: 604_800_000, unit: "week" },
  { limit: 31_557_600_000, divisor: 2_629_800_000, unit: "month" },
  { limit: Infinity, divisor: 31_557_600_000, unit: "year" },
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** e.g. "2 days ago", "in 3 hours" */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diff = then - now.getTime();
  const abs = Math.abs(diff);

  for (const { limit, divisor, unit } of RELATIVE_UNITS) {
    if (abs < limit) {
      return relativeFormatter.format(Math.round(diff / divisor), unit);
    }
  }
  return "—";
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

/** e.g. "Aug 31, 2:04 PM" */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFormatter.format(d);
}

/** e.g. "Sep 20, 2026" */
export function dateOnly(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

/** e.g. "2:04:31 PM" — for log lines */
export function timeOnly(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : timeFormatter.format(d);
}

/** Human duration between two ISO timestamps, e.g. "1m 42s". */
export function duration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";

  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Month label used by the current-month / next-month selection rule. */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}
