-- 004_add_email_fondy_refs.sql — notification email + Fondy references +
-- constrain the payment method to the two we support.

BEGIN;

-- Email for order + degustation notifications (SMTP).
ALTER TABLE user_t ADD COLUMN email varchar(255);

-- References needed to reverse/reconcile a Fondy payment.
ALTER TABLE order_t ADD COLUMN fondy_order_ref  varchar(64);  -- order id sent to Fondy
ALTER TABLE order_t ADD COLUMN fondy_payment_id varchar(64);  -- Fondy transaction id

-- Lock method_t to the supported values.
ALTER TABLE order_t
    ADD CONSTRAINT chk_order_method
    CHECK (method_t IN ('prepaid_card','cod'));

-- Optional (not applied, to match current DB): once every order always sets a
-- method, you can enforce presence with:
--   ALTER TABLE order_t ALTER COLUMN method_t SET NOT NULL;

COMMIT;
