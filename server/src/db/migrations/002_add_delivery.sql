-- 002_add_delivery.sql — Nova Poshta shipment per order + tracking history.

BEGIN;

CREATE TABLE delivery (
    delivery_id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id                bigint NOT NULL REFERENCES order_t(order_id) ON DELETE CASCADE,
    carrier                 varchar(20) NOT NULL DEFAULT 'nova_poshta',
    ttn                     varchar(30),           -- tracking number
    recipient_name          varchar(120),
    recipient_phone         varchar(20),
    recipient_city_ref      varchar(36),           -- NP city ref (UUID)
    recipient_warehouse_ref varchar(36),           -- NP warehouse ref (UUID)
    cod_amount              int,                   -- UAH; NULL = prepaid
    status                  varchar(16) NOT NULL DEFAULT 'pending',
    estimated_at            timestamptz,
    shipped_at              timestamptz,
    delivered_at            timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_delivery_order   UNIQUE (order_id),
    CONSTRAINT uq_delivery_ttn     UNIQUE (ttn),
    CONSTRAINT chk_delivery_cod    CHECK (cod_amount IS NULL OR cod_amount >= 0),
    CONSTRAINT chk_delivery_status CHECK (status IN
        ('pending','processing','shipped','in_transit','delivered','returned','cancelled'))
);

CREATE TABLE delivery_event (
    event_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_id    bigint NOT NULL REFERENCES delivery(delivery_id) ON DELETE CASCADE,
    status         varchar(16) NOT NULL,
    np_status_code varchar(8),
    description    varchar(255),
    location       varchar(150),                  -- renamed to location_t in 005
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_delivery_event_status CHECK (status IN
        ('pending','processing','shipped','in_transit','delivered','returned','cancelled'))
);

CREATE INDEX idx_delivery_order       ON delivery       (order_id);
CREATE INDEX idx_delivery_status      ON delivery       (status);
CREATE INDEX idx_delivery_event_deliv ON delivery_event (delivery_id, created_at);

-- Admin dashboard view: order + payment + shipment at a glance.
CREATE VIEW order_delivery_overview AS
SELECT o.order_id,
       o.status     AS order_status,
       o.method_t   AS payment_method,
       o.total_price,
       d.status     AS delivery_status,
       d.carrier,
       d.ttn,
       d.cod_amount,
       d.estimated_at,
       d.delivered_at
FROM   order_t o
LEFT   JOIN delivery d ON d.order_id = o.order_id;

COMMIT;
