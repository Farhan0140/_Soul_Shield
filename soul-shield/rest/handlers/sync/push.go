package sync

import (
	"encoding/json"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

// Push godoc
//
// @Summary Push sync changes
// @Description ক্লায়েন্টের queued offline change গুলো ব্যাচে পাঠায়। প্রতিটা change আলাদাভাবে
// accepted/superseded/rejected হিসেবে ফলাফল পায় - একটা change এ সমস্যা হলে বাকিগুলো আটকায় না।
// counter task এর "increment" op delta যোগ করে (last-write-wins না), বাকি সব op
// updated_at তুলনা করে resolve হয় - দেখো repo/sync_push.go।
// @Tags Sync
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body PushRequest true "Queued changes"
// @Success 200 {object} PushResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /sync [post]
func (h *Handler) Push(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req PushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	if len(req.Changes) == 0 {
		util.SendData(w, PushResponse{Results: []repo.SyncChangeResult{}}, http.StatusOK)
		return
	}

	results, err := h.syncRepo.PushChanges(userID, req.Changes)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to push sync changes"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, PushResponse{Results: results}, http.StatusOK)
}
