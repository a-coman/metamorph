function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
  const anchors = asRecord(observation?.anchors);
  const visibleAnchor = asRecord(anchors?.visible_item_count);

  const relationType =
    typeof relation?.type === 'string' ? relation.type : null;
  const relationOn = Array.isArray(relation?.on)
    ? relation.on.filter((item): item is string => typeof item === 'string')
    : [];

  if (!relationType && relationOn.length === 0 && !visibleAnchor) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Observation profile</p>
      {(relationType || relationOn.length > 0) && (
        <div className="text-sm text-foreground/80">
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">
            {relationType ?? 'relation'}
          </span>
          {relationOn.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              on {relationOn.join(', ')}
            </span>
          )}
        </div>
      )}
      {visibleAnchor && (
        <div className="text-xs text-muted-foreground space-y-1 font-mono">
          <div>
            container: {String(visibleAnchor.container_element_id ?? 'n/a')}
          </div>
          <div>
            snapshot: {String(visibleAnchor.inventory_snapshot_id ?? 'n/a').slice(0, 8)}…
          </div>
          {typeof visibleAnchor.item_selector_hint === 'string' && (
            <div>item hint: {visibleAnchor.item_selector_hint}</div>
          )}
        </div>
      )}
    </div>
  );
}
