-- 008_add_degustation_slot_unique.sql — one reservation per tasting time slot.

BEGIN;

ALTER TABLE degustation
    ADD CONSTRAINT uq_degustation_slot UNIQUE (date_t);

COMMIT;
