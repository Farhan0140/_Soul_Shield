package quran

import (
	"net/http"
	"soulsheld/util"
	"strconv"
)

// DeleteBookmark godoc
//
// @Summary Delete a bookmark
// @Tags Quran
// @Security BearerAuth
// @Produce json
// @Param id path int true "Bookmark ID"
// @Success 200 {object} SuccessResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /quran/bookmarks/{id} [delete]
func (h *Handler) DeleteBookmark(w http.ResponseWriter, r *http.Request) {
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

	err = h.quranRepo.Delete(id, userID)
	if err != nil {
		switch err {
		case util.ErrBookmarkNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		default:
			util.SendError(w, map[string]string{"error": "Failed to delete bookmark"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, map[string]string{"message": "Bookmark deleted successfully"}, http.StatusOK)
}
