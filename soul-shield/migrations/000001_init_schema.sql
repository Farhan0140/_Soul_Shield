-- +migrate Up

-- Soul Shield baseline schema.
--
-- This single migration replaces the original 20 incremental ones (they
-- contained a duplicated 000008, a constraint that was dropped and re-added
-- three times, and a backfill for data that no longer exists). It describes
-- the schema exactly as the Go repos (repo/*.go) and the mobile app's
-- local-first sync protocol (GET/POST /sync) expect it. Add every future
-- change as a NEW numbered file (000002_..., ...) - never edit this one once
-- it has been applied to a real database.
--
-- Conventions
--   * id      BIGSERIAL PK - what the web client and the REST routes use.
--   * uuid    stable client-generated/facing identifier - what the mobile
--             app's on-device SQLite store and the /sync protocol key on.
--             Both identifiers exist on every synced table on purpose.
--   * deleted_at  soft delete, so a sync pull can tell a client a row was
--             deleted instead of the row silently vanishing. Every read
--             path filters "deleted_at IS NULL".
--   * updated_at  stamped by trigger on every UPDATE (see set_updated_at) -
--             the sync pull cursor compares against it.
--   * All timestamps are TIMESTAMPTZ NOT NULL.

-- ---------------------------------------------------------------------------
-- Shared trigger: stamp updated_at on every UPDATE.
--
-- StatementBegin/End tells sql-migrate to treat the whole CREATE FUNCTION as
-- one statement instead of splitting it on the semicolons inside the $$ body.
-- +migrate StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +migrate StatementEnd

-- ---------------------------------------------------------------------------
-- Users & auth
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL CHECK (length(full_name) > 0),
    -- Always stored trimmed + lowercase (repo/user.go normalizeEmail), so
    -- "Farhan@x.com" on a phone keyboard and "farhan@x.com" on the website
    -- can never become two accounts. The CHECK makes a code path that forgets
    -- to normalize fail loudly instead of silently creating a duplicate.
    email       VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
    password    TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),

    security_answer_hash         TEXT,
    security_answer_attempts     INT NOT NULL DEFAULT 0,
    security_answer_locked_until TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE email_otps (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    otp         VARCHAR(255) NOT NULL,
    verified    BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE security_answer_attempt_logs (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    success     BOOLEAN NOT NULL,
    ip_address  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_answer_attempt_logs_email ON security_answer_attempt_logs(email);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    uuid        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name        VARCHAR(100) NOT NULL CHECK (length(name) > 0),
    color_hex   VARCHAR(7) NOT NULL DEFAULT '#CCCCCC' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- Unique among LIVE categories only. A plain UNIQUE (owner_id, name) counted
-- soft-deleted rows too, so deleting "Work" and creating "Work" again (on
-- either client) was rejected as a duplicate of the deleted one - the new
-- category never reached the server and the two clients diverged.
CREATE UNIQUE INDEX uq_categories_owner_name ON categories(owner_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_owner_position ON categories(owner_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_owner_updated ON categories(owner_id, updated_at);

CREATE TRIGGER trg_categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tasks
--   is_global = TRUE  -> admin-managed "fixed" task every user sees (owner_id NULL)
--   is_global = FALSE -> personal task, visible only to its owner
-- Column set must stay in sync with the Task struct in repo/models.go
-- (several queries use SELECT *).
-- ---------------------------------------------------------------------------
CREATE TABLE tasks (
    id               BIGSERIAL PRIMARY KEY,
    uuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    title            VARCHAR(255) NOT NULL CHECK (length(title) > 0),
    description      TEXT,

    is_global        BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,

    recurrence_type  VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (recurrence_type IN ('daily', 'weekly', 'custom')),
    -- 0 = Sunday ... 6 = Saturday
    recurrence_days  SMALLINT[] NOT NULL DEFAULT '{}'
        CHECK (recurrence_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,

    category_id      BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    reward_text      VARCHAR(255),

    task_type        VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (task_type IN ('normal', 'counter', 'timer')),
    target_count     INT,
    duration_seconds INT,
    reminder_time    VARCHAR(5)
        CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),

    -- Lineage: the fixed task a personal copy was cloned from ("Add to My Tasks").
    source_task_id   BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    position         INT NOT NULL DEFAULT 0,

    created_by       BIGINT NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT chk_task_owner CHECK (
        (is_global AND owner_id IS NULL) OR (NOT is_global AND owner_id IS NOT NULL)
    ),
    CONSTRAINT chk_task_type_fields CHECK (
        (task_type = 'normal'  AND target_count IS NULL AND duration_seconds IS NULL)
        OR (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0 AND duration_seconds IS NULL)
        OR (task_type = 'timer'   AND duration_seconds IS NOT NULL AND duration_seconds > 0 AND target_count IS NULL)
    )
);

CREATE INDEX idx_tasks_owner_category_position ON tasks(owner_id, category_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_global ON tasks(id) WHERE is_global AND deleted_at IS NULL;
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
CREATE INDEX idx_tasks_source_task_id ON tasks(source_task_id);
CREATE INDEX idx_tasks_updated ON tasks(updated_at);

CREATE TRIGGER trg_tasks_set_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Sub-tasks (children of a task; they share the parent's recurrence/category/
-- reward/reminder and have none of their own)
-- ---------------------------------------------------------------------------
CREATE TABLE sub_tasks (
    id               BIGSERIAL PRIMARY KEY,
    uuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    parent_task_id   BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    title            VARCHAR(255) NOT NULL CHECK (length(title) > 0),
    task_type        VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (task_type IN ('normal', 'counter', 'timer')),
    target_count     INT,
    duration_seconds INT,
    position         INT NOT NULL DEFAULT 0,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT chk_subtask_type_fields CHECK (
        (task_type = 'normal'  AND target_count IS NULL AND duration_seconds IS NULL)
        OR (task_type = 'counter' AND target_count IS NOT NULL AND target_count > 0 AND duration_seconds IS NULL)
        OR (task_type = 'timer'   AND duration_seconds IS NOT NULL AND duration_seconds > 0 AND target_count IS NULL)
    )
);

CREATE INDEX idx_sub_tasks_parent ON sub_tasks(parent_task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sub_tasks_updated ON sub_tasks(updated_at);

CREATE TRIGGER trg_sub_tasks_set_updated_at
    BEFORE UPDATE ON sub_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Completions: one row per (task, user, date). A row's absence means
-- "pending" (or "missed" for a past date) - derived at read time.
-- The unique key is what lets the website's REST calls and the mobile app's
-- /sync pushes for the same task+day land on ONE row instead of two.
-- ---------------------------------------------------------------------------
CREATE TABLE task_completions (
    id                   BIGSERIAL PRIMARY KEY,
    uuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    task_id              BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    task_title_snapshot  VARCHAR(255) NOT NULL,
    was_global_snapshot  BOOLEAN NOT NULL DEFAULT FALSE,

    task_date            DATE NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'missed')),
    progress_count       INT NOT NULL DEFAULT 0 CHECK (progress_count >= 0),

    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ,

    CONSTRAINT uq_task_completion UNIQUE (task_id, user_id, task_date)
);

CREATE INDEX idx_task_completions_user_date ON task_completions(user_id, task_date);
CREATE INDEX idx_task_completions_user_updated ON task_completions(user_id, updated_at);

CREATE TRIGGER trg_task_completions_set_updated_at
    BEFORE UPDATE ON task_completions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sub_task_completions (
    id                       BIGSERIAL PRIMARY KEY,
    uuid                     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    sub_task_id              BIGINT REFERENCES sub_tasks(id) ON DELETE SET NULL,
    parent_task_id           BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id                  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    sub_task_title_snapshot  VARCHAR(255) NOT NULL,

    task_date                DATE NOT NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'missed')),
    progress_count           INT NOT NULL DEFAULT 0 CHECK (progress_count >= 0),

    completed_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at               TIMESTAMPTZ,

    CONSTRAINT uq_sub_task_completion UNIQUE (sub_task_id, user_id, task_date)
);

CREATE INDEX idx_sub_task_completions_user_date ON sub_task_completions(user_id, task_date);
CREATE INDEX idx_sub_task_completions_parent_date ON sub_task_completions(parent_task_id, user_id, task_date);
CREATE INDEX idx_sub_task_completions_user_updated ON sub_task_completions(user_id, updated_at);

CREATE TRIGGER trg_sub_task_completions_set_updated_at
    BEFORE UPDATE ON sub_task_completions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Quran: last-read position + bookmarks (not part of the /sync protocol)
-- ---------------------------------------------------------------------------
CREATE TABLE quran_last_read (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    surah_no    SMALLINT NOT NULL CHECK (surah_no BETWEEN 1 AND 114),
    ayah_no     SMALLINT NOT NULL CHECK (ayah_no >= 1),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quran_bookmarks (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    surah_no    SMALLINT NOT NULL CHECK (surah_no BETWEEN 1 AND 114),
    ayah_no     SMALLINT NOT NULL CHECK (ayah_no >= 1),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_bookmark_owner_verse UNIQUE (owner_id, surah_no, ayah_no)
);

CREATE INDEX idx_quran_bookmarks_owner_id ON quran_bookmarks(owner_id);

-- +migrate Down

DROP TABLE IF EXISTS quran_bookmarks;
DROP TABLE IF EXISTS quran_last_read;
DROP TABLE IF EXISTS sub_task_completions;
DROP TABLE IF EXISTS task_completions;
DROP TABLE IF EXISTS sub_tasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS security_answer_attempt_logs;
DROP TABLE IF EXISTS email_otps;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS set_updated_at();
