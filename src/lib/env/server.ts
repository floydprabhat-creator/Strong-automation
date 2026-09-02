/**
 * Environment for server-side Next.js code (`web`).
 *
 * The dashboard reads Appwrite and enqueues work; it never publishes, never
 * drives Playwright, and therefore never needs Podio, Git or Dashlane
 * configuration (docs/features/11-runtime-architecture.md). Keeping those out of
 * this object is deliberate: an unused secret in a process is still a secret that
 * can leak from it.
 *
 * Server-only. For values the browser needs, see `./public.ts`.
 */

import { assertServerOnly, createEnvReader } from "./read";

export interface AppwriteEnv {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  artifactsBucketId: string;
}

export interface ServerEnv {
  appwrite: AppwriteEnv;
  artifactsDir: string;
  artifactRetentionDays: number;
  logLevel: string;
}

let cached: ServerEnv | null = null;

/**
 * Reads and validates the dashboard's configuration once per process.
 *
 * Call it inside a request/render path rather than at module scope, so a
 * misconfigured environment surfaces as a page error rather than a build-time
 * crash on a machine that legitimately has no secrets.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  assertServerOnly("lib/env/server");

  const read = createEnvReader();

  const env: ServerEnv = {
    appwrite: {
      endpoint: read.require("APPWRITE_ENDPOINT"),
      projectId: read.require("APPWRITE_PROJECT_ID"),
      apiKey: read.require("APPWRITE_API_KEY"),
      databaseId: read.require("APPWRITE_DATABASE_ID"),
      artifactsBucketId: read.require("APPWRITE_ARTIFACTS_BUCKET_ID"),
    },
    artifactsDir: read.require("ARTIFACTS_DIR"),
    artifactRetentionDays: read.integer("ARTIFACT_RETENTION_DAYS"),
    logLevel: read.require("LOG_LEVEL"),
  };

  read.assertComplete("the web dashboard");
  cached = Object.freeze(env);
  return cached;
}
