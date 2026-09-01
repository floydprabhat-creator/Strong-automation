# Feature: Git Integration

## Responsibility

Git is the source of **arbitrary** HTML/CSS/JS supplied or maintained by a client or
third party for a given dealership page.

## Critical Design Constraint

> The HTML/CSS/JS in Git cannot be assumed to follow a structure controlled by the
> automation team. It may be added or modified by an end client or a third party.

Implications:

- **No fixed template parsing.** Don't assume file names, folder layout, or a
  component structure. Locate files by whatever addressing scheme is actually in use
  per dealership (documented convention, Podio-provided path, or a per-repo manifest).
- **Reproduce the human workflow.** The tool's job is to find the same files a human
  would copy/paste today, not to reinterpret or restructure them.
- **Read-only.** The tool never commits, pushes, or modifies the Git repository. See
  [03-code-processing.md](03-code-processing.md) for how normalization is applied
  without touching the source.

## Responsibilities

- Resolve dealership + page type → repo path (and commit/branch/ref) using whatever
  mapping Podio or a config table provides.
- Clone/pull or read the relevant repo (local clone kept in sync, or fetch on demand).
- Read the raw HTML/CSS/JS file(s) for that page.
- Record the exact Git commit hash used, for audit trail in Appwrite
  (`git_sources` collection — see [05-appwrite-data-layer.md](05-appwrite-data-layer.md)).

## Confirmed Repo Structure

- **One shared repository**, with **per-dealership folders** inside it. File
  resolution is `repo/<dealershipFolder>/<pageFile(s)>` (exact naming convention
  within a dealership folder still needs to be confirmed per dealership, since
  folder contents are client/third-party supplied and not guaranteed uniform —
  see [03-code-processing.md](03-code-processing.md) constraint).
- **The role of Git in this pipeline is literally "read the file, then paste its
  content into the platform's editor."** There is no build/compile step and no
  repo-side templating to reverse-engineer — the automation's job is to read the
  exact text a human would currently copy, and hand that text (after only the
  metadata-normalization step) to the platform adapter for pasting into the
  correct field(s) (see [06-platform-adapters.md](06-platform-adapters.md)).
- Because it's a single shared repo, a local clone kept up to date with `git pull`
  before each read is simpler than per-dealership clone management.

## Pin the Commit, Don't Read the Working Tree

A single shared repo means every dealership's work lands in the same clone. If a
job reads files straight off the working tree, a `git pull` (or another job's
refresh) can change those files *while the job is running* — so the content
published wouldn't match the `commitHash` recorded for audit.

The rule:

1. At job start, resolve and record the exact commit SHA once.
2. Read all file content **at that SHA** (`git show <sha>:<path>`), not from the
   working tree.
3. A retry of the same job reuses the pinned SHA, so a retry republishes exactly
   what the original attempt intended — not whatever landed in the repo since.

This makes `git_sources.commitHash` a real audit record rather than an
approximation, and it's what allows the "preserve the original Git source"
guarantee to actually hold under concurrency.

## Locating the File for a Job

Podio provides the lookup keys ([01-podio-integration.md](01-podio-integration.md)):
`Client Code`, plus the linked Content Page's `H1 Title`, `Geo`, `Meta Title`, and
`Meta Description`.

**Observed example** (job "Ford Dent Repair", client `BFB`):

| Podio field | Value |
|---|---|
| Client Code | `BFB` |
| H1 Title | `Berglund Ford of Bedford: Expert Dent Repair` |
| Geo | `Bedford, VA` |
| → file | `expert-dent-repair-bedford-va.html` |

So the filename appears to be `slug(<H1 after the colon>) + "-" + slug(Geo)`.

**Treat that as a hypothesis, not a rule.** It's derived from a single example, and
this repo is explicitly *not* guaranteed to follow a convention the automation team
controls. A slug-guessing strategy will silently pick the wrong file the moment a
title contains punctuation, a dealership deviates, or two pages slug identically.

**Recommended resolution strategy — match on content, fall back to filename:**

1. Narrow to the client's folder using `Client Code` (`BFB`).
2. **Grep candidate files for the exact `Meta Title` or `H1 Title` string.** The
   generated HTML contains these verbatim, so a content match is far more reliable
   than reconstructing a filename.
3. Use the derived slug only to rank/disambiguate when content matching returns
   more than one hit.
4. **If matching returns zero or multiple files, fail the job as `config` class**
   ([07](07-publishing-job-engine.md)) for human review. Never guess — publishing
   the wrong page to a live dealership site is the worst failure mode in this
   system, and it's silent.

## Worth Investigating: the file is already attached to the Podio item

The job's activity feed shows: *"Kiosk — Added file `expert-dent-repair-bedford-va.html`"*,
alongside an `HTML Generated` counter going 0 → 1. An upstream tool ("Kiosk")
generates the HTML and attaches it directly to the Podio item.

If that attachment is byte-identical to what lands in Git, **downloading it from
Podio removes this entire file-discovery problem** — no slug derivation, no
grepping, no ambiguity, and no wrong-page risk. That would be a significant
simplification of the highest-risk lookup in the pipeline.

Worth confirming before building the Git matcher:
- Is the Podio attachment the same artifact that's committed to Git?
- Is it reliably present on every eligible job, or only some?
- Which does the team consider authoritative if they ever differ?

## Open Questions to Resolve Before Building

- Are there multiple files per page (separate .html/.css/.js) or one combined file
  per platform convention? The observed example is a single `.html`, which fits
  Dealer.com's paste model — but shouldn't be assumed for other platforms.
- Does the client folder in Git key off `Client Code` (`BFB`) or the full client
  name? Needs a look at the real repo tree.

## Acceptance Criteria (MVP)

- [ ] Given a dealership + page type, resolve and read the correct file(s) from Git
- [ ] Capture and store the commit hash used
- [ ] No write operations against the repo anywhere in the pipeline
- [ ] Works against at least one real client repo without assuming its internal layout

## Depends On

[01-podio-integration.md](01-podio-integration.md) (for dealership/page identity)

## Feeds Into

[03-code-processing.md](03-code-processing.md), [05-appwrite-data-layer.md](05-appwrite-data-layer.md) (`git_sources`)
