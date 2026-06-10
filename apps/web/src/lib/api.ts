import { createApiClient } from '@metamorph/api-client';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = createApiClient({ baseUrl });

export { baseUrl };
