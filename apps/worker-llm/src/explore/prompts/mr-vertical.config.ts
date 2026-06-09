import { OBSERVATION_CATALOG_FIELDS } from '@metamorph/core';

export const MR_VERTICAL_TRANSFORM_FAMILY = 'idempotence' as const;

export const MR_VERTICAL_CATALOG = OBSERVATION_CATALOG_FIELDS;

export const MR_VERTICAL_RULES = [
  'MVP vertical: idempotence of filter/search. Apply a filter in source, repeat the same action in follow_up.',
  `transform_family MUST be exactly "${MR_VERTICAL_TRANSFORM_FAMILY}".`,
  `relation.on MUST use ONLY catalog fields: ${OBSERVATION_CATALOG_FIELDS.join(', ')}.`,
  'Prefer relation.on including both applied_query and results_url for search idempotence MRs.',
  'relation.type should be "equal" for idempotence MRs.',
  'Prefer a simple search query on the homepage leading to a results/listing page — avoid login, checkout, or account walls.',
  'Phase goals must be achievable without authentication; dismiss cookie consent in the goal if the homepage shows a banner.',
  'Make goals concrete for verification: mention URL search params (e.g. /s?k=, /s/) and visible results grid or listing cards.',
  'For travel/listing sites (Airbnb): goal is destination search → listings/results page; avoid date-picker complexity — use a simple destination query like Madrid.',
] as const;
