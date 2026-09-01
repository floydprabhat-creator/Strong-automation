"use server";

import { revalidatePath } from "next/cache";
import { confirmGate } from "@/lib/data/repository";
import type { ActionResult } from "@/features/jobs/actions";

/**
 * Operator confirms a gated precondition (VPN enabled, Dashlane re-authed).
 *
 * IMPORTANT for the real implementation: this records the operator's answer, it
 * does NOT establish that the precondition holds. The worker must independently
 * verify connectivity before publishing, because an operator can confirm a
 * moment before the tunnel is actually up
 * (docs/features/11-runtime-architecture.md).
 */
export async function confirmGateAction(gateId: string): Promise<ActionResult> {
  if (!gateId) {
    return { ok: false, message: "No gate specified." };
  }

  await confirmGate(gateId);

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/attention");

  return {
    ok: true,
    message: "Confirmed — the worker will verify connectivity before publishing.",
  };
}
