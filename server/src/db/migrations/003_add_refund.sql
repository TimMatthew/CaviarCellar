-- 003_add_refund.sql — the single refund path (prepaid, not collected).

BEGIN;

CREATE TABLE refund (
    refund_id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id          bigint NOT NULL REFERENCES order_t(order_id) ON DELETE RESTRICT,
    amount            int NOT NULL,                      -- UAH, full goods value
    reason            varchar(32) NOT NULL DEFAULT 'not_collected',
    fondy_reverse_ref varchar(64),                       -- Fondy reverse id (audit / ПРРО)
    status            varchar(16) NOT NULL DEFAULT 'pending',
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_refund_order   UNIQUE (order_id),       -- one refund per order
    CONSTRAINT chk_refund_amount CHECK (amount >= 0),
    CONSTRAINT chk_refund_status CHECK (status IN ('pending','done','failed'))
);

COMMIT;
