package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
	"strconv"
	"time"
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
	userID, ok := getUserID(r)
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

	date := time.Now()
	if req.Date != "" {
		parsed, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid date format, use YYYY-MM-DD"}, http.StatusBadRequest)
			return
		}
		date = parsed
	}

	completion, err := h.taskRepo.Complete(id, userID, date)
	if err != nil {
		switch err {
		case util.ErrTaskNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		case util.ErrTaskNotScheduled:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		default:
			util.SendError(w, map[string]string{"error": "Failed to complete task"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, toCompletionResponse(completion), http.StatusOK)
}