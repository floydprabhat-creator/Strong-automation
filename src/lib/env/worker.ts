/**
 * Environment for the standalone `worker` process.
 *
 * The worker owns everything the dashboard doesn't: the Podio poll loop, Git
 * reads, the Dashlane-authenticated Chrome profile, and the operator gates
 * (docs/features/11-runtime-architecture.md).
 *
 * `.env*` files are not loaded automatically outside Next.js — call
 * `loadWorkerEnvFiles()` from `./load.ts` at the worker entrypoint before this.
 */

import { assertServerOnly, createEnvReader, EnvConfigError } from "./read";
import type { AppwriteEnv } from "./server";

export type PodioAuthMode = "user" | "app";

export interface PodioEnv {
  clientId: string;
  clientSecret: string;
  appId: string;
  /**
   * `user` authenticates as the operator via the authorization-code flow, which
   * needs no workspace admin rights and can read every app the operator can see
   * — including the linked Content Pages records an app token cannot reach.
   * `app` is the narrower per-app token, once an admin can issue one.
   */
  authMode: PodioAuthMode;
  redirectUri: string;
  appToken?: string;
  contentPagesAppId?: string;
  tokenFile: string;
}

export interface GitEnv {
  repoUrl: string;
  branch: string;
  cloneDir: string;
  sshKeyPath?: string;
  httpsToken?: string;
}

export interface BrowserEnv {
  chromeExecutablePath: string;
  profileDir: string;
  dashlaneExtensionId?: string;
  dashlaneSessionDays: number;
}

export interface GateEnv {
  vpnCheckUrl?: string;
  vpnCheckTimeoutMs: number;
  operatorGateTimeoutMinutes: number;
}

export interface WorkerRuntimeEnv {
  workerId: string;
  lockFile: string;
  pollIntervalMs: number;
  leaseTtlMs: number;
  artifactsDir: string;
  artifactRetentionDays: number;
  logLevel: string;
}

export interface WorkerEnv {
  appwrite: AppwriteEnv;
  podio: PodioEnv;
  git: GitEnv;
  browser: BrowserEnv;
  gates: GateEnv;
  runtime: WorkerRuntimeEnv;
}

let cached: WorkerEnv | null = null;

export function workerEnv(): WorkerEnv {
  if (cached) return cached;
  assertServerOnly("lib/env/worker");

  const read = createEnvReader();

  const env: WorkerEnv = {
    appwrite: {
      endpoint: read.require("APPWRITE_ENDPOINT"),
      projectId: read.require("APPWRITE_PROJECT_ID"),
      apiKey: read.require("APPWRITE_API_KEY"),
      databaseId: read.require("APPWRITE_DATABASE_ID"),
      artifactsBucketId: read.require("APPWRITE_ARTIFACTS_BUCKET_ID"),
    },
    podio: {
      clientId: read.require("PODIO_CLIENT_ID"),
      clientSecret: read.require("PODIO_CLIENT_SECRET"),
      appId: read.require("PODIO_APP_ID"),
      authMode: podioAuthMode(read.require("PODIO_AUTH_MODE")),
      redirectUri: read.require("PODIO_REDIRECT_URI"),
      appToken: read.optional("PODIO_APP_TOKEN"),
      contentPagesAppId: read.optional("PODIO_CONTENT_PAGES_APP_ID"),
      tokenFile: read.require("PODIO_TOKEN_FILE"),
    },
    git: {
      repoUrl: read.require("GIT_REPO_URL"),
      branch: read.require("GIT_REPO_BRANCH"),
      cloneDir: read.require("GIT_CLONE_DIR"),
      sshKeyPath: read.optional("GIT_SSH_KEY_PATH"),
      httpsToken: read.optional("GIT_HTTPS_TOKEN"),
    },
    browser: {
      chromeExecutablePath: read.require("CHROME_EXECUTABLE_PATH"),
      profileDir: read.require("CHROME_PROFILE_DIR"),
      dashlaneExtensionId: read.optional("DASHLANE_EXTENSION_ID"),
      dashlaneSessionDays: read.integer("DASHLANE_SESSION_DAYS"),
    },
    gates: {
      vpnCheckUrl: read.optional("VPN_CHECK_URL"),
      vpnCheckTimeoutMs: read.integer("VPN_CHECK_TIMEOUT_MS"),
      operatorGateTimeoutMinutes: read.integer("OPERATOR_GATE_TIMEOUT_MINUTES"),
    },
    runtime: {
      workerId: read.optional("WORKER_ID") ?? defaultWorkerId(),
      lockFile: read.require("WORKER_LOCK_FILE"),
      pollIntervalMs: read.integer("WORKER_POLL_INTERVAL_MS"),
      leaseTtlMs: read.integer("WORKER_LEASE_TTL_MS"),
      artifactsDir: read.require("ARTIFACTS_DIR"),
      artifactRetentionDays: read.integer("ARTIFACT_RETENTION_DAYS"),
      logLevel: read.require("LOG_LEVEL"),
    },
  };

  read.assertComplete("the worker");
  cached = Object.freeze(env);
  return cached;
}

/**
 * The VPN probe is only needed once the Dealer eProcess adapter exists, so it is
 * optional at startup and checked at the point of use instead — an unset probe
 * URL must stop the eProcess batch, never be treated as "tunnel is up"
 * (docs/features/11-runtime-architecture.md).
 */
export function requireVpnCheckUrl(env: WorkerEnv = workerEnv()): string {
  const url = env.gates.vpnCheckUrl;
  if (!url) {
    throw new Error(
      "VPN_CHECK_URL is not set — Dealer eProcess jobs cannot be verified as reachable. Set it before enabling that platform.",
    );
  }
  return url;
}

/**
 * `app` mode is unusable without a token, and silently falling back to `user`
 * would authenticate as a different identity than the operator configured.
 */
function podioAuthMode(value: string): PodioAuthMode {
  if (value === "user" || value === "app") return value;
  throw new EnvConfigError(
    `PODIO_AUTH_MODE must be "user" or "app", got "${value}".`,
  );
}

function defaultWorkerId(): string {
  const host = process.env.HOSTNAME ?? "local";
  return `${host}:${process.pid}`;
}
