import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADAPTIVE_SETTLE_MAX_MS_ACTION,
  ADAPTIVE_SETTLE_MAX_MS_CAPTURE,
  ADAPTIVE_SETTLE_MAX_MS_GOTO,
  assessPageReady,
  getAdaptiveSettleMaxMs,
  renderAdaptiveSettleCode,
  renderFinalCaptureStabilizationCode,
  renderPostStepStabilizationCode,
  shouldStopAdaptiveSettle,
  type PageReadyMetrics,
} from './page-stabilization.js';

function metrics(overrides: Partial<PageReadyMetrics> = {}): PageReadyMetrics {
  return {
    readyState: 'complete',
    bodyTextLength: 500,
    mainTextLength: 200,
    visibleBusyCount: 0,
    ...overrides,
  };
}

describe('assessPageReady', () => {
  it('returns false while document is loading', () => {
    assert.equal(assessPageReady(metrics({ readyState: 'loading' })), false);
  });

  it('returns false for near-empty body text', () => {
    assert.equal(assessPageReady(metrics({ bodyTextLength: 50 })), false);
  });

  it('returns false when main landmark exists but is empty', () => {
    assert.equal(assessPageReady(metrics({ mainTextLength: 10 })), false);
  });

  it('returns false when visible busy indicators are present', () => {
    assert.equal(assessPageReady(metrics({ visibleBusyCount: 1 })), false);
  });

  it('returns true for a healthy populated page', () => {
    assert.equal(assessPageReady(metrics()), true);
  });

  it('returns true when no main landmark is present and body is populated', () => {
    assert.equal(assessPageReady(metrics({ mainTextLength: null })), true);
  });
});

describe('shouldStopAdaptiveSettle', () => {
  it('stops when assessPageReady is true', () => {
    const result = shouldStopAdaptiveSettle({
      metrics: metrics(),
      previousBodyTextLength: 100,
      stablePollCount: 0,
    });
    assert.equal(result.stop, true);
  });

  it('stops after two stable body-text polls above minimum', () => {
    const notReadyButPopulated = metrics({ mainTextLength: 10 });
    const first = shouldStopAdaptiveSettle({
      metrics: notReadyButPopulated,
      previousBodyTextLength: 500,
      stablePollCount: 0,
    });
    assert.equal(first.stop, false);
    assert.equal(first.nextStablePollCount, 1);

    const second = shouldStopAdaptiveSettle({
      metrics: notReadyButPopulated,
      previousBodyTextLength: 500,
      stablePollCount: first.nextStablePollCount,
    });
    assert.equal(second.stop, true);
    assert.equal(second.nextStablePollCount, 2);
  });

  it('resets stable poll count when body text changes', () => {
    const result = shouldStopAdaptiveSettle({
      metrics: metrics({ bodyTextLength: 300, mainTextLength: 10 }),
      previousBodyTextLength: 200,
      stablePollCount: 1,
    });
    assert.equal(result.stop, false);
    assert.equal(result.nextStablePollCount, 0);
  });
});

describe('getAdaptiveSettleMaxMs', () => {
  it('maps phases to configured max durations', () => {
    assert.equal(getAdaptiveSettleMaxMs('after_goto'), ADAPTIVE_SETTLE_MAX_MS_GOTO);
    assert.equal(getAdaptiveSettleMaxMs('after_action'), ADAPTIVE_SETTLE_MAX_MS_ACTION);
    assert.equal(getAdaptiveSettleMaxMs('before_capture'), ADAPTIVE_SETTLE_MAX_MS_CAPTURE);
  });
});

describe('renderPostStepStabilizationCode', () => {
  it('uses networkidle and goto max for goto actions', () => {
    const code = renderPostStepStabilizationCode('  ', 'goto');
    assert.match(code, /waitForLoadState\('networkidle'/);
    assert.match(code, new RegExp(`const __maxMs = ${ADAPTIVE_SETTLE_MAX_MS_GOTO}`));
    assert.doesNotMatch(code, /waitForLoadState\('domcontentloaded'/);
  });

  it('uses domcontentloaded and action max for click actions', () => {
    const code = renderPostStepStabilizationCode('  ', 'click');
    assert.match(code, /waitForLoadState\('domcontentloaded'/);
    assert.match(code, new RegExp(`const __maxMs = ${ADAPTIVE_SETTLE_MAX_MS_ACTION}`));
    assert.doesNotMatch(code, /waitForLoadState\('networkidle'/);
  });

  it('uses capture max for final stabilization without action', () => {
    const code = renderFinalCaptureStabilizationCode('  ');
    assert.match(code, new RegExp(`const __maxMs = ${ADAPTIVE_SETTLE_MAX_MS_CAPTURE}`));
  });
});

describe('renderAdaptiveSettleCode', () => {
  it('includes metrics collection and poll loop', () => {
    const code = renderAdaptiveSettleCode('  ', 5000);
    assert.match(code, /await page\.evaluate\(\(\) => \{/);
    assert.match(code, /aria-busy="true"/);
    assert.match(code, /__stablePollCount/);
    assert.match(code, /await page\.waitForTimeout\(__pollMs\)/);
  });

  it('collects metrics in the browser via page.evaluate', () => {
    const code = renderAdaptiveSettleCode('  ', 5000);
    assert.match(code, /const __metrics = await page\.evaluate/);
    assert.doesNotMatch(code, /const __metrics = \(\(\) =>/);
  });
});
