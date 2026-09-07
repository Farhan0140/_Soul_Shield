package quran

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
)

// UpsertLastRead godoc
//
// @Summary Save my last-read Quran position
// @Description পুরনো position থাকলে ওভাররাইট হয়ে যাবে - user এর একটাই last-read position থাকে
// @Tags Quran
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body UpsertLastReadRequest true "Last-read position"
// @Success 200 {object} LastReadResponse
// @Failure 400 {object} ErrorResponse
// @Router /quran/last-read [put]
func (h *Handler) UpsertLastRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req UpsertLastReadRequest
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

	lastRead, err := h.quranRepo.UpsertLastRead(userID, req.SurahNo, req.AyahNo)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to save last-read position"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, LastReadResponse{
		SurahNo:   lastRead.SurahNo,
		AyahNo:    lastRead.AyahNo,
		UpdatedAt: lastRead.UpdatedAt,
	}, http.StatusOK)
}
