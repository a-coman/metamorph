'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RunDetailsDto } from '@metamorph/api-client';

function PayloadBlock({
  role,
  payload,
}: {
  role: string;
  payload: unknown;
}) {
  const text =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  return (
    <div className="space-y-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {role.replace('_', ' ')}
      </div>
      <pre className="text-xs font-mono bg-muted/40 rounded-lg border border-border/60 p-3 overflow-x-auto max-h-72 text-foreground/80 whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

export function RunRawPayloadsPanel({
  observations,
}: {
  observations: RunDetailsDto['observations'];
}) {
  const [open, setOpen] = useState(false);

  if (observations.length === 0) {
    return null;
  }

  const byRole: Record<string, RunDetailsDto['observations'][number]> = {};
  for (const obs of observations) {
    byRole[obs.role] = obs;
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left group"
        >
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Raw payloads
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full observation JSON captured during execution
            </p>
          </div>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['source', 'follow_up'] as const).map((role) => {
              const obs = byRole[role];
              if (!obs) {
                return (
                  <div
                    key={role}
                    className="text-xs text-muted-foreground font-mono py-4 text-center border border-dashed border-border rounded-lg"
                  >
                    No {role} observation
                  </div>
                );
              }
              return (
                <PayloadBlock key={role} role={role} payload={obs.payload} />
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
