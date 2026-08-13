package task

import (
	"net/http"
	"soulsheld/repo"
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

	tasks, err := h.taskRepo.ListForDateByCategory(userID, date, categoryID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	if err := h.attachSubTasksForDate(tasks, userID, date); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	// Completed tasks stay in the list but sort after every active one, so a
	// category page reads "what's left" first without losing what's already
	// done - split-then-recombine here (after attachSubTasksForDate, since a
	// sub-tasked parent's status is only finalized once its sub-task
	// aggregation has been applied) keeps each group's original relative
	// order (is_global, created_at from the repo query) intact.
	sorted := make([]repo.TaskWithStatus, 0, len(tasks))
	completedItems := 0
	for _, t := range tasks {
		if t.Status != util.StatusCompleted {
			sorted = append(sorted, t)
		}
	}
	for _, t := range tasks {
		if t.Status == util.StatusCompleted {
			sorted = append(sorted, t)
			completedItems++
		}
	}

	totalItems := len(sorted)
	totalPages := (totalItems + pageSize - 1) / pageSize
	if totalPages == 0 {
		totalPages = 1
	}

	start := min((page-1)*pageSize, totalItems)
	end := min(start+pageSize, totalItems)
	pageTasks := sorted[start:end]

	response := make([]TaskWithStatusResponse, len(pageTasks))
	for i, t := range pageTasks {
		response[i] = toTaskWithStatusResponse(t)
	}

	util.SendData(w, PaginatedTasksResponse{
		Tasks:          response,
		Page:           page,
		PageSize:       pageSize,
		TotalItems:     totalItems,
		CompletedItems: completedItems,
		TotalPages:     totalPages,
	}, http.StatusOK)
}
