-- +migrate Up

-- Session revocation (PROJECT_ANALYSIS S5). Every session JWT carries the
-- account's token_version ("ver" claim) and AuthenticateJWT rejects a token
-- whose version no longer matches. Changing or resetting the password bumps
-- it, which signs out every device that still holds an older token. Existing
-- tokens have no "ver" claim, which decodes as 0 = this default, so nobody is
-- signed out by the deploy itself.
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;

-- +migrate Down
ALTER TABLE users DROP COLUMN token_version;
