import { createApiClient } from '@metamorph/api-client';

export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3001';
}

export function createValidationApiClient() {
  return createApiClient({ baseUrl: getApiUrl() });
}
