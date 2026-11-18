package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
)

// CompleteTask godoc
//
// @Summary Mark a task as completed for a given date
// @Description date না দিলে আজকের তারিখ ধরা হবে। ঐ তারিখে task টা scheduled না থাকলে error দিবে।
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Task ID"
// @Param body body CompleteTaskRequest false "Optional date"
// @Success 200 {object} CompletionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{id}/complete [post]
func (h *Handler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid task id"}, http.StatusBadRequest)
		return
	}

	var req CompleteTaskRequest
	// body না থাকলেও (empty POST) সমস্যা যেন না হয়, তাই error ignore করছি যদি EOF হয়
	_ = json.NewDecoder(r.Body).Decode(&req)

	date, dateOK := actionDate(w, r, req.Date)
	if !dateOK {
		return
	}

	completion, err := h.taskRepo.Complete(id, userID, date)
	if err != nil {
		sendCompletionError(w, r, err, "Failed to complete task")
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toCompletionResponse(completion), http.StatusOK)
}
