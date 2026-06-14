export {
  ELEMENT_SHORT_ID_PATTERN,
  formatElementShortId,
  normalizeElementShortId,
} from './domain/element-short-id.js';

export {
  InventoryItemSchema,
  PageMetricsSchema,
  PageSnapshotInventorySchema,
  ViewportSizeSchema,
  type InventoryItem,
  type PageMetrics,
  type PageSnapshotInventory,
  type ViewportSize,
} from './domain/schemas/page-snapshot.schema.js';

export {
  RelationTypeSchema,
  MrDefinitionSchema,
  type RelationType,
  type MrDefinition,
} from './domain/schemas/mr-definition.schema.js';

export {
  SlotActionSchema,
  SlotStepSchema,
  ScenarioSlotsSchema,
  GenerationSlotsSchema,
  type SlotAction,
  type SlotStep,
  type ScenarioSlots,
  type GenerationSlots,
} from './domain/schemas/generation-slots.schema.js';

export {
  PLAYBOOK_TEMPLATE_VERSION,
  renderPlaybook,
  renderObservationSchema,
  type PlaybookRenderInput,
} from './infrastructure/templates/playbook-template.v1.js';

export {
  compilePlaybook,
  validateInventoryElementIds,
  extractHostFromUrl,
  PlaybookCompileError,
  type CompilePlaybookResult,
} from './application/compiler/playbook-compiler.js';

export {
  resolveStepTargets,
  withProbeGotoPrefix,
  compileProbeSpec,
  type CompileProbeSpecResult,
} from './application/compiler/probe-spec-compiler.js';

export {
  resolveInventoryItemTarget,
  applyResolvedTargetToStep,
  renderTargetExpression,
  resolveStepTargetExpression,
  type ResolvedInventoryTarget,
} from './application/compiler/resolve-inventory-target.js';

export {
  GOTO_WAIT_UNTIL,
  NETWORK_IDLE_WAIT_UNTIL,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_TIMEOUT_MS,
  POST_ACTION_SETTLE_MS,
  shouldStabilizeAfterAction,
  FINAL_PAGE_STABILIZATION_CODE,
  isFillableInventoryItem,
  isComboboxInventoryItem,
  renderFillCode,
  renderComboboxFillCode,
} from './application/compiler/step-execution-policy.js';

export {
  OBSERVATION_CATALOG_FIELDS,
  ObservationCatalogFieldSchema,
  OBSERVATION_FIELD_TYPES,
  buildObservationPayloadSchema,
  parseObservationCatalogFields,
  type ObservationCatalogField,
} from './domain/schemas/observation-catalog.schema.js';

export {
  MrPlanOutputSchema,
  MR_PLAN_PROMPT_VERSION,
  type MrPlanOutput,
  type MrIntent,
} from './domain/schemas/mr-plan-output.schema.js';

export {
  ExplorePlanActionSchema,
  ExplorePlanOutputSchema,
  PLAN_EXPLORE_PROMPT_VERSION,
  type ExplorePlanOutput,
} from './domain/schemas/explore-plan-output.schema.js';

export {
  ExploreVerifyVerdictSchema,
  ExploreVerifyOutputSchema,
  EXPLORE_VERIFY_PROMPT_VERSION,
  type ExploreVerifyOutput,
} from './domain/schemas/explore-verify-output.schema.js';

export {
  evaluateMr,
  validateObservationPayload,
  MrEvaluationError,
  type FieldEvaluationDetail,
  type MrEvaluationResult,
} from './application/mr-engine/mr-engine.js';
