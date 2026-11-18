package task

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
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
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}
	role := middlewares.Role(r)

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

	if req.Title != nil {
		title, err := validateTitle(*req.Title)
		if err != nil {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
			return
		}
		req.Title = &title
	}
	if req.RecurrenceType != nil {
		if err := validateRecurrenceType(*req.RecurrenceType); err != nil {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
			return
		}
	}

	if req.ReminderTime != nil && *req.ReminderTime != "" && !reminderTimePattern.MatchString(*req.ReminderTime) {
		util.SendError(w, map[string]string{"error": util.ErrInvalidReminderTime.Error()}, http.StatusBadRequest)
		return
	}

	if req.SubTasks != nil {
		for _, st := range *req.SubTasks {
			if st.Title == "" {
				util.SendError(w, map[string]string{"error": util.ErrSubTaskTitleRequired.Error()}, http.StatusBadRequest)
				return
			}
			stType := st.TaskType
			if stType == "" {
				stType = "normal"
			}
			if stType != "normal" && stType != "counter" && stType != "timer" {
				util.SendError(w, map[string]string{"error": "sub-task task_type must be 'normal', 'counter' or 'timer'"}, http.StatusBadRequest)
				return
			}
			if stType == "counter" && (st.TargetCount == nil || *st.TargetCount <= 0) {
				util.SendError(w, map[string]string{"error": "target_count is required and must be > 0 for counter sub-tasks"}, http.StatusBadRequest)
				return
			}
			if stType == "timer" && (st.DurationSeconds == nil || *st.DurationSeconds <= 0) {
				util.SendError(w, map[string]string{"error": "duration_seconds is required and must be > 0 for timer sub-tasks"}, http.StatusBadRequest)
				return
			}
		}
	}

	updates := repo.TaskUpdate{
		Title:           req.Title,
		Description:     req.Description,
		RecurrenceType:  req.RecurrenceType,
		RecurrenceDays:  req.RecurrenceDays,
		IsActive:        req.IsActive,
		CategoryID:      req.CategoryID,
		RewardText:      req.RewardText,
		TargetCount:     req.TargetCount,
		DurationSeconds: req.DurationSeconds,
		ReminderTime:    req.ReminderTime,
	}

	// nil = "leave the sub-tasks alone"; a non-nil (even empty) list replaces them.
	var subInputs []repo.SubTask
	if req.SubTasks != nil {
		subInputs = make([]repo.SubTask, len(*req.SubTasks))
		for i, st := range *req.SubTasks {
			stType := st.TaskType
			if stType == "" {
				stType = "normal"
			}
			sub := repo.SubTask{Title: st.Title, TaskType: stType}
			if st.ID != nil {
				sub.ID = *st.ID
			}
			// description follows full-row replace semantics (replaceSubTasksTx
			// assigns the column directly): the web form always includes it,
			// absent/null both clear. Matches the /sync push path.
			if st.Description != nil {
				sub.Description = sql.NullString{String: *st.Description, Valid: true}
			}
			if st.TargetCount != nil {
				sub.TargetCount = sql.NullInt32{Int32: *st.TargetCount, Valid: true}
			}
			if st.DurationSeconds != nil {
				sub.DurationSeconds = sql.NullInt32{Int32: *st.DurationSeconds, Valid: true}
			}
			subInputs[i] = sub
		}
	}

	// Task fields + sub-task list in ONE transaction (B9).
	updated, subTasks, err := h.taskRepo.UpdateWithSubTasks(id, updates, userID, role, subInputs)
	if err != nil {
		switch {
		case errors.Is(err, util.ErrTaskNotFound):
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case errors.Is(err, util.ErrForbidden):
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		case errors.Is(err, util.ErrInvalidRecurrence),
			errors.Is(err, util.ErrCategoryNotFound),
			errors.Is(err, util.ErrInvalidCounterTarget),
			errors.Is(err, util.ErrInvalidTimerDuration),
			errors.Is(err, util.ErrSubTaskTitleRequired),
			errors.Is(err, util.ErrSubTaskNotFound):
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case errors.Is(err, util.ErrInvalidInput):
			slog.Warn("update task: database refused input", "task_id", id, "error", err)
			util.SendError(w, map[string]string{"error": util.ErrInvalidInput.Error()}, http.StatusBadRequest)
		default:
			slog.Error("update task failed", "task_id", id, "error", err)
			util.SendError(w, map[string]string{"error": "Failed to update task"}, http.StatusInternalServerError)
		}
		return
	}

	if req.SubTasks == nil {
		byParent, listErr := h.subTaskRepo.ListByParentIDs([]int64{id})
		if listErr != nil {
			util.SendError(w, map[string]string{"error": "Failed to load sub-tasks"}, http.StatusInternalServerError)
			return
		}
		subTasks = byParent[id]
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toTaskResponse(updated, subTasks), http.StatusOK)
}
