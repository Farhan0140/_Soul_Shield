package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCorsAllowList(t *testing.T) {
	h := Cors([]string{"https://soul-shield.vercel.app"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	cases := []struct {
		origin, want string
	}{
		{"https://soul-shield.vercel.app", "https://soul-shield.vercel.app"},
		{"https://evil.example", ""},
		{"", ""},
	}
	for _, c := range cases {
		req := httptest.NewRequest("GET", "/tasks", nil)
		if c.origin != "" {
			req.Header.Set("Origin", c.origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != c.want {
			t.Errorf("origin %q: ACAO = %q, want %q", c.origin, got, c.want)
		}
		if rec.Header().Get("Vary") != "Origin" {
			t.Errorf("origin %q: missing Vary: Origin", c.origin)
		}
	}
}

func TestCorsWildcard(t *testing.T) {
	h := Cors([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://anything.test")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://anything.test" {
		t.Fatalf("wildcard: ACAO = %q", got)
	}
}
