export {
  ELEMENT_SHORT_ID_PATTERN,
  formatElementShortId,
  normalizeElementShortId,
} from './domain/element-short-id.js';

export { DEFAULT_MAX_A11Y_TREE_CHARS } from './domain/page-snapshot.constants.js';

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
  requireObservationItems,
  findObservationItem,
  observationLabelText,
} from './domain/observation-inventory.js';

export {
  RelationTypeSchema,
  TransformFamilySchema,
  MrDefinitionSchema,
  type RelationType,
  type TransformFamily,
  type MrDefinition,
} from './domain/schemas/mr-definition.schema.js';

export {
  TRANSFORM_FAMILIES,
  isTransformFamily,
  getFamilyProfile,
  applyFamilyProfile,
  isCompareAllowedForFamily,
  type FamilyProfile,
} from './domain/mr-family-profile.js';

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
  ObservableDefSchema,
  ObservableKeySchema,
  ObservableValueTypeSchema,
  ObservableCompareSchema,
  ObservationBindingSchema,
  ObservationSpecSchema,
  OBSERVATION_SPEC_SCHEMA_VERSION,
  type ObservableDef,
  type ObservableCompare,
  type ObservableValueType,
  type ObservationBinding,
  type ObservationSpec,
} from './domain/schemas/observable.schema.js';

export {
  ObserveSpecOutputSchema,
  OBSERVE_SPEC_PROMPT_VERSION,
  type ObserveSpecOutput,
} from './domain/schemas/observe-spec-output.schema.js';

export {
  resolveObservableBindingTargets,
  validateObservableBindings,
  renderObservableExtractor,
} from './application/compiler/observation-binding-compiler.js';

export {
  PLAYBOOK_TEMPLATE_VERSION,
  renderPlaybook,
  renderObservationSchema,
  type PlaybookRenderInput,
} from './infrastructure/templates/playbook-template.v1.js';

export {
  validateSelectOptionSteps,
  formatSelectOptionValidationErrors,
  type SelectOptionValidationError,
} from './application/compiler/validate-select-option-steps.js';

export { validatePlanBatch } from './application/compiler/validate-plan-batch.js';

export {
  compilePlaybook,
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
  resolveInventoryItemTargetCandidates,
  applyResolvedTargetToStep,
  renderTargetExpression,
  resolveStepTargetExpression,
  type ResolvedInventoryTarget,
} from './application/compiler/resolve-inventory-target.js';

export {
  GOTO_WAIT_UNTIL,
  NETWORK_IDLE_WAIT_UNTIL,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_LOAD_TIMEOUT_MS,
  POST_ACTION_SETTLE_MS,
  shouldStabilizeAfterAction,
  FINAL_PAGE_STABILIZATION_CODE,
  isFillableInventoryItem,
  isComboboxInventoryItem,
  resolveStepFillBehavior,
  renderFillCode,
  renderComboboxFillCode,
  type FillBehavior,
} from './application/compiler/step-execution-policy.js';

export {
  OBSERVATION_CATALOG_FIELDS,
  ObservationCatalogFieldSchema,
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

export {
  ObservationAnchorOutputSchema,
  OBSERVATION_ANCHOR_PROMPT_VERSION,
  MIN_RESULT_LABEL_ELEMENT_AREA_PX,
  type ObservationAnchorOutput,
} from './domain/schemas/observation-anchor-output.schema.js';

export {
  parseLocalizedNumbers,
  parseLocalizedNumberToken,
  pickNumberAtIndex,
  PARSE_LOCALIZED_NUMBERS_FN_SOURCE,
} from './domain/parse-localized-numbers.js';
