package quran

import (
	"net/http"
	"soulsheld/util"
)

// GetLastRead godoc
//
// @Summary Get my last-read Quran position
// @Tags Quran
// @Security BearerAuth
// @Produce json
// @Success 200 {object} LastReadResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /quran/last-read [get]
func (h *Handler) GetLastRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	lastRead, err := h.quranRepo.GetLastRead(userID)
	if err != nil {
		if err == util.ErrLastReadNotFound {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
			return
		}
		util.SendError(w, map[string]string{"error": "Failed to fetch last-read position"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, LastReadResponse{
		SurahNo:   lastRead.SurahNo,
		AyahNo:    lastRead.AyahNo,
		UpdatedAt: lastRead.UpdatedAt,
	}, http.StatusOK)
}
