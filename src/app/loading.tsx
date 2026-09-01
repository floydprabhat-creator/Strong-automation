import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

/** Loading UI components accept no props. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <SkeletonRows />
      </div>
    </div>
  );
}
