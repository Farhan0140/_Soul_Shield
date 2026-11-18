package util

import (
	"sync"
	"time"
)

// RateLimiter is a small in-memory sliding-window limiter: at most `limit`
// hits per key within `window`. It's meant for the unauthenticated auth
// endpoints (login, register, password reset), where each attempt costs a
// bcrypt hash and unlimited attempts would allow password guessing.
//
// State lives in this process only — fine for the single Render instance this
// API runs on. If the API is ever scaled horizontally, move this to a shared
// store (e.g. Redis) so the limit applies across instances.
type RateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string][]time.Time
	now    func() time.Time // overridable in tests
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	l := &RateLimiter{
		limit:  limit,
		window: window,
		hits:   make(map[string][]time.Time),
		now:    time.Now,
	}
	go l.janitor()
	return l
}

// Allow records a hit for key and reports whether it is within the limit.
// When it isn't, retryAfter is how long until the oldest counted hit expires.
// Rejected hits are not recorded, so hammering a limited key doesn't extend
// its lockout.
func (l *RateLimiter) Allow(key string) (allowed bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	recent := pruneOlderThan(l.hits[key], now.Add(-l.window))

	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false, recent[0].Add(l.window).Sub(now)
	}

	l.hits[key] = append(recent, now)
	return true, 0
}

// janitor drops keys whose hits have all expired so the map can't grow
// without bound from one-off IPs/emails.
func (l *RateLimiter) janitor() {
	ticker := time.NewTicker(l.window)
	defer ticker.Stop()
	for range ticker.C {
		l.mu.Lock()
		cutoff := l.now().Add(-l.window)
		for key, hits := range l.hits {
			if recent := pruneOlderThan(hits, cutoff); len(recent) == 0 {
				delete(l.hits, key)
			} else {
				l.hits[key] = recent
			}
		}
		l.mu.Unlock()
	}
}

// pruneOlderThan returns the hits at or after cutoff (hits are in time order).
func pruneOlderThan(hits []time.Time, cutoff time.Time) []time.Time {
	i := 0
	for i < len(hits) && hits[i].Before(cutoff) {
		i++
	}
	return hits[i:]
}
