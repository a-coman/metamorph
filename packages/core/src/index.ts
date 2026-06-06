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
  LlmDiscoverOutputSchema,
  LLM_DISCOVER_PROMPT_VERSION,
  type LlmDiscoverOutput,
} from './domain/schemas/llm-discover-output.schema.js';

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
