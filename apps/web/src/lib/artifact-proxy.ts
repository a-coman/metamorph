const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'content-disposition',
  'accept-ranges',
  'etag',
  'last-modified',
];

function unavailable(status = 502) {
  return Response.json(
    { error: status === 404 ? 'Artifact not found' : 'Artifact unavailable' },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function proxyArtifact(
  request: Request,
  artifactId: string,
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  try {
    // Keep artifact existence/linkage checks in the API. Browser credentials
    // belong to the API request and must never be forwarded to object storage.
    const apiHeaders = new Headers({ Accept: 'application/json' });
    for (const name of ['authorization', 'cookie']) {
      const value = request.headers.get(name);
      if (value) apiHeaders.set(name, value);
    }
    const metadata = await fetchImpl(
      `${apiBaseUrl.replace(/\/$/, '')}/artifacts/${encodeURIComponent(artifactId)}/url`,
      { headers: apiHeaders, cache: 'no-store', signal: request.signal },
    );
    if (!metadata.ok) {
      await metadata.body?.cancel();
      return unavailable([401, 403, 404].includes(metadata.status) ? metadata.status : 502);
    }
    const { url } = await metadata.json() as { url: string };
    const headers = new Headers();
    if (request.method !== 'HEAD') {
      for (const name of ['range', 'if-range']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
    }
    // The storage URL is signed for GET. For HEAD, read the same headers and
    // immediately cancel the stream instead of issuing an invalid signed HEAD.
    const upstream = await fetchImpl(url, {
      method: 'GET', headers, cache: 'no-store', signal: request.signal,
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store' });
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (upstream.status === 416) {
      await upstream.body?.cancel();
      responseHeaders.set('content-length', '0');
      return new Response(null, { status: 416, headers: responseHeaders });
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return unavailable(upstream.status === 404 ? 404 : 502);
    }
    if (request.method === 'HEAD') {
      await upstream.body?.cancel();
      return new Response(null, { status: upstream.status, headers: responseHeaders });
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return unavailable();
  }
}
