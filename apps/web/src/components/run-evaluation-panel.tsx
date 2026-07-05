import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
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
import { cn } from '@/lib/utils';
import {
  formatCompareOperator,
  formatObservationValue,
  type RunEvaluation,
} from '@/lib/run-evaluation';

function EvaluationProgressBar({ evaluation }: { evaluation: RunEvaluation }) {
  const passPct = (evaluation.passedCount / evaluation.totalCount) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {evaluation.passedCount > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${passPct}%` }}
          />
        )}
        {evaluation.failedCount > 0 && (
          <div
            className="bg-destructive transition-all"
            style={{ width: `${100 - passPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>
          {evaluation.passedCount} passed
          {evaluation.failedCount > 0 && ` · ${evaluation.failedCount} failed`}
        </span>
        <span>{evaluation.totalCount} observables</span>
      </div>
    </div>
  );
}

function ValueCell({
  value,
  highlight,
}: {
  value: unknown;
  highlight?: boolean;
}) {
  const text = formatObservationValue(value);

  return (
    <span
      className={cn(
        'break-all text-foreground/80',
        highlight && 'text-destructive font-medium',
      )}
      title={text}
    >
      {text}
    </span>
  );
}

function ResultIndicator({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span className="text-[11px] font-medium">Pass</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-destructive">
      <XCircle className="size-3.5 shrink-0" />
      <span className="text-[11px] font-medium">Fail</span>
    </span>
  );
}

export function RunEvaluationPanel({ evaluation }: { evaluation: RunEvaluation }) {
  const allPassed = evaluation.failedCount === 0;

  return (
    <Card
      className={cn(
        'border-border bg-card shadow-sm',
        allPassed ? 'border-emerald-200/60' : 'border-destructive/30',
      )}
    >
      <CardHeader className="pb-4 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium text-foreground">
              Observable evaluation
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Per-field comparison between source and follow_up phases
            </p>
          </div>
          <StatusBadge status={allPassed ? 'pass' : 'fail'} size="md" />
        </div>
        <EvaluationProgressBar evaluation={evaluation} />
        {!allPassed && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-foreground/80">
              <span className="font-medium text-destructive">
                {evaluation.failedCount} violation{evaluation.failedCount === 1 ? '' : 's'}
              </span>
              {': '}
              <span className="font-mono">{evaluation.failedKeys.join(', ')}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/80">
              <TableHead className="w-3 pl-4" />
              <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground w-[22%]">
                Observable
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground min-w-[120px]">
                Source
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground w-16 text-center">
                Compare
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground min-w-[120px]">
                Follow-up
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground w-20 text-right pr-4">
                Result
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluation.displayKeys.map((key) => {
              const detail = evaluation.details[key];
              const passed = detail.ok;

              return (
                <TableRow
                  key={key}
                  className={cn(
                    passed ? 'hover:bg-muted/30' : 'bg-destructive/[0.03] hover:bg-destructive/[0.06]',
                  )}
                >
                  <TableCell className="pl-4 align-middle">
                    <div
                      className={cn(
                        'w-1 h-8 rounded-full',
                        passed ? 'bg-emerald-400/70' : 'bg-destructive',
                      )}
                    />
                  </TableCell>
                  <TableCell className="align-middle py-3 pr-2">
                    <div className="font-mono text-xs text-foreground">{key}</div>
                    {detail.error && (
                      <div className="text-[11px] text-destructive mt-1">{detail.error}</div>
                    )}
                  </TableCell>
                  <TableCell className="align-middle py-3 font-mono text-xs whitespace-normal">
                    <ValueCell value={detail.source} />
                  </TableCell>
                  <TableCell className="align-middle py-3 text-center">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] px-1.5 tabular-nums"
                      title={detail.compare}
                    >
                      {formatCompareOperator(detail.compare)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-middle py-3 font-mono text-xs whitespace-normal">
                    <ValueCell
                      value={detail.followUp}
                      highlight={!passed}
                    />
                  </TableCell>
                  <TableCell className="align-middle py-3 text-right pr-4">
                    <ResultIndicator passed={passed} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
