import { createServer } from "node:http";
import { APP_NAME } from "@moneymind/shared";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { checkDatabase, disconnectDatabase } from "./db/prisma.js";

const app = createApp();
const server = createServer(app);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.fatal({ port: env.port }, "Port is already in use");
  } else {
    logger.fatal({ err: error }, "HTTP server failed to start");
  }
  process.exit(1);
});

server.listen(env.port, env.host, () => {
  logger.info(
    {
      name: APP_NAME,
      url: `http://localhost:${env.port}`,
      environment: env.nodeEnv,
      docs: `http://localhost:${env.port}/api/v1/health`,
    },
    "MoneyMind API listening",
  );

  void checkDatabase().then((up) => {
    if (up) {
      logger.info("PostgreSQL connection verified");
    } else {
      logger.error("PostgreSQL is not reachable; auth endpoints will fail until it is");
    }
  });
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Graceful shutdown started");

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    if (error) {
      logger.error({ err: error }, "HTTP server closed with an error");
      process.exit(1);
    }
    logger.info("HTTP server closed");
    void disconnectDatabase()
      .catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, "Failed to close the database connection");
      })
      .finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  shutdown("SIGTERM");
});
