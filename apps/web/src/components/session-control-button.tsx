'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type SessionControlButtonProps = {
  sessionId: string;
  controlStatus: string;
  hasActiveWork: boolean;
  onControlStatusChange?: (status: string) => void;
};

export function SessionControlButton({
  sessionId,
  controlStatus,
  hasActiveWork,
  onControlStatusChange,
}: SessionControlButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(controlStatus);

  useEffect(() => {
    setLocalStatus(controlStatus);
  }, [controlStatus]);

  const status = localStatus;

  const handlePause = () => {
    startTransition(async () => {
      try {
        const result = await api.pauseSession(sessionId);
        setLocalStatus(result.controlStatus);
        onControlStatusChange?.(result.controlStatus);
        toast.success('Session pausing…');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to pause session');
      }
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      try {
        const result = await api.resumeSession(sessionId);
        setLocalStatus(result.controlStatus);
        onControlStatusChange?.(result.controlStatus);
        toast.success('Session resumed');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to resume session');
      }
    });
  };

  if (status === 'pausing') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2 shrink-0">
        <Loader2 className="size-3.5 animate-spin" />
        Pausing…
      </Button>
    );
  }

  if (status === 'paused') {
    return (
      <Button
        variant="default"
        size="sm"
        className="gap-2 shrink-0"
        disabled={isPending}
        onClick={handleResume}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        Resume
      </Button>
    );
  }

  if (!hasActiveWork || status !== 'active') {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 shrink-0"
      disabled={isPending}
      onClick={handlePause}
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
      Pause
    </Button>
  );
}
