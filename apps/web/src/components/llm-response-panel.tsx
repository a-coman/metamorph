'use client';

import {
  CheckpointScreenshot,
  CheckpointTraceLink,
} from '@/components/checkpoint-card';
import { SlotStepLabel, type SlotStepLike } from '@/lib/format-slot-step';
import type { ExplorationCheckpointDto } from '@metamorph/api-client';
import {
  derivePlanFailureType,
  readPlanExploreError,
} from '@/lib/plan-explore-errors';

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="text-xs font-mono bg-muted/40 rounded-md p-2.5 min-w-0 w-full overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-muted-foreground">{children}</span>
  );
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-foreground/80 leading-relaxed break-words [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

function EnumBadge({ value }: { value: string }) {
  return (
    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80">
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
      {children}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  if (!record) return [];
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function MrPlanResponse({ response }: { response: Record<string, unknown> }) {
  const mrDefinition = asRecord(response.mr_definition);
  const exploration = asRecord(response.exploration);
  const precondition = asRecord(mrDefinition?.precondition);
  const transformation = asRecord(mrDefinition?.transformation);
  const relation = asRecord(mrDefinition?.relation);

  const preconditionText = readString(precondition, 'description');
  const transformFamily = readString(transformation, 'transform_family');
  const transformationText = readString(transformation, 'description');
  const relationType = readString(relation, 'type');
  const relationOn = readStringArray(relation, 'on');
  const relationText = readString(relation, 'description');
  const sourceGoal = readString(exploration, 'source_phase_goal');
  const followUpGoal = readString(exploration, 'follow_up_phase_goal');

  return (
    <div className="space-y-3">
      {mrDefinition && (
        <div className="space-y-2">
          <FieldLabel>MR</FieldLabel>
          {preconditionText && (
            <InfoBlock>
              <FieldLabel>Precondition</FieldLabel>
              <FieldValue>{preconditionText}</FieldValue>
            </InfoBlock>
          )}

          {(transformFamily || transformationText) && (
            <InfoBlock>
              <FieldLabel>Transformation</FieldLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {transformFamily && <EnumBadge value={transformFamily} />}
              </div>
              {transformationText && <FieldValue>{transformationText}</FieldValue>}
            </InfoBlock>
          )}

          {(relationType || relationOn.length > 0 || relationText) && (
            <InfoBlock>
              <FieldLabel>Relation</FieldLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {relationType && <EnumBadge value={relationType} />}
                {relationOn.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    on {relationOn.join(', ')}
                  </span>
                )}
              </div>
              {relationText && <FieldValue>{relationText}</FieldValue>}
            </InfoBlock>
          )}
        </div>
      )}

      {(sourceGoal || followUpGoal) && (
        <div className="space-y-2">
          <FieldLabel>Phase goals</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sourceGoal && (
              <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs font-medium text-foreground">Source</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{sourceGoal}</p>
              </div>
            )}
            {followUpGoal && (
              <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-xs font-medium text-foreground">Follow-up</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{followUpGoal}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanExploreResponse({ response }: { response: Record<string, unknown> }) {
  const rationale = typeof response.rationale === 'string' ? response.rationale : null;
  const steps = Array.isArray(response.steps) ? (response.steps as SlotStepLike[]) : [];
  const error = readPlanExploreError(response);
  const failureType = error ? derivePlanFailureType(error) : null;
  const inventorySnapshotId =
    typeof response.inventorySnapshotId === 'string' && response.inventorySnapshotId.length > 0
      ? response.inventorySnapshotId
      : null;

  return (
    <div className="space-y-3">
      {error && (
        <InfoBlock>
          <div className="flex items-center gap-2 flex-wrap">
            <FieldLabel>Planning error</FieldLabel>
            {failureType && <EnumBadge value={failureType} />}
          </div>
          <FieldValue>
            <span className="text-red-600">{error}</span>
          </FieldValue>
        </InfoBlock>
      )}
      {rationale && (
        <p className="text-xs text-foreground/80 leading-relaxed break-words [overflow-wrap:anywhere]">
          {rationale}
        </p>
      )}
      {steps.length > 0 && (
        <ol className="space-y-1 text-xs list-decimal list-inside p-2.5 rounded-lg bg-muted/30 border border-border/50">
          {steps.map((step, index) => (
            <li key={index} className="text-muted-foreground">
              <SlotStepLabel step={step} />
            </li>
          ))}
        </ol>
      )}
      {inventorySnapshotId && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">
            Annotated screenshot at planning time
          </p>
          <CheckpointScreenshot snapshotId={inventorySnapshotId} />
        </div>
      )}
    </div>
  );
}

export function resolveVerifyVerdict(
  responseJson: unknown | null,
  checkpoint?: ExplorationCheckpointDto,
): string | null {
  if (responseJson !== null && responseJson !== undefined && typeof responseJson === 'object') {
    const verdict = (responseJson as Record<string, unknown>).verdict;
    if (typeof verdict === 'string') {
      return verdict;
    }
  }

  return checkpoint?.verdict ?? null;
}

function VerifyResponse({
  response,
  checkpoint,
}: {
  response: Record<string, unknown>;
  checkpoint?: ExplorationCheckpointDto;
}) {
  const rationale =
    (typeof response.rationale === 'string' ? response.rationale : null) ??
    checkpoint?.rationale ??
    null;

  return (
    <div className="space-y-3">
      {rationale && (
        <p className="text-xs text-foreground/80 leading-relaxed break-words [overflow-wrap:anywhere]">
          {rationale}
        </p>
      )}
      {checkpoint?.traceArtifactId && (
        <CheckpointTraceLink artifactId={checkpoint.traceArtifactId} />
      )}
      {checkpoint?.snapshotId && (
        <CheckpointScreenshot snapshotId={checkpoint.snapshotId} />
      )}
    </div>
  );
}

type LlmResponsePanelProps = {
  purpose: string;
  responseJson: unknown | null;
  checkpoint?: ExplorationCheckpointDto;
};

export function LlmResponsePanel({
  purpose,
  responseJson,
  checkpoint,
}: LlmResponsePanelProps) {
  if (responseJson === null || responseJson === undefined) {
    return (
      <p className="text-xs text-muted-foreground italic">Response not recorded for this call.</p>
    );
  }

  if (typeof responseJson !== 'object') {
    return <JsonBlock value={responseJson} />;
  }

  const record = responseJson as Record<string, unknown>;

  switch (purpose) {
    case 'mr_plan':
      return <MrPlanResponse response={record} />;
    case 'explore_plan':
    case 'plan_explore':
      return <PlanExploreResponse response={record} />;
    case 'explore_verify':
      return <VerifyResponse response={record} checkpoint={checkpoint} />;
    case 'observation_anchor':
      return (
        <div className="space-y-2">
          {readString(record, 'container_element_id') && (
            <InfoBlock>
              <FieldLabel>Results container</FieldLabel>
              <EnumBadge value={readString(record, 'container_element_id')!} />
            </InfoBlock>
          )}
          {readString(record, 'item_selector_hint') && (
            <InfoBlock>
              <FieldLabel>Item selector hint</FieldLabel>
              <EnumBadge value={readString(record, 'item_selector_hint')!} />
            </InfoBlock>
          )}
          {readString(record, 'rationale') && (
            <FieldValue>{readString(record, 'rationale')}</FieldValue>
          )}
        </div>
      );
    default:
      return <JsonBlock value={responseJson} />;
  }
}
