# Feature: Automation Engine (Orchestration)

## Responsibility

The glue layer that runs the full pipeline in order, owns error handling across
step boundaries, and is the only component allowed to call every other subsystem.
No other feature should call another feature directly except through this engine
(e.g. a platform adapter should never reach into Podio directly).

## Orchestration Sequence

Matches the source doc's "Final Target Workflow" (§14):

1. Detect Podio item with status `Ready` → [01](01-podio-integration.md)
2. Create `publishing_jobs` record in Appwrite → [05](05-appwrite-data-layer.md), [07](07-publishing-job-engine.md)
3. Resolve dealership + platform + source code location
4. Retrieve Git files (read-only) → [02](02-git-integration.md)
5. Apply metadata-normalization ONLY → [03](03-code-processing.md)
6. Retrieve credentials from Dashlane → [04](04-dashlane-credentials.md)
7. Run the platform adapter (`login` → `publishPage`/`updatePage`) → [06](06-platform-adapters.md)
8. Verify the published page → [08](08-verification.md)
9. On success: update Appwrite job = Published, update Podio status, record attempt
10. On failure: log error to Appwrite, transition to Retry or Failed (max attempts), never leak credentials into the error record

## Design Notes

- Each step should be a discrete function/module with a narrow interface — this is
  what keeps the "one allowed modification" constraint enforceable and testable in
  isolation (see [03](03-code-processing.md)).
- The engine should be resumable: if the process restarts mid-job, it should be
  able to pick up a `Queued`/`Publishing` job from Appwrite state rather than
  requiring Podio to be re-polled from scratch.
- Trigger model for MVP: manual "Run" button in the dashboard per job, or a single
  scheduled poll — NOT automatic hands-off publishing until proven reliable (per
  source doc §12, item 9).

## Acceptance Criteria (MVP)

- [ ] A single orchestration function runs steps 1–10 above for one job, with each
      step's success/failure independently logged
- [ ] A failure at any step halts that job without affecting other jobs
- [ ] Re-running the engine after a crash does not duplicate a publish for a job
      already `Published`
- [ ] End-to-end dry run works for one dealership on one platform

## Depends On

All other features.

## Feeds Into

[10-frontend-dashboard.md](10-frontend-dashboard.md) (surfaces engine state/actions)
