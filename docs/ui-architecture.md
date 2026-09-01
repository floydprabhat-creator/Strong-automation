# UI Architecture

Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript.

## Layering rules

```
src/
  app/          Routes only. Thin: fetch data, compose features. No business logic.
  components/
    ui/         Design-system primitives. Know nothing about the domain.
    layout/     App chrome (shell, nav).
  features/
    <feature>/
      components/   Domain components for that feature
      actions.ts    Server actions for that feature
  lib/
    types/      Domain + view types (shared with the future worker process)
    data/       The ONLY module that knows where data comes from
    format/     Date/text formatting
    utils/      Generic helpers
```

Three rules keep this from rotting:

1. **`components/ui/` never imports from `features/` or `lib/data/`.** A primitive
   that knows what a "job" is stops being reusable.
2. **`app/` holds no logic.** A route fetches from `lib/data`, then renders a
   feature component. If a page grows conditionals, they belong in a feature.
3. **Only `lib/data/repository.ts` touches the data source.** Everything else
   consumes typed view models.

## The data-source swap

`lib/data/repository.ts` currently reads in-memory fixtures. Appwrite does not
exist yet, so building against a repository interface means the UI is complete and
reviewable now, and going live is a **single-module change**:

- Reimplement each exported function against the Appwrite SDK.
- Keep the signatures — every function is already `async`.
- Delete `fixtures.ts`.

No component, page, or type changes. See
[features/05-appwrite-data-layer.md](features/05-appwrite-data-layer.md) for the
target schema, which `lib/types/domain.ts` already mirrors.

> Fixture mutations persist only for the life of the dev server process. That is
> intentional: it makes retry/dismiss/confirm interactive without a backend.

## Server vs. client components

Server by default. `"use client"` appears in exactly five files, each for a
specific reason:

| File | Why it's a client component |
|---|---|
| `layout/sidebar-nav.tsx` | `usePathname` for active-route highlighting |
| `jobs/components/job-filters.tsx` | Writes filter state into the URL |
| `jobs/components/job-retry-actions.tsx` | Calls a server action, shows pending state |
| `attention/components/failure-queue.tsx` | Multi-select state for bulk retry |
| `attention/components/bulk-action-bar.tsx` | Click handlers |
| `worker/components/operator-gate-banner.tsx` | Confirm action + pending state |

Data fetching stays on the server; client components receive serializable props.
Note that components can't cross the boundary as props, which is why `sidebar-nav`
resolves icons from a string key rather than accepting elements.

## Filters live in the URL

`/jobs` reads `status`, `platform`, `dealership`, and `q` from `searchParams`, so a
filtered view is shareable, survives reload, and works with the back button. The
filter bar uses `router.replace` inside a transition rather than local state.

## Next.js 16 specifics worth knowing

These differ from older App Router code and are easy to get wrong:

- **`params` / `searchParams` are Promises** and must be awaited. Synchronous
  access was fully removed in 16.
- **Route prop types are global and generated** — `PageProps<"/jobs/[id]">`,
  `LayoutProps<"/">`. Run `npx next typegen` (or `next dev`/`next build`) after
  adding a route, or type-checking fails with "does not satisfy the constraint".
- **`error.tsx` takes `retry`, not `reset`** (stable in 16.3). `retry` re-fetches
  and re-renders; `reset` only clears error state.
- **`loading.tsx` takes no props.**
- **Turbopack is the default** — no `--turbopack` flag.
- **`next lint` is gone** — lint with `npx eslint src`.
- `cacheComponents` / `use cache` are deliberately **not** enabled. Turning them on
  is not a rename-only change: it removes the `dynamic`/`revalidate` segment
  configs and makes PPR the default, requiring every uncached read to sit behind
  `<Suspense>`. Decide that separately.

## Theming

Tokens are CSS variables on `:root` in `globals.css`, mapped to Tailwind utilities
via `@theme inline` (`bg-surface`, `text-ink-muted`, `border-line`). Dark mode
overrides only the variables under `prefers-color-scheme: dark`, so every utility
follows the theme with no `dark:` variants in components.

Semantic tones (`ok` / `warn` / `danger` / `info` / `accent`) are used consistently
across badges, banners, and tiles — status colour is never hard-coded in a
component.

## Known gap

`notFound()` on `/jobs/[id]` renders the correct not-found UI but responds **200
instead of 404**, because the async shell in the root layout begins streaming
before the page resolves. Cosmetic for an internal tool; fixing it means moving the
shell's data fetch out of the layout.
