import pino from "pino";
import { config } from "../config/index.js";

// One shared structured logger. Level comes from config; ISO timestamps, and
// pid/hostname are dropped to keep lines readable. In production, pipe stdout
// to your log collector; in dev you can add `pino-pretty` if you want colour.
export const logger = pino({
  level: config.logLevel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
