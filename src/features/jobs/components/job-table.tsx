import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChevronRight, IconInbox } from "@/components/ui/icons";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { ErrorClassBadge } from "@/features/jobs/components/error-class-badge";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { dateOnly, relativeTime } from "@/lib/format/datetime";
import type { JobView } from "@/lib/types/views";

export function JobTable({ jobs }: { jobs: JobView[] }) {
  if (!jobs.length) {
    return (
      <EmptyState
        icon={<IconInbox size={28} />}
        title="No jobs match these filters"
        description="Adjust the filters above, or check that the worker has polled Podio recently."
      />
    );
  }

  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            <TH>Page</TH>
            <TH>Client</TH>
            <TH>Platform</TH>
            <TH>Status</TH>
            <TH>Due by</TH>
            <TH>Updated</TH>
            <TH className="w-8" />
          </TR>
        </THead>
        <TBody>
          {jobs.map((job) => (
            <TR key={job.id} interactive>
              <TD className="max-w-72">
                <Link
                  href={`/jobs/${job.id}`}
                  className="block truncate font-medium text-ink hover:text-accent"
                >
                  {job.title}
                </Link>
                <span className="font-mono text-xs text-ink-subtle">
                  {job.podioItemId}
                </span>
              </TD>

              <TD>
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                    {job.dealership.clientCode}
                  </span>
                  <span className="hidden max-w-40 truncate text-sm text-ink-muted lg:inline">
                    {job.dealership.name}
                  </span>
                </span>
              </TD>

              <TD>
                <PlatformTag platform={job.platform} />
              </TD>

              <TD>
                <span className="inline-flex items-center gap-1.5">
                  <JobStatusBadge status={job.status} />
                  {job.errorClass && <ErrorClassBadge errorClass={job.errorClass} />}
                </span>
              </TD>

              <TD className="text-sm whitespace-nowrap text-ink-muted tabular">
                {dateOnly(job.dueBy)}
              </TD>

              <TD className="text-sm whitespace-nowrap text-ink-subtle">
                {relativeTime(job.updatedAt)}
              </TD>

              <TD>
                <Link
                  href={`/jobs/${job.id}`}
                  aria-label={`Open ${job.title}`}
                  className="inline-flex text-ink-subtle hover:text-ink"
                >
                  <IconChevronRight size={16} />
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}
