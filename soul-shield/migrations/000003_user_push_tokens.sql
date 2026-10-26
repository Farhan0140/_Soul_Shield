-- +migrate Up

-- Expo push tokens, one per device that opted in (Profile → "Cross-device
-- sync alerts"). When a user's tasks change via the REST path (web edits),
-- the API fans a short "data changed" push out to every token the user has
-- registered, prompting those devices' background sync to pull the changes
-- immediately instead of at their next app-open/reconnect/daily window.
-- token is UNIQUE: a device re-registering replaces its row's user/platform.
CREATE TABLE user_push_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    platform   VARCHAR(20) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_push_tokens_user ON user_push_tokens(user_id);

CREATE TRIGGER trg_user_push_tokens_set_updated_at
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +migrate Down
DROP TABLE IF EXISTS user_push_tokens;
