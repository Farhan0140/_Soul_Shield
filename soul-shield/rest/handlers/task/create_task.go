package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

// CreateTask godoc
//
// @Summary Create task
// @Description User বা Admin task তৈরি করতে পারবে। is_global=true শুধু admin ব্যবহার করতে পারবে।
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateTaskRequest true "Task Info"
// @Success 201 {object} TaskResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /tasks [post]
func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}
	role := getRole(r)

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		util.SendError(w, map[string]string{"error": "Title is required"}, http.StatusBadRequest)
		return
	}

	if req.IsGlobal && role != "admin" {
		util.SendError(w, map[string]string{"error": "Only admin can create global tasks"}, http.StatusForbidden)
		return
	}

	newTask := repo.Task{
		Title:          req.Title,
		RecurrenceType: req.RecurrenceType,
		CreatedBy:      userID,
		IsGlobal:       req.IsGlobal,
	}
	newTask.Description.String = req.Description
	newTask.Description.Valid = req.Description != ""

	if !req.IsGlobal {
		newTask.OwnerID.Int64 = userID
		newTask.OwnerID.Valid = true
	}

	days := make([]int64, len(req.RecurrenceDays))
	copy(days, req.RecurrenceDays)
	newTask.RecurrenceDays = days

	created, err := h.taskRepo.Create(newTask)
	if err != nil {
		if err == util.ErrInvalidRecurrence {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
			return
		}
		util.SendError(w, map[string]string{"error": "Failed to create task"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, toTaskResponse(created), http.StatusCreated)
}
