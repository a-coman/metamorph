import { TraceViewerFrame } from '@/components/trace-viewer-frame';

export default async function TracePage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  return (
    <main className="h-dvh">
      <TraceViewerFrame artifactId={artifactId} />
    </main>
  );
}
