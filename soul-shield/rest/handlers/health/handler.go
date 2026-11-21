// Package health serves the readiness check: is the server up AND can it
// reach its database?
//
// It sits next to GET /healthz (rest/server.go), which is a pure liveness
// probe that never touches the database. Keep Render's health check on
// /healthz: pointing it here would wake the Neon database on every probe and
// get the instance restarted whenever the database is briefly slow.
package health

import (
	"context"
	"log/slog"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"time"
)

// dbTimeout bounds the database ping. Generous enough for a Neon cold start,
// short enough that a caller gets an answer well before the write timeout.
const dbTimeout = 5 * time.Second

// Pinger is the slice of *sqlx.DB this handler needs (kept small for tests).
type Pinger interface {
	PingContext(ctx context.Context) error
}

type Handler struct {
	db      Pinger
	started time.Time
	now     func() time.Time
}

func NewHandler(db Pinger) *Handler {
	return &Handler{db: db, started: time.Now(), now: time.Now}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager) {
	mux.Handle("GET /health", manager.With(http.HandlerFunc(h.Health)))
}

type CheckResult struct {
	// "ok" or "down".
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	// Present only when Status is "down". Deliberately generic: the real
	// driver error goes to the server log, not to the public response.
	Error string `json:"error,omitempty"`
}

type Response struct {
	// "ok" when every check passed, otherwise "unavailable".
	Status        string                 `json:"status"`
	Time          string                 `json:"time"`
	UptimeSeconds int64                  `json:"uptime_seconds"`
	Checks        map[string]CheckResult `json:"checks"`
}

// Health godoc
//
// @Summary Server health check
// @Description Reports whether the API is running and can reach its database.
// @Description Returns 200 when every check passes, 503 when any check fails.
// @Description No authentication. For a liveness probe that skips the
// @Description database, use GET /healthz.
// @Tags Health
// @Produce json
// @Success 200 {object} Response
// @Failure 503 {object} Response
// @Router /health [get]
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	db := h.checkDatabase(r.Context())

	resp := Response{
		Status:        "ok",
		Time:          h.now().UTC().Format(time.RFC3339),
		UptimeSeconds: int64(h.now().Sub(h.started).Seconds()),
		Checks:        map[string]CheckResult{"database": db},
	}
	code := http.StatusOK
	if db.Status != "ok" {
		resp.Status = "unavailable"
		code = http.StatusServiceUnavailable
	}

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	util.SendData(w, resp, code)
}

func (h *Handler) checkDatabase(parent context.Context) CheckResult {
	ctx, cancel := context.WithTimeout(parent, dbTimeout)
	defer cancel()

	start := h.now()
	err := h.db.PingContext(ctx)
	latency := h.now().Sub(start).Milliseconds()

	if err != nil {
		slog.Error("health check: database ping failed", "error", err, "latency_ms", latency)
		return CheckResult{Status: "down", LatencyMs: latency, Error: "database unreachable"}
	}
	return CheckResult{Status: "ok", LatencyMs: latency}
}
