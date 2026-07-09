import type { SlotAction } from '../../domain/schemas/generation-slots.schema.js';

export const GOTO_NAVIGATION_WAIT_UNTIL = 'load' as const;
export const GOTO_WAIT_UNTIL = 'domcontentloaded' as const;
export const NETWORK_IDLE_WAIT_UNTIL = 'networkidle' as const;
export const LOAD_STATE_TIMEOUT_MS = 5000;
export const NETWORK_IDLE_LOAD_TIMEOUT_MS = 2000;

/** @deprecated Use adaptive settle instead. Kept for backward-compatible exports. */
export const POST_ACTION_SETTLE_MS = 1000;

export const ADAPTIVE_SETTLE_INITIAL_MS = 500;
export const ADAPTIVE_SETTLE_POLL_MS = 300;
export const ADAPTIVE_SETTLE_MAX_MS_GOTO = 8000;
export const ADAPTIVE_SETTLE_MAX_MS_ACTION = 5000;
export const ADAPTIVE_SETTLE_MAX_MS_CAPTURE = 8000;

export const PAGE_READY_MIN_BODY_TEXT = 120;
export const PAGE_READY_MAIN_TEXT_MIN = 40;

export type StabilizePhase = 'after_goto' | 'after_action' | 'before_capture';

export type PageReadyMetrics = {
  readyState: string;
  bodyTextLength: number;
  mainTextLength: number | null;
  visibleBusyCount: number;
};

export function getAdaptiveSettleMaxMs(phase: StabilizePhase): number {
  switch (phase) {
    case 'after_goto':
      return ADAPTIVE_SETTLE_MAX_MS_GOTO;
    case 'after_action':
      return ADAPTIVE_SETTLE_MAX_MS_ACTION;
    case 'before_capture':
      return ADAPTIVE_SETTLE_MAX_MS_CAPTURE;
  }
}

export function assessPageReady(metrics: PageReadyMetrics): boolean {
  if (metrics.readyState === 'loading') {
    return false;
  }
  if (metrics.bodyTextLength < PAGE_READY_MIN_BODY_TEXT) {
    return false;
  }
  if (metrics.mainTextLength !== null && metrics.mainTextLength < PAGE_READY_MAIN_TEXT_MIN) {
    return false;
  }
  if (metrics.visibleBusyCount > 0) {
    return false;
  }
  return true;
}

export function shouldStopAdaptiveSettle(input: {
  metrics: PageReadyMetrics;
  previousBodyTextLength: number | null;
  stablePollCount: number;
}): { stop: boolean; nextStablePollCount: number } {
  if (assessPageReady(input.metrics)) {
    return { stop: true, nextStablePollCount: 0 };
  }

  if (
    input.previousBodyTextLength !== null &&
    input.metrics.bodyTextLength === input.previousBodyTextLength &&
    input.metrics.bodyTextLength >= PAGE_READY_MIN_BODY_TEXT
  ) {
    const nextStablePollCount = input.stablePollCount + 1;
    if (nextStablePollCount >= 2) {
      return { stop: true, nextStablePollCount };
    }
    return { stop: false, nextStablePollCount };
  }

  return { stop: false, nextStablePollCount: 0 };
}

/** Browser-side metrics collection body (shared by runtime evaluate and codegen). */
export const COLLECT_PAGE_READY_METRICS_BODY = `
  const bodyText = (document.body?.innerText ?? '').trim();
  const main = document.querySelector('main, [role="main"], #content, #bodyconstraint-inner');
  const mainText = main ? (main.textContent ?? '').trim() : null;
  let visibleBusyCount = 0;
  for (const el of document.querySelectorAll('[aria-busy="true"]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      visibleBusyCount++;
    }
  }
  return {
    readyState: document.readyState,
    bodyTextLength: bodyText.length,
    mainTextLength: mainText !== null ? mainText.length : null,
    visibleBusyCount,
  };
`;

export function renderCollectPageReadyMetricsExpression(): string {
  return `await page.evaluate(() => {${COLLECT_PAGE_READY_METRICS_BODY}})`;
}

export function renderAssessPageReadyExpression(metricsVar: string): string {
  return `(() => {
    const __m = ${metricsVar};
    if (__m.readyState === 'loading') return false;
    if (__m.bodyTextLength < ${PAGE_READY_MIN_BODY_TEXT}) return false;
    if (__m.mainTextLength !== null && __m.mainTextLength < ${PAGE_READY_MAIN_TEXT_MIN}) return false;
    if (__m.visibleBusyCount > 0) return false;
    return true;
  })()`;
}

export function renderAdaptiveSettleCode(indent: string, maxMs: number): string {
  const i = indent;
  const ii = `${indent}  `;
  const iii = `${indent}    `;
  const iiii = `${indent}      `;
  const iiiii = `${indent}        `;

  return `${i}await (async () => {
${ii}const __maxMs = ${maxMs};
${ii}const __initialMs = ${ADAPTIVE_SETTLE_INITIAL_MS};
${ii}const __pollMs = ${ADAPTIVE_SETTLE_POLL_MS};
${ii}const __minBodyText = ${PAGE_READY_MIN_BODY_TEXT};
${ii}const __start = Date.now();
${ii}let __previousBodyTextLength = null;
${ii}let __stablePollCount = 0;
${ii}await page.waitForTimeout(__initialMs);
${ii}while (Date.now() - __start < __maxMs) {
${iii}const __metrics = ${renderCollectPageReadyMetricsExpression()};
${iii}if (${renderAssessPageReadyExpression('__metrics')}) {
${iiii}return;
${iii}}
${iii}if (
${iiii}__previousBodyTextLength !== null &&
${iiii}__metrics.bodyTextLength === __previousBodyTextLength &&
${iiii}__metrics.bodyTextLength >= __minBodyText
${iii}) {
${iiii}__stablePollCount++;
${iiii}if (__stablePollCount >= 2) {
${iiiii}return;
${iiii}}
${iii}} else {
${iiii}__stablePollCount = 0;
${iii}}
${iii}__previousBodyTextLength = __metrics.bodyTextLength;
${iii}await page.waitForTimeout(__pollMs);
${ii}}
${i}})();`;
}

export function renderPostStepStabilizationCode(indent = '  ', action?: SlotAction): string {
  if (action === 'goto') {
    return [
      `${indent}await page.waitForLoadState('${NETWORK_IDLE_WAIT_UNTIL}', { timeout: ${NETWORK_IDLE_LOAD_TIMEOUT_MS} }).catch(() => undefined);`,
      renderAdaptiveSettleCode(indent, ADAPTIVE_SETTLE_MAX_MS_GOTO),
    ].join('\n');
  }

  return [
    `${indent}await page.waitForLoadState('${GOTO_WAIT_UNTIL}', { timeout: ${LOAD_STATE_TIMEOUT_MS} }).catch(() => undefined);`,
    renderAdaptiveSettleCode(
      indent,
      action === undefined ? ADAPTIVE_SETTLE_MAX_MS_CAPTURE : ADAPTIVE_SETTLE_MAX_MS_ACTION,
    ),
  ].join('\n');
}

export function renderFinalCaptureStabilizationCode(indent = '  '): string {
  return renderPostStepStabilizationCode(indent, undefined);
}
