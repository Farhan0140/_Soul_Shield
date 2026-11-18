package task

import (
	"log/slog"
	"net/http"
	"sort"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
	"time"
)

// PersonalStatsResponse is the Profile page summary, computed on the server
// (C3) instead of shipping a year of per-day task history to the browser.
type PersonalStatsResponse struct {
	Days                  int     `json:"days" example:"365"`
	TotalTasks            int     `json:"total_tasks" example:"1200"`
	TotalCompleted        int     `json:"total_completed" example:"900"`
	CompletionRate        int     `json:"completion_rate" example:"75"`
	Streak                int     `json:"streak" example:"12"`
	FavoriteCategory      *string `json:"favorite_category,omitempty" example:"Prayer"`
	FavoriteCategoryCount int     `json:"favorite_category_count" example:"300"`
	// BestWeekday: 0 = Sunday ... 6 = Saturday; omitted with no completions.
	BestWeekday *int `json:"best_weekday,omitempty" example:"5"`
}

// PersonalStats godoc
//
// @Summary Personal statistics
// @Description Completion rate, current streak, favourite category and best weekday over the last `days` days
// @Description (default 365, max 366), using the same per-day statuses as /tasks/history.
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param days query int false "Window size in days (1-366), default 365"
// @Success 200 {object} PersonalStatsResponse
// @Failure 400 {object} ErrorResponse
// @Router /tasks/stats [get]
func (h *Handler) PersonalStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	days := 365
	if v := r.URL.Query().Get("days"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 || parsed > MaxHistoryDays {
			util.SendError(w, map[string]string{"error": "days must be between 1 and 366"}, http.StatusBadRequest)
			return
		}
		days = parsed
	}

	today := util.RequestToday(r)
	from := today.AddDate(0, 0, -(days - 1))

	tasks, err := h.taskRepo.ListForRange(userID, from, today, today)
	if err == nil {
		err = h.attachSubTasksForRange(tasks, userID, from, today, today)
	}
	if err != nil {
		slog.Error("personal stats failed", "user_id", userID, "error", err)
		util.SendError(w, map[string]string{"error": "Failed to load statistics"}, http.StatusInternalServerError)
		return
	}

	stats := computePersonalStats(tasks, today)
	stats.Days = days
	util.SendData(w, stats, http.StatusOK)
}

// computePersonalStats aggregates per-day task statuses. Streak = consecutive
// days with at least one completion, ending today (or yesterday, so the
// streak doesn't read 0 before today's first completion).
func computePersonalStats(items []repo.TaskWithStatus, today time.Time) PersonalStatsResponse {
	var stats PersonalStatsResponse
	stats.TotalTasks = len(items)

	completedDates := map[string]bool{}
	categoryCounts := map[string]int{}
	weekdayCounts := [7]int{}
	for _, t := range items {
		if t.Status != util.StatusCompleted {
			continue
		}
		stats.TotalCompleted++
		completedDates[t.Date] = true
		if t.CategoryName != nil && *t.CategoryName != "" {
			categoryCounts[*t.CategoryName]++
		}
		if d, err := time.Parse(util.DateLayout, t.Date); err == nil {
			weekdayCounts[d.Weekday()]++
		}
	}

	if stats.TotalTasks > 0 {
		stats.CompletionRate = int(float64(stats.TotalCompleted)*100/float64(stats.TotalTasks) + 0.5)
	}

	day := today
	if !completedDates[day.Format(util.DateLayout)] {
		day = day.AddDate(0, 0, -1)
	}
	for completedDates[day.Format(util.DateLayout)] {
		stats.Streak++
		day = day.AddDate(0, 0, -1)
	}

	// Deterministic tie-break (alphabetical) so the answer doesn't flicker.
	names := make([]string, 0, len(categoryCounts))
	for name := range categoryCounts {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		if categoryCounts[name] > stats.FavoriteCategoryCount {
			n := name
			stats.FavoriteCategory = &n
			stats.FavoriteCategoryCount = categoryCounts[name]
		}
	}

	best, bestCount := 0, 0
	for wd, c := range weekdayCounts {
		if c > bestCount {
			best, bestCount = wd, c
		}
	}
	if bestCount > 0 {
		stats.BestWeekday = &best
	}
	return stats
}
