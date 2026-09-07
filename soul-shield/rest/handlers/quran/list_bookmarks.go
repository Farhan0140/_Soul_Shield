package quran

import (
	"net/http"
	"soulsheld/util"
)

// ListBookmarks godoc
//
// @Summary List my Quran bookmarks
// @Description নতুন bookmark আগে দেখায় (created_at DESC)
// @Tags Quran
// @Security BearerAuth
// @Produce json
// @Success 200 {array} BookmarkResponse
// @Failure 401 {object} ErrorResponse
// @Router /quran/bookmarks [get]
func (h *Handler) ListBookmarks(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	bookmarks, err := h.quranRepo.ListBookmarks(userID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch bookmarks"}, http.StatusInternalServerError)
		return
	}

	response := make([]BookmarkResponse, len(bookmarks))
	for i, b := range bookmarks {
		response[i] = BookmarkResponse{
			ID:        b.ID,
			SurahNo:   b.SurahNo,
			AyahNo:    b.AyahNo,
			Note:      b.Note,
			CreatedAt: b.CreatedAt,
		}
	}

	util.SendData(w, response, http.StatusOK)
}
