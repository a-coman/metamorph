import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proxyArtifact } from './artifact-proxy.js';

const apiUrl = 'http://api.internal:3001';
const signedUrl = 'http://storage.internal/trace.zip?signed-for=get';

function transport(storageResponse: Response, metadataStatus = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return Response.json({ url: signedUrl }, { status: metadataStatus });
    }
    return storageResponse;
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test('streams artifact content through the app without a storage redirect', async () => {
  const { calls, fetchImpl } = transport(new Response('zip-bytes', {
    headers: { 'Content-Type': 'application/zip', 'Content-Length': '9', ETag: 'example' },
  }));
  const response = await proxyArtifact(new Request('http://app/api/artifact-url/id'), 'id', apiUrl, fetchImpl);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'zip-bytes');
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.equal(response.headers.get('content-length'), '9');
  assert.equal(response.headers.get('etag'), 'example');
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(calls[0].url, `${apiUrl}/artifacts/id/url`);
  assert.equal(calls[1].url, signedUrl);
});

test('preserves range requests and keeps browser credentials away from storage', async () => {
  const { calls, fetchImpl } = transport(new Response('zip', {
    status: 206, headers: { 'Content-Range': 'bytes 0-2/9', 'Accept-Ranges': 'bytes' },
  }));
  const request = new Request('http://app/api/artifact-url/id', {
    headers: { Range: 'bytes=0-2', 'If-Range': 'etag', Authorization: 'Bearer app-token', Cookie: 'session=app-cookie' },
  });
  const response = await proxyArtifact(request, 'id', apiUrl, fetchImpl);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-2/9');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal(new Headers(calls[0].init?.headers).get('authorization'), 'Bearer app-token');
  const storageHeaders = new Headers(calls[1].init?.headers);
  assert.equal(storageHeaders.get('range'), 'bytes=0-2');
  assert.equal(storageHeaders.get('if-range'), 'etag');
  assert.equal(storageHeaders.get('authorization'), null);
  assert.equal(storageHeaders.get('cookie'), null);
  assert.equal(calls[1].init?.signal, request.signal);
});

test('HEAD uses the signed GET and cancels its body immediately', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const { calls, fetchImpl } = transport(new Response(body, { headers: { 'Content-Length': '32000000' } }));
  const response = await proxyArtifact(new Request('http://app/api/artifact-url/id', { method: 'HEAD' }), 'id', apiUrl, fetchImpl);
  assert.equal(calls[1].init?.method, 'GET');
  assert.equal(response.status, 200);
  assert.equal(response.body, null);
  assert.equal(response.headers.get('content-length'), '32000000');
  assert.equal(cancelled, true);
});

for (const status of [401, 403, 404]) {
  test(`API ${status} prevents storage access`, async () => {
    const { calls, fetchImpl } = transport(new Response('must not be fetched'), status);
    const response = await proxyArtifact(new Request('http://app/api/artifact-url/id'), 'id', apiUrl, fetchImpl);
    assert.equal(response.status, status);
    assert.equal(calls.length, 1);
  });
}

test('unsatisfiable ranges preserve the object size', async () => {
  const { fetchImpl } = transport(new Response('storage error', {
    status: 416, headers: { 'Content-Range': 'bytes */9', 'Content-Length': '13' },
  }));
  const response = await proxyArtifact(new Request('http://app/api/artifact-url/id'), 'id', apiUrl, fetchImpl);
  assert.equal(response.status, 416);
  assert.equal(response.headers.get('content-range'), 'bytes */9');
  assert.equal(response.headers.get('content-length'), '0');
});

test('backend failures are not reported as missing artifacts', async () => {
  const { fetchImpl } = transport(new Response(null), 503);
  const response = await proxyArtifact(new Request('http://app/api/artifact-url/id'), 'id', apiUrl, fetchImpl);
  assert.equal(response.status, 502);
});

test('storage failures do not leak signed URLs or storage error bodies', async () => {
  const { fetchImpl } = transport(new Response('private storage diagnostics', { status: 403 }));
  const response = await proxyArtifact(new Request('http://app/api/artifact-url/id'), 'id', apiUrl, fetchImpl);
  assert.equal(response.status, 502);
  const message = await response.text();
  assert.ok(!message.includes('storage.internal'));
  assert.ok(!message.includes('private storage diagnostics'));
});
