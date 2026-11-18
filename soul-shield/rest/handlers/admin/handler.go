// Package admin serves admin-only, read-only reporting endpoints.
package admin

import (
	"log/slog"
	"net/http"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
	"time"
)

type Handler struct {
	stats repo.AdminStatsRepo
}

func NewHandler(stats repo.AdminStatsRepo) *Handler {
	return &Handler{stats: stats}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle(
		"GET /admin/stats",
		// With() wraps in order, so AuthenticateJWT (last) runs first and
		// sets the role RequireRole checks.
		manager.With(
			http.HandlerFunc(h.Stats),
			mw.RequireRole("admin"),
			mw.AuthenticateJWT,
		),
	)
}

type TaskUsageResponse struct {
	// TaskID is the task's uuid (the same task_id the task list endpoints return).
	TaskID      string `json:"task_id"`
	Title       string `json:"title"`
	Completions int    `json:"completions"`
	Users       int    `json:"users"`
	AddedBy     int    `json:"added_by"`
	// Opportunities = scheduled days in the window x active users.
	Opportunities  int `json:"opportunities"`
	CompletionRate int `json:"completion_rate"`
}

type StatsResponse struct {
	Days        int                 `json:"days"`
	From        string              `json:"from"`
	To          string              `json:"to"`
	TotalUsers  int                 `json:"total_users"`
	NewUsers    int                 `json:"new_users"`
	ActiveToday int                 `json:"active_today"`
	ActiveUsers int                 `json:"active_users"`
	Tasks       []TaskUsageResponse `json:"tasks"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// Stats godoc
//
// @Summary Admin usage statistics
// @Description Real usage numbers across ALL users for the last `days` days (default 30, max 366):
// @Description user counts, daily/period active users, and per fixed task: completions, distinct users,
// @Description how many users added it to their own tasks, and a completion rate
// @Description (completions / (scheduled days x active users)). Admins only.
// @Tags Admin
// @Security BearerAuth
// @Produce json
// @Param days query int false "Window size in days (1-366), default 30"
// @Success 200 {object} StatsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/stats [get]
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	days := 30
	if v := r.URL.Query().Get("days"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 || parsed > 366 {
			util.SendError(w, map[string]string{"error": "days must be between 1 and 366"}, http.StatusBadRequest)
			return
		}
		days = parsed
	}

	to := util.RequestToday(r)
	from := to.AddDate(0, 0, -(days - 1))

	overview, err := h.stats.Overview(from, to)
	if err != nil {
		slog.Error("admin stats failed", "error", err)
		util.SendError(w, map[string]string{"error": "Failed to load statistics"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, buildStatsResponse(overview, days, from, to), http.StatusOK)
}

func buildStatsResponse(o *repo.AdminOverview, days int, from, to time.Time) StatsResponse {
	resp := StatsResponse{
		Days:        days,
		From:        from.Format(util.DateLayout),
		To:          to.Format(util.DateLayout),
		TotalUsers:  o.TotalUsers,
		NewUsers:    o.NewUsers,
		ActiveToday: o.ActiveToday,
		ActiveUsers: o.ActiveUsers,
		Tasks:       make([]TaskUsageResponse, len(o.Tasks)),
	}
	for i, t := range o.Tasks {
		opportunities := scheduledDays(t.RecurrenceDays, from, to) * o.ActiveUsers
		resp.Tasks[i] = TaskUsageResponse{
			TaskID:         t.UUID,
			Title:          t.Title,
			Completions:    t.Completions,
			Users:          t.Users,
			AddedBy:        t.AddedBy,
			Opportunities:  opportunities,
			CompletionRate: percent(t.Completions, opportunities),
		}
	}
	return resp
}

// scheduledDays counts the days in [from, to] whose weekday is in recurrence.
func scheduledDays(recurrence []int64, from, to time.Time) int {
	on := [7]bool{}
	for _, d := range recurrence {
		if d >= 0 && d < 7 {
			on[d] = true
		}
	}
	n := 0
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if on[d.Weekday()] {
			n++
		}
	}
	return n
}

func percent(part, whole int) int {
	if whole <= 0 {
		return 0
	}
	p := int(float64(part)*100/float64(whole) + 0.5)
	if p > 100 {
		p = 100
	}
	return p
}
