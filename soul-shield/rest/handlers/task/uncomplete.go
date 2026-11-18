package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
)

// UncompleteTask godoc
//
// @Summary Un-complete a task for a date
// @Description Puts a normal (non-counter) task back to "pending" for the date (default: the caller's today).
// @Description Idempotent: un-completing a task that isn't completed is a no-op.
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
// @Router /tasks/{id}/uncomplete [post]
func (h *Handler) UncompleteTask(w http.ResponseWriter, r *http.Request) {
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
	_ = json.NewDecoder(r.Body).Decode(&req) // body is optional

	date, dateOK := actionDate(w, r, req.Date)
	if !dateOK {
		return
	}

	completion, err := h.taskRepo.Uncomplete(id, userID, date)
	if err != nil {
		sendCompletionError(w, r, err, "Failed to update task")
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toCompletionResponse(completion), http.StatusOK)
}

// UncompleteSubTask godoc
//
// @Summary Un-complete a sub-task for a date
// @Description Puts a normal (non-counter) sub-task back to "pending" for the date (default: the caller's today).
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param taskId path int true "Parent Task ID"
// @Param subTaskId path int true "Sub-task ID"
// @Param body body CompleteTaskRequest false "Optional date"
// @Success 200 {object} SubTaskCompletionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{taskId}/subtasks/{subTaskId}/uncomplete [post]
func (h *Handler) UncompleteSubTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	taskID, subTaskID, ok := parseSubTaskPath(w, r)
	if !ok {
		return
	}

	var req CompleteTaskRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	date, dateOK := actionDate(w, r, req.Date)
	if !dateOK {
		return
	}

	completion, err := h.subTaskRepo.Uncomplete(taskID, subTaskID, userID, date)
	if err != nil {
		sendSubTaskError(w, err)
		return
	}

	parentStatus, parentRewardText, err := h.computeParentStatusAfterAction(taskID, userID, date, util.RequestToday(r))
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to compute parent status"}, http.StatusInternalServerError)
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toSubTaskCompletionResponse(completion, parentStatus, parentRewardText), http.StatusOK)
}
