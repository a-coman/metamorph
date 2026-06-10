'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Globe, Users, Bot, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Mode = 'hitl' | 'auto';

const MODE_OPTIONS: { value: Mode; label: string; description: string; icon: typeof Users }[] = [
  {
    value: 'hitl',
    label: 'Human-in-the-Loop',
    description: 'Review and approve before execution',
    icon: Users,
  },
  {
    value: 'auto',
    label: 'Autonomous',
    description: 'AI runs tests automatically',
    icon: Bot,
  },
];

export function SessionCreateForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<Mode>('hitl');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const result = await api.createSession({ url: url.trim(), mode });
      toast.success('Session created — discovery queued');
      router.push(`/sessions/${result.sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="session-url" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3.5" />
            Target URL
          </Label>
          <Input
            id="session-url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="h-10 font-mono text-sm bg-muted/30 border-border focus-visible:ring-primary/50 placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-goal" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="size-3.5" />
            Test Goal
            <span className="text-xs text-muted-foreground/60">(optional)</span>
          </Label>
          <Input
            id="session-goal"
            type="text"
            placeholder="e.g., Test checkout flow"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="h-10 text-sm bg-muted/30 border-border focus-visible:ring-primary/50 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Execution Mode
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  'flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'interactive-card border-border bg-muted/20'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-md shrink-0 transition-colors',
                  selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className={cn(
                    'text-sm font-medium transition-colors',
                    selected ? 'text-primary' : 'text-foreground'
                  )}>
                    {option.label}
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || !url.trim()}
          className="gap-2 font-medium h-10 px-5 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Start Session
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
