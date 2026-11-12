'use client';

import { useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TraceViewerFrame } from '@/components/trace-viewer-frame';
import type { RunDetailsDto } from '@metamorph/api-client';

interface TraceViewerProps {
  artifacts: RunDetailsDto['artifacts'];
}

function TraceViewerEmbed({ artifactId }: { artifactId: string }) {
  const [expanded, setExpanded] = useState(false);
  const viewerUrl = `/traces/${encodeURIComponent(artifactId)}`;

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
        <TraceViewerFrame artifactId={artifactId} />
      </div>
    </div>
  );
}

export function TraceViewer({ artifacts }: TraceViewerProps) {
  const traceArtifacts = artifacts.filter((a) => a.kind === 'trace');
  const [selection, setSelected] = useState<string | null>(null);
  const selected = traceArtifacts.find((artifact) => artifact.id === selection)?.id
    ?? traceArtifacts[0]?.id;

  if (traceArtifacts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Traces ({traceArtifacts.length})
        </span>
      </div>

      {traceArtifacts.length > 1 && (
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

      {selected && (
        <TraceViewerEmbed artifactId={selected} />
      )}
    </div>
  );
}
