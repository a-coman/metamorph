import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeReplayBundleHash, type GenerationSlots } from '@metamorph/core';
import { approveMrVersion } from './approve-mr-version.js';
import { executeMrVersion } from './execute-mr-version.js';
import { MrPromotionError } from './errors.js';
import type {
  MrPromotionDeps,
  MrPromotionPrismaClient,
} from './mr-promotion-deps.js';
import { promoteMrVersionIfAuto } from './promote-mr-version-if-auto.js';

const DEFAULT_GENERATION_SLOTS: GenerationSlots = {
  source: { steps: [{ id: 1, action: 'goto', url: 'https://example.com' }] },
  follow_up: { steps: [{ id: 1, action: 'goto', url: 'https://example.com' }] },
  observation: { schemaVersion: 2, observables: [] },
};
const DEFAULT_PLAYBOOK_CONTENT = 'test("source", () => undefined);';
const DEFAULT_PLAYBOOK_BLOB = {
  content: DEFAULT_PLAYBOOK_CONTENT,
  contentHash: computeReplayBundleHash({
    playbookContent: DEFAULT_PLAYBOOK_CONTENT,
    observationSpec: DEFAULT_GENERATION_SLOTS.observation,
    templateVersion: 'playbook-template@5',
  }).contentHash,
  templateVersion: 'playbook-template@5',
};

type MrRow = {
  id: string;
  sessionId: string;
  status: string;
  playbookBlobId: string | null;
  generationSlots?: unknown;
  replayBundleHash?: string | null;
  session?: { mode: 'hitl' | 'auto'; controlStatus: string; url: string };
  playbookBlob?: typeof DEFAULT_PLAYBOOK_BLOB | null;
};

function createMockPrisma(options: {
  mr?: MrRow | null;
  publish?: () => Promise<void>;
}): MrPromotionDeps {
  let mr = options.mr
    ? {
        generationSlots: DEFAULT_GENERATION_SLOTS,
        replayBundleHash: null,
        ...options.mr,
      }
    : null;
  const jobs: Array<{
    id: string;
    status: string;
    payload: Record<string, unknown>;
  }> = [];
  const runs: Array<{ id: string; jobId: string }> = [];
  let jobCounter = 0;
  let runCounter = 0;

  const prisma: MrPromotionPrismaClient = {
    session: {
      findUnique: async () => null,
    },
    mrVersion: {
      findUnique: async () => (mr ? { ...mr } : null),
      update: async ({ data }) => {
        if (!mr) {
          throw new Error('missing mr');
        }
        if (data.status) {
          mr = { ...mr, status: data.status };
        }
        if (data.replayBundleHash) {
          mr = { ...mr, replayBundleHash: data.replayBundleHash };
        }
        return {
          id: mr.id,
          status: mr.status as MrRow['status'],
          approvedAt: data.approvedAt ?? null,
        };
      },
    },
    playbookBlob: {
      update: async () => ({}),
    },
    job: {
      create: async ({ data }) => {
        jobCounter += 1;
        const job = {
          id: `job-${jobCounter}`,
          status: data.status,
          payload: data.payload,
        };
        jobs.push(job);
        return { id: job.id };
      },
      update: async ({ where, data }) => {
        const job = jobs.find((row) => row.id === where.id);
        if (!job) {
          throw new Error('job not found');
        }
        if (data.status) {
          job.status = data.status;
        }
        if (data.payload) {
          job.payload = data.payload;
        }
      },
    },
    run: {
      create: async ({ data }) => {
        runCounter += 1;
        const run = { id: `run-${runCounter}`, jobId: data.jobId };
        runs.push(run);
        return { id: run.id };
      },
    },
    $transaction: async (fn) => fn(prisma),
  };

  return {
    prisma,
    publishExecutePairJob: options.publish ?? (async () => undefined),
  };
}

describe('mr-promotion', () => {
  it('skips promotion for hitl sessions', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'draft_pending_hitl',
        playbookBlobId: 'blob-1',
        session: {
          mode: 'hitl',
          controlStatus: 'active',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
    });

    const result = await promoteMrVersionIfAuto(deps, 'mr-1');
    assert.deepEqual(result, { outcome: 'skipped', reason: 'hitl' });
  });

  it('skips promotion when session is paused', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'draft_pending_hitl',
        playbookBlobId: 'blob-1',
        session: {
          mode: 'auto',
          controlStatus: 'paused',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
    });

    const result = await promoteMrVersionIfAuto(deps, 'mr-1');
    assert.deepEqual(result, { outcome: 'skipped', reason: 'paused' });
  });

  it('promotes auto sessions by approving and executing', async () => {
    let published = false;
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'draft_pending_hitl',
        playbookBlobId: 'blob-1',
        session: {
          mode: 'auto',
          controlStatus: 'active',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
      publish: async () => {
        published = true;
      },
    });

    const result = await promoteMrVersionIfAuto(deps, 'mr-1');
    assert.equal(result.outcome, 'promoted');
    assert.equal(published, true);
    if (result.outcome === 'promoted') {
      assert.match(result.jobId, /^job-/);
      assert.match(result.runId, /^run-/);
    }
  });

  it('fails enqueue without failing approve', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'draft_pending_hitl',
        playbookBlobId: 'blob-1',
        session: {
          mode: 'auto',
          controlStatus: 'active',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
      publish: async () => {
        throw new Error('rabbit down');
      },
    });

    const result = await promoteMrVersionIfAuto(deps, 'mr-1');
    assert.deepEqual(result, {
      outcome: 'failed',
      step: 'enqueue',
      error: 'Failed to publish execute pair job',
    });
  });

  it('approve rejects wrong status', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'approved',
        playbookBlobId: 'blob-1',
      },
    });

    await assert.rejects(
      () => approveMrVersion(deps.prisma, 'mr-1'),
      (error: unknown) => {
        assert.ok(error instanceof MrPromotionError);
        assert.equal(error.code, 'invalid_status');
        return true;
      },
    );
  });

  it('execute requires approved status', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'draft_pending_hitl',
        playbookBlobId: 'blob-1',
        session: {
          mode: 'auto',
          controlStatus: 'active',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
    });

    await assert.rejects(
      () => executeMrVersion(deps, 'mr-1'),
      (error: unknown) => {
        assert.ok(error instanceof MrPromotionError);
        assert.equal(error.code, 'invalid_status');
        return true;
      },
    );
  });

  it('execute rejects a tampered replay bundle', async () => {
    const deps = createMockPrisma({
      mr: {
        id: 'mr-1',
        sessionId: 'session-1',
        status: 'approved',
        playbookBlobId: 'blob-1',
        replayBundleHash: 'tampered',
        session: {
          mode: 'auto',
          controlStatus: 'active',
          url: 'https://example.com',
        },
        playbookBlob: DEFAULT_PLAYBOOK_BLOB,
      },
    });

    await assert.rejects(
      () => executeMrVersion(deps, 'mr-1'),
      (error: unknown) => {
        assert.ok(error instanceof MrPromotionError);
        assert.equal(error.code, 'integrity_failed');
        return true;
      },
    );
  });
});
