'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-5 text-center">
        <div className="flex justify-center">
          <div className="size-12 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold font-mono">Connection error</h1>
          <p className="text-sm text-muted-foreground">
            Cannot reach the API at{' '}
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {process.env.NEXT_PUBLIC_API_URL ?? 'localhost:3001'}
            </code>
            . Make sure the backend is running.
          </p>
        </div>
        <Button onClick={reset} variant="outline" size="sm" className="gap-2 font-mono text-xs">
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    </div>
  );
}
