"use server";

import { revalidatePath } from "next/cache";
import { dismissJobs, retryJobs } from "@/lib/data/repository";

/**
 * Server actions for the operator's two decisions on a failed job.
 *
 * Expected problems are returned as values rather than thrown, per the Next.js
 * guidance for Server Functions. When this talks to a real worker, authorisation
 * must be checked inside each action — Server Functions are reachable by direct
 * POST.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Return failed jobs to the queue. This is the only path from `failed` back to
 * `queued`; the engine never retries on its own
 * (docs/features/07-publishing-job-engine.md).
 */
export async function retryJobsAction(ids: string[]): Promise<ActionResult> {
  if (!ids.length) {
    return { ok: false, message: "No jobs selected." };
  }

  const moved = await retryJobs(ids);

  revalidatePath("/attention");
  revalidatePath("/jobs");
  revalidatePath("/");

  if (moved === 0) {
    return { ok: false, message: "Nothing requeued — those jobs are no longer failed." };
  }

  return {
    ok: true,
    message: `Requeued ${moved} job${moved === 1 ? "" : "s"}.`,
  };
}

/** Permanently exclude jobs from selection — for work a human will finish by hand. */
export async function dismissJobsAction(ids: string[]): Promise<ActionResult> {
  if (!ids.length) {
    return { ok: false, message: "No jobs selected." };
  }

  const dismissed = await dismissJobs(ids);

  revalidatePath("/attention");
  revalidatePath("/jobs");
  revalidatePath("/");

  return {
    ok: true,
    message: `Dismissed ${dismissed} job${dismissed === 1 ? "" : "s"}.`,
  };
}
