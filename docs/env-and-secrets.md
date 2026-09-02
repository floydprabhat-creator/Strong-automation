# Environment & Secret Storage

How configuration is declared, where each value physically lives, and what must
never be written to disk. Companion to the "Configuration & Secrets" table in
[11-runtime-architecture.md](features/11-runtime-architecture.md).

## Where the list of variables lives

[`src/lib/env/spec.ts`](../src/lib/env/spec.ts) is the single source of truth —
name, owning process, required/optional, secret or not, default, and the feature
doc that explains it. Everything else is derived from it:

| File | Role |
|---|---|
| `src/lib/env/read.ts` | Typed readers; reports **all** missing variables at once |
| `src/lib/env/server.ts` | `serverEnv()` — Appwrite + artifacts, for the Next.js server |
| `src/lib/env/worker.ts` | `workerEnv()` — everything the publishing process needs |
| `src/lib/env/public.ts` | The only values allowed into the browser bundle |
| `src/lib/env/load.ts` | `loadWorkerEnvFiles()` — `.env*` loading for the standalone worker |
| `scripts/check-env.mts` | `npm run env:check`; `-- --write-example` regenerates `.env.example` |

Add a variable to `spec.ts` first, then read it. `.env.example` is generated, not
hand-edited.

```bash
cp .env.example .env.local     # fill in real values
chmod 600 .env.local
npm run env:check              # before starting the worker
```

## The storage rule, in one line

**A secret lives in exactly one authoritative place, and on the worker machine in
exactly one file that only the operator can read.**

### Layer 1 — the authoritative copy: Dashlane

Dashlane is already the credential store for this project ([04](features/04-dashlane-credentials.md)),
so it is also where the *master* copy of every API secret belongs — as a secure
note, not scattered across chat messages and laptops. If the worker machine dies,
the secure note is what rebuilds `.env.local`.

### Layer 2 — the machine copy: `.env.local`

- Lives at the project root (never inside `src/` — Next.js only loads root `.env*`).
- `chmod 600`, owned by the operator account.
- Gitignored. `.gitignore` allows exactly one exception, `!.env.example`.
- On a laptop, enable **FileVault** (or the platform equivalent). Disk encryption
  is what makes a plaintext `.env.local` an acceptable design at this scale.

### Layer 3 (optional, recommended for the two highest-value secrets) — the OS keychain

`APPWRITE_API_KEY` and `PODIO_CLIENT_SECRET` are the two values that grant broad
access. On macOS they can be kept out of any file entirely:

```bash
# once, to store
security add-generic-password -a "$USER" -s strong-automation/appwrite-api-key -w

# at worker start, to inject
export APPWRITE_API_KEY=$(security find-generic-password -a "$USER" \
  -s strong-automation/appwrite-api-key -w)
npm run worker
```

`process.env` takes precedence over every `.env*` file, so an exported value wins
without any code change. The keychain prompts on first access after unlock, which
is a real trade-off against unattended restarts — worth it for the Appwrite key,
probably not for `WORKER_POLL_INTERVAL_MS`.

## Per-secret guidance

| Secret | Store as | Notes |
|---|---|---|
| `APPWRITE_API_KEY` | Keychain, else `.env.local` | Scope the key to **databases + storage only**. Never a project-wide key, never in the browser. |
| `PODIO_CLIENT_SECRET`, `PODIO_APP_TOKEN` | Keychain, else `.env.local` | The app token is what grants write access to `Final Page URL`, `Status`, `Assigned To`. |
| Podio refresh token | `.secrets/podio-token.json`, `chmod 600` | Written by `npm run podio:auth`, then renewed by the worker. Gitignored. Revocable from Podio account settings, which a stored password would not be. |
| Git access | **SSH deploy key**, read-only, passphrase-protected, in the SSH agent | Preferred over `GIT_HTTPS_TOKEN`: a key file on disk is not a value that can be pasted into a log or a screenshot. |
| Dealership platform logins | **Dashlane only** | Never in env, never in Appwrite, never in a fixture. The extension is the only thing that ever handles them ([04](features/04-dashlane-credentials.md)). |
| `CHROME_PROFILE_DIR` | A path in env; the directory itself is sensitive | It holds an unlocked ~14-day Dashlane session. Treat the folder as a credential at rest: keep it outside any synced/backed-up location (iCloud, Dropbox, Time Machine share). |
| VPN credentials | The VPN client's own store | The worker only probes `VPN_CHECK_URL`; it never authenticates the tunnel. |

## Podio: which auth flow, and why

`PODIO_AUTH_MODE=user` (the default) runs the OAuth2 **authorization-code** flow:

```bash
npm run podio:auth   # once — approve in the browser, refresh token written to disk
```

It exists because of two constraints that only became clear once real access was
in hand:

- The operator reaches the client's Podio as a **member, not an admin**, so the
  per-app Developer page that issues `PODIO_APP_TOKEN` may not be available.
- The account signs in through **Google SSO**, so there is no Podio password for
  a `grant_type=password` flow to use — and storing one would be worse anyway.

What the flow gives us: no password on disk, access to every app the operator can
see (including Content Pages, which an app token cannot reach), a token
revocable from Podio's own settings, and unattended renewal from the refresh
token. What it costs: writes are attributed to the operator's account, and the
authorization has to be repeated if the refresh chain ever breaks — the same
shape as the Dashlane re-auth gate ([11](features/11-runtime-architecture.md)).

Set `PODIO_AUTH_MODE=app` instead once an admin can issue tokens for **both**
the HTML Page Jobs and Content Pages apps; it is the narrower grant of the two.

## Rules that are not negotiable

1. **No secret gets a `NEXT_PUBLIC_` prefix.** That prefix inlines the value into
   the JavaScript every visitor downloads, permanently, at build time. Only
   `src/lib/env/public.ts` reads those, and only non-secret values are in it.
2. **No secret in `next.config.ts`.** Its `env` key inlines values at build time
   the same way.
3. **Server-only modules stay server-only.** `serverEnv()` and `workerEnv()` call
   `assertServerOnly()`, so importing them from a client component throws a clear
   error instead of silently yielding `undefined`.
4. **Nothing secret reaches Appwrite.** Appwrite stores *references* to
   credentials, never values ([04](features/04-dashlane-credentials.md)).
5. **Redact before persisting.** Applies to `automation_logs`,
   `publishing_attempts.errorDetail`, console output — and to screenshots, which
   are logs too and must be masked at capture time
   ([12](features/12-failure-diagnostics.md)).
6. **`git status` before every commit.** The one-time cost of a leaked key is far
   higher than the habit.

## Rotation

Rotate — not just re-share — when any of these happen:

- An operator leaves or the worker machine changes hands.
- A secret is pasted anywhere outside Dashlane (chat, ticket, screen share).
- The repo history is ever found to contain a value (rotate **first**, rewrite
  history second; assume it was cloned).

Scheduled work that isn't rotation but sits next to it: the Dashlane session is
re-authenticated on the automation Chrome profile roughly every **14 days**
([04](features/04-dashlane-credentials.md)). Someone has to own that date, or the
worker's circuit breaker will find it for you.

## If the dashboard is ever deployed

Today both processes are local. If `web` later moves to a host (Vercel or
similar), its secrets move into that host's encrypted environment store — never
into a committed file, and never into the repo. The worker stays on the operator
machine regardless: it needs a real Chrome profile and, for eProcess, the VPN
([11](features/11-runtime-architecture.md)).
