package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
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

	var req IncrementTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		util.SendError(w, map[string]string{"error": "amount must be greater than 0"}, http.StatusBadRequest)
		return
	}

	date, dateOK := actionDate(w, r, req.Date)
	if !dateOK {
		return
	}

	completion, err := h.taskRepo.Increment(id, userID, date, req.Amount)
	if err != nil {
		sendCompletionError(w, r, err, "Failed to update progress")
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toCompletionResponse(completion), http.StatusOK)
}
