import { cn } from "@/lib/utils/cn";

/**
 * Read-only code display. Scrolls inside its own box so long lines never widen
 * the page.
 */
export function CodeBlock({
  content,
  className,
  /** Optional per-line tone map for diff-style highlighting, keyed by line index. */
  lineTones,
}: {
  content: string;
  className?: string;
  lineTones?: Record<number, "added" | "removed">;
}) {
  const lines = content.split("\n");

  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border border-line bg-surface-2 p-3",
        "font-mono text-[0.75rem] leading-relaxed text-ink",
        className,
      )}
    >
      <code>
        {lines.map((line, i) => {
          const tone = lineTones?.[i];
          return (
            <span
              key={i}
              className={cn(
                "block px-1",
                tone === "added" && "bg-ok-soft text-ok-ink",
                tone === "removed" && "bg-danger-soft text-danger-ink",
              )}
            >
              {line || " "}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
