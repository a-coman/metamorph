import type { PageSnapshotInventory } from '@metamorph/core';
import { MR_VERTICAL_CATALOG, MR_VERTICAL_RULES, MR_VERTICAL_TRANSFORM_FAMILY } from './mr-vertical.config.js';
import { buildInventorySummary } from './inventory-summary.js';

export function buildMrPlanSystemPrompt(): string {
  return [
    'You plan a metamorphic testing relation (MR) and exploration goals for a web application.',
    'Return ONLY valid JSON matching this exact shape (no markdown, no extra keys):',
    '{',
    '  "mr_definition": {',
    '    "precondition": { "description": string },',
    '    "transformation": {',
    `      "transform_family": "${MR_VERTICAL_TRANSFORM_FAMILY}",`,
    '      "description": string',
    '    },',
    '    "relation": {',
    '      "type": "equal",',
    `      "on": [${MR_VERTICAL_CATALOG.map((f) => `"${f}"`).join(' | ')}],`,
    '      "description": string',
    '    }',
    '  },',
    '  "exploration": {',
    '    "source_phase_goal": string,',
    '    "follow_up_phase_goal": string',
    '  }',
    '}',
    '',
    'Rules:',
    ...MR_VERTICAL_RULES.map((rule) => `- ${rule}`),
    '- mr_definition.precondition and mr_definition.transformation MUST be objects, not strings.',
    '- mr_definition.relation MUST be an object with type/on/description, not a string.',
    '- exploration.source_phase_goal: what the source Playwright scenario must achieve (dismiss cookie banner if present, then reach search results with query applied).',
    '- exploration.follow_up_phase_goal: independent replay from homepage, dismiss cookies again if needed, rebuild source state, repeat filter/search once.',
    '- Keep goals simple: homepage → search results with a query; do not require login or advanced sidebar filters.',
    'Example:',
    JSON.stringify(
      {
        mr_definition: {
          precondition: {
            description:
              'User is on a search results page with a query already applied.',
          },
          transformation: {
            transform_family: MR_VERTICAL_TRANSFORM_FAMILY,
            description:
              'Repeat the same search/filter action on the results page.',
          },
          relation: {
            type: 'equal',
            on: ['applied_query', 'results_url'],
            description:
              'The applied query and results URL stay the same after repeating the search.',
          },
        },
        exploration: {
          source_phase_goal:
            'Dismiss cookie consent if visible, search from the homepage, and reach a results page with the query applied (URL contains search params, product grid visible).',
          follow_up_phase_goal:
            'From the homepage, dismiss cookies if needed, rebuild the same search path as source to reach matching results, then repeat the search submit once to test idempotence.',
        },
      },
      null,
      2,
    ),
  ].join('\n');
}

export function buildMrPlanUserText(input: {
  url: string;
  inventory: PageSnapshotInventory;
}): string {
  return [
    `Target URL: ${input.url}`,
    '',
    'Page inventory (element labels are overlaid on the annotated screenshot, not this raw image):',
    buildInventorySummary(input.inventory),
    '',
    'Propose the MR definition and exploration phase goals for idempotence testing on this page.',
  ].join('\n');
}
