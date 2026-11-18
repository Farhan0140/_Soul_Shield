package task

import (
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/util"
	"time"
)

// MaxHistoryDays caps GET /tasks/history: one request can't make the server
// expand decades of recurrence (S6).
const MaxHistoryDays = 366

// viewDate parses an optional YYYY-MM-DD query/body value for READ endpoints,
// defaulting to the caller's today (their X-Timezone, see util/clock.go).
func viewDate(w http.ResponseWriter, r *http.Request, raw string) (time.Time, bool) {
	if raw == "" {
		return util.RequestToday(r), true
	}
	parsed, err := time.Parse(util.DateLayout, raw)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid date format, use YYYY-MM-DD"}, http.StatusBadRequest)
		return time.Time{}, false
	}
	return parsed, true
}

// actionDate is viewDate for WRITE endpoints (complete / increment /
// uncomplete): additionally refuses dates after the caller's today, so no
// client can record progress for a day that hasn't happened yet (B8).
func actionDate(w http.ResponseWriter, r *http.Request, raw string) (time.Time, bool) {
	date, ok := viewDate(w, r, raw)
	if !ok {
		return time.Time{}, false
	}
	if date.After(util.RequestLatestDate(r)) {
		util.SendError(w, map[string]string{"error": util.ErrFutureDate.Error()}, http.StatusBadRequest)
		return time.Time{}, false
	}
	return date, true
}

// sendCompletionError maps a task complete/increment/uncomplete repo error to
// its HTTP response.
func sendCompletionError(w http.ResponseWriter, r *http.Request, err error, fallback string) {
	switch {
	case errors.Is(err, util.ErrTaskNotFound):
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
	case errors.Is(err, util.ErrForbidden):
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
	case errors.Is(err, util.ErrTaskNotScheduled),
		errors.Is(err, util.ErrNotCounterTask),
		errors.Is(err, util.ErrTaskHasSubTasks),
		errors.Is(err, util.ErrInvalidIncrementAmount):
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
	default:
		slog.Error(fallback, "path", r.URL.Path, "error", err)
		util.SendError(w, map[string]string{"error": fallback}, http.StatusInternalServerError)
	}
}
