# Feature: Podio Integration

> Updated against real screenshots of the **Strong Devs → HTML Page Jobs** app.
> Earlier assumptions in this doc (a generic "Ready" status, `Published` as the
> terminal state) were wrong and have been replaced with the actual workflow.

## The App

- Workspace: **Strong Devs**, app: **HTML Page Jobs** (~15,172 items total).
- Other apps in the workspace that may matter later: Organization, Codebases,
  Documents, Stakeholders, Content Pages, Link Databases.

## Actual Fields on an HTML Page Job

| Field | Type | Notes |
|---|---|---|
| `Title` | text | e.g. "Ford Dent Repair" |
| `Client` | relationship | → Client record (has Client URL, Client Code) |
| `Platform` | dropdown | Dealer.com, (others) — drives adapter selection |
| `Status` | category (required) | see status list below |
| `HOT` | category | priority flag |
| `Job Type` | category | e.g. "Content Page" |
| `Assigned To` | category | Dylan Nesbitt, Kasandra Logan, John Carnagey, **Playwright**, **Rubico** — note these are *category options*, not Podio users |
| `Due By` | date | drives the current-month / next-month selection |
| `Content Page` | relationship | → Content Page record (the actual copy) |
| `Final Page URL` | text | **written back by automation** after publishing |
| `Client URL` | text | e.g. `http://www.berglundfordofbedford.com/` |
| `Client Code` | text | e.g. `BFB` — key identifier for repo/folder resolution |
| `Page Links` | relationship | → Link Database (e.g. "BFB English Link Database") |
| `Image Instructions` | text | often empty |

### Content Page record (linked)
`Geo` (e.g. "Bedford, VA"), `Meta Title`, `Meta Description`, `H1 Title`,
`Content` (rich text with H2s, links, lists). These fields are what identify the
corresponding file in Git — see [02-git-integration.md](02-git-integration.md).

### Status values (full list)
`Ready to Code` · `In Coding` · `Coded` · `Cancelled` · `Hold` · `Archived` ·
`Code Review` · `Ready to Post` · `Waiting on Links` · `Alert`

## Job Selection Rules (confirmed)

A job is eligible for automation when **all** of:

1. `Status` = **`Ready to Post`**
2. `Assigned To` is **empty** OR = **`Rubico`**
   *(explicitly excludes jobs assigned to named humans, and to `Playwright`)*
3. `Platform` is one of the five in scope — Dealer.com, Apollo, Dealer eProcess,
   AutoGo, Fox Dealer ([06](06-platform-adapters.md)). Enforced in the query, so
   jobs on the other 22 dropdown options are never fetched.
4. `Due By` falls in the **current month**
   — **fallback:** if no eligible jobs remain for the current month, move to
   **next month's** jobs.

The existing Podio views mirror this: `In Process → Ready to Post` (47) and
`Next Month` (47). Current volume is ~47 eligible jobs, which at serial execution
([11-runtime-architecture.md](11-runtime-architecture.md)) is a few hours of
runtime — acceptable, but it means the queue should be drainable across restarts.

## Podio Write-Back Lifecycle (confirmed)

The assignee field doubles as a **claim/lock**, so the full lifecycle is:

### Before attempting to publish
- If `Assigned To` is **empty** → set it to **`Rubico`**.
- If it's already `Rubico` → leave it.

This marks the job as taken so a human doesn't start working it mid-publish.

### On success
1. Write the published URL into **`Final Page URL`**
2. Set `Status` → **`Code Review`**
3. Leave `Assigned To` = `Rubico` **as-is**

`Code Review` — not `Published` — is the automation's terminal state. The pipeline
hands off to a human QA step rather than closing the job itself, which contains the
risk of an imperfect publish behind an existing checkpoint.

### On failure
1. **Leave `Status` as `Ready to Post`** — do not change it
2. **Remove `Rubico` from `Assigned To`** (release the claim, back to empty)
3. **Write nothing else to Podio** — no comment, no field, no trace

The failure **summary is local only**, held in Appwrite and surfaced in the
dashboard ([10](10-frontend-dashboard.md)) for the operator's own reference. Podio
stays clean; the human decides from the dashboard what to do next.

**Podio write-back is therefore strictly minimal:** two fields on success
(`Final Page URL`, `Status`), one field on failure (`Assigned To`), and the claim
before starting. Nothing else in Podio is ever mutated by this tool.

### What this means, read as a workflow

A failed job silently returns to the human pool: status still `Ready to Post`,
assignee cleared, no automation footprint. To anyone working the Podio queue it
simply looks like unclaimed work — which is the desired outcome, since a job the
automation couldn't do is a job a human should pick up. Meanwhile the automation
itself must not re-attempt it (see the loop guard below), and the *reason* it
failed lives in the local dashboard.

## ⚠️ Consequence: a failed job becomes immediately eligible again

Because failure resets Podio to `Ready to Post` **with no assignee**, a failed job
is indistinguishable from a fresh one under the selection rules above — the next
poll will pick it straight back up and retry forever.

**Podio therefore cannot be the memory of what already failed. Appwrite must be.**
With no comment and no status change, Podio retains *zero* trace of the attempt, so
the local record is the only thing that knows this job was already tried. The poll
query must exclude any Podio item whose Appwrite job sits in `Failed` — see the
selection guard in [07-publishing-job-engine.md](07-publishing-job-engine.md).
Since retries are operator-initiated only, that single exclusion is sufficient.

The same applies at scale: if the Dashlane session lapses, the worker would walk
the entire queue and fail all ~47 jobs, clearing each assignee — leaving 47 jobs to
review and re-release by hand over one root cause. An `auth`-class failure must
trip a **circuit breaker** that stops the worker rather than draining the queue.

## Integration Approach

- Podio API. **Authentication is the authorization-code flow as the operator**
  (`PODIO_AUTH_MODE=user`), not app auth: app tokens require admin rights on each
  app, and are scoped to a single app — so they cannot read the linked Content
  Page records that [02](02-git-integration.md) matches files on. Run
  `npm run podio:auth` once; the refresh token is then renewed unattended
  ([../env-and-secrets.md](../env-and-secrets.md)). App auth stays supported for
  the day a workspace admin can issue tokens for both apps.
- Poll for eligible items; no webhook assumed.
- Filter server-side by status + due-date range where the API allows, then apply
  the assignee rule, to avoid pulling 15k items.
- Treat Podio as authoritative for job *intent* and for dealership data (Client
  record) — don't duplicate it as a second source of truth in Appwrite.

## Open Questions

- **Under user auth, writes are attributed to the operator's own Podio account.**
  The `Assigned To` field already has a `Rubico` option, which suggests the client
  expects the automation to act as an identity of its own. A dedicated Podio user
  for the automation would fix attribution and remove the dependency on one
  person's guest access — worth raising with the client.
- **What does the `Playwright` assignee option mean?** If it marks jobs already
  handled by an existing automation, the tool must keep excluding it (current
  rule does). Worth confirming it isn't meant to be *this* tool's marker.
- Is `Page Links` (the Link Database) needed at publish time, or only during the
  earlier HTML-generation step? The activity feed shows link paths resolved on
  the job, suggesting it's consumed before `Ready to Post`.

## Acceptance Criteria (MVP)

- [ ] Authenticate to Podio via API
- [ ] Query eligible jobs by the three rules above, including the next-month fallback
- [ ] Map an item to `{ podioItemId, title, clientCode, clientUrl, platform, dueBy, contentPage: { geo, metaTitle, metaDescription, h1Title } }`
- [ ] Write `Final Page URL` and set `Status` = `Code Review`
- [ ] Display eligible jobs in the dashboard ([10](10-frontend-dashboard.md))

## Depends On

None (entry point).

## Feeds Into

[02-git-integration.md](02-git-integration.md) (file lookup keys),
[07-publishing-job-engine.md](07-publishing-job-engine.md)
