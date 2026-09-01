import { EmptyState } from "@/components/ui/empty-state";
import { timeOnly } from "@/lib/format/datetime";
import { cn } from "@/lib/utils/cn";
import type { LogEntry, LogLevel } from "@/lib/types/domain";

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-ink-muted",
  warn: "text-warn",
  error: "text-danger",
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR ",
};

export function LogViewer({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) {
    return <EmptyState title="No log entries" description="Nothing has run for this job yet." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <ol className="divide-y divide-line/60">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex gap-3 px-4 py-1.5 font-mono text-xs leading-relaxed"
          >
            <span className="shrink-0 text-ink-subtle tabular">
              {timeOnly(log.timestamp)}
            </span>
            <span className={cn("shrink-0 font-semibold", LEVEL_STYLES[log.level])}>
              {LEVEL_LABELS[log.level]}
            </span>
            {log.step && (
              <span className="hidden shrink-0 text-ink-subtle sm:inline">
                [{log.step}]
              </span>
            )}
            <span className="min-w-0 break-words text-ink">{log.message}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
