/**
 * Configuration entrypoint. See `docs/env-and-secrets.md` for how values are
 * stored, and `./spec.ts` for the catalogue of variables.
 *
 * Import the narrow module rather than this barrel in client components —
 * `./public.ts` is the only one that may cross into the browser.
 */

export { ENV_SPEC, ENV_VARS, PROCESS_SCOPES, specFor, specsForScopes } from "./spec";
export type { EnvName, EnvScope, EnvVarSpec } from "./spec";
export { EnvConfigError } from "./read";
export { serverEnv } from "./server";
export type { AppwriteEnv, ServerEnv } from "./server";
export { workerEnv, requireVpnCheckUrl } from "./worker";
export type { WorkerEnv } from "./worker";
export { loadWorkerEnvFiles } from "./load";
