import { config } from 'dotenv';
import { resolve } from 'node:path';
import {
  createDiscoverLlmJobService,
  createLlmDiscoverSubscriber,
} from './discover-llm/composition-root.js';
import { prisma } from './shared/infrastructure/prisma/prisma-client.js';

const workerDir = resolve(import.meta.dirname, '..');
const rootDir = resolve(workerDir, '../..');

config({ path: resolve(workerDir, '.env') });
config({ path: resolve(rootDir, '.env'), override: true });

function parseJobId(args: string[]): string | undefined {
  const flagIndex = args.indexOf('--job-id');
  if (flagIndex >= 0 && args[flagIndex + 1]) {
    return args[flagIndex + 1];
  }
  return undefined;
}

async function runConsume(): Promise<void> {
  const subscriber = createLlmDiscoverSubscriber();
  await subscriber.start();

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down consumer...`);
    await subscriber.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await new Promise<void>(() => {
    // keep process alive until signal
  });
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (command === 'discover-llm') {
    const jobId = parseJobId(rest);
    if (!jobId) {
      console.error('Usage: discover-llm --job-id <uuid>');
      process.exitCode = 1;
      return;
    }

    const discoverLlmJob = createDiscoverLlmJobService();
    const result = await discoverLlmJob.run(jobId);

    if (result.isLeft()) {
      throw new Error(result.value.errorMessage ?? 'Discover LLM job failed');
    }

    console.log(`MR version created: ${result.value.mrVersionId}`);
    return;
  }

  if (command === 'consume') {
    await runConsume();
    return;
  }

  console.error(
    'Unknown command. Available: consume | discover-llm --job-id <uuid>',
  );
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.argv[2] !== 'consume') {
      await prisma.$disconnect();
    }
  });
