import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { cn } from "@/lib/utils/cn";
import type { PlatformBreakdownRow } from "@/lib/types/views";

/**
 * Queue composition per platform.
 *
 * Useful because execution is serial and platform-batched: knowing that the
 * remaining work is concentrated on one platform tells the operator what the
 * next hour looks like, and whether a VPN gate is about to be hit.
 */
export function PlatformBreakdown({ rows }: { rows: PlatformBreakdownRow[] }) {
  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            <TH>Platform</TH>
            <TH>Adapter</TH>
            <TH className="text-right">Queued</TH>
            <TH className="text-right">Failed</TH>
            <TH className="text-right">Published</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.platform.id}>
              <TD>
                <PlatformTag platform={row.platform} />
              </TD>
              <TD>
                <span className="font-mono text-xs text-ink-muted">
                  {row.platform.adapterKey}
                </span>
              </TD>
              <TD className="text-right tabular">{row.queued || "—"}</TD>
              <TD
                className={cn(
                  "text-right tabular",
                  row.failed > 0 && "font-medium text-danger",
                )}
              >
                {row.failed || "—"}
              </TD>
              <TD className="text-right text-ink-muted tabular">
                {row.published || "—"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}
