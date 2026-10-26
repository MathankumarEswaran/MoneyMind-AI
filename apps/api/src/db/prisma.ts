import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
    log: env.isDev
      ? [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : [{ emit: "event", level: "error" }],
  });

  client.$on("warn", (event) => logger.warn({ prisma: event }, "Prisma warning"));
  client.$on("error", (event) => logger.error({ prisma: event }, "Prisma error"));

  return client;
}

/**
 * One client per process. Reusing it across hot reloads and test files avoids
 * exhausting PostgreSQL connections.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, "Database readiness check failed");
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
