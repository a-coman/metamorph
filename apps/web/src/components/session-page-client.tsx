'use client';

import { useState, useEffect } from 'react';
import { Calendar, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteFavicon } from '@/components/site-favicon';
import { SessionControlButton } from '@/components/session-control-button';
import { SessionLiveActivity } from '@/components/session-live-activity';
import { SessionMrVersionsEventsProvider } from '@/hooks/session-mr-versions-events-context';
import { useSessionHubState } from '@/hooks/use-session-hub-state';
import {
  resolveDefaultActivitySelection,
  syncActivitySelection,
  type ActivitySelection,
} from '@/lib/session-activity-by-family';
import type { SessionActivityDto, SessionDetailsDto } from '@metamorph/api-client';

interface SessionPageClientProps {
  sessionId: string;
  session: SessionDetailsDto;
  initialActivity?: SessionActivityDto | null;
  hostname: string;
  pathname: string;
  formattedDate: string;
}

export function SessionPageClient({
  sessionId,
  session,
  initialActivity,
  hostname,
  pathname,
  formattedDate,
}: SessionPageClientProps) {
  const {
    jobs,
    controlStatus,
    setControlStatus,
    hasActiveJob,
    hasInterruptibleWork,
    mrVersions,
  } = useSessionHubState(session);

  const [selectedFamily, setSelectedFamily] = useState<ActivitySelection>(() =>
    resolveDefaultActivitySelection(session.mrVersions),
  );

  useEffect(() => {
    setSelectedFamily((current) => syncActivitySelection(current, mrVersions));
  }, [mrVersions]);

  return (
    <>
      {/* Session identity */}
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <SiteFavicon url={session.url} size="md" fallbackClassName="text-primary" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1
                className="text-base font-semibold text-foreground truncate"
                title={session.url}
              >
                {hostname}
              </h1>
              {pathname && (
                <span className="text-sm text-muted-foreground truncate max-w-[240px]">
                  {pathname}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Settings className="size-3" />
                {session.mode.toUpperCase()} mode
              </span>
              <span
                className="font-mono text-muted-foreground/40 truncate max-w-[200px]"
                title={session.id}
              >
                {session.id}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={session.url} target="_blank" rel="noopener noreferrer">
              Open Site
              <ExternalLink className="size-3" />
            </a>
          </Button>
          <SessionControlButton
            sessionId={sessionId}
            controlStatus={controlStatus}
            hasActiveWork={hasInterruptibleWork}
            onControlStatusChange={setControlStatus}
          />
        </div>
      </div>

      {/*
       * Run — pipeline state and live activity for this execution.
       * Future: when a session supports multiple runs, wrap this in a run
       * selector (tabs/dropdown) and pass a runId down to sub-components.
       */}
      <SessionMrVersionsEventsProvider mrVersions={mrVersions}>
        <SessionLiveActivity
          sessionId={sessionId}
          isActive={(hasActiveJob || mrVersions.length === 0) && controlStatus === 'active'}
          controlStatus={controlStatus}
          initialActivity={initialActivity}
          mrVersions={mrVersions}
          jobs={jobs}
          selectedFamily={selectedFamily}
          onSelectFamily={setSelectedFamily}
        />
      </SessionMrVersionsEventsProvider>
    </>
  );
}
