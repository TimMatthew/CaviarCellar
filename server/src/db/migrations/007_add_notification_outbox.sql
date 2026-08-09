-- 007_add_notification_outbox.sql — durable retry queue for email notifications.

BEGIN;

CREATE TABLE notification_outbox (
    outbox_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient    varchar(255) NOT NULL,
    subject      varchar(255) NOT NULL,
    body_text    text NOT NULL,
    attempts     integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    sent_at      timestamptz,
    last_error   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_outbox_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_notification_outbox_pending
    ON notification_outbox (available_at, outbox_id)
    WHERE sent_at IS NULL;

COMMIT;
