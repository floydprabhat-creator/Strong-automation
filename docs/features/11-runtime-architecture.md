# Feature: Runtime & Process Architecture

> This doc covers a gap the source PDF doesn't address: the PDF describes *what* the
> systems do, but not *where the code runs*. That decision is forced by two facts —
> publishing jobs take minutes, and Dashlane auth requires a real persistent Chrome
> profile — neither of which fits inside a Next.js request handler.

## Process Topology: Two Processes, One Shared State

```
  +---------------------+           +------------------------+
  |  web (Next.js)      |           |  worker (Node/TS)      |
  |  - dashboard UI     |           |  - Podio poll loop     |
  |  - read APIs        |           |  - job claim + run     |
  |  - "Run job" action |           |  - Playwright + Chrome |
  +----------+----------+           +-----------+------------+
             |                                  |
             |          both talk ONLY to       |
             +--------------> Appwrite <--------+
                        (jobs, attempts, logs)
```

- **`web`** — the Next.js app in this repo. Renders the dashboard, reads job state
  from Appwrite, and *enqueues* work (sets a job to `Queued`). It never runs
  Playwright and never performs a publish itself.
- **`worker`** — a standalone long-running Node process. Owns the Podio poll loop,
  claims `Queued` jobs, and runs the full pipeline
  ([09-automation-engine-orchestration.md](09-automation-engine-orchestration.md)).
- **They never call each other directly.** All coordination is through Appwrite
  state. Restarting the UI must never kill an in-flight publish, and vice versa.

### Why not run the engine inside Next.js API routes?

- Publishes take minutes; request handlers are the wrong lifecycle for that.
- Playwright with a persistent Chrome profile + a loaded extension is a
  long-lived, stateful, single-instance resource — not something to spin up per
  HTTP request.
- A poll loop needs a process that outlives any request.

### Suggested repo layout

```
strong-automation/
  src/app/          # Next.js dashboard (UI + read-only APIs)
  src/lib/          # shared: appwrite client, domain types, job status enum
  src/worker/
    index.ts        # worker entrypoint (poll loop + claim loop)
    engine/         # orchestration steps (09)
    adapters/       # platform adapters (06)
    processing/     # metadata normalization (03)
    integrations/   # podio, git, dashlane
```

`src/lib` is imported by both processes so job status values and record shapes
can't drift between UI and worker.

## Hard Constraint: Browser Concurrency Is 1

The Dashlane extension lives in **one** persistent Chrome profile
([04-dashlane-credentials.md](04-dashlane-credentials.md)). Playwright's
`launchPersistentContext` cannot open the same profile twice concurrently.

Therefore:

- **Default job concurrency is 1.** Jobs that need browser-based login run
  strictly serially. This isn't a tuning knob to raise casually — raising it
  requires N separate Chrome profiles, each independently Dashlane-authenticated
  and each needing its own ~14-day re-auth. Plan capacity around serial execution.
- Enforce **a single worker instance** (lockfile / advisory lock at startup, exit
  if another worker holds it). Two workers against one profile will fail in
  confusing ways.
- Non-browser work (Podio polling, Git reads, Appwrite writes) can still overlap
  freely — the serialization constraint applies only to the browser stage.

## Job Claiming and Crash Recovery

Appwrite has no multi-document transactions, so claiming needs a lease pattern:

- A worker claims a job by writing `leaseOwner` (worker id) and `leaseExpiresAt`,
  then re-reading to confirm it won the claim.
- A job sitting in `Publishing` with an **expired lease** means the worker died
  mid-publish.

**Critical:** a crashed mid-publish job must **not** be requeued automatically — the
publish may have already landed on the platform. Recovery runs `verifyPage`
([08-verification.md](08-verification.md)) to establish actual state, then either
marks it `Published` or drops it into `Failed` for operator review. It never
re-publishes on its own; that would be the most likely source of duplicate pages
in the system, and retry decisions belong to the operator
([07](07-publishing-job-engine.md)).

A crash is also the one case where Podio is left mid-claim: status still
`Ready to Post`, assignee still `Rubico`, no failure comment posted (the failure
path never ran). That combination is *still eligible* under the selection rules
([01](01-podio-integration.md)), so the expired-lease check in Appwrite — not
Podio's fields — is what prevents the re-attempt. Reconciling a crashed job should
also finish the Podio write-back the crash skipped, so the item doesn't sit
claimed-but-untouched.

## Environment Precondition: VPN (Dealer eProcess)

Dealer eProcess is only reachable over VPN ([06](06-platform-adapters.md)). VPN is
**machine-wide state**, not per-job, which has consequences:

### Confirmed flow: prompt the operator, then verify

The VPN is enabled **manually by the operator**. The worker must therefore *ask*
and wait, rather than skipping or failing:

1. Worker finishes all non-VPN work first (see ordering below).
2. Worker sees N pending Dealer eProcess jobs and **prompts the operator**:
   *"VPN required for N Dealer eProcess jobs — enable it and confirm."*
   Surfaced in the dashboard ([10](10-frontend-dashboard.md)); a desktop
   notification is worth adding, since a worker waiting silently on a dashboard
   nobody is looking at is indistinguishable from a worker that has stalled.
3. Operator enables the VPN and confirms in the dashboard.
4. **Worker verifies connectivity itself before proceeding** — reach a known host
   behind the tunnel. Never trust the confirmation alone: the operator may confirm
   a second before the tunnel is actually up, and the resulting failure would look
   like a platform bug rather than a timing one.
5. Worker runs the **entire eProcess batch** while the VPN is up.
6. On batch completion, tell the operator the VPN is no longer needed.

- **One prompt per batch, not per job.** N eProcess jobs produce one request for
  human action. Prompting per job would be unusable at ~47-job queue sizes.
- **Do not claim eProcess jobs in Podio until the VPN is verified up.** A job
  claimed and then left waiting hours for a VPN sits assigned to `Rubico`,
  invisible to the humans who might otherwise pick it up ([01](01-podio-integration.md)).
- **Batch by platform.** Since browser concurrency is 1 and jobs run serially,
  process all eProcess jobs in one contiguous run while the VPN is up, rather than
  toggling the connection per job. Interleaving platforms would mean connecting and
  disconnecting repeatedly — slow, and each transition is a chance to fail.
- **A VPN wait must never block unrelated work.** Order the queue so all non-VPN
  platforms (Dealer.com, Apollo, Auto Go, Fox Dealer) are processed first and the
  eProcess batch runs last. Otherwise a single eProcess job early in the queue
  stalls everything behind it until a human happens to be available.
- **Time out rather than wait forever.** If the operator doesn't respond (end of
  day, away from the machine), park the eProcess jobs — **as deferred, not
  failed** — and stop cleanly with nothing left claimed. They're picked up on the
  next run; they were never broken.
- **Watch for collateral effects.** Depending on whether the VPN is full- or
  split-tunnel, bringing it up may reroute or block traffic the worker needs
  (Podio, Appwrite, Git, other platforms' sites). Confirm the worker still reaches
  everything with the VPN up before relying on batching — and if it doesn't, the
  eProcess batch has to be isolated from all other work.
- **A VPN-down condition is not a job failure.** It's an environment state: report
  it as a worker-level condition in the dashboard, the same way a stopped worker or
  a lapsed Dashlane session is surfaced ([10](10-frontend-dashboard.md)).

Automating the connection is a possible later refinement (it would need the VPN
client's own CLI), but manual-with-a-prompt is the confirmed MVP behaviour.

## Generalise It: Operator-Gated Preconditions

The VPN gate is not a one-off. It's the second instance of the same shape:

| Gate | Trigger | Operator action |
|---|---|---|
| VPN | pending Dealer eProcess jobs | enable the VPN, confirm |
| Dashlane session | ~14-day session lapsed ([04](04-dashlane-credentials.md)) | re-auth the automation Chrome profile |

Both are "the worker cannot proceed until a human does something on this machine."
Build **one mechanism** for it rather than special-casing VPN:

- A worker state of `WaitingForOperator(reason, affectedJobCount)`, distinct from
  both "idle" and "failed".
- Jobs stay in `Queued`/deferred — **never** pushed into `Failed`. A precondition
  that isn't met yet is not a job failure, and shouldn't consume the operator's
  failure-review queue ([07](07-publishing-job-engine.md)).
- One dashboard surface that renders any pending gate, with a confirm action.
- Verification after confirmation, always — the gate closes only when the worker
  has independently checked the precondition really holds.

Modelling these as failures instead would be the easy mistake: it would flood the
Needs Attention view with jobs that were never broken, and each would then need a
manual retry to recover from what was really just "the VPN was off."

## Configuration & Secrets

| Secret | Used by | Where it lives |
|---|---|---|
| Appwrite API key | worker (+ server-side web only) | `.env`, never `NEXT_PUBLIC_*` |
| Podio OAuth client + refresh token | worker | `.env` / local token file, gitignored |
| Git access (SSH key or token) | worker | existing local Git config / SSH agent |
| Dealership platform logins | — | **Dashlane only**, never in env or Appwrite |

- Nothing here is committed. Verify `.gitignore` covers `.env*` before the first
  real credential is added.
- The Appwrite API key must never reach the browser bundle — keep all privileged
  Appwrite calls in the worker or in server-side Next.js code.

## Acceptance Criteria (MVP)

- [ ] `worker` runs as a separate process with its own entrypoint and npm script
- [ ] Worker refuses to start if another worker instance is already running
- [ ] Browser-stage work is serialized (concurrency 1)
- [ ] A job claimed by a worker records `leaseOwner` + `leaseExpiresAt`
- [ ] A `Publishing` job with an expired lease is resolved via verification, never by an automatic re-publish
- [ ] No secret is readable from the client-side bundle
- [ ] Non-VPN platforms are processed before the eProcess batch
- [ ] Pending eProcess jobs raise **one** operator prompt for the whole batch, and
      those jobs are not claimed in Podio until VPN connectivity is *verified*
- [ ] An unanswered gate parks jobs as deferred (never `Failed`) and exits cleanly
- [ ] The same gate mechanism serves both VPN and Dashlane re-auth

## Depends On

[05-appwrite-data-layer.md](05-appwrite-data-layer.md) (lease fields on `publishing_jobs`)

## Feeds Into

[07-publishing-job-engine.md](07-publishing-job-engine.md),
[09-automation-engine-orchestration.md](09-automation-engine-orchestration.md),
[10-frontend-dashboard.md](10-frontend-dashboard.md)
