import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/index.js";
import { router } from "./http/routes.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { healthcheck } from "./db/pool.js";
import { asyncHandler } from "./lib/asyncHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Express app. Order matters: security headers and body parsing
// first, then health + API routes, then the static site, and the error handler
// LAST so it catches everything above it.
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  app.get(
    "/health",
    asyncHandler(async (req, res) => {
      const ok = await healthcheck();
      res.status(ok ? 200 : 503).json({ ok });
    })
  );

  app.use("/api", router);

  // Serve the static frontend (web/) from the same origin — no CORS needed.
  // config.server.webDir is relative to this file (src/), default ../../web.
  app.use(express.static(path.resolve(__dirname, config.server.webDir)));

  app.use(errorHandler);

  return app;
}
