type SlotStep = {
  action?: string;
  element_id?: string;
  value?: string;
  url?: string;
  key?: string;
};

type ObservableDef = {
  key?: string;
  compare?: string;
  rationale?: string;
  binding?: { kind?: string; element_id?: string; element_ids?: string[] };
};

export function formatStepsSummary(steps: SlotStep[] | undefined): string {
  if (!steps?.length) {
    return '';
  }
  return steps
    .map((step) => {
      const parts = [step.action];
      if (step.element_id) {
        parts.push(step.element_id);
      }
      if (step.value) {
        parts.push(`"${step.value}"`);
      }
      if (step.url) {
        parts.push(step.url);
      }
      if (step.key) {
        parts.push(`key:${step.key}`);
      }
      return parts.join(' ');
    })
    .join(' → ');
}

export function formatObservablesSummary(
  observables: ObservableDef[] | undefined,
): string {
  if (!observables?.length) {
    return '';
  }
  return observables
    .map((observable) => {
      const binding = observable.binding;
      const target = binding?.element_id
        ?? (binding?.element_ids?.length ? binding.element_ids.join('+') : binding?.kind ?? '');
      return `${observable.key ?? '?'} [${observable.compare ?? '?'}] @ ${target}: ${observable.rationale ?? ''}`;
    })
    .join(' | ');
}

export function formatObservationPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload === null || payload === undefined ? '' : JSON.stringify(payload);
  }
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => `${key}=${formatPayloadValue(value)}`)
    .join('; ');
}

function formatPayloadValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (Array.isArray(value)) {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  return JSON.stringify(value);
}

export type MrQualityRow = {
  domain: string;
  generation: number;
  transformFamily: string;
  mrVersionId: string;
  transformationDescription: string;
  sourcePhaseGoal: string;
  followUpPhaseGoal: string;
  sourceStepsSummary: string;
  followUpStepsSummary: string;
  relationDescription: string;
  observablesSummary: string;
  observationValuesSource: string;
  observationValuesFollowUp: string;
  meaningful_transformation: string;
  observables_adequate: string;
  observables_extracted_correctly: string;
};

export function buildMrQualityRow(input: {
  domain: string;
  generation: number;
  transformFamily: string;
  mrVersionId: string;
  definition: Record<string, unknown> | undefined;
  explorationGoals: Record<string, unknown> | null | undefined;
  generationSlots: Record<string, unknown> | undefined;
  sourceObservationPayload: unknown;
  followUpObservationPayload: unknown;
}): MrQualityRow {
  const transformation = input.definition?.transformation as
    | { description?: string }
    | undefined;
  const relation = input.definition?.relation as { description?: string } | undefined;
  const goals = input.explorationGoals as
    | { source_phase_goal?: string; follow_up_phase_goal?: string }
    | undefined;
  const slots = input.generationSlots as
    | {
        source?: { steps?: SlotStep[] };
        follow_up?: { steps?: SlotStep[] };
        observation?: { observables?: ObservableDef[] };
      }
    | undefined;

  return {
    domain: input.domain,
    generation: input.generation,
    transformFamily: input.transformFamily,
    mrVersionId: input.mrVersionId,
    transformationDescription: transformation?.description ?? '',
    sourcePhaseGoal: goals?.source_phase_goal ?? '',
    followUpPhaseGoal: goals?.follow_up_phase_goal ?? '',
    sourceStepsSummary: formatStepsSummary(slots?.source?.steps),
    followUpStepsSummary: formatStepsSummary(slots?.follow_up?.steps),
    relationDescription: relation?.description ?? '',
    observablesSummary: formatObservablesSummary(slots?.observation?.observables),
    observationValuesSource: formatObservationPayload(input.sourceObservationPayload),
    observationValuesFollowUp: formatObservationPayload(input.followUpObservationPayload),
    meaningful_transformation: '',
    observables_adequate: '',
    observables_extracted_correctly: '',
  };
}
