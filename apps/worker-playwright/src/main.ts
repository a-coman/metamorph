import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createDiscoverJobService } from './discovery/composition-root.js';
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

async function main() {
  const [, , command, ...rest] = process.argv;

  if (command === 'discover') {
    const jobId = parseJobId(rest);
    if (!jobId) {
      console.error('Usage: discover --job-id <uuid>');
      process.exitCode = 1;
      return;
    }

    const discoverJob = createDiscoverJobService();
    const result = await discoverJob.run(jobId);

    if (result.isLeft()) {
      throw new Error(result.value.errorMessage ?? 'Discover job failed');
    }

    return;
  }

  console.error('Unknown command. Available: discover --job-id <uuid>');
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
