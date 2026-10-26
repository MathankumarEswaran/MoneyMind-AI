import { afterAll, beforeAll } from "vitest";
import { disconnectDatabase, prisma } from "../db/prisma.js";

/**
 * Each test file starts from a known-empty database. TRUNCATE is fast and
 * CASCADE follows the foreign keys from users/workspaces down to sessions.
 */
beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "sessions", "memberships", "workspaces", "users" CASCADE',
  );
});

afterAll(async () => {
  await disconnectDatabase();
});
