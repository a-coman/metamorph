import { TRANSFORM_FAMILIES, isTransformFamily, type TransformFamily } from '@metamorph/core';

export function resolveSessionTransformFamilies(
  families: string[] | null | undefined,
): TransformFamily[] {
  const source =
    families && families.length > 0 ? families : [...TRANSFORM_FAMILIES];

  return source.filter((family): family is TransformFamily =>
    isTransformFamily(family),
  );
}
