package task

import (
	"net/http"
	"soulsheld/util"
	"time"
)

// TaskHistory godoc
//
// @Summary Get task history for a date range
// @Description from/to না দিলে গত ৭ দিন default হিসেবে দেখাবে (আজসহ)
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param from query string false "YYYY-MM-DD"
// @Param to query string false "YYYY-MM-DD"
// @Success 200 {array} TaskWithStatusResponse
// @Failure 400 {object} ErrorResponse
// @Router /tasks/history [get]
func (h *Handler) TaskHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	toStr := r.URL.Query().Get("to")
	fromStr := r.URL.Query().Get("from")

	to := time.Now()
	if toStr != "" {
		parsed, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid 'to' date format"}, http.StatusBadRequest)
			return
		}
		to = parsed
	}

	from := to.AddDate(0, 0, -6) // default: শেষ ৭ দিন (আজসহ)
	if fromStr != "" {
		parsed, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid 'from' date format"}, http.StatusBadRequest)
			return
		}
		from = parsed
	}

	if from.After(to) {
		util.SendError(w, map[string]string{"error": "'from' date cannot be after 'to' date"}, http.StatusBadRequest)
		return
	}

	tasks, err := h.taskRepo.ListForRange(userID, from, to)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch task history"}, http.StatusInternalServerError)
		return
	}

	if err := h.attachSubTasksForRange(tasks, userID, from, to); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch task history"}, http.StatusInternalServerError)
		return
	}

	response := make([]TaskWithStatusResponse, len(tasks))
	for i, t := range tasks {
		response[i] = toTaskWithStatusResponse(t)
	}

	util.SendData(w, response, http.StatusOK)
}