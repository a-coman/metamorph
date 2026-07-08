import { getDomainById, listSessionSlots } from './config.js';

export type BatchCliOptions = {
  all: boolean;
  domain: string | null;
  generation: number | null;
  force: boolean;
};

export function parseBatchCli(argv: string[]): BatchCliOptions {
  const options: BatchCliOptions = {
    all: false,
    domain: null,
    generation: null,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--domain') {
      options.domain = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--generation') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--generation must be a positive integer');
      }
      options.generation = value;
      index += 1;
    }
  }

  return options;
}

export function resolveBatchSlots(
  options: BatchCliOptions,
): Array<{ domain: string; generation: number; url: string }> {
  if (options.all) {
    return listSessionSlots();
  }

  if (!options.domain) {
    throw new Error('Specify --domain <id>, optionally --generation <n>, or --all');
  }

  const domain = getDomainById(options.domain);
  if (!domain) {
    throw new Error(`Unknown domain: ${options.domain}`);
  }

  if (options.generation !== null) {
    if (options.generation > domain.generations) {
      throw new Error(
        `Generation ${options.generation} exceeds max ${domain.generations} for ${domain.id}`,
      );
    }
    return [{ domain: domain.id, generation: options.generation, url: domain.url }];
  }

  return Array.from({ length: domain.generations }, (_, index) => ({
    domain: domain.id,
    generation: index + 1,
    url: domain.url,
  }));
}
