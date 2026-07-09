import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExploreGraphRunner } from './explore-graph-runner.js';

type FakeCompiledGraph = {
  invoke(input: unknown, config: unknown): Promise<Record<string, unknown>>;
  getState(config: unknown): Promise<{ next: string[]; values: Record<string, unknown> }>;
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ExploreGraphRunner setup concurrency', () => {
  it('shares cold-start setup across concurrent graph invocations', async () => {
    const setupGate = deferred();
    const setupStarted = deferred();
    const invokeConfigs: unknown[] = [];
    const fakeGraph: FakeCompiledGraph = {
      async invoke(_input, config) {
        invokeConfigs.push(config);
        return { mrVersionId: 'mr-1' };
      },
      async getState() {
        return { next: [], values: { mrVersionId: 'mr-1' } };
      },
    };

    class TestRunner extends ExploreGraphRunner {
      setupCalls = 0;

      override async setup(): Promise<void> {
        this.setupCalls++;
        setupStarted.resolve();
        await setupGate.promise;
        (this as unknown as { compiled: FakeCompiledGraph }).compiled = fakeGraph;
      }
    }

    const runner = new TestRunner(
      {} as ConstructorParameters<typeof ExploreGraphRunner>[0],
    );

    const first = runner.start({
      exploreJobId: 'explore-1',
      sessionId: 'session-1',
      sessionUrl: 'https://example.com',
      pageSnapshotId: 'snapshot-1',
      transformFamily: 'subset',
    });
    const second = runner.start({
      exploreJobId: 'explore-2',
      sessionId: 'session-1',
      sessionUrl: 'https://example.com',
      pageSnapshotId: 'snapshot-1',
      transformFamily: 'inverse',
    });

    await setupStarted.promise;
    assert.equal(runner.setupCalls, 1);

    setupGate.resolve();
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    assert.equal(runner.setupCalls, 1);
    assert.equal(firstOutcome.status, 'completed');
    assert.equal(secondOutcome.status, 'completed');
    assert.equal(invokeConfigs.length, 2);
  });
});
