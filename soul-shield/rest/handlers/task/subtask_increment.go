package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
	"time"
)

// IncrementSubTask godoc
//
// @Summary Increment progress of a counter-type sub-task
// @Description amount ব্যাচ আকারে পাঠান। Sub-task এর নিজের recurrence নাই - parent task যেই দিন scheduled সেই দিনেই increment করা যাবে।
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param taskId path int true "Parent Task ID"
// @Param subTaskId path int true "Sub-Task ID"
// @Param body body IncrementTaskRequest true "Increment amount"
// @Success 200 {object} SubTaskCompletionResponse
// @Failure 400 {object} ErrorResponse
// @Router /tasks/{taskId}/subtasks/{subTaskId}/increment [post]
func (h *Handler) IncrementSubTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	taskID, subTaskID, ok := parseSubTaskPath(w, r)
	if !ok {
		return
	}

	var req IncrementTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		util.SendError(w, map[string]string{"error": "amount must be greater than 0"}, http.StatusBadRequest)
		return
	}

	date := time.Now()
	if req.Date != "" {
		parsed, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid date format"}, http.StatusBadRequest)
			return
		}
		date = parsed
	}

	completion, err := h.subTaskRepo.Increment(taskID, subTaskID, userID, date, req.Amount)
	if err != nil {
		sendSubTaskError(w, err)
		return
	}

	parentStatus, parentRewardText, err := h.computeParentStatusAfterAction(taskID, userID, date)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to compute parent status"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, toSubTaskCompletionResponse(completion, parentStatus, parentRewardText), http.StatusOK)
}
