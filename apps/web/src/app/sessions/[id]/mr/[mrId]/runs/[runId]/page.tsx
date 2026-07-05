import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunLivePoller } from '@/components/run-live-poller';
import { RunEvaluationPanel } from '@/components/run-evaluation-panel';
import { RunRawPayloadsPanel } from '@/components/run-raw-payloads-panel';
import { RunSummaryCard } from '@/components/run-summary-card';
import { TraceViewer } from '@/components/trace-viewer';
import {
  parseRunEvaluation,
  parseRunInputBundleError,
} from '@/lib/run-evaluation';
import type { RunDetailsDto } from '@metamorph/api-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; mrId: string; runId: string }>;
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
        <div
          key={art.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card/50"
        >
          <span className="text-xs text-muted-foreground capitalize w-16 shrink-0">
            {art.kind}
          </span>
          <span className="font-mono text-xs text-foreground/70 flex-1 truncate">{art.path}</span>
          {art.sizeBytes !== null && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {(art.sizeBytes / 1024).toFixed(1)} KB
            </span>
          )}
          <Link
            href={`/api/artifact-url/${art.id}`}
            target="_blank"
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            title="Download artifact"
          >
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      ))}
    </div>
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
  const evaluation = parseRunEvaluation(run.inputBundle);
  const executionError = parseRunInputBundleError(run.inputBundle);

  return (
    <div className="min-h-screen">
      <PageHeader
        crumbs={[
          { label: 'Session', href: `/sessions/${sessionId}` },
          { label: 'MR Details', href: `/sessions/${sessionId}/mr/${mrId}?tab=runs` },
          { label: 'Run' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <RunSummaryCard run={run} isActive={isActive} />

        {isActive && (
          <RunLivePoller runId={runId} mrVersionId={mrId} />
        )}

        {run.status === 'failed' && executionError && (
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                <span>Execution failed</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
                {executionError}
              </p>
            </CardContent>
          </Card>
        )}

        {evaluation && <RunEvaluationPanel evaluation={evaluation} />}

        {run.violations.length > 0 && !evaluation && (
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
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
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-destructive/20 bg-destructive/5"
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

        <RunRawPayloadsPanel observations={run.observations} />

        <TraceViewer artifacts={run.artifacts} />

        {run.artifacts.length > 0 && (
          <Card className="border-border bg-card shadow-sm">
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
