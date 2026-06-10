import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { RunSummaryDto } from '@metamorph/api-client';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { MrVersionTabs } from '@/components/mr-version-tabs';
import { StatusBadge } from '@/components/status-badge';
import { ExplorationTimeline, ExplorationTimelineSkeleton } from '@/components/exploration-timeline';
import { PlaybookEditor, PlaybookSkeleton } from '@/components/playbook-editor';
import { RunsTab, RunsTabSkeleton } from '@/components/runs-tab';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; mrId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

async function ExplorationTab({ mrId }: { mrId: string }) {
  const data = await api.getExploration(mrId);
  return <ExplorationTimeline mrVersionId={mrId} initial={data} />;
}

async function PlaybookTab({
  mrId,
  mrStatus,
}: {
  mrId: string;
  mrStatus: string;
}) {
  let content = '';
  try {
    content = await api.getPlaybook(mrId);
  } catch {
    content = '# Playbook not yet available';
  }
  return (
    <PlaybookEditor
      mrVersionId={mrId}
      initialContent={content}
      status={mrStatus}
    />
  );
}

async function RunsTabWrapper({
  sessionId,
  mrId,
  mrStatus,
}: {
  sessionId: string;
  mrId: string;
  mrStatus: string;
}) {
  let runs: RunSummaryDto[] = [];
  try {
    runs = await api.listRuns(mrId);
  } catch {
    runs = [];
  }
  return (
    <RunsTab
      sessionId={sessionId}
      mrVersionId={mrId}
      mrStatus={mrStatus}
      initialRuns={runs}
    />
  );
}

export default async function MrVersionPage({ params, searchParams }: Props) {
  const { id: sessionId, mrId } = await params;
  const { tab: tabParam } = await searchParams;

  let mrVersion;
  try {
    mrVersion = await api.getMrVersion(mrId);
  } catch {
    notFound();
  }

  const defaultTab =
    tabParam ??
    (mrVersion.status === 'draft_pending_hitl'
      ? 'playbook'
      : ['approved', 'executing', 'executed'].includes(mrVersion.status)
        ? 'runs'
        : 'exploration');

  return (
    <div className="min-h-screen">
      <PageHeader
        crumbs={[
          { label: 'Session', href: `/sessions/${sessionId}` },
          { label: 'MR Details' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">
                Metamorphic Relation
              </h1>
              <StatusBadge status={mrVersion.status} />
            </div>
            <div className="text-xs text-muted-foreground font-mono">{mrId}</div>
          </div>
        </div>

        <Suspense>
          <MrVersionTabs
            defaultTab={defaultTab}
            exploration={
              <Suspense fallback={<ExplorationTimelineSkeleton />}>
                <ExplorationTab mrId={mrId} />
              </Suspense>
            }
            playbook={
              <Suspense fallback={<PlaybookSkeleton />}>
                <PlaybookTab mrId={mrId} mrStatus={mrVersion.status} />
              </Suspense>
            }
            runs={
              <Suspense fallback={<RunsTabSkeleton />}>
                <RunsTabWrapper sessionId={sessionId} mrId={mrId} mrStatus={mrVersion.status} />
              </Suspense>
            }
          />
        </Suspense>
      </main>
    </div>
  );
}
