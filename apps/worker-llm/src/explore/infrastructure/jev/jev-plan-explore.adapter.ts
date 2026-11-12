import {
  isFillableInventoryItem,
  type ExplorePlanOutput,
  type InventoryItem,
  type MrIntent,
} from '@metamorph/core';
import type { PlanExploreInput, PlanExplorePort } from '../../application/ports/plan-explore.port.js';
import type { ExploreLlmResult } from '../openrouter/explore-openrouter.client.js';
import { ExploreOpenRouterClient } from '../openrouter/explore-openrouter.client.js';
import {
  ExploreLlmCallError,
  ExploreLlmValidationError,
} from '../openrouter/explore-llm-validation.error.js';
import { logExploreLlmExchange } from '../openrouter/explore-llm-logger.js';
import { assemblePlanExplore, JevPlanAssemblyError } from './assemble-plan-explore.js';
import {
  JEV_NOUL_OVERLAY,
  NONE_CHOICE,
  PLAN_EXPLORE_FILL_PROMPT_VERSION,
  PLAN_EXPLORE_JEV_PROMPT_VERSION,
} from './jev-plan-explore.constants.js';
import {
  OpenRouterDecisionsClient,
  asChoiceAnswer,
  asNoulAnswer,
  readUsageTokens,
  type DecisionsResponse,
} from './openrouter-decisions.client.js';
import {
  buildPlanExploreJevRequest,
  buildSelectOptionQuestions,
  buildSelectOptionState,
  extractSourceQuery,
  isSearchishItem,
  isSelectOptionInventoryItem,
  itemCriteriaLine,
} from './plan-explore-questions.js';
import { itemDisplayName, itemRoleLabel } from './synthesize-plan-rationale.js';

export class JevPlanExploreAdapter implements PlanExplorePort {
  readonly needsVision = false;

  constructor(
    private readonly openRouter: ExploreOpenRouterClient,
    private readonly decisions: OpenRouterDecisionsClient = new OpenRouterDecisionsClient(),
  ) {}

  getModel(): string {
    return this.decisions.getModel();
  }

  getPromptVersion(): string {
    return PLAN_EXPLORE_JEV_PROMPT_VERSION;
  }

  async planNext(input: PlanExploreInput): Promise<ExploreLlmResult<ExplorePlanOutput>> {
    const startedAt = Date.now();
    const { state, questions } = buildPlanExploreJevRequest({
      url: input.url,
      phase: input.phase,
      mrIntent: input.mrIntent,
      inventory: input.inventory,
      batchLog: input.batchLog,
      sourceReference: input.sourceReference,
    });
    const systemPrompt = JSON.stringify(questions);
    const userPrompt = JSON.stringify(state);
    const promptAudit = {
      systemPrompt,
      userPrompt,
      userPromptImages: null,
    };

    const tokens = { in: 0, out: 0, sawUsage: false };
    const debug: Record<string, unknown> = { questions };

    try {
      const decision = await this.decisions.decide({ state, questions });
      addUsage(tokens, decision);
      debug.decision = decision;

      const answers = decision.answers;
      const overlayNoul = asNoulAnswer(answers, 'overlay_present')?.noul ?? 0;
      const overlayId = asChoiceAnswer(answers, 'overlay_target')?.choice;
      const dismissingOverlay =
        overlayNoul >= JEV_NOUL_OVERLAY &&
        Boolean(overlayId) &&
        overlayId !== NONE_CHOICE;

      const nextId = asChoiceAnswer(answers, 'next_control')?.choice;
      const targetId = dismissingOverlay ? overlayId : nextId;
      const item = targetId
        ? input.inventory.items.find((entry) => entry.shortId === targetId)
        : undefined;

      let fillResult: ExploreLlmResult<{ value: string }> | undefined;
      let selectDecision: DecisionsResponse | undefined;
      let fillValue: string | undefined;
      let selectValue: string | undefined;

      const needsFill =
        !dismissingOverlay && Boolean(item) && isFillableInventoryItem(item!);
      if (needsFill && item) {
        const pinned =
          input.phase === 'follow_up' && isSearchishItem(item)
            ? extractSourceQuery(input)
            : null;
        if (pinned) {
          fillValue = pinned;
          debug.fill = { pinned: true, value: fillValue };
        } else {
          fillResult = await this.openRouter.fillPlanValue({
            promptVersion: PLAN_EXPLORE_FILL_PROMPT_VERSION,
            system: buildFillSystemPrompt(),
            userText: buildFillUserPrompt({
              mrIntent: input.mrIntent,
              phase: input.phase,
              item,
              sourceQuery: extractSourceQuery(input),
            }),
          });
          addNumericUsage(tokens, fillResult.audit.tokensIn, fillResult.audit.tokensOut);
          fillValue = fillResult.output.value;
          debug.fill = {
            model: fillResult.audit.model,
            value: fillValue,
            tokensIn: fillResult.audit.tokensIn,
            tokensOut: fillResult.audit.tokensOut,
          };
        }
      }

      const needsSelect =
        !dismissingOverlay && Boolean(item) && isSelectOptionInventoryItem(item!);
      if (needsSelect && item) {
        const optionQuestions = buildSelectOptionQuestions(item);
        const optionState = buildSelectOptionState(item, state);
        selectDecision = await this.decisions.decide({
          state: optionState,
          questions: optionQuestions,
        });
        addUsage(tokens, selectDecision);
        selectValue = asChoiceAnswer(selectDecision.answers, 'select_value')?.choice;
        debug.select = selectDecision;
      }

      const inventoryById = new Map(
        input.inventory.items.map((entry) => [entry.shortId, entry]),
      );
      const nextStepId =
        (Array.isArray(input.validatedSteps[input.phase])
          ? input.validatedSteps[input.phase].length
          : 0) + 1;

      const output = assemblePlanExplore({
        answers,
        inventoryById,
        nextStepId,
        fillValue,
        selectValue,
      });

      const latencyMs = Date.now() - startedAt;
      logExploreLlmExchange({
        purpose: 'plan_explore',
        promptVersion: PLAN_EXPLORE_JEV_PROMPT_VERSION,
        model: this.getModel(),
        userText: userPrompt,
        system: systemPrompt,
        screenshotCount: 0,
        latencyMs,
        tokensIn: tokens.sawUsage ? tokens.in : null,
        tokensOut: tokens.sawUsage ? tokens.out : null,
        output,
      });

      return {
        output,
        audit: {
          purpose: 'plan_explore',
          model: this.getModel(),
          promptVersion: PLAN_EXPLORE_JEV_PROMPT_VERSION,
          tokensIn: tokens.sawUsage ? tokens.in : null,
          tokensOut: tokens.sawUsage ? tokens.out : null,
          latencyMs,
          ...promptAudit,
        },
        debugJson: debug,
      };
    } catch (error) {
      if (error instanceof ExploreLlmValidationError || error instanceof ExploreLlmCallError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Jev plan_explore error';
      if (error instanceof JevPlanAssemblyError) {
        throw new ExploreLlmValidationError(message, debug, debug, promptAudit);
      }

      throw new ExploreLlmCallError(message, promptAudit, error);
    }
  }
}

function addUsage(
  tokens: { in: number; out: number; sawUsage: boolean },
  source: Pick<DecisionsResponse, 'usage'>,
): void {
  const usage = readUsageTokens(source.usage);
  addNumericUsage(tokens, usage.tokensIn, usage.tokensOut);
}

function addNumericUsage(
  tokens: { in: number; out: number; sawUsage: boolean },
  tokensIn: number | null,
  tokensOut: number | null,
): void {
  if (tokensIn !== null) {
    tokens.in += tokensIn;
    tokens.sawUsage = true;
  }
  if (tokensOut !== null) {
    tokens.out += tokensOut;
    tokens.sawUsage = true;
  }
}

function buildFillSystemPrompt(): string {
  return [
    'You pick the literal text to type into a web form field during metamorphic testing exploration.',
    'Return ONLY JSON matching {"value": string}.',
    'If Source query is set and the field is the site search box, reuse that query exactly.',
    'Prefer a short, stable query in the site language when the phase goal does not name a specific value.',
    'Do not add explanation keys.',
  ].join('\n');
}

function buildFillUserPrompt(input: {
  mrIntent: MrIntent;
  phase: PlanExploreInput['phase'];
  item: InventoryItem | undefined;
  sourceQuery: string | null;
}): string {
  const phaseGoal =
    input.phase === 'source'
      ? input.mrIntent.exploration.source_phase_goal
      : input.mrIntent.exploration.follow_up_phase_goal;
  const target = input.item
    ? `${input.item.shortId} ${itemRoleLabel(input.item)} ${JSON.stringify(itemDisplayName(input.item))} (${itemCriteriaLine(input.item)})`
    : 'unknown fillable field';

  return [
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    `Target: ${target}`,
    `Source query: ${input.sourceQuery ?? '(none)'}`,
  ].join('\n');
}
