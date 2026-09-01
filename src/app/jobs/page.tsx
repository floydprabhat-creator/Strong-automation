import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { JobFilters } from "@/features/jobs/components/job-filters";
import { JobTable } from "@/features/jobs/components/job-table";
import { listDealerships, listJobs, listPlatforms } from "@/lib/data/repository";
import type { JobStatus } from "@/lib/types/domain";

export default async function JobsPage(props: PageProps<"/jobs">) {
  const searchParams = await props.searchParams;

  const asParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const [jobs, platforms, dealerships] = await Promise.all([
    listJobs({
      status: (asParam(searchParams.status) as JobStatus | "all") ?? "all",
      platformId: asParam(searchParams.platform) ?? "all",
      dealershipId: asParam(searchParams.dealership) ?? "all",
      q: asParam(searchParams.q),
    }),
    listPlatforms(),
    listDealerships(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Every publishing job the tool knows about, with its engine state."
      />

      <JobFilters platforms={platforms} dealerships={dealerships} />

      <Card>
        <CardHeader
          title={`${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          description="Engine state is local. Podio status only changes on success."
        />
        <CardBody padded={false}>
          <JobTable jobs={jobs} />
        </CardBody>
      </Card>
    </div>
  );
}
