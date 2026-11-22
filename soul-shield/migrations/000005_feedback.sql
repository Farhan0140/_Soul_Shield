-- +migrate Up

-- App ratings + feedback, sent from the mobile app (signed in or not) and
-- reviewed in the web admin panel.

-- Phones used WITHOUT an account. Each one sends a random device id it keeps
-- locally; the first time it submits feedback it gets the next number here,
-- and shows in the admin panel as "guest-user-<id>".
CREATE TABLE guest_devices (
    id         BIGSERIAL PRIMARY KEY,
    device_id  UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every submission is kept (rating + optional message). For the 1-5 star
-- totals each person counts once, with their most recent rating
-- (repo/feedback.go's Summary) - rating again replaces the old vote.
CREATE TABLE feedback (
    id              BIGSERIAL PRIMARY KEY,
    -- Exactly one submitter: an account, or a guest device. Deleting the
    -- account deletes its feedback with everything else it owns.
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    guest_device_id BIGINT REFERENCES guest_devices(id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    message         TEXT CHECK (message IS NULL OR length(message) <= 2000),
    platform        VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Set when an admin has seen it (opening the Feedback page). Drives the
    -- admin panel's "new feedback" notification.
    read_at         TIMESTAMPTZ,
    CHECK ((user_id IS NULL) <> (guest_device_id IS NULL))
);

CREATE INDEX idx_feedback_unread ON feedback(id) WHERE read_at IS NULL;
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_guest ON feedback(guest_device_id, created_at DESC);

-- +migrate Down
DROP TABLE feedback;
DROP TABLE guest_devices;
