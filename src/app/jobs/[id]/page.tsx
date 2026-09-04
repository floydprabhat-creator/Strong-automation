import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Definition, DefinitionList } from "@/components/ui/definition-list";
import { IconAlert, IconExternal } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { AttemptTimeline } from "@/features/jobs/components/attempt-timeline";
import {
  ErrorClassBadge,
  errorClassGuidance,
} from "@/features/jobs/components/error-class-badge";
import { JobRetryActions } from "@/features/jobs/components/job-retry-actions";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { LogViewer } from "@/features/jobs/components/log-viewer";
import { PlatformTag } from "@/features/jobs/components/platform-tag";
import { PodioLink } from "@/features/jobs/components/podio-link";
import { SourceDiff } from "@/features/jobs/components/source-diff";
import { getJobDetail } from "@/lib/data/repository";
import { dateOnly, dateTime, monthLabel } from "@/lib/format/datetime";

export async function generateMetadata(
  props: PageProps<"/jobs/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const detail = await getJobDetail(id);
  return { title: detail ? `${detail.job.title} — Strong Automation` : "Job not found" };
}

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const detail = await getJobDetail(id);

  if (!detail) notFound();

  const { job, attempts, logs, sourceReview } = detail;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/jobs" className="text-xs text-ink-muted hover:text-ink">
          ← All jobs
        </Link>
      </div>

      <PageHeader
        eyebrow={
          <>
            <JobStatusBadge status={job.status} />
            {job.errorClass && <ErrorClassBadge errorClass={job.errorClass} />}
            <PlatformTag platform={job.platform} />
          </>
        }
        title={job.title}
        description={`${job.dealership.name} · ${job.pageType}`}
        actions={job.status === "failed" ? <JobRetryActions jobId={job.id} /> : undefined}
      />

      {job.status === "failed" && job.errorSummary && (
        <Banner
          tone="danger"
          icon={<IconAlert size={18} />}
          title="This job failed and is waiting on your decision"
        >
          <p className="text-ink">{job.errorSummary}</p>
          {job.errorClass && (
            <p className="mt-1 font-medium text-danger-ink">
              {errorClassGuidance(job.errorClass)}
            </p>
          )}
          <p className="mt-1 text-ink-subtle">
            Podio still shows this as <strong>Ready to Post</strong> with no assignee —
            nothing was written there on failure.
          </p>
        </Banner>
      )}

      {job.status === "deferred" && job.deferredReason && (
        <Banner tone="info" title="Deferred — not a failure">
          {job.deferredReason}
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Job record" />
          <CardBody>
            <DefinitionList>
              <Definition label="Podio item">
                <PodioLink podioItemId={job.podioItemId} />
              </Definition>
              <Definition label="Client code" mono>
                {job.dealership.clientCode}
              </Definition>
              <Definition label="Client site">
                <a
                  href={job.dealership.clientUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {job.dealership.clientUrl.replace(/^https?:\/\//, "")}
                  <IconExternal size={12} />
                </a>
              </Definition>
              {job.podioAssignee !== undefined && (
                <Definition label="Assigned to (Podio)">
                  {job.podioAssignee ?? (
                    <span className="text-ink-subtle">unassigned — free for a human to pick up</span>
                  )}
                </Definition>
              )}
              <Definition label="Due by">
                {dateOnly(job.dueBy)}{" "}
                <span className="text-ink-subtle">({monthLabel(job.dueBy)})</span>
              </Definition>
              <Definition label="Pinned commit" mono>
                {job.gitCommitHash ?? "not yet resolved"}
              </Definition>
              <Definition label="Source file" mono>
                {job.sourceFile ?? "not yet resolved"}
              </Definition>
              <Definition label="Operator retries">
                {job.attemptCount}
              </Definition>
              {job.publishedUrl && (
                <Definition label="Published URL">
                  <a
                    href={job.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-accent hover:underline"
                  >
                    {job.publishedUrl}
                    <IconExternal size={12} />
                  </a>
                </Definition>
              )}
              <Definition label="Last updated">{dateTime(job.updatedAt)}</Definition>
            </DefinitionList>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Source review"
            description="Original vs processed — proof the only change was inside the metadata block."
          />
          <CardBody>
            <SourceDiff review={sourceReview} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Attempts"
          description="Every run, with the evidence captured at failure."
        />
        <CardBody padded={false}>
          <AttemptTimeline attempts={attempts} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Activity log" />
        <CardBody padded={false}>
          <LogViewer logs={logs} />
        </CardBody>
      </Card>
    </div>
  );
}
