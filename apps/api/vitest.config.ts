import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a dedicated PostgreSQL database. Starting the
 * suite never touches development data: `moneymind_test` is truncated by the
 * setup file and `migrate deploy` is expected to have been run once.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Auth tests share one PostgreSQL database, so files must not interleave.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://moneymind:moneymind_dev_only@localhost:5432/moneymind_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-0001",
      JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-002",
      ACCESS_TOKEN_TTL_SECONDS: "900",
      REFRESH_TOKEN_TTL_DAYS: "30",
      COOKIE_SECURE: "false",
      AUTH_RATE_LIMIT_MAX: "1000",
      RATE_LIMIT_MAX: "100000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/server.ts", "src/types/**"],
    },
  },
});
