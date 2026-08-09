-- 001_init.sql — base schema: identity supertype, catalogue, orders, tasting.
-- Run migrations in order against an EMPTY database to reproduce the current DB.

BEGIN;

-- Identity supertype: every person is one profile; user_t / admin_t extend it.
CREATE TABLE profile (
    prof_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_t  varchar(120) NOT NULL
);

CREATE TABLE user_t (
    prof_id      bigint PRIMARY KEY REFERENCES profile(prof_id) ON DELETE CASCADE,
    phone_number varchar(20) NOT NULL,
    CONSTRAINT uq_user_phone UNIQUE (phone_number)
);

CREATE TABLE admin_t (
    prof_id    bigint PRIMARY KEY REFERENCES profile(prof_id) ON DELETE CASCADE,
    password_t text NOT NULL          -- argon2/bcrypt HASH, never a raw password
);

CREATE TABLE caviar (
    caviar_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                varchar(150) NOT NULL,
    manufacturer_country varchar(100),
    fish                 varchar(100),
    description          varchar(500),
    net_weight_grams     int,
    price_uah            int NOT NULL,          -- UAH
    amount               int NOT NULL DEFAULT 0,-- stock on hand
    rel_image_path       varchar(255),
    CONSTRAINT chk_caviar_weight CHECK (net_weight_grams > 0),
    CONSTRAINT chk_caviar_price  CHECK (price_uah >= 0),
    CONSTRAINT chk_caviar_stock  CHECK (amount >= 0)
);

CREATE TABLE order_t (
    order_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES user_t(prof_id) ON DELETE RESTRICT,
    total_price int NOT NULL DEFAULT 0,          -- UAH, frozen at checkout
    status      varchar(16) NOT NULL DEFAULT 'pending',
    method_t    varchar(16),                     -- prepaid_card | cod (constrained in 004)
    paid_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_order_total  CHECK (total_price >= 0),
    CONSTRAINT chk_order_status CHECK (status IN ('pending','paid','cancelled','refunded'))
);

CREATE TABLE order_item (
    order_item_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id           bigint NOT NULL REFERENCES order_t(order_id) ON DELETE CASCADE,
    cav_id             bigint NOT NULL REFERENCES caviar(caviar_id) ON DELETE RESTRICT,
    cav_price_snapshot int NOT NULL,             -- UAH, captured at purchase
    cav_amount         int NOT NULL,             -- units
    CONSTRAINT chk_order_item_qty   CHECK (cav_amount > 0),
    CONSTRAINT chk_order_item_price CHECK (cav_price_snapshot >= 0),
    CONSTRAINT uq_order_item_line   UNIQUE (order_id, cav_id)
);

CREATE TABLE degustation (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       bigint NOT NULL REFERENCES user_t(prof_id) ON DELETE RESTRICT,
    date_t        timestamptz NOT NULL,
    guests_amount int NOT NULL,
    CONSTRAINT chk_degustation_guests CHECK (guests_amount > 0)
);

CREATE INDEX idx_order_user       ON order_t     (user_id);
CREATE INDEX idx_order_item_order ON order_item  (order_id);
CREATE INDEX idx_order_item_cav   ON order_item  (cav_id);
CREATE INDEX idx_degustation_user ON degustation (user_id);

-- Reconciliation view: live line sum vs the frozen charged total.
CREATE VIEW order_running_total AS
SELECT o.order_id,
       o.status,
       COALESCE(SUM(oi.cav_price_snapshot * oi.cav_amount), 0) AS computed_total,
       o.total_price                                           AS charged_total
FROM   order_t o
LEFT   JOIN order_item oi ON oi.order_id = o.order_id
GROUP  BY o.order_id, o.status, o.total_price;

COMMIT;
