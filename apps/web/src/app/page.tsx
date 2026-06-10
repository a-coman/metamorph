import { Suspense } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { SessionCreateForm } from '@/components/session-create-form';
import { SessionListTable, SessionListSkeleton } from '@/components/session-list-table';

export const dynamic = 'force-dynamic';

async function SessionList() {
  try {
    const data = await api.listSessions({ limit: 20 });
    return (
      <SessionListTable
        initialItems={data.items}
        initialNextCursor={data.nextCursor}
      />
    );
  } catch {
    return <ApiDownBanner />;
  }
}

function ApiDownBanner() {
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground">Sessions</span>
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
        <div className="p-1.5 rounded-md bg-amber-100 text-amber-600 shrink-0">
          <AlertTriangle className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-700">Backend Unavailable</p>
          <p className="text-sm text-amber-600">
            Start the API server at{' '}
            <code className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">localhost:3001</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <PageHeader />

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-medium tracking-tight text-foreground">
                New Session
              </h1>
              <p className="text-sm text-muted-foreground">
                Test metamorphic relations on any web application
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
            <SessionCreateForm />
          </div>
        </section>

        <section>
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
