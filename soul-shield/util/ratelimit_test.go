package util

import (
	"testing"
	"time"
)

func newTestLimiter(limit int, window time.Duration, clock *time.Time) *RateLimiter {
	return &RateLimiter{
		limit:  limit,
		window: window,
		hits:   make(map[string][]time.Time),
		now:    func() time.Time { return *clock },
	}
}

func TestRateLimiterAllowsUpToLimitThenBlocks(t *testing.T) {
	clock := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	l := newTestLimiter(3, time.Minute, &clock)

	for i := 1; i <= 3; i++ {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("hit %d should be allowed", i)
		}
	}
	ok, retry := l.Allow("a")
	if ok {
		t.Fatal("4th hit within the window should be blocked")
	}
	if retry != time.Minute {
		t.Fatalf("retryAfter = %v, want %v", retry, time.Minute)
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("keys must be limited independently")
	}
}

func TestRateLimiterWindowSlides(t *testing.T) {
	clock := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	l := newTestLimiter(2, time.Minute, &clock)

	l.Allow("a")
	clock = clock.Add(30 * time.Second)
	l.Allow("a")
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("should be blocked with 2 hits in the last minute")
	}

	// The first hit expires 60s after it happened; the second is still counted.
	clock = clock.Add(31 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("should be allowed once the oldest hit left the window")
	}
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("should be blocked again: 2 hits in the last minute")
	}
}

func TestRateLimiterRejectedHitsDoNotExtendLockout(t *testing.T) {
	clock := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	l := newTestLimiter(1, time.Minute, &clock)

	l.Allow("a")
	for i := 0; i < 10; i++ {
		clock = clock.Add(5 * time.Second)
		l.Allow("a") // blocked attempts
	}
	clock = clock.Add(11 * time.Second) // 61s after the only counted hit
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("blocked attempts must not be counted toward the window")
	}
}

func TestValidateNewPassword(t *testing.T) {
	cases := map[string]error{
		"":                       ErrPasswordTooShort,
		"12345":                  ErrPasswordTooShort,
		"123456":                 nil,
		string(make([]byte, 72)): nil,
		string(make([]byte, 73)): ErrPasswordTooLong,
	}
	for pw, want := range cases {
		if got := ValidateNewPassword(pw); got != want {
			t.Errorf("ValidateNewPassword(len %d) = %v, want %v", len(pw), got, want)
		}
	}
}
