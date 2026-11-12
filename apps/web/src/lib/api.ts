import { createApiClient } from '@metamorph/api-client';

const baseUrl = typeof window === 'undefined'
  ? process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  : '/api/backend';

export const api = createApiClient({ baseUrl });

export { baseUrl };
