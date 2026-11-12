import { proxyArtifact } from '@/lib/artifact-proxy';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyArtifact(
    request,
    id,
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  );
}

export const HEAD = GET;
