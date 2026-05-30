import { PrismaClient } from '@prisma/client';

// A single shared Prisma client for the process. Reused by routes and the seed script.
export const prisma = new PrismaClient();
