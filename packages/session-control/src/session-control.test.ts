import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPauseRequested } from './session-control-status.js';
import { SessionControlChecker } from './session-control-reader.js';

describe('session-control', () => {
  it('detects pause requested states', () => {
    assert.equal(isPauseRequested('pausing'), true);
    assert.equal(isPauseRequested('paused'), true);
    assert.equal(isPauseRequested('active'), false);
  });

  it('defaults missing session status to active', async () => {
    const checker = new SessionControlChecker({
      getControlStatus: async () => null,
    });

    assert.equal(await checker.getStatus('session-id'), 'active');
    assert.equal(await checker.isPauseRequested('session-id'), false);
  });
});
