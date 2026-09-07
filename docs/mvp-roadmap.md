# MVP Roadmap

Derived from source doc §12, sequenced by dependency. Each phase should be usable
and demoable before moving to the next — don't build all features in parallel.

## Phase 0 — Foundations
- [ ] Provision Appwrite (self-hosted or cloud) and create collections per
      [05-appwrite-data-layer.md](features/05-appwrite-data-layer.md)
- [ ] Split the repo into `web` (Next.js) + `worker` (standalone Node/TS) processes
      per [11-runtime-architecture.md](features/11-runtime-architecture.md), sharing
      types via `src/lib` — do this **before** writing pipeline code, it's expensive
      to retrofit
- [ ] Appwrite SDK wrapper + domain types shared by both processes
- [ ] Confirm `.gitignore` covers `.env*` before any real credential exists

## Phase 0.5 — De-risking spikes (do these before committing to Phase 3)
Each of these can invalidate an assumption cheaply, and each is currently unproven:
- [x] **Dashlane spike — DONE, and it works.** `scripts/dashlane-spike.mts` drove
      Dealer.com's real sign-in end to end: extension alive, vault unlocked,
      picker opened, entry selected by `Client Code`, both fields autofilled.
      Two constraints came out of it and are binding on the worker: Chrome must
      be spawned normally and attached to over CDP (Playwright's own launch
      deletes the extension), and the vault needs ~6s to become ready after
      launch. Mechanics in [04](features/04-dashlane-credentials.md).
- [ ] **File-source spike (do this first, it may delete work):** confirm whether the
      `Kiosk`-generated HTML attached to the Podio item is the same artifact as the
      Git file ([02](features/02-git-integration.md)). If yes, the whole Git
      matching strategy collapses into "download the attachment."
- [ ] **Git spike:** if Git remains the source, validate the filename-derivation
      hypothesis (`H1` + `Geo` slug) and the content-grep fallback across ~20 real
      jobs, not one
- [ ] **CMS fidelity spike:** paste a known page into the first target platform by
      hand and diff what the CMS stores back, to calibrate verification tolerance
      ([08](features/08-verification.md))

## Phase 1 — Read-only visibility
- [ ] [Podio integration](features/01-podio-integration.md): fetch + display
      publishable ("Ready") items in the dashboard
- [ ] [Git integration](features/02-git-integration.md): resolve and read the
      correct file(s) for a given item, read-only

## Phase 2 — Processing & review
- [ ] [Code processing](features/03-code-processing.md): implement the
      narrowly-scoped metadata normalization with unit tests
- [ ] [Frontend](features/10-frontend-dashboard.md): local preview/review step
      showing original vs. processed source

## Phase 3 — First platform, end-to-end: **Dealer.com**
- [ ] [Dashlane credentials](features/04-dashlane-credentials.md): browser login
      to Dealer.com via the extension profile
- [ ] [Platform adapters](features/06-platform-adapters.md): implement the
      **Dealer.com** adapter fully — `login`, `publishPage`, `updatePage`.
      (Dealer.com, not WordPress: it's the platform every currently-eligible job
      targets.)
- [ ] [Verification](features/08-verification.md): real content check, not just
      HTTP 200
- [ ] [Job engine](features/07-publishing-job-engine.md) +
      [orchestration](features/09-automation-engine-orchestration.md): wire the full
      Ready → Published path for this one platform, manually triggered

## Phase 4 — Reliability
- [ ] Failure reporting: attempt logs + error classes surfaced in the dashboard's
      Needs Attention view, with operator-initiated retry/dismiss (single + bulk).
      **No automatic retries** — see [07](features/07-publishing-job-engine.md)
- [ ] `auth`-failure circuit breaker stops the worker instead of draining the queue
- [ ] Failure screenshots + page state captured and shown inline in the dashboard
      ([12](features/12-failure-diagnostics.md)) — **with password masking done at
      capture time**, plus a retention policy so artifacts don't grow unbounded
- [ ] Podio write-back: `Final Page URL` + `Status` → `Code Review` on success;
      failure status (`Alert`?) on human-review cases — see
      [01](features/01-podio-integration.md)

## Phase 5 — Scale out
Add the remaining adapters in this order ([06](features/06-platform-adapters.md)):
- [ ] **WordPress** — one adapter covering both Auto Go and Fox Dealer (best
      effort-to-coverage ratio of the remaining four)
- [ ] **Apollo** — bespoke, no environmental complications
- [ ] **Dealer eProcess last** — needs the VPN precondition
      ([11](features/11-runtime-architecture.md)) plus platform-batched scheduling,
      so tackle it once the pipeline is otherwise proven and a VPN fault can't be
      mistaken for a pipeline fault
- [ ] Only after Phase 3–4 is proven reliable on real dealerships: consider moving
      from manual "Run job" trigger to scheduled/automatic publishing

## Explicitly Out of Scope for MVP
- Automatic (unattended) publishing — manual trigger required until proven reliable
- Visual/screenshot diffing for verification
- Multi-user auth/permissions in the dashboard (Appwrite makes this easy to add later)
- Editing dealership/platform config from the UI (read-only is enough at first)
