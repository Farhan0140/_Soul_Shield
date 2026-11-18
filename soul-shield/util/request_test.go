package util

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.0.0.9:5555"

	if got := clientIP(req, 0); got != "10.0.0.9" {
		t.Fatalf("no header: %q", got)
	}

	// The client forged "6.6.6.6"; the one trusted proxy appended the real address.
	req.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.7")
	if got := clientIP(req, 0); got != "6.6.6.6" {
		t.Fatalf("hops=0 keeps the old leftmost behaviour, got %q", got)
	}
	if got := clientIP(req, 1); got != "203.0.113.7" {
		t.Fatalf("hops=1: %q, want the proxy-appended address", got)
	}
	if got := clientIP(req, 2); got != "6.6.6.6" {
		t.Fatalf("hops=2: %q", got)
	}
	if got := clientIP(req, 3); got != "10.0.0.9" {
		t.Fatalf("more hops than entries falls back to RemoteAddr, got %q", got)
	}
}
