package task

import (
	"database/sql"
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
			if stType != "normal" && stType != "counter" {
				util.SendError(w, map[string]string{"error": "sub-task task_type must be 'normal' or 'counter'"}, http.StatusBadRequest)
				return
			}
			if stType == "counter" && (st.TargetCount == nil || *st.TargetCount <= 0) {
				util.SendError(w, map[string]string{"error": "target_count is required and must be > 0 for counter sub-tasks"}, http.StatusBadRequest)
				return
			}
		}
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

	var subTasks []repo.SubTask
	if req.SubTasks != nil {
		inputs := make([]repo.SubTask, len(*req.SubTasks))
		for i, st := range *req.SubTasks {
			stType := st.TaskType
			if stType == "" {
				stType = "normal"
			}
			sub := repo.SubTask{Title: st.Title, TaskType: stType}
			if st.ID != nil {
				sub.ID = *st.ID
			}
			if st.TargetCount != nil {
				sub.TargetCount = sql.NullInt32{Int32: *st.TargetCount, Valid: true}
			}
			inputs[i] = sub
		}

		subTasks, err = h.subTaskRepo.ReplaceForParent(id, inputs)
		if err != nil {
			switch err {
			case util.ErrSubTaskTitleRequired, util.ErrInvalidCounterTarget, util.ErrSubTaskNotFound:
				util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
			default:
				util.SendError(w, map[string]string{"error": "Failed to update sub-tasks"}, http.StatusInternalServerError)
			}
			return
		}
	} else {
		byParent, listErr := h.subTaskRepo.ListByParentIDs([]int64{id})
		if listErr != nil {
			util.SendError(w, map[string]string{"error": "Failed to load sub-tasks"}, http.StatusInternalServerError)
			return
		}
		subTasks = byParent[id]
	}

	util.SendData(w, toTaskResponse(updated, subTasks), http.StatusOK)
}