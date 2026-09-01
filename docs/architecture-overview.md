# Dealership Page Publishing Automation — Architecture Overview

Source: `dealership_page_publishing_automation_architecture_appwrite.pdf`

## Objective

Reduce manual work publishing dealership pages across multiple platforms (WordPress,
Dealer eProcess, Dealer.com, future platforms) by orchestrating existing systems rather
than replacing them.

## Core Systems

| System | Responsibility |
|---|---|
| Podio | Source of truth for page content, assignee, platform, dealership, page type, status, publishing workflow |
| Git | Source of arbitrary HTML/CSS/JS supplied or maintained by client/third party |
| Dashlane | Secure storage/retrieval of credentials for dealerships and platforms |
| Appwrite | Backend data layer: publishing jobs, dealerships, platforms, logs, attempts, history |
| Automation Engine | Orchestrates validation, code processing, publishing, verification, retries, Podio updates |
| Platform Adapters | Platform-specific publishing logic (WordPress, Dealer eProcess, Dealer.com, ...) |
| Playwright / APIs | Browser automation where APIs are unavailable; APIs where practical |

## Key Architectural Principle

Separate **what** should be published from **how** it gets published:

- Podio → what, where, for whom, when
- Git → the client/third-party supplied code
- Dashlane → how to authenticate
- Processor → the one permitted metadata normalization
- Adapter → how the target platform receives/publishes the code
- Appwrite → jobs, state, logs, attempts, history, application data
- Job engine → succeeded / failed / needs retry
- Verification → whether the page actually published correctly

## Hard Constraints (do not violate)

1. **Git code is not a template.** It may be arbitrary, client/third-party-authored
   HTML/CSS/JS. Never assume a fixed structure; locate and reproduce the existing
   copy/paste workflow faithfully. See [03-code-processing.md](features/03-code-processing.md).
2. **Exactly one code modification is allowed**: decoding HTML entities inside a
   designated *commented metadata* block (e.g. `<!-- <title>...</title> -->`). This must
   never run as a global find/replace across HTML/CSS/JS.
3. **Git source is never mutated.** Read → temp/in-memory copy → normalize → publish →
   discard copy. Original commit/hash stays intact and auditable.
4. **Manual approval before full automation.** Don't flip to fully automatic publishing
   until the pipeline has been proven reliable on at least one platform end-to-end.

## End-to-End Workflow

```
Podio (status: Ready)
   |
   v
Create publishing job in Appwrite
   |
   v
Identify dealership + platform + source code
   |
   v
Retrieve Git files (read-only)
   |
   v
Apply ONLY commented-metadata normalization where required
   |
   v
Retrieve credentials securely from Dashlane
   |
   v
Run platform adapter
   +--> API publishing (when available)
   +--> Playwright browser automation (when necessary)
   |
   v
Verify published page
   +--> Success -> Update Appwrite -> Update Podio -> Published
   +--> Failure -> Log error in Appwrite -> Retry / Human review
```

## Recommended Stack

- Frontend: React / Next.js (this repo, `strong-automation`)
- Backend: Node.js + TypeScript
- Application data: Appwrite (self-hosted or remote)
- Browser automation: Playwright
- Workflow/source: Podio + Git
- Credentials: Dashlane
- Publishing: platform APIs where available, Playwright otherwise

## Feature Docs

1. [Podio Integration](features/01-podio-integration.md)
2. [Git Integration](features/02-git-integration.md)
3. [Code Processing (Metadata Normalization)](features/03-code-processing.md)
4. [Dashlane Credentials](features/04-dashlane-credentials.md)
5. [Appwrite Data Layer](features/05-appwrite-data-layer.md)
6. [Platform Adapters](features/06-platform-adapters.md)
7. [Publishing Job Engine](features/07-publishing-job-engine.md)
8. [Verification](features/08-verification.md)
9. [Automation Engine (Orchestration)](features/09-automation-engine-orchestration.md)
10. [Frontend Dashboard](features/10-frontend-dashboard.md)
11. [Runtime & Process Architecture](features/11-runtime-architecture.md) — *not in the source PDF; covers where the code actually runs*
12. [Failure Diagnostics & Screenshots](features/12-failure-diagnostics.md) — *not in the source PDF; visual evidence for manual retry decisions*

See [mvp-roadmap.md](mvp-roadmap.md) for build order.

## Runtime Shape (decided beyond the PDF)

The PDF specifies the systems but not the process model. Two constraints force it:
publishes take minutes, and Dashlane auth needs a real persistent Chrome profile.
So the app runs as **two processes sharing Appwrite state** — a Next.js `web`
dashboard and a standalone `worker` that owns the poll loop and all Playwright
work. Browser concurrency is **1**, because there is only one Dashlane-authenticated
Chrome profile. Details in [11-runtime-architecture.md](features/11-runtime-architecture.md).
