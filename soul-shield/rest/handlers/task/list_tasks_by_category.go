package task

import (
	"net/http"
	"soulsheld/util"
	"strconv"
	"time"
)

const defaultTaskPageSize = 10
const maxTaskPageSize = 100

// ListTasksByCategory godoc
//
// @Summary List a category's tasks for a date, paginated
// @Description date না দিলে আজকের তারিখ ধরা হবে। page (default 1) আর page_size (default 10, max 100) দিয়ে pagination হয়।
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param categoryId path int true "Category ID"
// @Param date query string false "YYYY-MM-DD, default: today"
// @Param page query int false "default: 1"
// @Param page_size query int false "default: 10"
// @Success 200 {object} PaginatedTasksResponse
// @Failure 400 {object} ErrorResponse
// @Router /categories/{categoryId}/tasks [get]
func (h *Handler) ListTasksByCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	categoryID, err := strconv.ParseInt(r.PathValue("categoryId"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid category id"}, http.StatusBadRequest)
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

	page := 1
	if v := r.URL.Query().Get("page"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 {
			util.SendError(w, map[string]string{"error": "Invalid page"}, http.StatusBadRequest)
			return
		}
		page = parsed
	}

	pageSize := defaultTaskPageSize
	if v := r.URL.Query().Get("page_size"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 || parsed > maxTaskPageSize {
			util.SendError(w, map[string]string{"error": "Invalid page_size"}, http.StatusBadRequest)
			return
		}
		pageSize = parsed
	}

	tasks, totalItems, err := h.taskRepo.ListForDateByCategory(userID, date, categoryID, pageSize, (page-1)*pageSize)
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

	totalPages := (totalItems + pageSize - 1) / pageSize
	if totalPages == 0 {
		totalPages = 1
	}

	util.SendData(w, PaginatedTasksResponse{
		Tasks:      response,
		Page:       page,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	}, http.StatusOK)
}
