# Feature: Frontend Dashboard

## Responsibility

Local React/Next.js UI (this repo, `strong-automation`) for reviewing, triggering,
and monitoring publishing jobs — the human-facing control surface over the
automation engine.

## Screens (MVP)

1. **Job list** — pulled from Appwrite `publishing_jobs`: dealership, platform,
   status, attempt count, last updated. Filterable by status.
2. **Job detail** — full job record, attempt history (`publishing_attempts`), logs
   (`automation_logs`), and a diff/preview of original vs. processed source (see
   [03-code-processing.md](03-code-processing.md)) for manual review before publish.
3. **Manual trigger** — "Fetch Ready items from Podio" and "Run job" actions,
   consistent with the source doc's guidance to keep a manual approval step until
   the pipeline is proven (§12, item 9).
4. **Platform/dealership config** — read view (and later edit view) over the
   `dealerships`/`platforms` Appwrite collections.

5. **Needs Attention** — *the most important screen in the app.* Because failures
   write nothing to Podio ([01](01-podio-integration.md)), this is the **only**
   place a failure is visible anywhere in the system. It must show, per failed job:
   - the failure **summary** and `errorClass` ([07](07-publishing-job-engine.md)),
     which is what tells the operator whether a retry is even worth attempting yet
   - which pipeline step failed, and the attempt history
   - **the failure screenshot, inline** ([12](12-failure-diagnostics.md)) — plus the
     captured URL, console errors, and any milestone screenshots leading up to it.
     This is usually faster to read than the error text, and is the main reason the
     operator can judge a retry without re-running the job.
   - the Podio item it maps to, with a link straight to it

   **This screen is the only path back into the queue.** Retries are entirely
   manual — a `Failed` job stays failed until acted on here — so it needs:
   - **Retry** — requeue this job, per job, after the operator has judged it worth
     retrying (and fixed the cause where the error class says to)
   - **Dismiss** — leave it excluded for good, for jobs a human will finish by hand
     in Podio instead
   - **Bulk select + retry.** Not a nicety: a single environmental cause (a lapsed
     Dashlane session) can flag many jobs at once, and re-releasing them one at a
     time after one fix is the obvious frustration case.
   - A visible **worker status / circuit-breaker** indicator, so a worker stopped by
     an `auth` failure is obvious rather than looking like an idle queue.

6. **Operator gate prompt** — a prominent banner (not buried in a list) whenever the
   worker is in `WaitingForOperator` ([11](11-runtime-architecture.md)):
   - *"VPN required for N Dealer eProcess jobs — enable it, then confirm"* with a
     **Confirm** action; the worker independently verifies connectivity before it
     proceeds, so a premature confirm is safe.
   - The same surface handles a lapsed Dashlane session prompt.
   - **Send a desktop notification too.** The worker blocks until answered, and a
     prompt sitting on a dashboard nobody is looking at is indistinguishable from
     a crashed worker — this is the difference between a 30-second pause and an
     afternoon of no throughput.
   - Show when the gate is satisfied and the batch is running, then that the VPN is
     no longer needed once it completes.
   - Jobs waiting on a gate must render as **deferred, not failed** — they don't
     belong in Needs Attention, and they need no retry action.

## Design Notes

- This app is local-only for now; Appwrite can be self-hosted or remote, but the
  frontend itself doesn't need to be deployed anywhere.
- Keep the dashboard read-heavy and action-light at first: visibility into what the
  engine did is more valuable early on than adding more automated triggers.
- Current repo state: fresh `create-next-app` scaffold (`src/app/page.tsx` is still
  the default template) — no dashboard code exists yet.

## Acceptance Criteria (MVP)

- [ ] Job list view reads live from Appwrite
- [ ] Job detail view shows attempts + logs for a selected job
- [ ] **Needs Attention view** lists every failed job with its summary, error class,
      and failing step
- [ ] **Retry** requeues a failed job (single and bulk-select)
- [ ] **Dismiss** permanently excludes a job from selection
- [ ] Worker running/stopped/waiting state is visible at a glance
- [ ] An operator gate (VPN, Dashlane re-auth) shows as a banner with a confirm
      action, plus a desktop notification
- [ ] Gate-deferred jobs are shown separately from failed jobs
- [ ] A manual "Run job" action invokes the orchestration engine ([09](09-automation-engine-orchestration.md)) and reflects updated status without a page reload
- [ ] Original vs. processed source diff is visible before a job is run (manual review gate)

## Depends On

[05-appwrite-data-layer.md](05-appwrite-data-layer.md), [07-publishing-job-engine.md](07-publishing-job-engine.md), [09-automation-engine-orchestration.md](09-automation-engine-orchestration.md)

## Feeds Into

End users (dealership page publishers / assignees).
