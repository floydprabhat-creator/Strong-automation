# Feature: Appwrite Data Layer

## Responsibility

Appwrite replaces SQLite as the persistent application data layer. The app stays
local; Appwrite (self-hosted or remote) holds all durable state: jobs, history,
logs, and reference data. It also lays groundwork for future team access, auth,
permissions, and a shared dashboard.

## Recommended Collections

### `dealerships`
- `name`
- `slug` / identifier used to match Podio + Git + Dashlane records
- `platforms` (which platforms this dealership publishes to)
- metadata as needed (region, brand, etc.)

### `platforms`
Seeded with the five confirmed platforms ([06](06-platform-adapters.md)):
Apollo, Dealer.com, Dealer eProcess, Auto Go, Fox Dealer.
- `name`
- `adapterKey` — maps to a `PlatformAdapter` implementation. **Auto Go and Fox
  Dealer share `wordpress`**; the differences between them live in this record's
  config, not in separate adapter code
- `requiresVpn` (bool) — true for Dealer eProcess; gates job selection until VPN
  connectivity is verified ([11](11-runtime-architecture.md))
- `publishMode` (api / playwright) — applies to publish/update/verify only; **login
  is browser-based on every platform**, since Dashlane autofill is extension-only
  ([04](04-dashlane-credentials.md))
- `loginUrl` (the page Dashlane autofills against)
- config specific to the platform (API base URL, selectors, etc.)

### `git_sources`
- `dealershipId`, `platformId`, `pageType`
- `repoRef` (repo/path/branch)
- `commitHash` used for a given job
- `rawContentSnapshot` or pointer (optional, for audit — consider size limits)

### `publishing_jobs`
- `podioItemId`
- `dealershipId`, `platformId`, `pageType`
- `gitCommitHash`
- `status` (Draft / Ready / Queued / Publishing / Published / Failed / Retry — see [07](07-publishing-job-engine.md))
- `attemptCount`
- `publishedUrl`
- `errorSummary`
- `errorClass` (transient / auth / config / content / verification / unknown — see [07](07-publishing-job-engine.md))
- `leaseOwner`, `leaseExpiresAt` (worker claim — see [11](11-runtime-architecture.md))
- `createdAt`, `updatedAt`

`attemptCount` is a **record of operator-initiated retries**, not a budget — there
are no automatic retries ([07](07-publishing-job-engine.md)). No cooldown or
max-attempt fields are needed: `status = Failed` is itself the exclusion, and only
an explicit dashboard action clears it.

**`podioItemId` must be unique** — it's the identity that survives Podio being
reset to `Ready to Post` on failure. One Podio item = one job record, reused
across retries so `attemptCount` actually accumulates. Index it; a duplicate here
silently resets the retry budget and reopens the loop the guard exists to prevent
(see [07](07-publishing-job-engine.md)).

### `publishing_attempts`
- `jobId` (relation to `publishing_jobs`)
- `attemptNumber`
- `startedAt`, `finishedAt`
- `outcome` (success / failure)
- `errorClass` (diagnostic class — see [07](07-publishing-job-engine.md))
- `errorDetail` (redacted — no credentials)
- `verificationResult`
- `artifacts[]` — failure screenshots and captures ([12](12-failure-diagnostics.md)),
  each as `{ step, localPath, storageFileId?, capturedUrl, type }`. `localPath` is
  always set; `storageFileId` only once the upload succeeds.

### Storage bucket: `job_artifacts`
An Appwrite Storage bucket holding screenshots and (optionally) Playwright traces,
keyed `<jobId>/<attemptNumber>/<step>-<timestamp>.jpg`. Screenshots are subject to
the same redaction rule as logs — see the masking requirements in
[12-failure-diagnostics.md](12-failure-diagnostics.md) before implementing capture.

### `published_pages`
Tracks what already exists on each platform, so re-publishing edits in place
instead of creating duplicates (see "Update vs. Create" in [07](07-publishing-job-engine.md)).
- `dealershipId`, `platformId`, `pageType` (unique together)
- `platformPageId` (the CMS's own identifier for the page)
- `publishedUrl`
- `lastPublishedJobId`, `lastPublishedAt`

Deriving this by querying "most recent successful job" instead would also work,
but a dedicated record is more robust and makes the create-vs-update decision a
single lookup.

### `automation_logs`
- `jobId` / `attemptId`
- `level` (info/warn/error)
- `message`
- `timestamp`

## Design Notes

- A `publishing_job` stores everything needed to reconstruct "what happened" without
  re-querying Podio or Git: Podio item ID, dealership, platform, page type, Git
  commit/hash, source files (or pointer), status, attempt count, published URL,
  error info, timestamps — per the source doc.
- Use Appwrite permissions per collection now, even as a single-user local tool, so
  multi-user access later is a permissions change, not a schema migration.
- Keep `automation_logs` append-only; never mutate past log entries.
- **Appwrite has no multi-document transactions.** Anything requiring atomicity
  (claiming a job, marking published + writing `published_pages`) must be designed
  as an ordered sequence that's safe if interrupted partway — write the durable
  fact first, then the derived one, and make replays idempotent. See the lease
  pattern in [11-runtime-architecture.md](11-runtime-architecture.md).
- **Appwrite is a network dependency.** If it's remote and the connection drops
  mid-publish, the job's state can lag reality on the platform. Recovery relies on
  verification, not on assuming the last written state was correct.

## Acceptance Criteria (MVP)

- [ ] Appwrite project provisioned (self-hosted or cloud), API key generated
- [ ] Collections created with the schema above and appropriate indexes (`status`, `dealershipId`, `podioItemId`)
- [ ] CRUD wrapper module in the Node/TS backend for each collection
- [ ] A job's full lifecycle (create → status transitions → attempts → logs) is queryable from Appwrite alone, without touching Podio/Git

## Depends On

None directly — but schema is shaped by [01](01-podio-integration.md), [02](02-git-integration.md), [07](07-publishing-job-engine.md).

## Feeds Into

Every other feature (central state store).
