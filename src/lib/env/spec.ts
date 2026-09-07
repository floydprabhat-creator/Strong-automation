/**
 * The catalogue of every environment variable this system reads.
 *
 * This file is the single source of truth for configuration: the typed readers
 * (`./worker.ts`, `./server.ts`) key off it, `scripts/check-env.ts` validates
 * against it, and `.env.example` is generated from it
 * (`npm run env:check -- --write-example`). Add a variable here first.
 *
 * It deliberately imports nothing, so plain `node` can load it directly.
 *
 * NO SECRET VALUE EVER LIVES IN THIS FILE — only names, defaults that are safe
 * to publish, and placeholder examples. See `docs/env-and-secrets.md`.
 */

/**
 * Which process reads the variable.
 *
 * - `shared` — both the worker and server-side Next.js code
 * - `worker` — the standalone worker only (docs/features/11-runtime-architecture.md)
 * - `web`    — server-side Next.js only
 * - `public` — inlined into the browser bundle at build time; NEVER a secret
 */
export type EnvScope = "shared" | "worker" | "web" | "public";

export interface EnvVarSpec {
  name: string;
  scope: EnvScope;
  /** Whether the owning process refuses to start without it. */
  required: boolean;
  /** True if the value is a credential: masked in output, never logged. */
  secret: boolean;
  description: string;
  /** Used when the variable is unset. Absent means there is no default. */
  default?: string;
  /** Placeholder written into `.env.example`. Never a real value. */
  example?: string;
  /** Feature doc that explains why this exists. */
  doc?: string;
}

export const ENV_SPEC = [
  /* ---------------------------------------------------------------------- */
  /* Appwrite — the shared state layer both processes talk to                */
  /* ---------------------------------------------------------------------- */
  {
    name: "APPWRITE_ENDPOINT",
    scope: "shared",
    required: true,
    secret: false,
    description: "Appwrite API endpoint (self-hosted or cloud).",
    example: "https://cloud.appwrite.io/v1",
    doc: "docs/features/05-appwrite-data-layer.md",
  },
  {
    name: "APPWRITE_PROJECT_ID",
    scope: "shared",
    required: true,
    secret: false,
    description: "Appwrite project ID.",
    example: "strong-automation",
    doc: "docs/features/05-appwrite-data-layer.md",
  },
  {
    name: "APPWRITE_API_KEY",
    scope: "shared",
    required: true,
    secret: true,
    description:
      "Server API key. Scope it to databases + storage only. Must never reach the browser bundle — server-side and worker code only.",
    example: "standard_0000000000000000000000000000000000000000",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "APPWRITE_DATABASE_ID",
    scope: "shared",
    required: true,
    secret: false,
    description: "Database holding the publishing collections.",
    default: "automation",
    doc: "docs/features/05-appwrite-data-layer.md",
  },
  {
    name: "APPWRITE_ARTIFACTS_BUCKET_ID",
    scope: "shared",
    required: true,
    secret: false,
    description:
      "Storage bucket for failure screenshots and traces. The worker writes it, the dashboard reads it.",
    default: "job_artifacts",
    doc: "docs/features/12-failure-diagnostics.md",
  },

  /* ---------------------------------------------------------------------- */
  /* Podio — job intent, and the only system written back to                 */
  /* ---------------------------------------------------------------------- */
  {
    name: "PODIO_CLIENT_ID",
    scope: "worker",
    required: true,
    secret: false,
    description: "Podio API client ID (OAuth2 app auth).",
    example: "strong-automation",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "PODIO_CLIENT_SECRET",
    scope: "worker",
    required: true,
    secret: true,
    description: "Podio API client secret.",
    example: "replace-me",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "PODIO_APP_ID",
    scope: "worker",
    required: true,
    secret: false,
    description: "Item ID of the Strong Devs -> HTML Page Jobs app.",
    example: "00000000",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "PODIO_AUTH_MODE",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "`user` (authorization-code flow, approved once in the browser — works without workspace admin rights) or `app` (per-app token, needs an admin to issue it).",
    default: "user",
    doc: "docs/env-and-secrets.md",
  },
  {
    name: "PODIO_REDIRECT_URI",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Callback the one-time `npm run podio:auth` listens on. Its host must match the domain registered with the API key.",
    default: "http://localhost:8321/podio/callback",
    doc: "docs/env-and-secrets.md",
  },
  {
    name: "PODIO_APP_TOKEN",
    scope: "worker",
    required: false,
    secret: true,
    description:
      "Only for PODIO_AUTH_MODE=app. Issued from the app's Developer page, which needs admin rights. Unused in `user` mode.",
    example: "",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "PODIO_CONTENT_PAGES_APP_ID",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Content Pages app, if linked records have to be queried directly rather than followed from the job item.",
    example: "00000000",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "PODIO_TOKEN_FILE",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Where the OAuth refresh token is cached between worker restarts. Written by `npm run podio:auth`. Gitignored; chmod 600.",
    default: ".secrets/podio-token.json",
    doc: "docs/features/11-runtime-architecture.md",
  },

  /* ---------------------------------------------------------------------- */
  /* Git — read-only source of the page HTML                                 */
  /* ---------------------------------------------------------------------- */
  {
    name: "GIT_REPO_URL",
    scope: "worker",
    required: true,
    secret: false,
    description:
      "The one shared page repo, with per-dealership folders. Prefer an SSH URL so no token lives in env.",
    example: "git@github.com:example/dealership-pages.git",
    doc: "docs/features/02-git-integration.md",
  },
  {
    name: "GIT_REPO_BRANCH",
    scope: "worker",
    required: false,
    secret: false,
    description: "Branch to pull before resolving a job's commit SHA.",
    default: "main",
    doc: "docs/features/02-git-integration.md",
  },
  {
    name: "GIT_CLONE_DIR",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Local clone kept in sync with `git pull`. Content is read at a pinned SHA, never from this working tree.",
    default: ".cache/page-repo",
    doc: "docs/features/02-git-integration.md",
  },
  {
    name: "GIT_SSH_KEY_PATH",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Read-only deploy key, if the SSH agent isn't already carrying one. The path is config; the key file itself is the secret.",
    example: "~/.ssh/strong_automation_deploy_ed25519",
    doc: "docs/env-and-secrets.md",
  },
  {
    name: "GIT_HTTPS_TOKEN",
    scope: "worker",
    required: false,
    secret: true,
    description:
      "Fallback only, for an HTTPS clone URL. An SSH deploy key is preferred — a token in env is a secret that a key file isn't.",
    example: "",
    doc: "docs/env-and-secrets.md",
  },

  /* ---------------------------------------------------------------------- */
  /* Browser + Dashlane — the one authenticated Chrome profile               */
  /* ---------------------------------------------------------------------- */
  {
    name: "CHROME_EXECUTABLE_PATH",
    scope: "worker",
    required: true,
    secret: false,
    description:
      "Real Chrome, not Playwright's bundled Chromium — the Dashlane extension only loads in branded Chrome.",
    example: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    doc: "docs/features/04-dashlane-credentials.md",
  },
  {
    name: "CHROME_PROFILE_DIR",
    scope: "worker",
    required: true,
    secret: false,
    description:
      "Persistent profile with the Dashlane extension installed and the 14-day session applied. Dedicated to automation; nothing else uses it. Treat the directory as a secret at rest — it holds a live vault session.",
    example: "~/.strong-automation/chrome-profile",
    doc: "docs/features/04-dashlane-credentials.md",
  },
  {
    name: "DASHLANE_EXTENSION_ID",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Extension ID, needed to open the vault popup for autofill. Copy it from chrome://extensions on the automation profile rather than assuming it.",
    example: "",
    doc: "docs/features/04-dashlane-credentials.md",
  },
  {
    name: "DASHLANE_EXTENSION_DIR",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Unpacked copy of the Dashlane extension, loaded with --load-extension. Chrome deletes a Web Store install from a Playwright-driven profile; the copy's manifest keeps its `key`, so the extension ID — and the vault storage under it — survive.",
    example: "~/.strong-automation/dashlane-extension",
    doc: "docs/features/04-dashlane-credentials.md",
  },
  {
    name: "DASHLANE_SESSION_DAYS",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Length of the Dashlane 'keep me signed in' window, used to warn in the dashboard before it lapses mid-run.",
    default: "14",
    doc: "docs/features/04-dashlane-credentials.md",
  },

  /* ---------------------------------------------------------------------- */
  /* Operator gates — VPN and re-auth preconditions                          */
  /* ---------------------------------------------------------------------- */
  {
    name: "VPN_CHECK_URL",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "A host reachable ONLY behind the tunnel. The worker checks this itself after the operator confirms — the confirmation alone is never trusted. Required before the Dealer eProcess adapter ships.",
    example: "https://internal.example.com/health",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "VPN_CHECK_TIMEOUT_MS",
    scope: "worker",
    required: false,
    secret: false,
    description: "How long the tunnel probe waits before declaring the VPN down.",
    default: "5000",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "OPERATOR_GATE_TIMEOUT_MINUTES",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "How long a gate waits for a human before the affected jobs are parked as deferred (never failed) and the worker exits cleanly.",
    default: "60",
    doc: "docs/features/11-runtime-architecture.md",
  },

  /* ---------------------------------------------------------------------- */
  /* Worker runtime                                                          */
  /* ---------------------------------------------------------------------- */
  {
    name: "WORKER_ID",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Identity written to `leaseOwner`. Defaults to hostname:pid, which is enough while a single worker is enforced.",
    example: "",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "WORKER_LOCK_FILE",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Advisory lock proving only one worker runs. Two workers against one Chrome profile fail in confusing ways.",
    default: ".cache/worker.lock",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "WORKER_POLL_INTERVAL_MS",
    scope: "worker",
    required: false,
    secret: false,
    description: "Gap between Podio polls for eligible jobs.",
    default: "60000",
    doc: "docs/features/01-podio-integration.md",
  },
  {
    name: "WORKER_LEASE_TTL_MS",
    scope: "worker",
    required: false,
    secret: false,
    description:
      "Job lease duration. Must exceed the longest realistic publish, or a live job looks crashed.",
    default: "900000",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "ARTIFACTS_DIR",
    scope: "shared",
    required: false,
    secret: false,
    description:
      "Local artifact root, written before any Appwrite upload so a network failure still leaves evidence.",
    default: ".artifacts",
    doc: "docs/features/12-failure-diagnostics.md",
  },
  {
    name: "ARTIFACT_RETENTION_DAYS",
    scope: "shared",
    required: false,
    secret: false,
    description: "Age-out window for screenshots and traces.",
    default: "30",
    doc: "docs/features/12-failure-diagnostics.md",
  },
  {
    name: "DATA_SOURCE",
    scope: "shared",
    required: false,
    secret: false,
    description:
      "Where the dashboard reads jobs from: `fixtures` (default) or `podio` (live, read-only — no attempts, logs or retries until Appwrite exists). See src/lib/data/podio-source.ts.",
    default: "fixtures",
    doc: "docs/features/11-runtime-architecture.md",
  },
  {
    name: "LOG_LEVEL",
    scope: "shared",
    required: false,
    secret: false,
    description: "One of: debug, info, warn, error.",
    default: "info",
  },

  /* ---------------------------------------------------------------------- */
  /* Public — inlined into the browser bundle at build time                  */
  /* ---------------------------------------------------------------------- */
  {
    name: "NEXT_PUBLIC_PODIO_ITEM_URL_BASE",
    scope: "public",
    required: false,
    secret: false,
    description:
      "Base URL for deep links back to a Podio item. Public by definition — the dashboard renders it as an href.",
    default:
      "https://podio.com/strongdevs/html-page-jobs/apps/html-page-jobs/items",
    doc: "docs/features/01-podio-integration.md",
  },
] as const satisfies readonly EnvVarSpec[];

/** Every known variable name — a typo in a reader is a type error. */
export type EnvName = (typeof ENV_SPEC)[number]["name"];

/**
 * The same catalogue, widened for iteration. `ENV_SPEC` keeps its literal types
 * so `EnvName` can be derived from it, which also makes optional fields absent
 * rather than `undefined` on individual entries — read the list through this.
 */
export const ENV_VARS: readonly EnvVarSpec[] = ENV_SPEC;

export function specFor(name: EnvName): EnvVarSpec {
  const found = ENV_SPEC.find((entry) => entry.name === name);
  if (!found) throw new Error(`Unknown environment variable: ${name}`);
  return found;
}

/** Variables a given process must be able to read. */
export function specsForScopes(scopes: readonly EnvScope[]): EnvVarSpec[] {
  return ENV_SPEC.filter((entry) => scopes.includes(entry.scope));
}

/** Scopes read by each process, including what it shares with the other. */
export const PROCESS_SCOPES = {
  worker: ["shared", "worker"],
  web: ["shared", "web", "public"],
} as const satisfies Record<string, readonly EnvScope[]>;
