package repo

import (
	"database/sql"
	"errors"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type QuranLastRead struct {
	UserID    int64     `db:"user_id" json:"user_id"`
	SurahNo   int       `db:"surah_no" json:"surah_no"`
	AyahNo    int       `db:"ayah_no" json:"ayah_no"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type QuranBookmark struct {
	ID        int64     `db:"id" json:"id"`
	OwnerID   int64     `db:"owner_id" json:"owner_id"`
	SurahNo   int       `db:"surah_no" json:"surah_no"`
	AyahNo    int       `db:"ayah_no" json:"ayah_no"`
	Note      *string   `db:"note" json:"note"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type QuranRepo interface {
	GetLastRead(userID int64) (*QuranLastRead, error)
	UpsertLastRead(userID int64, surahNo, ayahNo int) (*QuranLastRead, error)

	ListBookmarks(ownerID int64) ([]QuranBookmark, error)
	CreateBookmark(bookmark QuranBookmark) (*QuranBookmark, error)
	UpdateBookmarkNote(id int64, ownerID int64, note *string) (*QuranBookmark, error)
	Delete(id int64, ownerID int64) error
	GetBookmarkByID(id int64) (*QuranBookmark, error)
}

type quranRepo struct {
	db *sqlx.DB
}

func NewQuranRepo(db *sqlx.DB) QuranRepo {
	return &quranRepo{db: db}
}

func (r *quranRepo) GetLastRead(userID int64) (*QuranLastRead, error) {
	var lastRead QuranLastRead
	err := r.db.Get(&lastRead, `
		SELECT * FROM quran_last_read WHERE user_id = $1
	`, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrLastReadNotFound
		}
		return nil, err
	}
	return &lastRead, nil
}

func (r *quranRepo) UpsertLastRead(userID int64, surahNo, ayahNo int) (*QuranLastRead, error) {
	lastRead := QuranLastRead{UserID: userID, SurahNo: surahNo, AyahNo: ayahNo}

	err := r.db.QueryRow(`
		INSERT INTO quran_last_read(user_id, surah_no, ayah_no)
		VALUES($1, $2, $3)
		ON CONFLICT(user_id) DO UPDATE SET
			surah_no = $2,
			ayah_no = $3,
			updated_at = CURRENT_TIMESTAMP
		RETURNING updated_at
	`, userID, surahNo, ayahNo).Scan(&lastRead.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &lastRead, nil
}

func (r *quranRepo) ListBookmarks(ownerID int64) ([]QuranBookmark, error) {
	var bookmarks []QuranBookmark
	err := r.db.Select(&bookmarks, `
		SELECT * FROM quran_bookmarks WHERE owner_id = $1 ORDER BY created_at DESC
	`, ownerID)
	return bookmarks, err
}

func (r *quranRepo) CreateBookmark(bookmark QuranBookmark) (*QuranBookmark, error) {
	err := r.db.QueryRow(`
		INSERT INTO quran_bookmarks (owner_id, surah_no, ayah_no, note)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, bookmark.OwnerID, bookmark.SurahNo, bookmark.AyahNo, bookmark.Note).
		Scan(&bookmark.ID, &bookmark.CreatedAt)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, util.ErrBookmarkExists
		}
		return nil, err
	}

	return &bookmark, nil
}

func (r *quranRepo) GetBookmarkByID(id int64) (*QuranBookmark, error) {
	var bookmark QuranBookmark
	err := r.db.Get(&bookmark, `SELECT * FROM quran_bookmarks WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrBookmarkNotFound
		}
		return nil, err
	}
	return &bookmark, nil
}

func (r *quranRepo) UpdateBookmarkNote(id int64, ownerID int64, note *string) (*QuranBookmark, error) {
	existing, err := r.GetBookmarkByID(id)
	if err != nil {
		return nil, err
	}

	if existing.OwnerID != ownerID {
		return nil, util.ErrForbidden
	}

	existing.Note = note

	_, err = r.db.Exec(`
		UPDATE quran_bookmarks SET note = $1 WHERE id = $2
	`, existing.Note, existing.ID)
	if err != nil {
		return nil, err
	}

	return existing, nil
}

func (r *quranRepo) Delete(id int64, ownerID int64) error {
	existing, err := r.GetBookmarkByID(id)
	if err != nil {
		return err
	}

	if existing.OwnerID != ownerID {
		return util.ErrForbidden
	}

	_, err = r.db.Exec(`DELETE FROM quran_bookmarks WHERE id = $1`, id)
	return err
}
