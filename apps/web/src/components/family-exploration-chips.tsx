'use client';

import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { resolveMrStatusBadge } from '@/hooks/use-session-hub-state';
import { sortMrVersionsByFamily } from '@/lib/mr-versions';
import type { ActivitySelection } from '@/lib/session-activity-by-family';
import type { SessionMrVersionSummaryDto } from '@metamorph/api-client';

type FamilyExplorationChipsProps = {
  mrVersions: SessionMrVersionSummaryDto[];
  controlStatus?: string;
  selected?: ActivitySelection;
  onSelect?: (selection: ActivitySelection) => void;
};

function formatFamilyLabel(family: string): string {
  return family.replace(/_/g, ' ');
}

export function FamilyExplorationChips({
  mrVersions,
  controlStatus,
  selected,
  onSelect,
}: FamilyExplorationChipsProps) {
  if (mrVersions.length === 0) {
    return null;
  }

  const sorted = sortMrVersionsByFamily(mrVersions);

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {sorted.map((mr) => {
        const isSelected =
          selected?.kind === 'family' && selected.mrVersionId === mr.id;

        return (
          <button
            key={mr.id}
            type="button"
            disabled={!onSelect}
            onClick={() =>
              onSelect?.({
                kind: 'family',
                family: mr.transformFamily,
                mrVersionId: mr.id,
              })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
              onSelect && 'hover:bg-muted/50 cursor-pointer',
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-muted/20',
            )}
          >
            <StatusBadge
              status={resolveMrStatusBadge(mr.status, controlStatus ?? 'active')}
            />
            <span className="font-medium capitalize text-foreground">
              {formatFamilyLabel(mr.transformFamily)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function formatFailedFamilyNames(
  mrVersions: SessionMrVersionSummaryDto[],
): string {
  const failed = sortMrVersionsByFamily(mrVersions).filter(
    (mr) => mr.status === 'exploration_failed',
  );
  if (failed.length === 0) {
    return '';
  }
  return failed.map((mr) => formatFamilyLabel(mr.transformFamily)).join(', ');
}
