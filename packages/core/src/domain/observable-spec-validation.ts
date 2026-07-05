import type {
  ObservableDef,
  ObservableValueType,
  ObservationBinding,
} from './schemas/observable.schema.js';

const BINDING_VALUE_TYPE: Record<ObservationBinding['kind'], ObservableValueType> = {
  input_value: 'string',
  text_content: 'string',
  url_pathname: 'string',
  url_params: 'string',
  composite: 'string',
  number_from_label: 'number',
  list_texts: 'string[]',
  presence: 'boolean',
};

export function expectedValueTypeForBinding(
  kind: ObservationBinding['kind'],
): ObservableValueType {
  return BINDING_VALUE_TYPE[kind];
}

export function validateObservableBindingValueType(
  observable: ObservableDef,
): string | null {
  const expected = expectedValueTypeForBinding(observable.binding.kind);

  if (observable.valueType !== expected) {
    return (
      `${observable.key}: binding kind ${observable.binding.kind} requires ` +
      `valueType ${expected}, got ${observable.valueType}`
    );
  }

  if (observable.compare === 'cardinality_lte' && observable.valueType !== 'number') {
    return (
      `${observable.key}: compare cardinality_lte requires valueType number, ` +
      `got ${observable.valueType}`
    );
  }

  return null;
}
