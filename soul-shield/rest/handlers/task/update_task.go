package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
	"strconv"
)

// UpdateTask godoc
//
// @Summary Update task
// @Description Owner (personal task) অথবা Admin (global task) আপডেট করতে পারবে
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Task ID"
// @Param body body UpdateTaskRequest true "Fields to update"
// @Success 200 {object} TaskResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{id} [patch]
func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}
	role := getRole(r)

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid task id"}, http.StatusBadRequest)
		return
	}

	var req UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	if req.ReminderTime != nil && *req.ReminderTime != "" && !reminderTimePattern.MatchString(*req.ReminderTime) {
		util.SendError(w, map[string]string{"error": util.ErrInvalidReminderTime.Error()}, http.StatusBadRequest)
		return
	}

	updates := repo.TaskUpdate{
		Title:          req.Title,
		Description:    req.Description,
		RecurrenceType: req.RecurrenceType,
		RecurrenceDays: req.RecurrenceDays,
		IsActive:       req.IsActive,
		CategoryID:     req.CategoryID,
		RewardText:     req.RewardText,
		TargetCount:    req.TargetCount,
		ReminderTime:   req.ReminderTime,
	}

	updated, err := h.taskRepo.Update(id, updates, userID, role)
	if err != nil {
		switch err {
		case util.ErrTaskNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		case util.ErrInvalidRecurrence:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case util.ErrCategoryNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case util.ErrInvalidCounterTarget:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		default:
			util.SendError(w, map[string]string{"error": "Failed to update task"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, toTaskResponse(updated), http.StatusOK)
}