package quran

import "time"

type UpsertLastReadRequest struct {
	SurahNo int `json:"surah_no" example:"2"`
	AyahNo  int `json:"ayah_no" example:"255"`
}

type LastReadResponse struct {
	SurahNo   int       `json:"surah_no"`
	AyahNo    int       `json:"ayah_no"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateBookmarkRequest struct {
	SurahNo int     `json:"surah_no" example:"2"`
	AyahNo  int     `json:"ayah_no" example:"255"`
	Note    *string `json:"note,omitempty"`
}

type UpdateBookmarkNoteRequest struct {
	Note *string `json:"note"`
}

type BookmarkResponse struct {
	ID        int64     `json:"id"`
	SurahNo   int       `json:"surah_no"`
	AyahNo    int       `json:"ayah_no"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type SuccessResponse struct {
	Message string `json:"message" example:"Bookmark deleted successfully"`
}
