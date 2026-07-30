-- +migrate Up
ALTER TABLE tasks
    ADD COLUMN reminder_time VARCHAR(5)
        CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
