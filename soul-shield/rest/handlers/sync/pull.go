package sync

import (
	"net/http"
	"time"

	"soulsheld/util"
)

// Pull godoc
//
// @Summary Pull sync changes
// @Description তোর ব্যবহারকারীর tasks/categories/sub_tasks/completions - 'since' এর পর যা কিছু
// পরিবর্তিত (soft-deleted সহ) হয়েছে, সব একসাথে রিটার্ন করে। মোবাইল অ্যাপের local-first
// SQLite স্টোরের delta pull এই endpoint থেকেই আসে (দেখো lib/background-sync/pull.ts)।
// @Tags Sync
// @Security BearerAuth
// @Produce json
// @Param since query string false "RFC3339 timestamp - omit for a full pull"
// @Success 200 {object} repo.SyncSnapshot
// @Failure 401 {object} ErrorResponse
// @Router /sync [get]
func (h *Handler) Pull(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	since := time.Time{}
	if raw := r.URL.Query().Get("since"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid 'since' timestamp - use RFC3339"}, http.StatusBadRequest)
			return
		}
		since = parsed
	}

	snapshot, err := h.syncRepo.PullChanges(userID, since)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to pull sync changes"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, snapshot, http.StatusOK)
}
