# Feature: Verification

## Responsibility

Confirm that a publish attempt actually succeeded on the target platform — a job
should never be marked `Published` just because the adapter call didn't throw.

## Approach

`verifyPage(page)` on each `PlatformAdapter` ([06](06-platform-adapters.md)) should:

1. Fetch the live published URL (via HTTP request or Playwright navigation).
2. Confirm the page loads (status 200, no CMS error page).
3. Confirm the published content matches what was sent — at minimum, check for a
   distinguishing fragment of the processed HTML (e.g. a known unique string from
   the metadata block or a content hash), not just "page exists."
4. Record the result (`publishing_attempts.verificationResult`) — pass/fail plus
   what was checked.

## Expect the CMS to Change What You Pasted

Because publishing is a paste-into-an-editor operation
([02](02-git-integration.md)), the CMS will often **not** store back exactly what
was sent: editors sanitize tags, rewrite attribute order and quoting, strip or
re-encode entities, inject wrapper markup, and rewrite relative URLs.

So an exact-match comparison will produce false failures on a perfectly good
publish. Verification needs a defined tolerance:

- **Don't** diff the full HTML byte-for-byte against the source.
- **Do** assert on a small set of stable, meaningful signals — e.g. the page
  loads, the normalized `<title>`/metadata values are present, and a few
  distinctive content strings from the source appear in the rendered output.
- Record *what was checked* alongside the pass/fail, so a later false failure is
  diagnosable rather than mysterious.
- Watch specifically for the CMS **re-encoding the entities** that
  [03-code-processing.md](03-code-processing.md) just decoded — that's the single
  most likely legitimate-looking mismatch in this pipeline, and it's worth an
  explicit check on the first platform brought online.

## Failure Handling

- Verification failure is treated the same as a publish failure: logged, routed to
  Retry/Failed per [07-publishing-job-engine.md](07-publishing-job-engine.md).
- Distinguish "adapter reported success but verification failed" from "adapter
  itself errored" in logs — the former often indicates a platform-specific quirk
  (caching delay, CMS draft vs. live state) worth surfacing distinctly.

## Open Questions to Resolve Before Building

- Some platforms may cache aggressively — does verification need a delay/retry
  loop before checking the live URL?
- Is a content-hash comparison sufficient, or does the team want a visual diff
  (screenshot comparison) for higher confidence? (Visual diff is a reasonable
  post-MVP enhancement, not required for v1.)

## Acceptance Criteria (MVP)

- [ ] Each adapter implements `verifyPage` performing a real content check (not just HTTP 200)
- [ ] Verification result stored per attempt
- [ ] Only a passed verification marks a job `Published`

## Depends On

[06-platform-adapters.md](06-platform-adapters.md)

## Feeds Into

[07-publishing-job-engine.md](07-publishing-job-engine.md) (final state), [01-podio-integration.md](01-podio-integration.md) (status write-back)
