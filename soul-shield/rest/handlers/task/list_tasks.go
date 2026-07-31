package task

import (
	"net/http"
	"soulsheld/util"
	"time"
)

// ListTasks godoc
//
// @Summary List today's (or given date's) tasks
// @Description date না দিলে আজকের তারিখ ধরা হবে। যেই দিনে recurrence_days ম্যাচ করবে সেই task গুলোই দেখাবে।
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param date query string false "YYYY-MM-DD, default: today"
// @Success 200 {array} TaskWithStatusResponse
// @Failure 400 {object} ErrorResponse
// @Router /tasks [get]
func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	dateStr := r.URL.Query().Get("date")
	date := time.Now()
	if dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid date format, use YYYY-MM-DD"}, http.StatusBadRequest)
			return
		}
		date = parsed
	}

	tasks, err := h.taskRepo.ListForDate(userID, date)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	if err := h.attachSubTasksForDate(tasks, userID, date); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	response := make([]TaskWithStatusResponse, len(tasks))
	for i, t := range tasks {
		response[i] = toTaskWithStatusResponse(t)
	}

	util.SendData(w, response, http.StatusOK)
}