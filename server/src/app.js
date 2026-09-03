import express from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/index.js";
import { router } from "./http/routes.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { healthcheck } from "./db/pool.js";
import { asyncHandler } from "./http/middleware/asyncHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

// Builds the Express app. Order matters: security headers and body parsing
// first, then health + API routes, then the static site, and the error handler
// LAST so it catches everything above it.
export function createApp() {
  const app = express();
  const webRoot = path.resolve(serverRoot, config.server.webDir);
  if (!fs.existsSync(webRoot)) {
    throw new Error(`Static WEB_DIR does not exist: ${webRoot}`);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
        },
      },
    })
  );
  app.use(express.json());

  app.get(
    "/health",
    asyncHandler(async (req, res) => {
      const ok = await healthcheck();
      res.status(ok ? 200 : 503).json({ ok });
    })
  );

  app.use("/api", router);

  app.use(express.static(webRoot));

  app.get("/", (req, res) => {
    res.sendFile(path.join(webRoot, "main.html"));
  });

  app.use(errorHandler);

  return app;
}
