import { notFound } from 'next/navigation';
import { ExternalLink, Calendar, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { SiteFavicon } from '@/components/site-favicon';
import { SessionHubClient } from '@/components/session-hub-client';
import { SessionEventsProvider } from '@/hooks/session-events-context';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

function parseUrl(url: string) {
  try {
    const u = new URL(url);
    return { hostname: u.hostname, pathname: u.pathname === '/' ? '' : u.pathname };
  } catch {
    return { hostname: url, pathname: '' };
  }
}

export default async function SessionHubPage({ params }: Props) {
  const { id } = await params;

  let session;
  let initialActivity = null;
  try {
    [session, initialActivity] = await Promise.all([
      api.getSession(id),
      api.getSessionActivity(id).catch(() => null),
    ]);
  } catch {
    notFound();
  }

  const { hostname, pathname } = parseUrl(session.url);

  return (
    <div className="min-h-screen">
      <PageHeader crumbs={[{ label: 'Session' }]} />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
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
                  {formatDate(session.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Settings className="size-3.5" />
                  {session.mode.toUpperCase()} mode
                </span>
                <span className="text-xs text-muted-foreground/50 font-mono">{session.id}</span>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
            <a href={session.url} target="_blank" rel="noopener noreferrer">
              Open Site
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>

        <SessionEventsProvider sessionId={id}>
          <SessionHubClient sessionId={id} initial={session} initialActivity={initialActivity} />
        </SessionEventsProvider>
      </main>
    </div>
  );
}
