# Feature: Platform Adapters

## Responsibility

Encapsulate platform-specific publishing logic behind a common interface, so the
automation engine never needs to know *how* WordPress differs from Dealer.com.

## The Five Platforms (confirmed)

| Platform | Kind | Notes |
|---|---|---|
| Apollo | Proprietary CMS | bespoke adapter |
| Dealer.com | Proprietary CMS | bespoke adapter — **build first**, all current eligible jobs |
| Dealer eProcess | Proprietary CMS | bespoke adapter — **requires VPN** ([11](11-runtime-architecture.md)) |
| Auto Go | WordPress (`wp-admin`) | shares the WordPress adapter |
| Fox Dealer | WordPress (`wp-admin`) | shares the WordPress adapter |

### Scope is fixed at these five

The live Podio `Platform` dropdown holds **27 options**, several of them
high-volume — a sample of the 200 most recently edited jobs ran Dealer.com 87,
**Dealer Inspire 35**, **DealerOn 22**, Dealer eProcess 13, Fox Dealer 10,
AutoGo 9, Apollo 3.

Everything outside the five above is **out of scope by decision, not by
omission**. Jobs on other platforms are excluded in the Podio query itself
(`platform` filter in `src/lib/data/podio-source.ts`), so they are never
fetched, rendered, counted, or published to. The single source of truth for the
list is `ADAPTER_BY_PLATFORM` in `src/lib/integrations/podio/map.ts`; widening
scope means adding an entry there *and* building the adapter behind it.

Two details worth knowing when matching the dropdown text: the option reads
**`AutoGo`**, not "Auto Go", and there is a separate generic **`WordPress`**
option that is *not* one of the five.

**This is two families, not five one-offs** — three proprietary CMSes each needing
their own Playwright work, and two WordPress installs that should share one
adapter parameterised by config (base URL, theme/builder quirks, field locations)
rather than being written twice. So: **four adapters for five platforms**, and the
one shared adapter covers 40% of the surface.

## Interface

```
PlatformAdapter
 |
 +-- DealerComAdapter          (proprietary)
 +-- ApolloAdapter             (proprietary)
 +-- DealerEProcessAdapter     (proprietary, VPN-gated)
 +-- WordPressAdapter          (Auto Go, Fox Dealer — config-driven)

login(credentials)
publishPage(page)
updatePage(page)
verifyPage(page)
```

Each method may be implemented via a platform API (preferred) or Playwright browser
automation (when no usable API exists).

**Confirmed workflow shape:** the source-of-truth Git repo is read purely so its file
content can be pasted into the platform's editor — there is no build step, just
"read text, paste text" (see [02-git-integration.md](02-git-integration.md)). And
because [Dashlane credential access is extension-only](04-dashlane-credentials.md),
`login()` will most often run through the same Playwright-driven browser session
regardless of whether the platform itself has a usable API, since that's the only
place the Dashlane extension can autofill from. Treat "API where available" as
applying to `publishPage`/`updatePage`/`verifyPage` more than to `login`.

## Platform Code Mapping

The Git files remain untouched (per [02](02-git-integration.md) and
[03](03-code-processing.md)); each adapter decides where each piece of processed
code belongs on its target platform:

| Platform | HTML | CSS | JS | Confirmed? |
|---|---|---|---|---|
| Dealer.com | ? | ? | ? | **TBD — fill during the first spike** |
| Apollo | ? | ? | ? | TBD |
| Dealer eProcess | ? | ? | ? | TBD |
| Auto Go (WP) | ? | ? | ? | TBD |
| Fox Dealer (WP) | ? | ? | ? | TBD |

Deliberately left blank rather than guessed. Each row is a question to answer by
publishing one page by hand and recording where each piece of code actually goes —
the earlier placeholder rows in this table were invented examples and shouldn't be
treated as real mappings for these platforms.

## WordPress Specifics (Auto Go, Fox Dealer)

Worth resolving early, because the answer decides whether one adapter or two:

- **Is the REST API usable, or is `wp-admin` UI automation required?** The stated
  human workflow is `wp-admin`, but if `/wp-json/` is reachable with the same
  credentials, publishing via REST is far more robust than driving the editor.
- **Is a page builder in play (Elementor, Divi, WPBakery)?** If so, REST is
  probably off the table — builders store content in `postmeta` in their own
  serialized format, not `post_content`, so a REST write produces a page the
  builder can't render. Check this before betting on the API.
- Note that WordPress logins are **per-dealership domains**
  (`<dealership>.com/wp-admin`), which makes Dashlane autofill unambiguous — unlike
  the shared portals of the proprietary CMSes ([04](04-dashlane-credentials.md)).

## Build Order

1. **Dealer.com** — every eligible `Ready to Post` job in the current queue targets
   it ([01](01-podio-integration.md)), so it's where all the value is. This
   supersedes the earlier "pick whichever has the best API" guidance, which would
   have built an adapter nothing is currently waiting on.
2. **WordPress** (Auto Go + Fox Dealer) — best return on effort: one adapter, two
   platforms, and the most conventional automation target of the five.
3. **Apollo** — bespoke, but no environmental complications.
4. **Dealer eProcess last** — the VPN requirement adds a machine-wide precondition
   ([11](11-runtime-architecture.md)) that's better tackled once the pipeline is
   otherwise proven, so a VPN problem is never confused with a pipeline problem.

For Playwright-based adapters: keep selectors isolated in the adapter, and write
`verifyPage` to check actual rendered output (not just "no exception thrown").

## Acceptance Criteria (MVP)

- [ ] `PlatformAdapter` interface defined in TypeScript (`login`, `publishPage`, `updatePage`, `verifyPage`)
- [ ] One concrete adapter implemented and working end-to-end against a real (or staging) target
- [ ] Adapter selection driven by `platforms.adapterKey` from Appwrite, not hardcoded branching
- [ ] Adapter failures produce structured errors (not raw stack traces) for `publishing_attempts.errorDetail`

## Depends On

[03-code-processing.md](03-code-processing.md), [04-dashlane-credentials.md](04-dashlane-credentials.md)

## Feeds Into

[08-verification.md](08-verification.md), [07-publishing-job-engine.md](07-publishing-job-engine.md)
