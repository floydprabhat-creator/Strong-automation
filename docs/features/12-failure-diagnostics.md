# Feature: Failure Diagnostics & Screenshots

## Responsibility

Capture visual evidence at the moment a job fails, so the operator can diagnose it
from the dashboard without re-running anything. Since failures write nothing to
Podio ([01](01-podio-integration.md)) and retries are entirely manual
([07](07-publishing-job-engine.md)), these artifacts are the primary evidence the
operator's retry decision rests on.

## What to Capture

On **every** failure during or after the browser stage:

| Artifact | Why |
|---|---|
| Screenshot at the moment of failure | What the CMS actually showed — error banner, validation message, unexpected modal |
| Current URL + page title | Reveals silent redirects (e.g. bounced back to a login page) |
| Console errors + failed network requests | Catches CMS-side JS failures that produce no visible error |
| For `verification` failures: screenshot of the **live published page** | Shows what actually landed vs. what was expected ([08](08-verification.md)) |

Also capture a screenshot at a few **successful** milestones — post-login, and
after the code is pasted but before submitting. When a later step fails, the
preceding screenshot is often what explains it, and by then it's too late to go
back and take one.

## ⚠️ Screenshots Are Logs — The Redaction Rule Applies

[04-dashlane-credentials.md](04-dashlane-credentials.md) forbids credential values
from reaching Appwrite, logs, or console output. **A screenshot is subject to that
same rule**, and it's much easier to violate accidentally:

- A login form may render the password in plain text (a "show password" toggle, or
  a CMS that simply doesn't mask).
- The **Dashlane extension popup** itself lists vault entries.
- URLs can carry session tokens; a CMS admin view can expose unrelated clients' data.

There's a direct tension here: an `auth` failure is both the most useful moment to
have a screenshot and the most dangerous one to take. Resolve it by capturing but
redacting, never by capturing blind:

1. **Mask credential inputs at capture time.** Playwright's
   `page.screenshot({ mask: [...locators] })` paints solid boxes over matched
   elements — mask every `input[type=password]` and any known username field
   before the image is ever written to disk.
2. **Never capture while the Dashlane extension UI is open.** Take the shot against
   the page, after the popup has closed.
3. **Strip query strings from captured URLs** before storing them.
4. Treat this as a **hard requirement, not a best effort** — an unredacted
   screenshot is a credential leak that persists in storage and, later, in any
   shared dashboard.

## Storage

- **Write to local disk first, upload to Appwrite Storage opportunistically.**
  A failure is often *itself* a connectivity problem; if the upload is the only
  path, the diagnostic for a network failure is the artifact most likely to be
  lost. Record the local path unconditionally, the Appwrite file ID when the
  upload succeeds.
- Suggested key: `<jobId>/<attemptNumber>/<step>-<timestamp>.jpg`
- Reference the artifacts from `publishing_attempts`
  ([05](05-appwrite-data-layer.md)) so they're reachable from the job's history.
- **Use JPEG for full-page captures.** A full-page shot of a long dealership
  content page can be several MB as PNG versus a few hundred KB as JPEG — and at
  ~47 jobs with milestone captures each, that difference decides whether this
  feature is sustainable on a local disk.

## Retention

Artifacts accumulate silently, so decide the policy up front rather than after the
disk fills:

- Delete a job's artifacts when it reaches `Published`, or keep only the final
  successful run's.
- Delete on **Dismiss** ([10](10-frontend-dashboard.md)) — a dismissed job's
  evidence has served its purpose.
- Age out anything older than a set window (30 days is a reasonable default).
- Keep the *most recent* attempt's artifacts per failed job at minimum; older
  attempts are rarely what gets reviewed.

## Consider: Playwright Traces for Hard Cases

For failures that screenshots don't explain, a Playwright **trace**
(`context.tracing.start/stop`) is substantially more diagnostic — it bundles a
DOM snapshot timeline, network log, console output, and per-action screenshots,
and opens in the Playwright trace viewer.

Traces are much larger than screenshots, so don't record them for every job.
A good middle ground: keep screenshots always-on, and expose a **"retry with
trace"** action in the dashboard for a job that has already failed once and needs
real investigation. That pairs naturally with manual retries — the operator is
already deciding to look closely at that specific job.

## Acceptance Criteria (MVP)

- [ ] Every browser-stage failure produces a screenshot, URL, and console/network capture
- [ ] Password inputs are masked at capture time; no unredacted credential ever hits disk
- [ ] The Dashlane extension UI is never captured
- [ ] Artifacts are written locally even when Appwrite is unreachable
- [ ] Artifacts are referenced from `publishing_attempts` and shown inline in the
      dashboard's Needs Attention view
- [ ] A retention policy is implemented, not just documented

## Depends On

[04-dashlane-credentials.md](04-dashlane-credentials.md) (redaction rule),
[06-platform-adapters.md](06-platform-adapters.md) (browser session),
[05-appwrite-data-layer.md](05-appwrite-data-layer.md) (storage + references)

## Feeds Into

[10-frontend-dashboard.md](10-frontend-dashboard.md) (the operator's review surface)
