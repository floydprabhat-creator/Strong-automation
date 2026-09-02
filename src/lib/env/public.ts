/**
 * Values the browser bundle is allowed to contain.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time, and only where the code reads
 * `process.env.NEXT_PUBLIC_X` as a literal member expression — a dynamic lookup
 * (`process.env[name]`) is left untouched and reads as `undefined` in the
 * browser. So these are written out longhand here rather than going through
 * `./read.ts`.
 *
 * Everything in this file ships to every visitor. Nothing secret belongs here,
 * now or later.
 */

/** Base for deep links back to a Podio item (docs/features/01-podio-integration.md). */
export const PODIO_ITEM_URL_BASE =
  process.env.NEXT_PUBLIC_PODIO_ITEM_URL_BASE ??
  "https://podio.com/strongdevs/html-page-jobs/apps/html-page-jobs/items";

export function podioItemUrl(podioItemId: string): string {
  return `${PODIO_ITEM_URL_BASE.replace(/\/$/, "")}/${podioItemId}`;
}
