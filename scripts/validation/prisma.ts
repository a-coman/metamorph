import { loadValidationEnv } from './env.js';
loadValidationEnv();
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/api/generated/prisma/client.js';

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (client) {
    return client;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
