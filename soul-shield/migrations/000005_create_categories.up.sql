-- +migrate Up
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(name) > 0),
    color_hex VARCHAR(7) NOT NULL DEFAULT '#CCCCCC' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_category_owner_name UNIQUE (owner_id, name)
);

CREATE INDEX idx_categories_owner_id ON categories(owner_id);