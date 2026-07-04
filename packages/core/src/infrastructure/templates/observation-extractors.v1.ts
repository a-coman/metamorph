import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { renderObservableExtractor } from '../../application/compiler/observation-binding-compiler.js';

export type ObservationExtractorContext = {
  observables: ObservableDef[];
  anchorInventories: Map<string, PageSnapshotInventory>;
};

export function renderObservationExtractors(
  context: ObservationExtractorContext,
): string {
  return context.observables
    .map((observable) =>
      renderObservableExtractor(observable, context.anchorInventories),
    )
    .join('\n');
}
