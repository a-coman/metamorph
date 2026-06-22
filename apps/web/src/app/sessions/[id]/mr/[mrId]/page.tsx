import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { RunSummaryDto } from '@metamorph/api-client';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { MrVersionTabs } from '@/components/mr-version-tabs';
import { MrVersionHeader } from '@/components/mr-version-header';
import { ExplorationTimeline, ExplorationTimelineSkeleton } from '@/components/exploration-timeline';
import { SessionEventsProvider } from '@/hooks/session-events-context';
import { PlaybookEditor, PlaybookSkeleton } from '@/components/playbook-editor';
import { RunsTab, RunsTabSkeleton } from '@/components/runs-tab';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; mrId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

async function ExplorationTab({
  mrId,
  initialControlStatus,
}: {
  mrId: string;
  initialControlStatus: string;
}) {
  const data = await api.getExploration(mrId);
  return (
    <ExplorationTimeline
      mrVersionId={mrId}
      initial={data}
      initialControlStatus={initialControlStatus}
    />
  );
}

async function PlaybookTab({
  mrId,
  mrStatus,
  sessionControlPaused,
}: {
  mrId: string;
  mrStatus: string;
  sessionControlPaused: boolean;
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
      sessionControlPaused={sessionControlPaused}
    />
  );
}

async function RunsTabWrapper({
  sessionId,
  mrId,
  mrStatus,
  sessionControlPaused,
}: {
  sessionId: string;
  mrId: string;
  mrStatus: string;
  sessionControlPaused: boolean;
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
      sessionControlPaused={sessionControlPaused}
    />
  );
}

export default async function MrVersionPage({ params, searchParams }: Props) {
  const { id: sessionId, mrId } = await params;
  const { tab: tabParam } = await searchParams;

  let mrVersion;
  let session;
  try {
    [mrVersion, session] = await Promise.all([
      api.getMrVersion(mrId),
      api.getSession(sessionId),
    ]);
  } catch {
    notFound();
  }

  const sessionControlPaused =
    session.controlStatus === 'paused' || session.controlStatus === 'pausing';

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
        <SessionEventsProvider sessionId={sessionId}>
          <MrVersionHeader
            mrId={mrId}
            initialMrStatus={mrVersion.status}
            initialControlStatus={session.controlStatus}
          />

          <Suspense>
            <MrVersionTabs
              defaultTab={defaultTab}
              exploration={
                <Suspense fallback={<ExplorationTimelineSkeleton />}>
                  <ExplorationTab
                    mrId={mrId}
                    initialControlStatus={session.controlStatus}
                  />
                </Suspense>
              }
              playbook={
                <Suspense fallback={<PlaybookSkeleton />}>
                  <PlaybookTab
                    mrId={mrId}
                    mrStatus={mrVersion.status}
                    sessionControlPaused={sessionControlPaused}
                  />
                </Suspense>
              }
              runs={
                <Suspense fallback={<RunsTabSkeleton />}>
                  <RunsTabWrapper
                    sessionId={sessionId}
                    mrId={mrId}
                    mrStatus={mrVersion.status}
                    sessionControlPaused={sessionControlPaused}
                  />
                </Suspense>
              }
            />
          </Suspense>
        </SessionEventsProvider>
      </main>
    </div>
  );
}
