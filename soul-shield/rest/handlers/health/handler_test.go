package health

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"soulsheld/rest/middlewares"
	"strings"
	"testing"
	"time"
)

type fakePinger struct {
	err      error
	deadline bool
}

func (f *fakePinger) PingContext(ctx context.Context) error {
	_, f.deadline = ctx.Deadline()
	return f.err
}

func serve(t *testing.T, p Pinger) (*httptest.ResponseRecorder, Response) {
	t.Helper()
	h := NewHandler(p)
	h.started = time.Now().Add(-90 * time.Second)

	rec := httptest.NewRecorder()
	h.Health(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	var body Response
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %v (%q)", err, rec.Body.String())
	}
	return rec, body
}

func TestHealthOK(t *testing.T) {
	p := &fakePinger{}
	rec, body := serve(t, p)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body.Status != "ok" || body.Checks["database"].Status != "ok" {
		t.Errorf("body = %+v, want status ok with database ok", body)
	}
	if body.UptimeSeconds < 90 {
		t.Errorf("uptime_seconds = %d, want >= 90", body.UptimeSeconds)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", got)
	}
	if !p.deadline {
		t.Error("database ping ran without a timeout")
	}
}

func TestHealthDatabaseDown(t *testing.T) {
	rec, body := serve(t, &fakePinger{err: errors.New("dial tcp 10.0.0.5:5432: connection refused")})

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	db := body.Checks["database"]
	if body.Status != "unavailable" || db.Status != "down" {
		t.Errorf("body = %+v, want unavailable with database down", body)
	}
	if strings.Contains(rec.Body.String(), "10.0.0.5") {
		t.Error("response leaks the raw database error")
	}
}

func TestHealthRoute(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(&fakePinger{}).RegisterRoutes(mux, middlewares.NewManager())

	get := httptest.NewRecorder()
	mux.ServeHTTP(get, httptest.NewRequest(http.MethodGet, "/health", nil))
	if get.Code != http.StatusOK {
		t.Errorf("GET /health = %d, want 200", get.Code)
	}

	post := httptest.NewRecorder()
	mux.ServeHTTP(post, httptest.NewRequest(http.MethodPost, "/health", nil))
	if post.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /health = %d, want 405", post.Code)
	}
}
