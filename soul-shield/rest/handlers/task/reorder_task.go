package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
)

// ReorderTasks godoc
//
// @Summary Reorder my tasks within a category
// @Description caller এর একটা category (category_id=null হলে "Uncategorized") এর জন্য নতুন
// @Description display order সেট করে। ordered_ids এ অবশ্যই caller এর সেই category এর বর্তমান
// @Description সব personal task id (কোনোটা বাদ/নতুন যোগ ছাড়া) নতুন ক্রমে থাকতে হবে - অন্য
// @Description ডিভাইস থেকে ইতিমধ্যে কিছু বদলে থাকলে 409 রিটার্ন করবে। শুধু personal (is_global=false)
// @Description task ই reorder করা যায়, fixed/admin task এর জন্য এই endpoint প্রযোজ্য না।
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body ReorderTasksRequest true "New task order for one category"
// @Success 200 {array} TaskResponse
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /tasks/reorder [patch]
func (h *Handler) ReorderTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req ReorderTasksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	reordered, err := h.taskRepo.Reorder(userID, req.CategoryID, req.OrderedIDs)
	if err != nil {
		switch err {
		case util.ErrEmptyOrder:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case util.ErrOrderMismatch:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusConflict)
		default:
			util.SendError(w, map[string]string{"error": "Failed to reorder tasks"}, http.StatusInternalServerError)
		}
		return
	}

	response := make([]TaskResponse, len(reordered))
	for i := range reordered {
		response[i] = toTaskResponse(&reordered[i], nil)
	}

	util.SendData(w, response, http.StatusOK)
}
