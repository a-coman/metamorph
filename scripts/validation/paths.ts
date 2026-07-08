import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const validationDir = resolve(fileURLToPath(new URL('.', import.meta.url)));

export const REPO_ROOT = resolve(validationDir, '../..');

export function getOutDir(): string {
  const configured = process.env.VALIDATION_OUT_DIR;
  if (configured) {
    return resolve(REPO_ROOT, configured);
  }
  return join(validationDir, 'out');
}

export function outPath(filename: string): string {
  return join(getOutDir(), filename);
}

export async function ensureOutDir(): Promise<string> {
  const dir = getOutDir();
  await mkdir(dir, { recursive: true });
  return dir;
}
