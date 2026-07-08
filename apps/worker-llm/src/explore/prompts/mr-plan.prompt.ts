import {
  getFamilyProfile,
  type TransformFamily,
  COMPARE_OPERATOR_SEMANTICS,
} from '@metamorph/core';

const TRANSFORM_FAMILY_SEMANTICS = {
  idempotence:
    'Apply an action once to reach an intermediate state P (source). Apply the same action again on P (the transformation). ' +
    'The observable outcome should not change. ' +
    'source_phase_goal: from a fresh context, reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply the transformation (P) once more. Note that is NOT merely re-running the same scenario as source — it must include the extra transformation step after reaching P.',
  subset:
    'From a base results state P (source), apply an additional filter or restriction (F) in follow_up. ' +
    'The total result count reported by the site (result info label) should not increase. ' +
    'source_phase_goal: from a fresh context, reach unfiltered search results P with a visible results summary label. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply one filter (F).',
  permutation:
    'Apply two independent actions (e.g. filters) in different orders. The final observable state should be the same. ' +
    'source_phase_goal: from a fresh context, apply action A then action B to reach state P. ' +
    'follow_up_phase_goal: from another fresh context, apply action B then action A.',
  inverse:
    'Apply a transformation T to reach state P (source). In follow_up, reach P and apply the inverse T-1 (undo, clear filter, back). ' +
    'The final state should match source. ' +
    'source_phase_goal: from a fresh context, apply T to reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then undo T with T-1.',
} satisfies Record<TransformFamily, string>;

const MR_PLAN_EXAMPLES: Record<TransformFamily, object> = {
  idempotence: {
    mr_definition: {
      precondition: { description: 'User on homepage' },
      transformation: {
        transform_family: 'idempotence',
        description: "Repeat the search query on the results page",
      },
      relation: {
        on: [],
        description:
          'Search terms, results URL, and result count stay the same after repeating the search',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage (fresh context): dismiss cookies if visible, search for a query to reach a results grid visible.',
      follow_up_phase_goal:
        'From homepage (fresh context): dismiss cookies if needed, rebuild the same search path to reach the same results grid, then repeat the search submit again.',
    },
    observation_intents: [
      'search query unchanged',
      'results URL unchanged',
      'result count unchanged',
    ],
  },
  subset: {
    mr_definition: {
      precondition: { description: 'User on homepage' },
      transformation: {
        transform_family: 'subset',
        description: 'Apply an additional filter on results grid',
      },
      relation: {
        on: [],
        description:
          'The base query is preserved and the reported total result count does not increase',
      },
    },
    exploration: {
      source_phase_goal:
        'From homepage, search for a query and reach results page with a visible result count label.',
      follow_up_phase_goal:
        'From homepage, rebuild the same search query to the same results grid, then apply one filter.',
    },
    observation_intents: [
      'search query stable',
      'reported result count does not increase',
    ],
  },
  permutation: {
    mr_definition: {
      precondition: { description: 'User on homepage' },
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
        'From homepage, search for a query, arrive to a results grid and apply filter A then filter B.',
      follow_up_phase_goal:
        'From homepage, search for the same query, arrive to the same results grid and apply filter B then filter A.',
    },
    observation_intents: ['active filters equal', 'results URL equal'],
  },
  inverse: {
    mr_definition: {
      precondition: { description: 'User on homepage' },
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
        'From homepage, search for a query and apply one filter.',
      follow_up_phase_goal:
        'From homepage, rebuild the same search query to the same results grid, then apply the same filter again, then remove it.',
    },
    observation_intents: ['query and URL restored after undo'],
  },
};

function buildFamilyProfileSection(transformFamily: TransformFamily): string {
  const profile = getFamilyProfile(transformFamily);
  const compareLines = profile.allowedCompares.map(
    (op) => `- ${op}: ${COMPARE_OPERATOR_SEMANTICS[op]}`,
  );

  return [
    '<family_profile>',
    `This explore job is locked to transform_family=${transformFamily}.`,
    '',
    'Family semantics:',
    TRANSFORM_FAMILY_SEMANTICS[transformFamily],
    '',
    'Compare operators at observe_spec (not in your JSON; chosen per observable later):',
    ...compareLines,
    '',
    'Observation intent hints:',
    ...profile.observationIntentHints.map((hint) => `- ${hint}`),
    '</family_profile>',
  ].join('\n');
}

export function buildMrPlanSystemPrompt(transformFamily: TransformFamily): string {
  return [
    'You plan a metamorphic testing relation (MR) and exploration goals for a web application.',
    '<output_format>',
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
    '</output_format>',
    '',
    buildFamilyProfileSection(transformFamily),
    '',
    '<rules>',
    `- This explore job is locked to transform_family=${transformFamily}.`,
    '- relation.on MUST be an empty array []; concrete observables are defined at a later stage.',
    '- observation_intents lists semantic hints for what should be measured (no element_ids).',
    '- MR relation and exploration goals are generic and element-agnostic.',
    '- Focus on concrete, verifiable transformation.description and exploration phase goals.',
    '- mr_definition.precondition, transformation, and relation MUST be objects, not strings.',
    '- Exploration goals must be achievable without login; dismiss cookie banners if visible.',
    '- Each phase is an independent Playwright scenario from the homepage with a new browser context.',
    '- Write all descriptions and phase goals in English.',
    '</rules>',
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
