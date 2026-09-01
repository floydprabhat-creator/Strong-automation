# Feature: Dashlane Credentials

## Responsibility

Secure storage and retrieval of login credentials for each dealership + platform
combination, used by platform adapters to authenticate (API or Playwright login).

## Requirements

- Credentials are looked up per `(dealership, platform)` pair at the moment a job
  needs to authenticate — never pre-fetched in bulk or cached to disk in plaintext.
- Credentials live only in memory for the duration of the publish attempt, then are
  discarded.
- Appwrite stores *references* to credentials (e.g. a Dashlane item ID or vault
  path) — never the actual secret values.
- Logs (`automation_logs`, `publishing_attempts`) must never contain raw credential
  values, even on failure. Redact before persisting any error payload.

## Integration Approach — Confirmed: Chrome Extension Only

Access is via the **Dashlane Chrome extension**, not the CLI or Business API. This
is a materially different (and harder) integration than a headless credential
fetch, and it changes how login works across adapters:

- The extension autofills credentials into recognized login form fields when its
  vault is unlocked — it does not expose a scriptable "give me the password for X"
  call. There's no clean out-of-band credential-fetch step to slot into a plain
  API-based adapter.
- **Practical approach:** run Playwright with a **persistent browser context** that
  has the real Dashlane extension installed (`launchPersistentContext` +
  `--load-extension` / a profile dir where the extension is already installed).
  Navigate to the platform's actual login page, trigger the extension's autofill
  (keyboard shortcut or clicking its icon), then either:
  1. Submit the login form directly in that same browser session (this is the
     natural fit for **Playwright-based adapters** — see
     [06-platform-adapters.md](06-platform-adapters.md)), or
  2. If a platform adapter is API-based, read the filled field values out of the
     DOM into memory (e.g. `input.value` via Playwright), then use those values
     for the API call and discard them immediately. Never log or persist the
     extracted value.
- **Vault unlock is solved, not a blocker.** Dashlane's login flow offers a "keep
  session open for 14 days" option. Applied once to the dedicated automation
  Chrome profile, the extension's vault stays unlocked for unattended runs for
  that window — no manual unlock needed per run. This makes headless/unattended
  operation realistic once the pipeline is proven, per the "move to automatic
  publishing" goal in [mvp-roadmap.md](../mvp-roadmap.md).
  - Operationally: this still needs a recurring (roughly every ~2 weeks) manual
    re-auth step on that one profile — treat it like a credential rotation task,
    and have the automation detect a locked/logged-out vault (e.g. autofill
    silently not firing) and fail jobs clearly rather than hanging, so an expired
    session surfaces immediately instead of silently breaking every job.
- Net effect: **this pushes more adapters toward the Playwright path** even where
  a platform has a usable API, because Dashlane itself is the piece that isn't
  API-accessible — but that path is now viable unattended for ~14-day stretches.

## Open Questions to Resolve Before Building

- Who owns re-authenticating the automation profile's Dashlane session every
  ~14 days, and should the dashboard surface a "Dashlane session expires on X"
  warning so it doesn't lapse mid-run unnoticed?
- **How does autofill disambiguate on the shared-portal platforms?** The five
  platforms split in two here ([06](06-platform-adapters.md)):
  - **WordPress (Auto Go, Fox Dealer)** — login is per-dealership
    (`<dealership>.com/wp-admin`), so one domain maps to one credential. Autofill
    is unambiguous. Easy case.
  - **Proprietary CMSes (Apollo, Dealer.com, Dealer eProcess)** — if many
    dealerships log into one shared portal domain, Dashlane will hold *many*
    credentials for that single domain and autofill has no way to know which
    dealership this job is for. Given the client list already spans Berglund Ford,
    Berglund Toyota, Berglund Volvo, Huntsville Toyota, Midpoint Chevrolet, Norris
    Honda and more, this is the common case, not an edge case.

  **This is the sharpest unresolved risk in the credential design**, and it's worth
  testing in the Phase 0.5 Dashlane spike: on a shared portal, can the correct
  entry be selected deterministically (via the extension's entry picker, a naming
  convention, or by reading the specific entry rather than relying on autofill's
  guess)? If autofill can only offer a list for a human to choose from, browser
  login on those three platforms isn't fully automatable as designed, and the
  credential approach needs rethinking before adapters are built.
- What should happen if credentials are missing/expired or autofill doesn't
  trigger — fail the job with a clear "credentials not found" error routed to
  human review, not a silent retry loop.

## Acceptance Criteria (MVP)

- [ ] Given a dealership + platform, retrieve the correct credential set
- [ ] Credential values never appear in Appwrite documents, logs, or console output
- [ ] Missing/invalid credential lookup fails the job cleanly with an actionable error
- [ ] Credentials retrieved fresh per attempt (no persistent local cache)

## Depends On

[01-podio-integration.md](01-podio-integration.md) (dealership/platform identity)

## Feeds Into

[06-platform-adapters.md](06-platform-adapters.md) (`login(credentials)`)
