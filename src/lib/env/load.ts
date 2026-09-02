/**
 * Loads `.env*` files for processes Next.js doesn't start.
 *
 * Next.js loads them itself for `web`; the standalone worker gets nothing, so it
 * calls this first thing at its entrypoint. `@next/env` is used rather than
 * `dotenv` so both processes resolve the same files in the same precedence:
 * `.env.$NODE_ENV.local` > `.env.local` > `.env.$NODE_ENV` > `.env`.
 *
 * Note that `.env*` files live at the project root, never inside `src/`.
 */

import { createRequire } from "node:module";

// `@next/env` ships as CommonJS. The worker runs as plain ESM under `node`,
// where a named import of a CJS module throws at load time.
const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");

export function loadWorkerEnvFiles(projectDir: string = process.cwd()): void {
  const isDev = process.env.NODE_ENV !== "production";
  loadEnvConfig(projectDir, isDev);
}
