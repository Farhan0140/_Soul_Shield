package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"testing"
	"time"
)

type fakeSyncRepo struct {
	repo.SyncRepo // unused methods panic if called
	gotSince      time.Time
}

func (f *fakeSyncRepo) PullGlobalChanges(since time.Time) (*repo.GlobalSnapshot, error) {
	f.gotSince = since
	return &repo.GlobalSnapshot{
		Cursor:           time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC),
		Tasks:            []repo.SyncTask{{UUID: "g-1", Title: "Fixed", IsGlobal: true}},
		SubTasks:         []repo.SyncSubTask{},
		GlobalCategories: []repo.SyncCategory{},
	}, nil
}

// Routed through the real mux registration, with no Authorization header.
func newGlobalMux(f *fakeSyncRepo) *http.ServeMux {
	mux := http.NewServeMux()
	NewHandler(f).RegisterRoutes(mux, middlewares.NewManager(), &middlewares.Middleware{})
	return mux
}

func TestPullGlobalNeedsNoLogin(t *testing.T) {
	f := &fakeSyncRepo{}
	rec := httptest.NewRecorder()
	newGlobalMux(f).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sync/global?since=2026-11-01T00:00:00Z", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	var body repo.GlobalSnapshot
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Tasks) != 1 || !body.Tasks[0].IsGlobal {
		t.Errorf("tasks = %+v, want the one fixed task", body.Tasks)
	}
	if want := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC); !f.gotSince.Equal(want) {
		t.Errorf("since = %v, want %v", f.gotSince, want)
	}
}

func TestPullGlobalRejectsBadSince(t *testing.T) {
	rec := httptest.NewRecorder()
	newGlobalMux(&fakeSyncRepo{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sync/global?since=yesterday", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestPullGlobalIsRateLimited(t *testing.T) {
	h := NewHandler(&fakeSyncRepo{})
	h.globalByIP = util.NewRateLimiter(2, time.Minute)

	codes := []int{}
	for i := 0; i < 3; i++ {
		rec := httptest.NewRecorder()
		h.PullGlobal(rec, httptest.NewRequest(http.MethodGet, "/sync/global", nil))
		codes = append(codes, rec.Code)
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != http.StatusTooManyRequests {
		t.Errorf("status codes = %v, want [200 200 429]", codes)
	}
}
