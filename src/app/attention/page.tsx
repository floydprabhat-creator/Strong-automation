import { Banner } from "@/components/ui/banner";
import { IconPause } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { FailureQueue } from "@/features/attention/components/failure-queue";
import { OperatorGateBanner } from "@/features/worker/components/operator-gate-banner";
import {
  getWorkerStatus,
  listFailureGroups,
  listOperatorGates,
} from "@/lib/data/repository";

export const metadata = { title: "Needs attention — Strong Automation" };

export default async function AttentionPage() {
  const [groups, worker, gates] = await Promise.all([
    listFailureGroups(),
    getWorkerStatus(),
    listOperatorGates(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Needs attention"
        description="Failed jobs wait here until you decide. Nothing is written to Podio on failure, so this is the only record of what went wrong."
      />

      {gates.map((gate) => (
        <OperatorGateBanner key={gate.id} gate={gate} />
      ))}

      {worker.state === "stopped" && (
        <Banner
          tone="danger"
          icon={<IconPause size={18} />}
          title="Worker stopped — fix the cause before retrying"
        >
          {worker.stoppedReason ??
            "An auth failure tripped the circuit breaker. Re-authenticate Dashlane, then retry the affected jobs together."}
        </Banner>
      )}

      <FailureQueue groups={groups} />
    </div>
  );
}
