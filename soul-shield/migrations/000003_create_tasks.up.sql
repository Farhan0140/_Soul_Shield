-- +migrate Up
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL CHECK (length(title) > 0),
    description TEXT,

    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (recurrence_type IN ('daily', 'weekly', 'custom')),
    
    recurrence_days SMALLINT[] NOT NULL DEFAULT '{}',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Personal task হলে owner_id required, global হলে null থাকতে পারে
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id) WHERE is_global = FALSE;
CREATE INDEX idx_tasks_is_global ON tasks(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_tasks_is_active ON tasks(is_active);


-- global=true হলে এইটা admin fixed task, সব user দেখবে
-- global=false হলে এইটা personal task, শুধু owner দেখবে

-- recurrence_type: 'daily', 'weekly', 'custom'

-- 0=Sunday ... 6=Saturday. 'daily' হলে সব দিন বসিয়ে দেওয়া হবে insert time এ