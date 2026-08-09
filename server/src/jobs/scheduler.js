import cron from "node-cron";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";
import { pollDeliveries } from "./pollDeliveries.js";
import { sendOutbox } from "./sendOutbox.js";

function nonOverlapping(name, job) {
  let running = false;
  return async () => {
    if (running) {
      logger.warn({ job: name }, "scheduled job skipped because previous run is active");
      return;
    }
    running = true;
    try {
      await job();
    } catch (error) {
      logger.error({ err: error, job: name }, "scheduled job failed");
    } finally {
      running = false;
    }
  };
}

const tasks = [];

export const scheduler = {
  start() {
    if (!config.jobs.schedulerEnabled || tasks.length) return;
    tasks.push(
      cron.schedule(config.jobs.deliveryPollCron, nonOverlapping("pollDeliveries", pollDeliveries)),
      cron.schedule(config.jobs.outboxCron, nonOverlapping("sendOutbox", sendOutbox))
    );
    logger.info(
      { deliveryPollCron: config.jobs.deliveryPollCron, outboxCron: config.jobs.outboxCron },
      "scheduler started"
    );
  },

  stop() {
    for (const task of tasks.splice(0)) task.destroy();
    logger.info("scheduler stopped");
  },
};
