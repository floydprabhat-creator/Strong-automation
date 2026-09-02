/**
 * Typed readers over `process.env`, driven by `./spec.ts`.
 *
 * Two rules shape this module:
 *
 * 1. **Report every missing variable at once.** A process that dies on the first
 *    missing name sends the operator through one restart per variable. A reader
 *    collects misses and `assertComplete` throws a single list.
 * 2. **Never read a `NEXT_PUBLIC_*` value through here.** Next.js only inlines
 *    literal `process.env.NEXT_PUBLIC_X` member access into the client bundle;
 *    the dynamic lookup below would silently be `undefined` in the browser. Those
 *    values live in `./public.ts` as literal references.
 */

import { specFor, type EnvName } from "./spec";

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvConfigError";
  }
}

/** Raw value with the spec default applied. Blank strings count as unset. */
function rawValue(name: EnvName): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess.trim() !== "") {
    return fromProcess.trim();
  }
  return specFor(name).default;
}

export interface EnvReader {
  /** Required value. Records a miss and returns "" so the caller can continue. */
  require(name: EnvName): string;
  /** Optional value, `undefined` when neither set nor defaulted. */
  optional(name: EnvName): string | undefined;
  /** Integer value; a non-numeric setting is recorded as an error. */
  integer(name: EnvName): number;
  /** Throws one aggregated error if anything was missing or malformed. */
  assertComplete(processLabel: string): void;
}

export function createEnvReader(): EnvReader {
  const missing: string[] = [];
  const invalid: string[] = [];

  return {
    require(name) {
      const value = rawValue(name);
      if (value === undefined) {
        missing.push(`${name} — ${specFor(name).description}`);
        return "";
      }
      return value;
    },

    optional(name) {
      return rawValue(name);
    },

    integer(name) {
      const value = rawValue(name);
      if (value === undefined) {
        missing.push(`${name} — ${specFor(name).description}`);
        return 0;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        invalid.push(`${name} — expected a number, got "${value}"`);
        return 0;
      }
      return parsed;
    },

    assertComplete(processLabel) {
      if (missing.length === 0 && invalid.length === 0) return;

      const sections = [
        `Environment is not configured for ${processLabel}.`,
        missing.length > 0
          ? ["", "Missing:", ...missing.map((line) => `  - ${line}`)].join("\n")
          : "",
        invalid.length > 0
          ? ["", "Invalid:", ...invalid.map((line) => `  - ${line}`)].join("\n")
          : "",
        "",
        "Copy .env.example to .env.local and fill it in, then run `npm run env:check`.",
      ];

      throw new EnvConfigError(sections.filter(Boolean).join("\n"));
    },
  };
}

/**
 * Guard for modules that must never be bundled into the client. Importing a
 * server-only module from a client component is the mistake this catches; the
 * value itself would already be `undefined` there, which is a subtler failure.
 */
export function assertServerOnly(moduleLabel: string): void {
  if (typeof window !== "undefined") {
    throw new EnvConfigError(
      `${moduleLabel} was imported into client-side code. Secrets are server-only — read them in a Server Component, a Route Handler, or the worker.`,
    );
  }
}
