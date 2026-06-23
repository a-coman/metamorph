'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Globe, Users, Bot, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ALL_TRANSFORM_FAMILIES,
  formatFamilyLabel,
  type TransformFamilyId,
} from '@/lib/mr-versions';
import { TRANSFORM_FAMILY_DESCRIPTIONS } from '@/lib/transform-families';

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
  const [transformFamilies, setTransformFamilies] = useState<TransformFamilyId[]>(
    () => [...ALL_TRANSFORM_FAMILIES],
  );
  const [mode, setMode] = useState<Mode>('hitl');
  const [loading, setLoading] = useState(false);

  const allSelected = transformFamilies.length === ALL_TRANSFORM_FAMILIES.length;

  function toggleFamily(family: TransformFamilyId) {
    setTransformFamilies((current) => {
      if (current.includes(family)) {
        return current.filter((value) => value !== family);
      }
      return [...current, family];
    });
  }

  function toggleSelectAll() {
    setTransformFamilies(allSelected ? [] : [...ALL_TRANSFORM_FAMILIES]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || transformFamilies.length === 0) return;
    setLoading(true);
    try {
      const result = await api.createSession({
        url: url.trim(),
        mode,
        transformFamilies,
      });
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
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5" />
              Test Categories
            </Label>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_TRANSFORM_FAMILIES.map((family) => {
              const selected = transformFamilies.includes(family);
              return (
                <Tooltip key={family}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleFamily(family)}
                      className={cn(
                        'flex w-full items-center p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'interactive-card border-border bg-muted/20',
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium capitalize transition-colors',
                          selected ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {formatFamilyLabel(family)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {TRANSFORM_FAMILY_DESCRIPTIONS[family]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
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
          disabled={loading || !url.trim() || transformFamilies.length === 0}
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
