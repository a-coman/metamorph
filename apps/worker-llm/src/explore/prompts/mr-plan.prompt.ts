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
    '- exploration.source_phase_goal: what the source Playwright scenario must achieve.',
    '- exploration.follow_up_phase_goal: independent replay from homepage, rebuild source state, repeat filter once.',
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
            'Reach a search results or filtered listing page with the search/filter query applied.',
          follow_up_phase_goal:
            'From the homepage, rebuild the path to the same filtered results state as source, then repeat the filter action once to test idempotence.',
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
