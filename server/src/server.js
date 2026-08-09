import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { healthcheck, closePool } from "./db/pool.js";
import { scheduler } from "./jobs/scheduler.js";

const app = createApp();

const server = app.listen(config.server.port, async () => {
  logger.info({ port: config.server.port, env: config.env }, "server listening");
  try {
    const ok = await healthcheck();
    logger.info({ db: ok ? "connected" : "unreachable" }, "database check");
  } catch (err) {
    logger.error({ err }, "database check failed at startup");
  }
  scheduler.start();
});

// Graceful shutdown: stop accepting requests, drain the pool, exit.
async function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  scheduler.stop();
  server.close(async () => {
    try {
      await closePool();
    } finally {
      process.exit(0);
    }
  });
  // Safety net if connections don't close in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
