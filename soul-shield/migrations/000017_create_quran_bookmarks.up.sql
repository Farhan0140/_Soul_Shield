-- +migrate Up
CREATE TABLE IF NOT EXISTS quran_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    surah_no SMALLINT NOT NULL CHECK (surah_no BETWEEN 1 AND 114),
    ayah_no SMALLINT NOT NULL CHECK (ayah_no >= 1),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_bookmark_owner_verse UNIQUE (owner_id, surah_no, ayah_no)
);

CREATE INDEX idx_quran_bookmarks_owner_id ON quran_bookmarks(owner_id);
