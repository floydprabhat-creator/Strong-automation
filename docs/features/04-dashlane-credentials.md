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

## PROVEN: the mechanics, measured against the live vault

The Phase 0.5 spike (`scripts/dashlane-spike.mts`) ran the full sequence against
Dealer.com's real sign-in and autofilled both fields from a selection made
programmatically on `Client Code`. The steps below are what the adapter must do;
each one was a failure mode found the hard way.

1. **Never let Playwright launch Chrome.** `launchPersistentContext` made Chrome
   treat the Web Store install as unverifiable and **delete the extension** —
   reproduced three times, leaving `Extensions/<id>/` empty and its Secure
   Preferences record stripped to `state=None`. `--load-extension` is no help:
   Chrome 137+ refuses it. Instead spawn Chrome as an ordinary process with
   `--remote-debugging-port` and attach with `chromium.connectOverCDP()`. The
   browser then behaves exactly as it does for a human.
2. **Wait for the vault to be *ready*, not merely loaded** — about 5–6s after
   browser start. Before that the content script stamps its attributes on the
   form but renders no icon, which is indistinguishable from a locked vault.
   Poll `chrome-extension://<id>/popup/index.html` until it renders real content.
3. **Click the in-field icon**, which Dashlane injects as
   `span[data-dashlanecreated]` (there is one per field; pick the one whose box
   sits inside the username field). Do **not** select on `data-dashlane-label` —
   that marks page elements Dashlane has labelled, and clicking one hit the
   site's "Forgot username" link.
4. **Wait ~3–4s for the picker frame**, which loads at
   `chrome-extension://<id>/content/webui/index.html?type=autofill-dropdown`.
   Its entries are ordinary DOM nodes and are readable and clickable.
5. **Match the entry on `Client Code`.** Vault entries are named with it —
   `"seostrongautmotive: GDB - Golling CDJR Bloomfield"`, `"strongautomotive26:
   HST - DDC Login"` — the same code Podio carries on every job. There is no
   search box to drive; a text match is enough.
6. **Zero matches must fail the job as `config`.** With ~17 pages of credentials
   in the vault, a near-miss is a login to the wrong dealership.

Selecting the entry fills both fields, and the value survives Cox's two-step
flow (username → Next → password screen).

## Hard Safety Rails (non-negotiable)

The automation touches live dealership accounts. Two things it must never do,
enforced in code rather than by care:

1. **Never enter an account-recovery or reset flow.** No navigation whose path or
   query matches `forgot|recover|reset|deactivate|cancel-account`. An early
   version of this spike landed on Dealer.com's *"Recover username"* screen by
   clicking an element Dashlane had labelled — a recovery flow can invalidate a
   credential that every other job for that dealership depends on.
2. **Never delete or remove anything, and never sign out.** No click on a control
   whose text or `aria-label` matches
   `forgot|recover|reset|delete|remove|deactivate|sign out|log out`.

Both are implemented as a navigation listener and a `safeClick()` wrapper in
`scripts/dashlane-spike.mts`, and belong in the shared browser layer the adapters
sit on — not in each adapter, where one omission is one wrong click. A violation
aborts the job; it is never a warning to be logged and stepped over.

Also: **the icon is intermittent.** Polling for `[data-dashlanecreated]` and
re-focusing the field between tries took the spike from ~50% to 3/3 successful
runs. When the icon never appears within ~24s, that is an `auth`-class failure
([07](07-publishing-job-engine.md)) — which trips the circuit breaker rather than
draining the queue — not a reason to continue.

## Open Questions to Resolve Before Building

- Who owns re-authenticating the automation profile's Dashlane session every
  ~14 days, and should the dashboard surface a "Dashlane session expires on X"
  warning so it doesn't lapse mid-run unnoticed?
- **RESOLVED for Dealer.com — selection is keyed on `Client Code`.** The operator
  types the client code (e.g. `BFB`), Dashlane filters its dropdown to the
  matching entries, and the right one is selected. That makes credential choice
  **deterministic given data Podio already supplies** — the `client-code` field
  is on every job item ([01](01-podio-integration.md)) — rather than a human
  judgement call. The open question is no longer *which* credential, but the
  mechanical one: can Playwright drive the extension's dropdown (or its popup
  vault) to make that same selection? That is what the Phase 0.5 spike must
  answer.

- **⚠️ New requirement: one credential can cover several dealerships.** Some
  Dealer.com logins map to a single account, others open a portal containing
  multiple dealer accounts. So authentication is not the end of the story — after
  login, the adapter must select the correct dealership *inside* the CMS before
  publishing anything. Getting this wrong publishes a correct page to the wrong
  dealership, which is the silent, worst-case failure this system exists to avoid
  ([02](02-git-integration.md) makes the same argument about file matching).
  `verifyPage` ([08](08-verification.md)) must therefore confirm the published URL
  belongs to the job's `Client URL` domain, not merely that a page went live.

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
