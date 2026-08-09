-- 005_rename_keyword_cols.sql — apply the _t suffix to the one column whose
-- name collides with a PostgreSQL keyword (LOCATION). Views/constraints that
-- reference it are updated automatically by RENAME COLUMN.

BEGIN;

ALTER TABLE delivery_event RENAME COLUMN location TO location_t;

COMMIT;
