package quran

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
	"strconv"
)

// UpdateBookmarkNote godoc
//
// @Summary Update a bookmark's note
// @Description শুধু bookmark এর owner ই আপডেট করতে পারবে
// @Tags Quran
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Bookmark ID"
// @Param body body UpdateBookmarkNoteRequest true "New note"
// @Success 200 {object} BookmarkResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /quran/bookmarks/{id} [patch]
func (h *Handler) UpdateBookmarkNote(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid bookmark id"}, http.StatusBadRequest)
		return
	}

	var req UpdateBookmarkNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	updated, err := h.quranRepo.UpdateBookmarkNote(id, userID, req.Note)
	if err != nil {
		switch err {
		case util.ErrBookmarkNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		default:
			util.SendError(w, map[string]string{"error": "Failed to update bookmark"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, BookmarkResponse{
		ID:        updated.ID,
		SurahNo:   updated.SurahNo,
		AyahNo:    updated.AyahNo,
		Note:      updated.Note,
		CreatedAt: updated.CreatedAt,
	}, http.StatusOK)
}
