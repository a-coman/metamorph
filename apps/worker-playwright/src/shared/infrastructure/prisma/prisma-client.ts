import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../../api/generated/prisma/client.js';

const workerDir = resolve(import.meta.dirname, '../../../../');
const rootDir = resolve(import.meta.dirname, '../../../../../..');

config({ path: resolve(workerDir, '.env') });
config({ path: resolve(rootDir, '.env'), override: true });

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const prisma = createPrismaClient();
