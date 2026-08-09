import { config } from "../config/index.js";
import { outboxRepo } from "../reps/outbox-repo.js";
import { sendMail } from "../integrations/mail/mailer.js";
import { logger } from "../lib/logger.js";

export async function sendOutbox() {
  const messages = await outboxRepo.listPending({ limit: config.jobs.outboxBatchSize });
  let sent = 0;
  let failed = 0;
  for (const message of messages) {
    try {
      await sendMail({
        to: message.recipient,
        subject: message.subject,
        text: message.body_text,
        throwOnError: true,
      });
      await outboxRepo.markSent(message.outbox_id);
      sent += 1;
    } catch (error) {
      failed += 1;
      const delay = Math.min(
        config.jobs.outboxMaxRetrySeconds,
        config.jobs.outboxRetrySeconds * 2 ** message.attempts
      );
      await outboxRepo.markFailed(message.outbox_id, error.message, delay);
      logger.error({ err: error, outboxId: message.outbox_id }, "outbox delivery failed");
    }
  }
  return { checked: messages.length, sent, failed };
}
