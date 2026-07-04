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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Observation profile</p>
      {relationOn.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Keys: {relationOn.join(', ')}
        </div>
      )}
      {observables.length > 0 && (
        <ul className="space-y-2 text-xs text-muted-foreground">
          {observables.map((observable) => (
            <li
              key={observable.key ?? observable.rationale}
              className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1"
            >
              <div className="font-mono text-foreground/90">{observable.key ?? 'observable'}</div>
              <div>
                {observable.compare ?? 'equal'} · {observable.valueType ?? 'unknown'} ·{' '}
                {observable.binding?.kind ?? 'binding'}
              </div>
              {observable.rationale && (
                <div className="text-muted-foreground">{observable.rationale}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
