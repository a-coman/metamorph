export type SlotStepLike = {
  action?: string;
  element_id?: string;
  value?: string;
  key?: string;
  url?: string;
  scroll_y?: number;
  timeout_ms?: number;
  resolved_selector?: string;
  selector?: string;
};

export function SlotStepLabel({ step }: { step: SlotStepLike }) {
  const action = step.action ?? 'step';

  return (
    <span>
      <span className="text-foreground/70">{action}</span>
      {step.element_id && <span className="ml-1 text-primary/70">{step.element_id}</span>}
      {action === 'press' && step.key && (
        <span className="ml-1 text-primary/70">{step.key}</span>
      )}
      {action === 'goto' && step.url && (
        <span className="ml-1 text-primary/70 truncate">{step.url}</span>
      )}
      {step.value && action !== 'goto' && action !== 'press' && (
        <span className="ml-1 opacity-50">= &quot;{step.value}&quot;</span>
      )}
      {!step.element_id && (step.resolved_selector ?? step.selector) && (
        <span className="ml-1 text-muted-foreground">{step.resolved_selector ?? step.selector}</span>
      )}
    </span>
  );
}
