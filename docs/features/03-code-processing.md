# Feature: Code Processing — Metadata Normalization

## Responsibility

Apply the **single allowed code modification** before publishing, and nothing else.

## The One Allowed Modification

Commented metadata blocks may contain HTML entity-encoded special characters that
need decoding. Example:

```html
<!--
<title>Dealer's &amp; Service Center</title>
<description>Best Cars &amp; Trucks in town</description>
-->
```

becomes:

```html
<!--
<title>Dealer's & Service Center</title>
<description>Best Cars & Trucks in town</description>
-->
```

## Hard Rules

1. **Scope-restricted.** Only operate inside the designated commented metadata block
   (the specific HTML comment containing `<title>`/`<description>` tags, or whatever
   the agreed delimiter convention is). Never run a global entity-decode across the
   file.
2. **No other transformation.** No minification, no reformatting, no reindentation,
   no whitespace normalization, no attribute reordering — the rest of the file passes
   through byte-for-byte.
3. **Non-destructive to source.** Operate on an in-memory string or a temp file copy.
   The Git working tree / original file is never written to.
4. **Deterministic and auditable.** Given the same input, always produce the same
   output. Store both the original and processed content (or a diff) in Appwrite
   (`publishing_jobs` / `git_sources`) for audit.

## Suggested Implementation Approach

1. Locate the designated comment block via a precise, narrow pattern (e.g. an HTML
   comment immediately containing `<title>` and `<description>` tags) — not a
   generic "first HTML comment in the file" heuristic, since arbitrary client code
   may contain unrelated comments.
2. Extract only the text inside that block.
3. Run entity decoding (e.g. `&amp;` → `&`, `&#39;` → `'`) on that substring only.
4. Splice the decoded substring back into a copy of the full file content.
5. Leave everything outside the block untouched.

## Acceptance Criteria (MVP)

- [ ] Given a file with a metadata comment block, only that block's entities are decoded
- [ ] A file with entity-like sequences elsewhere (CSS, JS, other comments) is left untouched
- [ ] A file with no metadata block passes through unmodified (no error, no-op)
- [ ] Original file content and processed content are both retrievable for audit
- [ ] Unit tests cover: entities inside block, entities outside block, no block present, malformed block

## Depends On

[02-git-integration.md](02-git-integration.md)

## Feeds Into

[06-platform-adapters.md](06-platform-adapters.md) (adapter receives processed content)
