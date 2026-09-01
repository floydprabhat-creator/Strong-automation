import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { Definition, DefinitionList } from "@/components/ui/definition-list";
import { EmptyState } from "@/components/ui/empty-state";
import type { SourceReview } from "@/lib/types/domain";

/**
 * The manual review gate before publishing.
 *
 * Its whole purpose is to prove the narrow scope of the one permitted code
 * modification (docs/features/03-code-processing.md): entities decoded *inside*
 * the commented metadata block, and nothing else in the file touched. Showing
 * "8 of 41,208 bytes changed" is the point — it's how the operator confirms the
 * processor didn't run a global find/replace.
 */
export function SourceDiff({ review }: { review: SourceReview | null }) {
  if (!review) {
    return (
      <EmptyState
        title="No source resolved yet"
        description="The Git file is pinned and read when the job starts."
      />
    );
  }

  const untouched = review.totalBytes - review.changedChars;

  return (
    <div className="space-y-4">
      <DefinitionList columns={2}>
        <Definition label="Source file" mono>
          {review.filePath}
        </Definition>
        <Definition label="Pinned commit" mono>
          {review.commitHash}
        </Definition>
      </DefinitionList>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ok">{review.changedChars} chars changed</Badge>
        <Badge tone="neutral">
          {untouched.toLocaleString()} bytes untouched
        </Badge>
        <span className="text-xs text-ink-subtle">
          Changes are confined to the commented metadata block
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">
            Original (in Git)
          </p>
          <CodeBlock content={review.originalMetadataBlock} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">
            Processed (to publish)
          </p>
          <CodeBlock content={review.processedMetadataBlock} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-subtle">
        The Git repository is never modified — normalization happens on an in-memory
        copy read at the pinned commit.
      </p>
    </div>
  );
}
