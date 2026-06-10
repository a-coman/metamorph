'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Maximize2, Minimize2, Loader2, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { RunDetailsDto } from '@metamorph/api-client';

interface TraceViewerProps {
  artifacts: RunDetailsDto['artifacts'];
}

function TraceViewerEmbed({ traceUrl }: { traceUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const viewerUrl = `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Trace Viewer
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <a href={viewerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open full screen
            </a>
          </Button>
        </div>
      </div>

      <div
        className="rounded-lg overflow-hidden border border-border transition-all duration-300"
        style={{ height: expanded ? '720px' : '420px' }}
      >
        <iframe
          src={viewerUrl}
          className="w-full h-full"
          title="Playwright trace viewer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <p className="text-xs font-mono text-muted-foreground">
        Powered by{' '}
        <a
          href="https://trace.playwright.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          trace.playwright.dev
        </a>
        {' '}— requires MinIO CORS to allow the origin.
      </p>
    </div>
  );
}

export function TraceViewer({ artifacts }: TraceViewerProps) {
  const traceArtifacts = artifacts.filter((a) => a.kind === 'trace');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (traceArtifacts.length === 0) return;
    setLoading(true);
    Promise.all(
      traceArtifacts.map(async (art) => {
        const { url } = await api.getArtifactUrl(art.id);
        return [art.id, url] as const;
      }),
    )
      .then((entries) => {
        const map = Object.fromEntries(entries);
        setUrls(map);
        setSelected(traceArtifacts[0]?.id ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (traceArtifacts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Traces ({traceArtifacts.length})
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground font-mono">
          <Loader2 className="size-4 animate-spin" />
          Generating presigned URLs…
        </div>
      )}

      {!loading && traceArtifacts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {traceArtifacts.map((art) => (
            <button
              key={art.id}
              type="button"
              onClick={() => setSelected(art.id)}
              className={[
                'px-3 py-1.5 rounded border text-xs font-mono transition-colors',
                selected === art.id
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'interactive-card bg-card border-border text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {art.path.split('/').pop() ?? art.kind}
            </button>
          ))}
        </div>
      )}

      {!loading && selected && urls[selected] && (
        <TraceViewerEmbed traceUrl={urls[selected]} />
      )}
    </div>
  );
}
