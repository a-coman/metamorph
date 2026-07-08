import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './paths.js';

let loaded = false;

export function loadValidationEnv(): void {
  if (loaded) {
    return;
  }

  const candidates = [
    join(REPO_ROOT, '.env'),
    join(REPO_ROOT, 'apps/api/.env'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      applyEnvFile(readFileSync(path, 'utf8'));
    }
  }

  loaded = true;
}

function applyEnvFile(contents: string): void {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
