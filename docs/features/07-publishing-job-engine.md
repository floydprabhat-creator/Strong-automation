# Feature: Publishing Job Engine & State Management

## Responsibility

Represent each publish as a **job** with explicit state, not a one-shot script —
this is what makes retries, logging, visibility, and safe failure handling possible.

## State Machine

```
Draft
 |
 v
Ready
 |
 v
Queued <-------------------+
 |                         |
 v                         | operator presses
Publishing                 | "Retry" in dashboard
 |                         | (the ONLY way back)
 +-----------> Published    |
 |                         |
 +-----------> Failed ------+
               (terminal until a human acts)
```

**There are no automatic retries.** A failure is terminal: the engine reports it
and stops touching that job. The operator reviews it in the dashboard and decides,
per job, whether it goes back in the queue. Nothing re-enters `Queued` on its own —
no backoff, no attempt budget, no self-healing.

### Mapping to Podio's real statuses

The internal states above are the *engine's* states; Podio has its own
([01-podio-integration.md](01-podio-integration.md)). They are not the same set,
and the engine should not try to mirror Podio one-to-one:

| Engine state | Podio status | Podio `Assigned To` |
|---|---|---|
| Queued → Publishing | `Ready to Post` (unchanged) | claimed as `Rubico` |
| **Published** | → **`Code Review`** + `Final Page URL` written | left as `Rubico` |
| Failed | **`Ready to Post` (unchanged)** | **`Rubico` removed** (nothing else written to Podio) |

**The engine's `Published` does not mean "done" to the business** — it means
"published and handed to human QA." Keep the internal name, but don't surface it
in the dashboard as if the job is closed; a human still reviews it in Podio.

- **Draft** — job exists conceptually but source/platform not yet confirmed.
- **Ready** — mirrors Podio's `Ready to Post` status; all inputs resolved
  (dealership, platform, Git file located).
- **Queued** — accepted by the engine, waiting for a worker slot.
- **Publishing** — actively running an adapter's publish flow.
- **Published** — verified success (see [08-verification.md](08-verification.md)).
- **Failed** — **terminal.** Excluded from selection, awaiting operator review. Only
  an explicit "Retry" action in the dashboard ([10](10-frontend-dashboard.md)) moves
  it back to `Queued`.

## Design Notes

- Job state and full history live in Appwrite (`publishing_jobs` +
  `publishing_attempts`), so the local app can crash/restart and resume without
  losing track of in-flight work.
- Each transition should be logged to `automation_logs` with enough context to
  reconstruct "why" later.
- Retry policy: **none automatic.** Every failure lands in `Failed` and waits.
  `attemptCount` is kept as a *record* of how many times the operator has retried,
  not as a budget the engine spends on its own.
- **Queue ordering matters.** Process non-VPN platforms first and run the Dealer
  eProcess batch last, so a job waiting on an operator to enable the VPN never
  stalls unrelated work behind it ([11](11-runtime-architecture.md)).
- **Deferred ≠ Failed.** A job parked waiting on an operator gate (VPN off,
  Dashlane re-auth needed) is not a failure: it keeps its queue position, needs no
  retry decision, and stays out of the Needs Attention view.
- Concurrency is effectively **1** for the browser stage, because the Dashlane
  extension lives in a single persistent Chrome profile — see
  [11-runtime-architecture.md](11-runtime-architecture.md). Don't design the queue
  around parallel publishing.

## Error Taxonomy — For Diagnosis, Not Retry Logic

With retries fully manual, the class no longer decides what the engine does — it
decides **what the operator needs to fix**, and it's the single most useful thing
on the failure screen. Store it on the attempt (`publishing_attempts.errorClass`):

| Class | Examples | What it tells the operator |
|---|---|---|
| `transient` | network timeout, CMS 5xx, Playwright timeout on a slow page | Nothing to fix — a plain retry will probably work |
| `auth` | Dashlane vault locked/expired, autofill didn't fire, platform rejected login | Re-auth Dashlane before retrying anything ([04](04-dashlane-credentials.md)). Retrying blind can lock the dealership's account |
| `config` | dealership/platform mapping missing, Git file unresolvable/ambiguous | Fix the data first; retrying unchanged will fail identically |
| `content` | metadata block malformed, source file empty | Fix the source page, then retry |
| `verification` | publish reported success but page didn't match | **Check the live page before retrying** — the publish may have partly landed, so a retry could duplicate work |
| `unknown` | unclassified exception | Read the log; likely a gap in the adapter |

`transient` is the only class where an unexamined retry is reasonable. Everything
else is telling you a retry is premature — which is exactly why the decision sits
with you rather than the engine.

Every failure also captures a screenshot and page state
([12-failure-diagnostics.md](12-failure-diagnostics.md)), so the class and the
image together are usually enough to decide on a retry without re-running the job.

## Selection Guard

Failure restores Podio to `Ready to Post` with no assignee
([01](01-podio-integration.md)), so a just-failed job looks **fully eligible again
on the very next poll**. Podio holds no memory of the attempt, so Appwrite must:

- **Key jobs by `podioItemId`**, so a re-selected Podio item resolves to its
  existing job record rather than spawning a duplicate.
- **Exclude any job in `Failed` from selection**, unconditionally, until the
  operator retries or dismisses it in the dashboard. Podio will keep looking
  eligible; Appwrite is the authority that says otherwise.

That's the whole guard — no cooldown timers or attempt budgets needed, because a
failed job simply never re-enters the queue by itself.

### Circuit breaker on `auth` — now more important, not less

Without auto-retry there's no infinite loop, but there *is* a worse version of the
same problem: if the Dashlane session has lapsed, the worker would walk the entire
eligible queue, failing all ~47 jobs one by one and clearing each assignee — leaving
you to review and re-release 47 jobs by hand for a single root cause.

So on the **first `auth` failure, stop the worker** and surface it prominently. One
job flagged and a stopped worker is a two-minute fix; 47 flagged jobs is an
afternoon. The same reasoning applies to any failure class that repeats across
consecutive jobs — a run of identical failures means the queue is being poisoned by
something environmental, and stopping beats continuing.

## Update vs. Create

`publishPage` and `updatePage` are distinct adapter methods
([06](06-platform-adapters.md)), so the engine must know which applies. Decide by
whether a prior successful job for the same `(dealership, platform, pageType)`
recorded a `platformPageId`/`publishedUrl`:

- No prior record → `publishPage` (create), then store the resulting identifier.
- Prior record exists → `updatePage` (edit in place).

Without this, re-publishing an existing page silently creates duplicates on the
platform.

## Acceptance Criteria (MVP)

- [ ] Job creation from an eligible Podio item produces a `publishing_jobs` record in `Queued`
- [ ] State transitions are enforced (no illegal jumps, e.g. Draft → Published)
- [ ] Each attempt is recorded in `publishing_attempts` with outcome, timestamps, and `errorClass`
- [ ] **A `Failed` job never re-enters the queue without an explicit operator action**
- [ ] An `auth` failure stops the worker instead of continuing through the queue
- [ ] Dashboard can show current state and history for any job

## Depends On

[01-podio-integration.md](01-podio-integration.md), [05-appwrite-data-layer.md](05-appwrite-data-layer.md)

## Feeds Into

[09-automation-engine-orchestration.md](09-automation-engine-orchestration.md), [10-frontend-dashboard.md](10-frontend-dashboard.md)
