package task

import (
	"encoding/json"
	"fmt"
	"net/http"
	"soulsheld/util"
	"strconv"
	"time"
)

// IncrementTask godoc
//
// @Summary Increment progress of a counter-type task
// @Description জিকির/গণনা টাইপ task এর জন্য - amount ব্যাচ আকারে পাঠান, একটা একটা tap এ কল করবেন না
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Task ID"
// @Param body body IncrementTaskRequest true "Increment amount"
// @Success 200 {object} CompletionResponse
// @Failure 400 {object} ErrorResponse
// @Router /tasks/{id}/increment [post]
func (h *Handler) IncrementTask(w http.ResponseWriter, r *http.Request) {
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

	completion, err := h.taskRepo.Increment(id, userID, date, req.Amount)
	if err != nil {
		fmt.Println(err)
		switch err {
		case util.ErrTaskNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		case util.ErrNotCounterTask, util.ErrTaskNotScheduled:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		default:
			util.SendError(w, map[string]string{"error": "Failed to update progress"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, toCompletionResponse(completion), http.StatusOK)
}