-- ==============================================================================
-- FONDY USD TEST CONVERSION
-- Store the exact provider amount and currency used to create the Fondy checkout.
-- The order total remains UAH; these fields are payment-provider audit values.
-- ==============================================================================

BEGIN;

ALTER TABLE order_t
    ADD COLUMN fondy_currency varchar(3),
    ADD COLUMN fondy_amount_minor bigint;

ALTER TABLE order_t
    ADD CONSTRAINT chk_fondy_payment_terms_pair
        CHECK (
            (fondy_currency IS NULL AND fondy_amount_minor IS NULL)
            OR
            (fondy_currency IS NOT NULL AND fondy_amount_minor IS NOT NULL)
        ),
    ADD CONSTRAINT chk_fondy_currency
        CHECK (fondy_currency IS NULL OR fondy_currency IN ('UAH', 'USD')),
    ADD CONSTRAINT chk_fondy_amount_minor
        CHECK (fondy_amount_minor IS NULL OR fondy_amount_minor > 0);

CREATE UNIQUE INDEX uq_order_fondy_order_ref
    ON order_t (fondy_order_ref)
    WHERE fondy_order_ref IS NOT NULL;

COMMIT;

-- ==============================================================================
