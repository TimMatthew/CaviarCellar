-- 006_add_admin_login.sql — give admins a unique login identifier.
-- The base admin_t had only prof_id + password_t; multi-admin login needs a
-- username to log in with. admin_t is expected to be empty at this point.

BEGIN;

ALTER TABLE admin_t ADD COLUMN username varchar(64);
ALTER TABLE admin_t ADD CONSTRAINT uq_admin_username UNIQUE (username);

-- App requires username on every admin (enforced in code / seed). If admin_t is
-- empty you may also enforce it at the DB level:
--   ALTER TABLE admin_t ALTER COLUMN username SET NOT NULL;

COMMIT;
