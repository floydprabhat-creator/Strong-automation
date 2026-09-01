import { Badge } from "@/components/ui/badge";
import { IconCamera, IconCode, IconExternal } from "@/components/ui/icons";
import type { Artifact } from "@/lib/types/domain";

/**
 * Failure evidence for one attempt (docs/features/12-failure-diagnostics.md).
 *
 * The thumbnail frame is a placeholder until the worker exists to write real
 * files: screenshots are captured locally first and uploaded to Appwrite Storage
 * opportunistically, so `storageFileId` may be null while `localPath` is always
 * set. That distinction is shown per artifact because "not uploaded" is a normal
 * state, not an error.
 */
export function ArtifactGallery({ artifacts }: { artifacts: Artifact[] }) {
  const screenshots = artifacts.filter((a) => a.type === "screenshot");
  const others = artifacts.filter((a) => a.type !== "screenshot");

  return (
    <div className="space-y-2">
      {screenshots.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {screenshots.map((artifact) => (
            <li
              key={artifact.id}
              className="overflow-hidden rounded-md border border-line bg-surface-2"
            >
              {/* Placeholder frame — swap for <Image> once artifacts are served. */}
              <div className="flex aspect-video items-center justify-center border-b border-line bg-surface-3 text-ink-subtle">
                <IconCamera size={20} />
              </div>

              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-ink" title={artifact.label}>
                  {artifact.label}
                </p>

                {artifact.capturedUrl && (
                  <p
                    className="truncate font-mono text-[0.6875rem] text-ink-subtle"
                    title={artifact.capturedUrl}
                  >
                    {artifact.capturedUrl}
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-0.5">
                  {artifact.storageFileId ? (
                    <Badge tone="neutral">uploaded</Badge>
                  ) : (
                    <span title="Written locally; upload to Appwrite Storage pending">
                      <Badge tone="warn">local only</Badge>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {others.map((artifact) => (
            <li key={artifact.id}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-ink-muted">
                <IconCode size={12} />
                {artifact.label}
                <span className="font-mono text-[0.6875rem] text-ink-subtle">
                  {artifact.type}
                </span>
                <IconExternal size={10} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-ink-subtle">
        Screenshots are captured with password fields masked at capture time — an
        unredacted screenshot would be a credential leak in storage.
      </p>
    </div>
  );
}
