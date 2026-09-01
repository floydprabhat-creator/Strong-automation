"use client";

import { useState, useTransition } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { IconLock, IconShield } from "@/components/ui/icons";
import { confirmGateAction } from "@/features/worker/actions";
import { relativeTime } from "@/lib/format/datetime";
import type { OperatorGate } from "@/lib/types/domain";

/**
 * The operator gate prompt.
 *
 * The worker blocks until this is answered, so it is deliberately the loudest
 * thing on the page. Two gates share this one component — VPN and Dashlane
 * re-auth — because both are "the worker cannot proceed until a human does
 * something on this machine" (docs/features/11-runtime-architecture.md).
 */
export function OperatorGateBanner({ gate }: { gate: OperatorGate }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const confirm = () => {
    startTransition(async () => {
      const res = await confirmGateAction(gate.id);
      setResult(res.message);
    });
  };

  return (
    <Banner
      tone="warn"
      icon={gate.kind === "vpn" ? <IconShield size={18} /> : <IconLock size={18} />}
      title={
        gate.kind === "vpn"
          ? `VPN required for ${gate.affectedJobCount} Dealer eProcess job${
              gate.affectedJobCount === 1 ? "" : "s"
            }`
          : "Dashlane session needs re-authentication"
      }
      actions={
        <Button variant="primary" size="sm" onClick={confirm} disabled={pending}>
          {pending ? "Confirming…" : gate.actionLabel}
        </Button>
      }
    >
      <p>{gate.message}</p>
      <p className="mt-0.5 text-ink-subtle">
        Raised {relativeTime(gate.raisedAt)}. Jobs waiting on this are deferred, not
        failed — they need no retry once the gate clears.
      </p>
      {result && (
        <p aria-live="polite" className="mt-1 font-medium text-ok-ink">
          {result}
        </p>
      )}
    </Banner>
  );
}
