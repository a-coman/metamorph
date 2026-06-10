'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMrVersionTab } from '@/hooks/use-mr-version-tab';

interface MrVersionTabsProps {
  defaultTab: string;
  exploration: React.ReactNode;
  playbook: React.ReactNode;
  runs: React.ReactNode;
}

const tabTriggerClassName =
  'text-sm text-muted-foreground hover:bg-hover-bg hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary data-[state=active]:shadow-sm rounded-lg px-4 transition-all cursor-pointer';

export function MrVersionTabs({ defaultTab, exploration, playbook, runs }: MrVersionTabsProps) {
  const { tab, setTab } = useMrVersionTab(defaultTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="bg-card border border-border h-10 p-1 gap-1 rounded-xl shadow-sm">
        <TabsTrigger value="exploration" className={tabTriggerClassName}>
          Exploration
        </TabsTrigger>
        <TabsTrigger value="playbook" className={tabTriggerClassName}>
          Playbook
        </TabsTrigger>
        <TabsTrigger value="runs" className={tabTriggerClassName}>
          Test Runs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="exploration" className="mt-0 animate-fade-in">
        {exploration}
      </TabsContent>

      <TabsContent value="playbook" className="mt-0 animate-fade-in">
        {playbook}
      </TabsContent>

      <TabsContent value="runs" className="mt-0 animate-fade-in">
        {runs}
      </TabsContent>
    </Tabs>
  );
}
