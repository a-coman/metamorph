import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Target, Play, Eye } from 'lucide-react';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'active';

interface StatusConfig {
  label: string;
  type: StatusType;
  icon?: typeof CheckCircle;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  discover: 'Discovery',
  explore: 'Exploration',
  probe: 'Probe',
  execute_pair: 'Execution',
  replay: 'Replay',
  regenerate_step: 'Regeneration',
  llm_oracle: 'Oracle',
};

const STATUS_MAP: Record<string, StatusConfig> = {
  // Job statuses
  pending_enqueue: { label: 'Pending', type: 'neutral', icon: Clock },
  queued: { label: 'Queued', type: 'neutral', icon: Clock },
  running: { label: 'Running', type: 'active', icon: Loader2 },
  done: { label: 'Done', type: 'success', icon: CheckCircle },
  completed: { label: 'Completed', type: 'success', icon: CheckCircle },
  failed: { label: 'Failed', type: 'error', icon: XCircle },
  enqueue_failed: { label: 'Failed', type: 'error', icon: XCircle },

  // MR version statuses
  draft_pending_hitl: { label: 'Needs Review', type: 'warning', icon: Eye },
  approved: { label: 'Approved', type: 'success', icon: CheckCircle },
  exploration_failed: { label: 'Failed', type: 'error', icon: XCircle },
  exploring: { label: 'Exploring', type: 'active', icon: Loader2 },
  executing: { label: 'Executing', type: 'active', icon: Play },
  executed: { label: 'Executed', type: 'success', icon: CheckCircle },

  // Run verdicts
  pass: { label: 'Pass', type: 'success', icon: CheckCircle },
  fail: { label: 'Fail', type: 'error', icon: XCircle },
  pending: { label: 'Pending', type: 'neutral', icon: Clock },

  // Checkpoint verdicts
  ok: { label: 'OK', type: 'success', icon: CheckCircle },
  goal_reached: { label: 'Goal', type: 'info', icon: Target },
};

const TYPE_STYLES: Record<StatusType, string> = {
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  error: 'bg-red-50 text-red-600 border-red-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  info: 'bg-primary/10 text-primary border-primary/30',
  neutral: 'bg-muted/50 text-muted-foreground border-border',
  active: 'bg-primary/10 text-primary border-primary/30',
};

function resolveStatusConfig(status: string): StatusConfig {
  const direct = STATUS_MAP[status];
  if (direct) return direct;

  const colon = status.indexOf(':');
  if (colon !== -1) {
    const jobType = status.slice(0, colon);
    const jobStatus = status.slice(colon + 1);
    const jobLabel = JOB_TYPE_LABELS[jobType] ?? jobType.replace(/_/g, ' ');
    const statusCfg = STATUS_MAP[jobStatus];
    if (statusCfg) {
      return {
        label: `${jobLabel} · ${statusCfg.label}`,
        type: statusCfg.type,
        icon: statusCfg.icon,
      };
    }
  }

  return { label: status.replace(/_/g, ' '), type: 'neutral' };
}

export function StatusBadge({ status, className, size = 'sm' }: {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const cfg = resolveStatusConfig(status);
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium capitalize',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1',
        TYPE_STYLES[cfg.type],
        className,
      )}
    >
      {Icon && (
        <Icon className={cn(
          'shrink-0',
          size === 'sm' ? 'size-3' : 'size-3.5',
          cfg.type === 'active' && 'animate-spin'
        )} />
      )}
      {cfg.label}
    </span>
  );
}
