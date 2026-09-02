import { IconExternal } from "@/components/ui/icons";
import { podioItemUrl } from "@/lib/env/public";
import { cn } from "@/lib/utils/cn";

/**
 * Link back to the Podio item.
 *
 * Failures write nothing to Podio, so this is the only bridge between a local
 * failure record and the item a human has to act on
 * (docs/features/01-podio-integration.md).
 */
export function PodioLink({
  podioItemId,
  className,
  label,
}: {
  podioItemId: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={podioItemUrl(podioItemId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover hover:underline",
        className,
      )}
    >
      {label ?? `Podio ${podioItemId}`}
      <IconExternal size={12} />
    </a>
  );
}
