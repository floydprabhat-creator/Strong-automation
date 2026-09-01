import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ErrorClass } from "@/lib/types/domain";

/**
 * The error class exists to tell the operator what to fix — retries are manual,
 * so this is the primary input to their decision
 * (docs/features/07-publishing-job-engine.md).
 */
const META: Record<
  ErrorClass,
  { label: string; tone: BadgeTone; guidance: string }
> = {
  transient: {
    label: "Transient",
    tone: "warn",
    guidance: "Nothing to fix — a plain retry will probably work.",
  },
  auth: {
    label: "Auth",
    tone: "danger",
    guidance:
      "Re-authenticate Dashlane before retrying. Retrying blind can lock the dealership's account.",
  },
  config: {
    label: "Config",
    tone: "warn",
    guidance: "Fix the data first — retrying unchanged will fail identically.",
  },
  content: {
    label: "Content",
    tone: "warn",
    guidance: "Fix the source page, then retry.",
  },
  verification: {
    label: "Verification",
    tone: "info",
    guidance:
      "Check the live page before retrying — the publish may have partly landed.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    guidance: "Read the log; likely a gap in the adapter.",
  },
};

export function errorClassGuidance(errorClass: ErrorClass): string {
  return META[errorClass].guidance;
}

export function ErrorClassBadge({ errorClass }: { errorClass: ErrorClass }) {
  const meta = META[errorClass];
  return (
    <span title={meta.guidance}>
      <Badge tone={meta.tone}>{meta.label}</Badge>
    </span>
  );
}
