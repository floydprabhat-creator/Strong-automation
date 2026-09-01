/**
 * Minimal class-name joiner.
 *
 * Deliberately dependency-free (no clsx/tailwind-merge) — this codebase composes
 * classes through explicit variant maps rather than merging conflicting utility
 * strings, so the conflict-resolution behaviour of tailwind-merge isn't needed.
 * If that changes, swap this implementation rather than sprinkling merges.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(" ");
}
