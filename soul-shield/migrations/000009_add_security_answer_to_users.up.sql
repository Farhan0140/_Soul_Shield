-- +migrate Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_locked_until TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS security_answer_attempt_logs (
	id BIGSERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL,
	success BOOLEAN NOT NULL,
	ip_address VARCHAR(64),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_answer_attempt_logs_email ON security_answer_attempt_logs(email);
