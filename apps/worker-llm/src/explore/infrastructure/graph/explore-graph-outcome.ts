export type ExploreGraphInterruptValue = {
  reason?: string;
  probeJobId?: string;
};

export type GraphStateSnapshot = {
  next: string[];
  interrupts?: Array<{ value?: ExploreGraphInterruptValue }>;
  tasks?: Array<{
    interrupts?: Array<{ value?: ExploreGraphInterruptValue }>;
  }>;
  values?: Record<string, unknown>;
};

export type ExploreGraphOutcomeStatus =
  | 'completed'
  | 'interrupted'
  | 'failed'
  | 'paused';

export type ExploreGraphOutcome = {
  status: ExploreGraphOutcomeStatus;
  mrVersionId?: string;
  reason?: string;
};

function extractInterruptValues(
  result: Record<string, unknown>,
  snapshot: GraphStateSnapshot,
): ExploreGraphInterruptValue[] {
  const values: ExploreGraphInterruptValue[] = [];

  const invokeInterrupts = result.__interrupt__ as unknown;
  if (Array.isArray(invokeInterrupts)) {
    for (const item of invokeInterrupts) {
      if (item && typeof item === 'object' && 'value' in item) {
        values.push((item as { value: ExploreGraphInterruptValue }).value);
      } else if (item && typeof item === 'object') {
        values.push(item as ExploreGraphInterruptValue);
      }
    }
  }

  if (snapshot.interrupts) {
    for (const item of snapshot.interrupts) {
      if (item?.value) {
        values.push(item.value);
      }
    }
  }

  if (snapshot.tasks) {
    for (const task of snapshot.tasks) {
      for (const item of task.interrupts ?? []) {
        if (item?.value) {
          values.push(item.value);
        }
      }
    }
  }

  return values;
}

function hasPendingInterrupt(
  result: Record<string, unknown>,
  snapshot: GraphStateSnapshot,
  interruptValues: ExploreGraphInterruptValue[],
): boolean {
  if (snapshot.next.length > 0) {
    return true;
  }

  if (interruptValues.length > 0) {
    return true;
  }

  if ((snapshot.interrupts?.length ?? 0) > 0) {
    return true;
  }

  const invokeInterrupts = result.__interrupt__ as unknown;
  return Array.isArray(invokeInterrupts) && invokeInterrupts.length > 0;
}

export function interpretExploreGraphOutcome(
  result: Record<string, unknown>,
  snapshot: GraphStateSnapshot,
): ExploreGraphOutcome {
  const checkpointValues = snapshot.values ?? {};
  const mrVersionId =
    (result.mrVersionId as string | undefined) ??
    (checkpointValues.mrVersionId as string | undefined);

  const failed =
    (result.failed as boolean | undefined) ??
    (checkpointValues.failed as boolean | undefined);
  const failureReason =
    (result.failureReason as string | undefined) ??
    (checkpointValues.failureReason as string | undefined);

  if (failed) {
    return { status: 'failed', mrVersionId, reason: failureReason };
  }

  const interruptValues = extractInterruptValues(result, snapshot);

  if (interruptValues.some((value) => value.reason === 'user_pause')) {
    return { status: 'paused', mrVersionId };
  }

  if (hasPendingInterrupt(result, snapshot, interruptValues)) {
    return { status: 'interrupted', mrVersionId };
  }

  return { status: 'completed', mrVersionId };
}
