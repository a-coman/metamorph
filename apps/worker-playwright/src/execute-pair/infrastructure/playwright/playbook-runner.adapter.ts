import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PlaybookRunResult = {
  sourceObservation: Record<string, unknown>;
  followUpObservation: Record<string, unknown>;
  traceZipPath: string | null;
};

export class PlaybookRunnerAdapter {
  private readonly workerRoot: string;
  private readonly reporterPath: string;

  constructor() {
    const here = dirname(fileURLToPath(import.meta.url));
    this.workerRoot = join(here, '../../../..');
    this.reporterPath = join(here, 'observation-reporter.cjs');
  }

  async run(playbookContent: string, runId: string): Promise<PlaybookRunResult> {
    const runDir = join(this.workerRoot, '.runs', runId);
    await mkdir(runDir, { recursive: true });

    await writeFile(join(runDir, 'playbook.spec.ts'), playbookContent);

    const configContent = `const path = require('path');

module.exports = {
  testDir: path.join(__dirname),
  timeout: 120000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [[${JSON.stringify(this.reporterPath)}, { outputDir: ${JSON.stringify(runDir)} }]],
  use: {
    trace: 'on',
    headless: ${process.env.PLAYWRIGHT_HEADLESS !== 'false'},
    locale: 'es-ES',
    actionTimeout: 60000,
    navigationTimeout: 60000,
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  },
};
`;

    const configPath = join(runDir, 'playwright.config.cjs');
    await writeFile(configPath, configContent);
    await this.execPlaywright(configPath);

    const sourceObservation = JSON.parse(
      await readFile(join(runDir, 'source.observation.json'), 'utf-8'),
    ) as Record<string, unknown>;

    const followUpObservation = JSON.parse(
      await readFile(join(runDir, 'follow_up.observation.json'), 'utf-8'),
    ) as Record<string, unknown>;

    const traceZipPath = await this.findTraceZip(runDir);

    return { sourceObservation, followUpObservation, traceZipPath };
  }

  private execPlaywright(configPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'pnpm',
        ['exec', 'playwright', 'test', '--config', configPath],
        { cwd: this.workerRoot, stdio: 'inherit', env: process.env },
      );

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Playwright tests failed with exit code ${code}`));
      });

      child.on('error', reject);
    });
  }

  private async findTraceZip(dir: string): Promise<string | null> {
    const entries = await this.walk(dir);

    for (const entry of entries) {
      if (entry.endsWith('trace.zip')) {
        return entry;
      }
    }

    return null;
  }

  private async walk(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const entryStat = await stat(fullPath);

      if (entryStat.isDirectory()) {
        results.push(...(await this.walk(fullPath)));
        continue;
      }

      results.push(fullPath);
    }

    return results;
  }
}
