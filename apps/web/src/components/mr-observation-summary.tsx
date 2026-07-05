import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCompareOperator } from '@/lib/run-evaluation';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type ObservableLike = {
  key?: string;
  compare?: string;
  valueType?: string;
  rationale?: string;
  binding?: { kind?: string };
};

function formatBindingKind(kind: string | undefined): string {
  if (!kind) return 'unknown';
  return kind.replace(/_/g, ' ');
}

export function MrObservationSummary({
  mrDefinition,
  generationSlots,
}: {
  mrDefinition: unknown;
  generationSlots: unknown;
}) {
  const definition = asRecord(mrDefinition);
  const slots = asRecord(generationSlots);
  const relation = asRecord(definition?.relation);
  const observation = asRecord(slots?.observation);
  const observables = Array.isArray(observation?.observables)
    ? (observation.observables as ObservableLike[])
    : [];

  const relationOn = Array.isArray(relation?.on)
    ? relation.on.filter((item): item is string => typeof item === 'string')
    : [];

  if (observables.length === 0 && relationOn.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          <span>Observation profile</span>
          {observables.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              · {observables.length} observable{observables.length === 1 ? '' : 's'}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {observables.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/80">
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground w-[11rem] py-2">
                  Key
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground w-[9.5rem] py-2">
                  Binding
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground w-10 py-2 text-center">
                  Cmp
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground w-16 py-2">
                  Type
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground py-2">
                  Rationale
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {observables.map((observable) => (
                <TableRow
                  key={observable.key ?? observable.rationale}
                  className="hover:bg-muted/20"
                >
                  <TableCell className="py-2 pr-2 align-top">
                    <span className="font-mono text-[11px] text-foreground leading-tight">
                      {observable.key ?? 'observable'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 align-top">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] capitalize px-1.5 py-0 h-5"
                    >
                      {formatBindingKind(observable.binding?.kind)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-center align-top">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] tabular-nums px-1.5 py-0 h-5 min-w-6 justify-center"
                      title={observable.compare ?? 'equal'}
                    >
                      {formatCompareOperator(observable.compare ?? 'equal')}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 align-top">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {observable.valueType ?? '?'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 align-top min-w-0 whitespace-normal">
                    {observable.rationale ? (
                      <p className="text-[11px] text-muted-foreground leading-snug font-sans">
                        {observable.rationale}
                      </p>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">
            Keys: {relationOn.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
