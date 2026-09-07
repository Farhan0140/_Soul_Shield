package quran

import (
	"encoding/json"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

// CreateBookmark godoc
//
// @Summary Bookmark a verse
// @Description একই verse আবার bookmark করতে গেলে 409 রিটার্ন করবে (uq_bookmark_owner_verse)
// @Tags Quran
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateBookmarkRequest true "Verse to bookmark"
// @Success 201 {object} BookmarkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /quran/bookmarks [post]
func (h *Handler) CreateBookmark(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req CreateBookmarkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	if req.SurahNo < 1 || req.SurahNo > 114 {
		util.SendError(w, map[string]string{"error": "surah_no must be between 1 and 114"}, http.StatusBadRequest)
		return
	}
	if req.AyahNo < 1 {
		util.SendError(w, map[string]string{"error": "ayah_no must be at least 1"}, http.StatusBadRequest)
		return
	}

	created, err := h.quranRepo.CreateBookmark(repo.QuranBookmark{
		OwnerID: userID,
		SurahNo: req.SurahNo,
		AyahNo:  req.AyahNo,
		Note:    req.Note,
	})
	if err != nil {
		if err == util.ErrBookmarkExists {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusConflict)
			return
		}
		util.SendError(w, map[string]string{"error": "Failed to create bookmark"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, BookmarkResponse{
		ID:        created.ID,
		SurahNo:   created.SurahNo,
		AyahNo:    created.AyahNo,
		Note:      created.Note,
		CreatedAt: created.CreatedAt,
	}, http.StatusCreated)
}
