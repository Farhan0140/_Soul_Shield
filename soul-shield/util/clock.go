package util

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// TimezoneHeader carries the caller's IANA timezone (e.g. "Asia/Dhaka").
// Both clients send it on every request so "today" (the missed-vs-pending
// boundary, the default date for complete/increment, the future-date guard)
// is the USER's calendar day, not the server's (Render runs on UTC, which is
// still "yesterday" for a Bangladesh user until 06:00 local time).
const TimezoneHeader = "X-Timezone"

// DateLayout is the wire format of every task date.
const DateLayout = "2006-01-02"

var locationCache sync.Map // name -> *time.Location

// RequestLocation returns the caller's timezone, or UTC when the header is
// missing or not a valid IANA name (older clients; the previous behaviour).
func RequestLocation(r *http.Request) *time.Location {
	loc, _ := requestLocation(r)
	return loc
}

func requestLocation(r *http.Request) (*time.Location, bool) {
	name := strings.TrimSpace(r.Header.Get(TimezoneHeader))
	if name == "" || len(name) > 64 {
		return time.UTC, false
	}
	if cached, ok := locationCache.Load(name); ok {
		return cached.(*time.Location), true
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC, false
	}
	locationCache.Store(name, loc)
	return loc, true
}

// earliestZone is the furthest-ahead offset in use (UTC+14, Line Islands):
// no user anywhere can legitimately be on a later calendar day than this.
var earliestZone = time.FixedZone("UTC+14", 14*60*60)

// RequestLatestDate is the latest task date the caller may record progress
// for: their own today when they sent a valid X-Timezone, otherwise the
// latest "today" anywhere on Earth (so an older client without the header is
// never wrongly refused, while far-future dates still are).
func RequestLatestDate(r *http.Request) time.Time {
	if loc, ok := requestLocation(r); ok {
		return TodayIn(loc)
	}
	return TodayIn(earliestZone)
}

// TodayIn returns today's calendar date in loc, as a UTC-midnight time.Time —
// the same shape time.Parse(DateLayout, ...) produces for client-supplied
// dates, so the two compare and format identically.
func TodayIn(loc *time.Location) time.Time {
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// RequestToday is TodayIn(RequestLocation(r)).
func RequestToday(r *http.Request) time.Time {
	return TodayIn(RequestLocation(r))
}
