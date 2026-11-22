package feedback

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"strings"
	"testing"
)

type fakeRepo struct {
	guests  map[string]int64
	created []repo.NewFeedback
	items   []repo.FeedbackItem
	unread  int
	marked  bool
}

func newFakeRepo() *fakeRepo { return &fakeRepo{guests: map[string]int64{}} }

func (f *fakeRepo) GuestDeviceID(deviceID string) (int64, error) {
	if id, ok := f.guests[deviceID]; ok {
		return id, nil
	}
	f.guests[deviceID] = int64(len(f.guests) + 1)
	return f.guests[deviceID], nil
}
func (f *fakeRepo) Create(nf repo.NewFeedback) (int64, error) {
	f.created = append(f.created, nf)
	return int64(len(f.created)), nil
}
func (f *fakeRepo) List(limit int, beforeID int64) ([]repo.FeedbackItem, error) {
	out := []repo.FeedbackItem{}
	for _, it := range f.items {
		if (beforeID == 0 || it.ID < beforeID) && len(out) < limit {
			out = append(out, it)
		}
	}
	return out, nil
}
func (f *fakeRepo) Summary() (*repo.RatingSummary, error) {
	return &repo.RatingSummary{Counts: map[string]int{"1": 0, "2": 0, "3": 0, "4": 0, "5": 1}, Total: 1, Average: 5}, nil
}
func (f *fakeRepo) UnreadCount() (int, error) { return f.unread, nil }
func (f *fakeRepo) MarkAllRead() error         { f.marked = true; f.unread = 0; return nil }

const deviceA = "3F0C1A52-8E1B-4F7E-9D43-2A1B5C6D7E8F"

func submit(t *testing.T, h *Handler, body string, userID int64) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/feedback", strings.NewReader(body))
	if userID != 0 {
		req = req.WithContext(middlewares.WithUser(req.Context(), userID, "user"))
	}
	rec := httptest.NewRecorder()
	h.Submit(rec, req)
	return rec
}

func TestSubmitGuestGetsStableGuestNumber(t *testing.T) {
	fr := newFakeRepo()
	h := NewHandler(fr)

	for range 2 {
		rec := submit(t, h, `{"rating":4,"device_id":"`+deviceA+`","platform":"android"}`, 0)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
		}
	}
	rec := submit(t, h, `{"rating":2,"device_id":"11111111-2222-3333-4444-555555555555"}`, 0)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d", rec.Code)
	}

	if len(fr.created) != 3 {
		t.Fatalf("created %d, want 3", len(fr.created))
	}
	// Same device (any letter case) -> same guest; another device -> next number.
	if *fr.created[0].GuestDeviceID != 1 || *fr.created[1].GuestDeviceID != 1 || *fr.created[2].GuestDeviceID != 2 {
		t.Fatalf("guest ids: %d %d %d", *fr.created[0].GuestDeviceID, *fr.created[1].GuestDeviceID, *fr.created[2].GuestDeviceID)
	}
	if fr.created[0].UserID != nil || fr.created[0].Message != nil || *fr.created[0].Platform != "android" {
		t.Fatalf("unexpected submission: %+v", fr.created[0])
	}
}

func TestSubmitSignedInIgnoresDeviceID(t *testing.T) {
	fr := newFakeRepo()
	rec := submit(t, NewHandler(fr), `{"rating":5,"message":"  Love it  ","device_id":"`+deviceA+`"}`, 42)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	got := fr.created[0]
	if got.UserID == nil || *got.UserID != 42 || got.GuestDeviceID != nil {
		t.Fatalf("submitter: %+v", got)
	}
	if got.Message == nil || *got.Message != "Love it" {
		t.Fatalf("message not trimmed: %v", got.Message)
	}
	if len(fr.guests) != 0 {
		t.Fatal("a signed-in submission must not create a guest device")
	}
}

func TestSubmitRejectsBadInput(t *testing.T) {
	cases := map[string]string{
		"rating 0":         `{"rating":0,"device_id":"` + deviceA + `"}`,
		"rating 6":         `{"rating":6,"device_id":"` + deviceA + `"}`,
		"guest, no device": `{"rating":3}`,
		"bad device":       `{"rating":3,"device_id":"not-a-uuid"}`,
		"too long":         `{"rating":3,"device_id":"` + deviceA + `","message":"` + strings.Repeat("a", 2001) + `"}`,
		"not json":         `rating=3`,
	}
	for name, body := range cases {
		fr := newFakeRepo()
		if rec := submit(t, NewHandler(fr), body, 0); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, rec.Code)
		}
		if len(fr.created) != 0 {
			t.Errorf("%s: saved anyway", name)
		}
	}
	// Exactly 2000 characters (multi-byte) is allowed.
	fr := newFakeRepo()
	body := `{"rating":3,"message":"` + strings.Repeat("ক", 2000) + `"}`
	if rec := submit(t, NewHandler(fr), body, 7); rec.Code != http.StatusCreated {
		t.Fatalf("2000 runes: status %d", rec.Code)
	}
}

func TestSubmitIsRateLimited(t *testing.T) {
	h := NewHandler(newFakeRepo())
	last := 0
	for range 11 {
		last = submit(t, h, `{"rating":5}`, 1).Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("11th submission: %d, want 429", last)
	}
}

func TestListPaginatesAndMarkRead(t *testing.T) {
	fr := newFakeRepo()
	for id := int64(5); id >= 1; id-- {
		fr.items = append(fr.items, repo.FeedbackItem{ID: id, Rating: 5, Submitter: repo.GuestName(id)})
	}
	fr.unread = 3
	h := NewHandler(fr)

	rec := httptest.NewRecorder()
	h.List(rec, httptest.NewRequest(http.MethodGet, "/admin/feedback?limit=2", nil))
	var page ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 2 || page.Items[0].ID != 5 || page.NextBefore != 4 || page.Unread != 3 || page.Summary.Total != 1 {
		t.Fatalf("page 1: %+v", page)
	}
	if page.Items[0].Submitter != "guest-user-5" {
		t.Fatalf("submitter %q", page.Items[0].Submitter)
	}

	rec = httptest.NewRecorder()
	h.List(rec, httptest.NewRequest(http.MethodGet, "/admin/feedback?limit=2&before=2", nil))
	page = ListResponse{}
	_ = json.Unmarshal(rec.Body.Bytes(), &page)
	if len(page.Items) != 1 || page.Items[0].ID != 1 || page.NextBefore != 0 {
		t.Fatalf("last page: %+v", page)
	}

	rec = httptest.NewRecorder()
	h.List(rec, httptest.NewRequest(http.MethodGet, "/admin/feedback?limit=500", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("limit=500: %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	h.MarkAllRead(rec, httptest.NewRequest(http.MethodPost, "/admin/feedback/read", nil))
	if rec.Code != http.StatusNoContent || !fr.marked {
		t.Fatalf("mark read: %d %v", rec.Code, fr.marked)
	}
}
