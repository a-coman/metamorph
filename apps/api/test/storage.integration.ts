import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageService } from '../src/shared/infrastructure/s3/s3-storage.service.js';
import { S3ArtifactStorageAdapter } from '../../worker-playwright/src/discovery/infrastructure/s3/s3-artifact-storage.adapter.js';
import { S3ArtifactReaderAdapter } from '../../worker-llm/src/shared/infrastructure/s3/s3-artifact-reader.adapter.js';

// Opt-in integration test: pnpm storage:test, after starting garage and garage-init.
test('Garage supports the artifact workflow used by the API and both workers', async (t) => {
  const endpoint = process.env.S3_ENDPOINT;
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? endpoint;
  assert.ok(endpoint && publicEndpoint, 'Configure S3_ENDPOINT in .env');
  const bucket = process.env.S3_BUCKET ?? 'metamorph-artifacts';
  const cleanup = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'garage',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
  const writer = new S3ArtifactStorageAdapter();
  const reader = new S3ArtifactReaderAdapter();
  const storage = new S3StorageService();
  const prefix = `storage-smoke/${randomUUID()}`;
  const key = `${prefix}/captura con espacios y ñ.png`;
  const apiKey = `${prefix}/trace.zip`;
  const body = Buffer.from('metamorph artifact round-trip\n');
  const traceBody = randomBytes(2 * 1024 * 1024 + 123);

  try {
    await t.test('bucket health, worker upload and LLM worker download', async () => {
      await storage.ping();
      await writer.put(key, body, 'image/png');
      assert.deepEqual(await reader.get(key), body);
      await storage.putObject(apiKey, traceBody, 'application/zip');
      assert.deepEqual(await reader.get(apiKey), traceBody);
    });

    // Simulate the Docker-only hostname: signatures must use the public host,
    // even though API reads and health checks use a different internal endpoint.
    const savedPublicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
    process.env.S3_ENDPOINT = 'http://garage:3900';
    process.env.S3_PUBLIC_ENDPOINT = publicEndpoint;
    let signer: S3StorageService;
    try {
      signer = new S3StorageService();
    } finally {
      process.env.S3_ENDPOINT = endpoint;
      if (savedPublicEndpoint === undefined) delete process.env.S3_PUBLIC_ENDPOINT;
      else process.env.S3_PUBLIC_ENDPOINT = savedPublicEndpoint;
    }
    const { url, expiresAt } = await signer.getPresignedUrl(key, 60);

    await t.test('public endpoint is signed directly and serves the original bytes', async () => {
      assert.equal(new URL(url).origin, new URL(publicEndpoint).origin);
      assert.ok(expiresAt.getTime() > Date.now());
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
    });

    await t.test('trace viewer CORS and range reads', async () => {
      const response = await fetch(url, {
        headers: { Origin: 'https://trace.playwright.dev', Range: 'bytes=0-8' },
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(response.status, 206);
      assert.ok(['*', 'https://trace.playwright.dev'].includes(
        response.headers.get('access-control-allow-origin') ?? '',
      ));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), body.subarray(0, 9));
      const preflight = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://trace.playwright.dev',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'range',
        },
        signal: AbortSignal.timeout(10_000),
      });
      assert.ok(preflight.ok);
      assert.ok(preflight.headers.get('access-control-allow-methods')?.includes('GET'));
      await preflight.arrayBuffer();
    });

    await t.test('unsigned and tampered links cannot read private artifacts', async () => {
      const unsigned = new URL(url);
      unsigned.search = '';
      const denied = await fetch(unsigned, { signal: AbortSignal.timeout(10_000) });
      assert.equal(denied.status, 403);
      await denied.arrayBuffer();
      const tampered = new URL(url);
      tampered.searchParams.set('X-Amz-Signature', '0'.repeat(64));
      const invalid = await fetch(tampered, { signal: AbortSignal.timeout(10_000) });
      assert.equal(invalid.status, 403);
      await invalid.arrayBuffer();
    });
  } finally {
    for (const Key of [key, apiKey]) {
      await cleanup.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
    }
    cleanup.destroy();
  }
});
