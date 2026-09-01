import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconInbox } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <EmptyState
        icon={<IconInbox size={32} />}
        title="Not found"
        description="That job or page doesn't exist. It may have been dismissed, or the link may be stale."
        actions={
          <Link href="/jobs" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Back to jobs
          </Link>
        }
      />
    </div>
  );
}
