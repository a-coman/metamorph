import {
  getFamilyPlanProfile,
  MR_PLAN_OPTIONS,
  OBSERVATION_FIELD_SEMANTICS,
  RELATION_TYPE_SEMANTICS,
  TRANSFORM_FAMILY_SEMANTICS,
} from './mr-vertical.config.js';
import type { TransformFamily } from '@metamorph/core';

const MR_PLAN_EXAMPLES: Record<TransformFamily, object> = {
  idempotence: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'idempotence',
        description: "Repeat the 'laptop' search on the results page",
      },
      relation: {
        type: 'equal',
        on: ['applied_query', 'results_url'],
        description:
          'The query and results URL are preserved after repeating the search',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage (fresh context): dismiss cookies if visible, search for laptop, reach /s?k=laptop with results grid visible.',
      follow_up_phase_goal:
        'From homepage (fresh context): dismiss cookies if needed, rebuild the same search path to reach /s?k=laptop, then repeat the search submit once.',
    },
  },
  inclusion: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'inclusion',
        description: 'Apply an additional filter on laptop results',
      },
      relation: {
        type: 'cardinality_lte',
        on: ['applied_query', 'reported_total_results'],
        description:
          'The base query is preserved and the reported total result count does not increase',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage: search laptop and reach results page with a visible result count label.',
      follow_up_phase_goal:
        'From homepage: rebuild search to same results, then apply one extra filter (e.g. Prime).',
    },
  },
  permutation: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'permutation',
        description: 'Apply two independent filters in different order',
      },
      relation: {
        type: 'equal',
        on: ['applied_query', 'results_url'],
        description: 'Same query and normalized URL regardless of filter order',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage: search laptop, apply filter A then filter B.',
      follow_up_phase_goal:
        'From homepage: search laptop, apply filter B then filter A.',
    },
  },
  inverse: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'inverse',
        description: 'Apply a filter then remove it',
      },
      relation: {
        type: 'equal',
        on: ['applied_query', 'results_url'],
        description: 'After undoing the filter, query and URL match source',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage: search laptop and apply one filter.',
      follow_up_phase_goal:
        'From homepage: rebuild search, apply same filter, then remove it.',
    },
  },
};

function buildAllowedValuesSection(transformFamily: TransformFamily): string {
  const profile = getFamilyPlanProfile(transformFamily);

  return [
    'Fixed profile for this explore job (do NOT change these):',
    `- transformation.transform_family: ${transformFamily}`,
    `- relation.type: ${profile.relationType}`,
    `- relation.on: ${profile.observationFields.join(', ')} (observation-catalog keys — generic, not DOM element_ids)`,
    '',
    'Other allowed observation fields in catalog:',
    `- ${MR_PLAN_OPTIONS.observationFields.join(', ')}`,
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

export function buildMrPlanSystemPrompt(transformFamily: TransformFamily): string {
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
    buildAllowedValuesSection(transformFamily),
    '',
    buildSemanticsSection(),
    '',
    'Rules:',
    `- This explore job is locked to transform_family=${transformFamily}.`,
    '- relation.type and relation.on MUST match the fixed profile above exactly.',
    '- relation.on MUST list observation-catalog field names only — never element_id, CSS selectors, or DOM labels.',
    '- MR relation and exploration goals are generic and element-agnostic; exploration later picks concrete UI controls from per-snapshot inventory.',
    '- Focus on concrete, verifiable transformation.description and exploration phase goals for this page (concrete = observable end state, not inventory shortIds).',
    '- Describe transformations and phase goals by user intent and page signals (URL patterns, results grid, filter applied), not by specific button or field names unless needed to disambiguate on this site.',
    '- mr_definition.precondition, transformation, and relation MUST be objects, not strings.',
    '- Exploration goals must be achievable on this page without login; dismiss cookie banners or modals if visible in the screenshot.',
    '- Phase goals must be concrete and verifiable: describe the end state (URL signals, visible UI such as results/listings grid) and what each phase must achieve.',
    '- Each phase (source and follow_up) is an independent Playwright scenario from the homepage with a new browser context; goals must not assume shared session or page state between phases.',
    '- Write all descriptions and phase goals in English.',
  ].join('\n');
}

export function buildMrPlanUserText(input: {
  url: string;
  transformFamily: TransformFamily;
}): string {
  return [
    `Target URL: ${input.url}`,
    `Transform family (fixed): ${input.transformFamily}`,
    '',
    'Attached: screenshot of the page (homepage after initial load).',
    '',
    'Propose the MR definition and exploration phase goals for this page.',
    'Write generic, element-agnostic goals; exploration will bind them to concrete controls visible in each snapshot.',
    'Example for this family:',
    JSON.stringify(MR_PLAN_EXAMPLES[input.transformFamily], null, 2),
  ].join('\n');
}
