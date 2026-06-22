import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { SessionPageClient } from '@/components/session-page-client';
import { SessionEventsProvider } from '@/hooks/session-events-context';

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
        <SessionEventsProvider sessionId={id}>
          <SessionPageClient
            sessionId={id}
            session={session}
            initialActivity={initialActivity}
            hostname={hostname}
            pathname={pathname}
            formattedDate={formatDate(session.createdAt)}
          />
        </SessionEventsProvider>
      </main>
    </div>
  );
}
