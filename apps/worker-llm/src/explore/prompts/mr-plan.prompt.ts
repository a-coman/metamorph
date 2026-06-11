import {
  MR_PLAN_OPTIONS,
  OBSERVATION_FIELD_SEMANTICS,
  RELATION_TYPE_SEMANTICS,
  TRANSFORM_FAMILY_SEMANTICS,
} from './mr-vertical.config.js';

const MR_PLAN_EXAMPLE = {
  mr_definition: {
    precondition: {
      description: 'Usuario en homepage de Amazon',
    },
    transformation: {
      transform_family: 'idempotence',
      description: "Repetir la búsqueda de 'portátil' en la página de resultados",
    },
    relation: {
      type: 'equal',
      on: ['applied_query', 'results_url'],
      description:
        'La query y la URL de resultados se mantienen tras repetir la búsqueda',
    },
  },
  exploration: {
    source_phase_goal:
      'From homepage (fresh context): dismiss cookies if visible, search for portátil, reach /s?k=portatil with results grid visible.',
    follow_up_phase_goal:
      'From homepage (fresh context): dismiss cookies if needed, rebuild the same search path to reach /s?k=portatil, then repeat the search submit once.',
  },
};

function buildAllowedValuesSection(): string {
  const { transformFamilies, relationTypes, observationFields } = MR_PLAN_OPTIONS;

  return [
    'Allowed values (pick ONLY from these - at least one):',
    `- transformation.transform_family: ${transformFamilies.join(' | ')}`,
    `- relation.type: ${relationTypes.join(' | ')}`,
    `- relation.on: ${observationFields.join(', ')} (note that this is an array of strings - and cannot be empty)`,
  ].join('\n');
}

function buildSemanticsSection(): string {
  const transformLines = MR_PLAN_OPTIONS.transformFamilies.map(
    (family) => `- ${family}: ${TRANSFORM_FAMILY_SEMANTICS[family]}`,
  );
  const relationLines = MR_PLAN_OPTIONS.relationTypes.map(
    (type) => `- ${type}: ${RELATION_TYPE_SEMANTICS[type]}`,
  );
  const fieldLines = MR_PLAN_OPTIONS.observationFields.map(
    (field) => `- ${field}: ${OBSERVATION_FIELD_SEMANTICS[field]}`,
  );

  return [
    'Our definitions of the concepts mentioned above:',
    'Transform families:',
    ...transformLines,
    'Relation types:',
    ...relationLines,
    'Observation fields:',
    ...fieldLines,
  ].join('\n');
}

export function buildMrPlanSystemPrompt(): string {
  return [
    'You plan a metamorphic testing relation (MR) and exploration goals for a web application.',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "mr_definition": {',
    '    "precondition": { "description": string },',
    '    "transformation": {',
    '      "transform_family": string,',
    '      "description": string',
    '    },',
    '    "relation": {',
    '      "type": string,',
    '      "on": string[],',
    '      "description": string',
    '    }',
    '  },',
    '  "exploration": {',
    '    "source_phase_goal": string,',
    '    "follow_up_phase_goal": string',
    '  }',
    '}',
    '',
    buildAllowedValuesSection(),
    '',
    buildSemanticsSection(),
    '',
    'Rules:',
    '- Every enum field must use exactly one of the allowed values listed above; do not invent new values.',
    '- Align mr_definition and exploration phase goals with the Semantics section for the chosen transform_family and relation.type.',
    '- mr_definition.precondition, transformation, and relation MUST be objects, not strings.',
    '- Exploration goals must be achievable on this page without login; dismiss cookie banners or modals if visible in the screenshot.',
    '- Phase goals must be concrete and verifiable: describe the end state (URL signals, visible UI such as results/listings grid) and what each phase must achieve.',
    '- Each phase (source and follow_up) is an independent Playwright scenario from the homepage with a new browser context; goals must not assume shared session or page state between phases.',
    '- source_phase_goal: what the source scenario achieves from a fresh context (homepage → target end state).',
    '- follow_up_phase_goal: what the follow_up scenario achieves from another fresh context; if it must rebuild the source path and/or apply the transformation, state that explicitly in the goal.',
    'Example:',
    JSON.stringify(MR_PLAN_EXAMPLE, null, 2),
  ].join('\n');
}

export function buildMrPlanUserText(input: { url: string }): string {
  return [
    `Target URL: ${input.url}`,
    '',
    'Attached: screenshot of the page (homepage after initial load).',
    '',
    'Propose the MR definition and exploration phase goals for this page.',
  ].join('\n');
}
