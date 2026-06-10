import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunLivePoller } from '@/components/run-live-poller';
import { TraceViewer } from '@/components/trace-viewer';
import type { RunDetailsDto } from '@metamorph/api-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; mrId: string; runId: string }>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(date));
}

function ObservationsPanel({ observations }: { observations: RunDetailsDto['observations'] }) {
  const byRole: Record<string, RunDetailsDto['observations']> = {};
  for (const obs of observations) {
    if (!byRole[obs.role]) byRole[obs.role] = [];
    byRole[obs.role].push(obs);
  }

  if (observations.length === 0) {
    return <p className="text-sm text-muted-foreground font-mono py-4">No observations</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(byRole).map(([role, items]) => (
        <div key={role} className="space-y-2">
          <div className="text-xs text-muted-foreground capitalize">{role}</div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {items.map((obs) => (
              <div
                key={obs.id}
                className="text-xs font-mono bg-muted/30 rounded p-2 text-foreground/80 whitespace-pre-wrap"
              >
                {typeof obs.payload === 'string'
                  ? obs.payload
                  : JSON.stringify(obs.payload, null, 2)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtifactsPanel({ artifacts }: {
  artifacts: RunDetailsDto['artifacts'];
}) {
  if (artifacts.length === 0) {
    return <p className="text-sm text-muted-foreground font-mono py-2">No artifacts</p>;
  }

  return (
    <div className="space-y-1">
      {artifacts.map((art) => (
        <ArtifactRow key={art.id} artifact={art} />
      ))}
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: RunDetailsDto['artifacts'][number] }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-card/50">
      <span className="text-xs text-muted-foreground capitalize w-16 shrink-0">
        {artifact.kind}
      </span>
      <span className="font-mono text-xs text-foreground/70 flex-1 truncate">{artifact.path}</span>
      {artifact.sizeBytes !== null && (
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {(artifact.sizeBytes / 1024).toFixed(1)} KB
        </span>
      )}
      <ArtifactDownloadLink artifactId={artifact.id} />
    </div>
  );
}

function ArtifactDownloadLink({ artifactId }: { artifactId: string }) {
  return (
    <Link
      href={`/api/artifact-url/${artifactId}`}
      target="_blank"
      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
      title="Download artifact"
    >
      <ExternalLink className="size-3.5" />
    </Link>
  );
}

export default async function RunDetailPage({ params }: Props) {
  const { id: sessionId, mrId, runId } = await params;

  let run: RunDetailsDto;
  try {
    run = await api.getRun(runId);
  } catch {
    notFound();
  }

  const isActive = ['pending', 'running'].includes(run.status);

  return (
    <div className="min-h-screen">
      <PageHeader
        crumbs={[
          { label: 'Session', href: `/sessions/${sessionId}` },
          { label: 'MR Details', href: `/sessions/${sessionId}/mr/${mrId}?tab=runs` },
          { label: 'Run' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold tracking-tight font-mono">Run #{run.attempt}</h1>
            <StatusBadge status={run.status} />
            {run.verdictStrict && <StatusBadge status={run.verdictStrict} />}
            {isActive && (
              <span className="text-xs font-mono text-primary animate-pulse">● live</span>
            )}
          </div>
          <div className="text-xs font-mono text-muted-foreground space-x-3">
            <span>Started {formatDate(run.createdAt)}</span>
            {run.finishedAt && <span>· Finished {formatDate(run.finishedAt)}</span>}
          </div>
        </div>

        {isActive && (
          <RunLivePoller runId={runId} mrVersionId={mrId} />
        )}

        {run.violations.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                <span>Violations ({run.violations.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {run.violations.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-3 py-2 rounded border border-destructive/20 bg-destructive/5"
                  >
                    <StatusBadge status={v.verdictStrict} />
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(v.createdAt).toISOString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="bg-border" />

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ObservationsPanel observations={run.observations} />
          </CardContent>
        </Card>

        <TraceViewer artifacts={run.artifacts} />

        {run.artifacts.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Artifacts ({run.artifacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ArtifactsPanel artifacts={run.artifacts} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
