'use client';

import Link from 'next/link';
import { Calendar, ChevronRight, ExternalLink, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteFavicon } from '@/components/site-favicon';
import { StatusBadge } from '@/components/status-badge';
import { SessionControlButton } from '@/components/session-control-button';
import { SessionLiveActivity } from '@/components/session-live-activity';
import { SessionPipelineStepper } from '@/components/session-pipeline-stepper';
import { MrVersionEventsProvider } from '@/hooks/mr-version-events-context';
import {
  resolveMrStatusBadge,
  useSessionHubState,
} from '@/hooks/use-session-hub-state';
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
    mr,
  } = useSessionHubState(session);

  return (
    <>
      <div className="flex items-start justify-between gap-4 p-5 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <SiteFavicon url={session.url} size="md" fallbackClassName="text-primary" />
          </div>
          <div className="space-y-2 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground truncate" title={session.url}>
                {hostname}
              </h1>
              {pathname && (
                <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {pathname}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Settings className="size-3.5" />
                {session.mode.toUpperCase()} mode
              </span>
              <span className="text-xs text-muted-foreground/50 font-mono">{session.id}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={session.url} target="_blank" rel="noopener noreferrer">
              Open Site
              <ExternalLink className="size-3.5" />
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

      <div className="space-y-8">
        {mr ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-5 shrink-0 bg-muted-foreground [mask-image:url(/logo-mark.svg)] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] [-webkit-mask-image:url(/logo-mark.svg)] [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center]"
              />
              <span className="text-sm font-medium text-muted-foreground">Metamorphic Relation</span>
            </div>
            <Link
              href={`/sessions/${sessionId}/mr/${mr.id}`}
              className="interactive-card group flex items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm cursor-pointer"
            >
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={resolveMrStatusBadge(mr.status, controlStatus)} />
                  <span className="text-sm font-medium text-foreground capitalize">
                    {mr.transformFamily}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground/60 font-mono truncate">{mr.id}</div>
              </div>
              <ChevronRight className="interactive-chevron size-5 shrink-0" />
            </Link>
          </div>
        ) : hasActiveJob ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl bg-muted/20">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Metamorphic relation pending</p>
            <p className="text-sm text-muted-foreground">Will appear once discovery completes</p>
          </div>
        ) : null}

        <div className="space-y-6">
          <SessionPipelineStepper mr={mr} jobs={jobs} controlStatus={controlStatus} />
          <MrVersionEventsProvider mrVersionId={mr?.id ?? null}>
            <SessionLiveActivity
              isActive={(hasActiveJob || !mr) && controlStatus === 'active'}
              controlStatus={controlStatus}
              initialActivity={initialActivity}
            />
          </MrVersionEventsProvider>
        </div>
      </div>
    </>
  );
}
