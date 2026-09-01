import { IconShield } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import type { Platform } from "@/lib/types/domain";

/**
 * Platform label. Surfaces two facts that matter operationally:
 *  - a VPN requirement (Dealer eProcess), because those jobs can't run unattended
 *  - that Auto Go / Fox Dealer share the WordPress adapter
 */
export function PlatformTag({
  platform,
  showAdapter = false,
  className,
}: {
  platform: Platform;
  showAdapter?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="text-sm text-ink">{platform.name}</span>

      {platform.requiresVpn && (
        <span
          title="Requires VPN — the operator must enable it before these jobs run"
          className="inline-flex items-center gap-0.5 rounded bg-info-soft px-1 py-0.5 text-[0.6875rem] font-medium text-info-ink"
        >
          <IconShield size={10} />
          VPN
        </span>
      )}

      {showAdapter && (
        <span className="font-mono text-[0.6875rem] text-ink-subtle">
          {platform.adapterKey}
        </span>
      )}
    </span>
  );
}
