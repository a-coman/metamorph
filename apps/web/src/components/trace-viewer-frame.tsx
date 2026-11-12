'use client';

import { useSyncExternalStore } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const subscribe = () => () => {};
const getSecureContext = () => window.isSecureContext;
const getServerSnapshot = () => null;

export function TraceViewerFrame({ artifactId }: { artifactId: string }) {
  const secure = useSyncExternalStore(subscribe, getSecureContext, getServerSnapshot);

  const artifactUrl = `/api/artifact-url/${encodeURIComponent(artifactId)}`;
  const viewerUrl = `/trace-viewer/index.html?trace=${encodeURIComponent(artifactUrl)}`;

  if (secure === null) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading trace viewer…
      </div>
    );
  }

  if (!secure) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-sm font-medium">Open Metamorph over HTTPS to view this trace</p>
          <p className="text-sm text-muted-foreground">
            The viewer works over HTTPS or localhost. You can also download the trace to open it locally.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={artifactUrl} download={`trace-${artifactId}.zip`}>
            <Download className="size-4" />
            Download trace
          </a>
        </Button>
      </div>
    );
  }

  return (
    <iframe
      src={viewerUrl}
      className="h-full w-full border-0"
      title="Playwright trace viewer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
    />
  );
}
