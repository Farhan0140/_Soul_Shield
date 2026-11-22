package sync

import (
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"time"

	"soulsheld/util"
)

// PullGlobal godoc
//
// @Summary Pull fixed tasks (no login)
// @Description Admin-created fixed (is_global) tasks and their sub-tasks changed since `since`
// @Description (soft-deleted included, as tombstones), plus the categories those tasks belong to.
// @Description Public: no authentication, and it never returns anyone's personal data. The mobile
// @Description app uses it to show fixed tasks to people using the app without an account;
// @Description signed-in devices get the same rows from GET /sync.
// @Tags Sync
// @Produce json
// @Param since query string false "RFC3339 timestamp - omit for a full pull"
// @Success 200 {object} repo.GlobalSnapshot
// @Failure 400 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Router /sync/global [get]
func (h *Handler) PullGlobal(w http.ResponseWriter, r *http.Request) {
	if ok, retryAfter := h.globalByIP.Allow(util.ClientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
		util.SendError(w, map[string]string{"error": util.ErrTooManyAttempts.Error()}, http.StatusTooManyRequests)
		return
	}

	since := time.Time{}
	if raw := r.URL.Query().Get("since"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid 'since' timestamp - use RFC3339"}, http.StatusBadRequest)
			return
		}
		since = parsed
	}

	snapshot, err := h.syncRepo.PullGlobalChanges(since)
	if err != nil {
		slog.Error("global sync pull failed", "error", err)
		util.SendError(w, map[string]string{"error": "Failed to pull fixed tasks"}, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	util.SendData(w, snapshot, http.StatusOK)
}
