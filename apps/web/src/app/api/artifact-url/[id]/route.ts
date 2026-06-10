import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { url } = await api.getArtifactUrl(id);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
