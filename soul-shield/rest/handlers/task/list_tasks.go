package task

import (
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
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
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	dateStr := r.URL.Query().Get("date")
	date, dateOK := viewDate(w, r, dateStr)
	if !dateOK {
		return
	}

	tasks, err := h.taskRepo.ListForDate(userID, date, util.RequestToday(r))
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	if err := h.attachSubTasksForDate(tasks, userID, date, util.RequestToday(r)); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	ownedRefs, err := h.taskRepo.ListOwnedRefs(userID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	response := make([]TaskWithStatusResponse, len(tasks))
	for i, t := range tasks {
		resp := toTaskWithStatusResponse(t)
		if t.IsGlobal {
			resp.AlreadyAdded = isAlreadyAddedByUser(t.TaskID, t.Title, ownedRefs)
		}
		response[i] = resp
	}

	util.SendData(w, response, http.StatusOK)
}
