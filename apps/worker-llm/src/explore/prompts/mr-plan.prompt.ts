import {
  getFamilyPlanProfile,
  MR_PLAN_OPTIONS,
  COMPARE_OPERATOR_SEMANTICS,
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
        on: [],
        description:
          'Search terms, results URL, and result count stay the same after repeating the search',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage (fresh context): dismiss cookies if visible, search for laptop, reach /s?k=laptop with results grid visible.',
      follow_up_phase_goal:
        'From homepage (fresh context): dismiss cookies if needed, rebuild the same search path to reach /s?k=laptop, then repeat the search submit once.',
    },
    observation_intents: [
      'search query unchanged',
      'results URL unchanged',
      'result count unchanged',
    ],
  },
  subset: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'subset',
        description: 'Apply an additional filter on laptop results',
      },
      relation: {
        on: [],
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
    observation_intents: [
      'search query stable',
      'reported result count does not increase',
    ],
  },
  permutation: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'permutation',
        description: 'Apply two independent filters in different order',
      },
      relation: {
        on: [],
        description: 'Same query, filters, and URL regardless of filter order',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage: search laptop, apply filter A then filter B.',
      follow_up_phase_goal:
        'From homepage: search laptop, apply filter B then filter A.',
    },
    observation_intents: ['active filters equal', 'results URL equal'],
  },
  inverse: {
    mr_definition: {
      precondition: { description: 'User on Amazon homepage' },
      transformation: {
        transform_family: 'inverse',
        description: 'Apply a filter then remove it',
      },
      relation: {
        on: [],
        description: 'After undoing the filter, state matches source',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage: search laptop and apply one filter.',
      follow_up_phase_goal:
        'From homepage: rebuild search, apply same filter, then remove it.',
    },
    observation_intents: ['query and URL restored after undo'],
  },
};

function buildAllowedValuesSection(transformFamily: TransformFamily): string {
  const profile = getFamilyPlanProfile(transformFamily);

  return [
    'Fixed profile for this explore job (do NOT change these):',
    `- transformation.transform_family: ${transformFamily}`,
    `- Allowed compare operators at observe_spec (not in this response): ${profile.allowedCompares.join(', ')}`,
    '',
    'Observation intent hints for this family:',
    ...profile.observationIntentHints.map((hint) => `- ${hint}`),
  ].join('\n');
}

function buildSemanticsSection(): string {
  const transformLines = MR_PLAN_OPTIONS.transformFamilies.map(
    (family) => `- ${family}: ${TRANSFORM_FAMILY_SEMANTICS[family]}`,
  );
  const compareLines = MR_PLAN_OPTIONS.compareOperators.map(
    (op) => `- ${op}: ${COMPARE_OPERATOR_SEMANTICS[op]}`,
  );

  return [
    'Our definitions:',
    'Transform families:',
    ...transformLines,
    'Compare operators (chosen per observable later at observe_spec):',
    ...compareLines,
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
    '      "on": [],',
    '      "description": string',
    '    }',
    '  },',
    '  "exploration": {',
    '    "source_phase_goal": string,',
    '    "follow_up_phase_goal": string',
    '  },',
    '  "observation_intents": string[]',
    '}',
    '',
    buildAllowedValuesSection(transformFamily),
    '',
    buildSemanticsSection(),
    '',
    'Rules:',
    `- This explore job is locked to transform_family=${transformFamily}.`,
    '- relation.on MUST be an empty array []; concrete observables are defined later at observe_spec.',
    '- observation_intents lists semantic hints for what should be measured (no element_ids).',
    '- MR relation and exploration goals are generic and element-agnostic.',
    '- Focus on concrete, verifiable transformation.description and exploration phase goals.',
    '- mr_definition.precondition, transformation, and relation MUST be objects, not strings.',
    '- Exploration goals must be achievable without login; dismiss cookie banners if visible.',
    '- Each phase is an independent Playwright scenario from the homepage with a new browser context.',
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
    'Propose the MR definition, exploration phase goals, and observation_intents.',
    'Example for this family:',
    JSON.stringify(MR_PLAN_EXAMPLES[input.transformFamily], null, 2),
  ].join('\n');
}
