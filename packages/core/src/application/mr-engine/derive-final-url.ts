import type { ObservableDef } from '../../domain/schemas/observable.schema.js';

function resolvePathToAbsoluteUrl(pathOrUrl: string, sessionUrl: string): string | null {
  try {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    return new URL(pathOrUrl, sessionUrl).href;
  } catch {
    return pathOrUrl || null;
  }
}

export function deriveFinalUrlFromObservation(
  observation: Record<string, unknown>,
  observables: ObservableDef[],
  sessionUrl: string,
): string | null {
  if (typeof observation.results_url === 'string' && observation.results_url.length > 0) {
    return resolvePathToAbsoluteUrl(observation.results_url, sessionUrl);
  }

  for (const observable of observables) {
    if (observable.binding.kind !== 'url_params') {
      continue;
    }
    const value = observation[observable.key];
    if (typeof value === 'string' && value.length > 0) {
      return resolvePathToAbsoluteUrl(value, sessionUrl);
    }
  }

  for (const observable of observables) {
    if (observable.binding.kind !== 'url_pathname') {
      continue;
    }
    const value = observation[observable.key];
    if (typeof value === 'string' && value.length > 0) {
      return resolvePathToAbsoluteUrl(value, sessionUrl);
    }
  }

  return null;
}
