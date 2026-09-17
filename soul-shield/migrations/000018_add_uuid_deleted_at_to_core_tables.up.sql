-- +migrate Up

-- gen_random_uuid() is built into Postgres core since v13, but this
-- guarantees the function exists regardless of the target Postgres version.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid: stable client-facing identifier for the mobile app's local-first
-- sync protocol (see soul-shield-mobile-app's Drizzle schema) — kept
-- alongside the existing BIGSERIAL id/BIGINT FKs rather than replacing them,
-- since an in-place PK swap on live data is far riskier than an additive
-- column. deleted_at: soft delete, so a row can still be referenced by
-- uuid/updated_at in a sync pull after being "deleted" instead of vanishing
-- via the old ON DELETE CASCADE/SET NULL hard-delete behavior.
ALTER TABLE tasks ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD CONSTRAINT uq_tasks_uuid UNIQUE (uuid);

ALTER TABLE categories ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE categories ADD CONSTRAINT uq_categories_uuid UNIQUE (uuid);

ALTER TABLE sub_tasks ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sub_tasks ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE sub_tasks ADD CONSTRAINT uq_sub_tasks_uuid UNIQUE (uuid);

-- Every existing read path filters deleted_at IS NULL (see repo/*.go changes
-- in this same phase) — index it alongside the columns those reads already
-- filter/order by.
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_sub_tasks_deleted_at ON sub_tasks(deleted_at) WHERE deleted_at IS NOT NULL;
