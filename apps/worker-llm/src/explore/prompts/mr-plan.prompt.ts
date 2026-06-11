import { MR_PLAN_OPTIONS } from './mr-vertical.config.js';

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
      'Dismiss cookies, buscar desde homepage, llegar a /s?k=portatil con grid visible',
    follow_up_phase_goal:
      'Desde homepage, reconstruir el mismo camino, repetir el submit de búsqueda una vez',
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
    'Rules:',
    '- Every enum field must use exactly one of the allowed values listed above; do not invent new values.',
    '- mr_definition.precondition, transformation, and relation MUST be objects, not strings.',
    '- Exploration goals must be achievable on this page without login; dismiss cookie banners or modals if visible in the screenshot.',
    '- Phase goals must be concrete and verifiable: describe the end state (URL signals, visible UI such as results/listings grid) and what each phase must achieve.',
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
