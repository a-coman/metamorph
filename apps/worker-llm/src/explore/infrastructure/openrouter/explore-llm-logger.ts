type ExploreLlmLogInput = {
  purpose: string;
  promptVersion: string;
  model: string;
  userText: string;
  system: string;
  screenshotCount: number;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  output?: unknown;
  validationError?: string;
};

const INDENT = '  ';
const SECTION = '▸';

export function isExploreLlmLoggingEnabled(): boolean {
  return process.env.EXPLORE_LLM_LOG_PROMPTS !== 'false';
}

function isVerbose(): boolean {
  return process.env.EXPLORE_LLM_LOG_VERBOSE === 'true';
}

function truncate(value: string, max = 88): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function logSection(title: string, lines: string[]): void {
  if (lines.length === 0) {
    return;
  }

  console.log(`${SECTION} ${title}`);
  for (const line of lines) {
    console.log(`${INDENT}${line}`);
  }
}

function extractLine(userText: string, label: string): string | undefined {
  const match = userText.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim();
}

function extractBlock(userText: string, header: string): string | undefined {
  const start = userText.indexOf(header);
  if (start < 0) {
    return undefined;
  }

  const contentStart = start + header.length;
  const rest = userText.slice(contentStart).replace(/^\s*\n/, '');
  const nextHeader = rest.search(/\n[A-Z][^\n]{2,}:\n|\n[A-Z][^\n]{2,} \(|\nDoes the /);

  if (nextHeader < 0) {
    return rest.trim() || undefined;
  }

  return rest.slice(0, nextHeader).trim() || undefined;
}

function extractJsonAfterHeader(userText: string, header: string): unknown {
  const block = extractBlock(userText, `${header}\n`);
  if (!block) {
    return undefined;
  }

  try {
    return JSON.parse(block);
  } catch {
    return undefined;
  }
}

function summarizeStep(step: unknown, index?: number): string {
  if (!step || typeof step !== 'object') {
    return typeof index === 'number' ? `${index + 1}. ?` : '?';
  }

  const record = step as Record<string, unknown>;
  const action = String(record.action ?? '?');
  const elementId =
    typeof record.element_id === 'string' ? record.element_id : undefined;
  const value = typeof record.value === 'string' ? record.value : undefined;
  const key = typeof record.key === 'string' ? record.key : undefined;
  const url = typeof record.url === 'string' ? record.url : undefined;

  let rendered: string;
  switch (action) {
    case 'fill':
      rendered = elementId
        ? `fill ${elementId} ← "${truncate(value ?? '', 32)}"`
        : `fill ← "${truncate(value ?? '', 32)}"`;
      break;
    case 'click':
      rendered = elementId ? `click ${elementId}` : 'click ?';
      break;
    case 'press':
      rendered = `press ${key ?? 'Enter'}`;
      break;
    case 'goto':
      rendered = url ? `goto ${truncate(url, 56)}` : 'goto ?';
      break;
    case 'waitFor':
      rendered = `wait ${record.timeout_ms ?? 2000}ms`;
      break;
    case 'scroll':
      rendered = `scroll y=${record.scroll_y ?? 500}`;
      break;
    case 'selectOption':
      rendered = elementId
        ? `select ${elementId} ← "${truncate(value ?? '', 24)}"`
        : 'select ?';
      break;
    default:
      rendered = action;
  }

  return typeof index === 'number' ? `${index + 1}. ${rendered}` : rendered;
}

function formatStepsList(steps: unknown, label: string): string[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [`${label}: (empty)`];
  }

  return [`${label} (${steps.length}):`, ...steps.map((step, i) => summarizeStep(step, i))];
}

function summarizeInventoryBlock(block: string | undefined, label: string): string[] {
  if (!block) {
    return [];
  }

  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [`${label}: (empty)`];
  }

  const preview = lines.slice(0, 6);
  const linesOut = [`${label} (${lines.length} elements):`, ...preview.map((l) => `· ${l}`)];

  if (lines.length > preview.length) {
    linesOut.push(`· … +${lines.length - preview.length} more`);
  }

  return linesOut;
}

function formatSystemPrompt(system: string): string[] {
  const lines: string[] = [];
  const rawLines = system.split('\n').map((l) => l.trimEnd());

  let inExample = false;
  let inRules = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed === 'Example:' || trimmed.startsWith('Example:')) {
      inExample = true;
      lines.push('example: idempotence MR JSON template (omitted)');
      continue;
    }

    if (inExample) {
      if (trimmed.startsWith('{') || trimmed.startsWith('}') || trimmed.startsWith('"')) {
        continue;
      }
      inExample = false;
    }

    if (trimmed.startsWith('Return ONLY valid JSON')) {
      lines.push(`output_schema: ${truncate(trimmed.replace('Return ONLY valid JSON: ', ''), 100)}`);
      continue;
    }

    if (trimmed === 'Rules:' || trimmed === 'Verdict rules (read carefully):') {
      inRules = true;
      lines.push('rules:');
      continue;
    }

    if (trimmed.startsWith('IMPORTANT:')) {
      inRules = false;
      lines.push(`important: ${truncate(trimmed.replace('IMPORTANT: ', ''), 100)}`);
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const rule = trimmed.slice(2);
      if (inRules || rule.includes(':')) {
        lines.push(`  • ${truncate(rule, 100)}`);
      } else {
        lines.push(`  • ${truncate(rule, 100)}`);
      }
      continue;
    }

    if (!inRules && lines.length === 0) {
      lines.push(`task: ${truncate(trimmed, 100)}`);
      continue;
    }

    if (!inRules) {
      lines.push(truncate(trimmed, 100));
    }
  }

  return lines;
}

function formatUserPrompt(userText: string, screenshotCount: number): string[] {
  const lines: string[] = [];

  const scalarFields: Array<[string, string | undefined]> = [
    ['session_url', extractLine(userText, 'Session URL') ?? extractLine(userText, 'Target URL')],
    ['url_after', extractLine(userText, 'URL after probe')],
    ['phase', extractLine(userText, 'Phase')],
    ['phase_goal', extractLine(userText, 'Phase goal')],
    [
      'source_end_url',
      extractLine(userText, 'Source end URL (target state to reach before repeating filter):') ??
        extractLine(userText, 'Source end URL (target state):'),
    ],
    ['probe_error', extractLine(userText, 'Last probe error') ?? extractLine(userText, 'Probe error')],
  ];

  for (const [key, value] of scalarFields) {
    if (value) {
      lines.push(`${key}: ${truncate(value, 88)}`);
    }
  }

  const phase = extractLine(userText, 'Phase');
  const phaseKey = phase === 'follow_up' ? 'follow_up' : 'source';

  const validatedPhase =
    extractJsonAfterHeader(userText, 'Validated steps in this phase (before this batch):') ??
    extractJsonAfterHeader(userText, 'Validated steps in this phase:');
  if (validatedPhase !== undefined) {
    lines.push(...formatStepsList(validatedPhase, 'validated_path'));
  } else {
    const validatedAll = extractJsonAfterHeader(userText, 'Validated steps so far:');
    if (validatedAll && typeof validatedAll === 'object' && !Array.isArray(validatedAll)) {
      const bucket = (validatedAll as Record<string, unknown>)[phaseKey];
      lines.push(...formatStepsList(bucket, 'validated_path'));
    }
  }

  const sourceSteps =
    extractJsonAfterHeader(
      userText,
      'Validated source steps (reference — replicate end state and filter action):',
    ) ??
    extractJsonAfterHeader(userText, 'Validated source steps (reference):') ??
    extractJsonAfterHeader(userText, 'Validated source steps:');
  const followUpSteps = extractJsonAfterHeader(userText, 'Validated follow_up steps:');
  if (sourceSteps !== undefined) {
    lines.push(...formatStepsList(sourceSteps, 'source_path'));
  }
  if (followUpSteps !== undefined) {
    lines.push(...formatStepsList(followUpSteps, 'follow_up_path'));
  }

  const batch = extractJsonAfterHeader(userText, 'Executed steps (this batch only):');
  if (batch !== undefined) {
    lines.push(...formatStepsList(batch, 'probe_batch'));
  }

  const inventoryCurrent =
    extractBlock(
      userText,
      'Current inventory (concrete UI instances for this snapshot — use ONLY these element_ids in steps):',
    ) ??
    extractBlock(userText, 'Current inventory (use ONLY these element_ids in steps):') ??
    extractBlock(userText, 'Current inventory:');
  const pageStructure =
    extractBlock(
      userText,
      'Page structure (accessibility tree; lines with → En map to shortIds above):',
    ) ?? extractBlock(userText, 'Page structure (accessibility tree');
  const inventoryBefore = extractBlock(userText, 'Inventory BEFORE:');
  const inventoryAfter = extractBlock(userText, 'Inventory AFTER:');

  lines.push(...summarizeInventoryBlock(inventoryCurrent, 'inventory'));
  if (pageStructure) {
    const structureLines = pageStructure.split('\n').map((line) => line.trim()).filter(Boolean);
    lines.push(`page_structure (${structureLines.length} lines):`);
    for (const line of structureLines.slice(0, 4)) {
      lines.push(`· ${truncate(line, 88)}`);
    }
    if (structureLines.length > 4) {
      lines.push(`· … +${structureLines.length - 4} more`);
    }
  }
  lines.push(...summarizeInventoryBlock(inventoryBefore, 'inventory_before'));
  lines.push(...summarizeInventoryBlock(inventoryAfter, 'inventory_after'));

  const instruction =
    extractLine(userText, 'Propose the next 1-3 steps OR scenario_complete if goal reached.') ??
    extractBlock(userText, 'Does the AFTER state satisfy the phase goal? If yes → goal_reached. If partial progress → ok. If broken → fail.');

  if (instruction) {
    lines.push(`ask: ${truncate(instruction, 100)}`);
  }

  lines.push(
    `screenshots: ${screenshotCount === 0 ? 'none' : `${screenshotCount} attached to API call`}`,
  );

  return lines;
}

function summarizeOutput(purpose: string, output: unknown): string[] {
  if (!output || typeof output !== 'object') {
    return ['(empty)'];
  }

  const record = output as Record<string, unknown>;
  const lines: string[] = [];

  if (purpose === 'mr_plan') {
    const mr = record.mr_definition as Record<string, unknown> | undefined;
    const exploration = record.exploration as Record<string, unknown> | undefined;
    const precondition = mr?.precondition as Record<string, unknown> | undefined;
    const transformation = mr?.transformation as Record<string, unknown> | undefined;
    const relation = mr?.relation as Record<string, unknown> | undefined;

    if (precondition?.description) {
      lines.push(`precondition: ${precondition.description}`);
    }
    if (transformation?.description) {
      lines.push(`transformation: ${transformation.description}`);
    }
    if (relation?.type) {
      lines.push(
        `relation: ${String(relation.type)} on ${JSON.stringify(relation.on ?? [])}`,
      );
    }
    if (exploration?.source_phase_goal) {
      lines.push(`source_goal: ${exploration.source_phase_goal}`);
    }
    if (exploration?.follow_up_phase_goal) {
      lines.push(`follow_up_goal: ${exploration.follow_up_phase_goal}`);
    }
    return lines;
  }

  if (purpose === 'plan_explore' || purpose === 'explore_plan') {
    lines.push(`action: ${String(record.action ?? '?')}`);
    if (typeof record.rationale === 'string') {
      lines.push(`rationale: ${record.rationale}`);
    }
    if (record.action === 'append_steps') {
      lines.push(...formatStepsList(record.steps, 'proposed_steps'));
    }
    return lines;
  }

  if (purpose === 'explore_verify') {
    lines.push(`verdict: ${String(record.verdict ?? '?')}`);
    if (typeof record.rationale === 'string') {
      lines.push(`rationale: ${record.rationale}`);
    }
    return lines;
  }

  lines.push(truncate(JSON.stringify(output), 120));
  return lines;
}

export function logExploreLlmExchange(input: ExploreLlmLogInput): void {
  if (!isExploreLlmLoggingEnabled()) {
    return;
  }

  const title = `${input.purpose}@${input.promptVersion}`;
  const divider = '─'.repeat(Math.max(20, Math.min(70, title.length + 10)));

  console.log(`\n${divider} ${title} ${divider}`);

  logSection('SYSTEM', formatSystemPrompt(input.system));
  logSection('USER', formatUserPrompt(input.userText, input.screenshotCount));

  if (isVerbose()) {
    logSection('RAW_SYSTEM', input.system.split('\n'));
    logSection('RAW_USER', input.userText.split('\n'));
  }

  if (input.validationError) {
    logSection('RESPONSE', [
      'status: FAIL (validation)',
      `error: ${input.validationError}`,
      input.output !== undefined
        ? `parsed: ${truncate(JSON.stringify(input.output), 120)}`
        : '',
    ].filter(Boolean));
  } else if (input.output !== undefined) {
    logSection('RESPONSE', ['status: OK', ...summarizeOutput(input.purpose, input.output)]);
  }

  logSection('META', [
    `model: ${input.model}`,
    `tokens: in=${input.tokensIn ?? '?'} out=${input.tokensOut ?? '?'} | ${input.latencyMs}ms`,
  ]);
}

export function logExploreGraphEvent(message: string): void {
  if (!isExploreLlmLoggingEnabled()) {
    return;
  }

  console.log(`[explore] ${message}`);
}
