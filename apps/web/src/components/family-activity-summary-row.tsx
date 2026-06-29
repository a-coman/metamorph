'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { resolveMrStatusBadge } from '@/hooks/use-session-hub-state';
import type { FamilyActivityBucket, ActivitySelection } from '@/lib/session-activity-by-family';

type FamilySummaryRowProps = {
  sessionId: string;
  families: FamilyActivityBucket[];
  selected: ActivitySelection;
  controlStatus?: string;
  onSelect: (selection: ActivitySelection) => void;
};

function formatFamilyLabel(family: string): string {
  return family.replace(/_/g, ' ');
}

function isFamilySelected(
  bucket: FamilyActivityBucket,
  selected: ActivitySelection,
): boolean {
  if (selected.kind !== 'family') {
    return false;
  }

  if (selected.mrVersionId && bucket.mrVersionId) {
    return selected.mrVersionId === bucket.mrVersionId;
  }

  return selected.family === bucket.family;
}

export function FamilyActivitySummaryRow({
  sessionId,
  families,
  selected,
  controlStatus,
  onSelect,
}: FamilySummaryRowProps) {
  return (
    <div className="grid grid-cols-2 gap-2 pb-4 border-b border-border/60">
      {families.map((bucket) => {
        const isSelected = isFamilySelected(bucket, selected);
        const canOpenDetails = !bucket.isPending && bucket.mrVersionId;

        return (
          <div
            key={bucket.mrVersionId ?? bucket.family}
            className={cn(
              'flex items-stretch rounded-lg border overflow-hidden transition-colors min-h-[3.75rem]',
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-muted/30',
            )}
          >
            <button
              type="button"
              onClick={() =>
                onSelect({
                  kind: 'family',
                  family: bucket.family,
                  ...(bucket.mrVersionId ? { mrVersionId: bucket.mrVersionId } : {}),
                })
              }
              className="flex flex-col justify-center gap-1 flex-1 min-w-0 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-h-5">
                <StatusBadge
                  status={resolveMrStatusBadge(bucket.status, controlStatus ?? 'active')}
                />
                <span className="text-xs font-medium text-foreground capitalize truncate">
                  {formatFamilyLabel(bucket.family)}
                </span>
              </div>
              <span
                className={cn(
                  'text-[10px] leading-[14px] min-h-[14px]',
                  bucket.eventCount > 0 ? 'text-muted-foreground' : 'invisible',
                )}
                aria-hidden={bucket.eventCount === 0}
              >
                {bucket.eventCount > 0 ? `${bucket.eventCount} events` : '0 events'}
              </span>
            </button>

            {canOpenDetails ? (
              <Link
                href={`/sessions/${sessionId}/mr/${bucket.mrVersionId}`}
                className="flex items-center gap-1 px-3 border-l border-border/40 text-xs text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors shrink-0 font-medium"
                title={`Open ${formatFamilyLabel(bucket.family)} detail`}
              >
                Details
                <ArrowRight className="size-3" />
              </Link>
            ) : (
              <span
                className="flex items-center gap-1 px-3 border-l border-border/40 text-xs text-muted-foreground/40 shrink-0 font-medium cursor-not-allowed"
                aria-hidden
              >
                Details
                <ArrowRight className="size-3" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
