package util

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestTodayIn(t *testing.T) {
	dhaka, err := time.LoadLocation("Asia/Dhaka")
	if err != nil {
		t.Skip("tz database unavailable:", err)
	}
	got := TodayIn(dhaka)
	now := time.Now().In(dhaka)
	if got.Format(DateLayout) != now.Format(DateLayout) {
		t.Fatalf("TodayIn(Dhaka) = %s, want %s", got.Format(DateLayout), now.Format(DateLayout))
	}
	if got.Location() != time.UTC || got.Hour() != 0 {
		t.Fatalf("TodayIn must return UTC midnight (same shape as time.Parse of a date), got %v", got)
	}
}

func TestRequestLocationFallsBackToUTC(t *testing.T) {
	for _, header := range []string{"", "Not/A_Zone", "../../etc/passwd"} {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set(TimezoneHeader, header)
		if loc := RequestLocation(req); loc != time.UTC {
			t.Fatalf("header %q: got %v, want UTC", header, loc)
		}
	}
}

func TestRequestLatestDate(t *testing.T) {
	// Without a timezone, no real user anywhere can be on a later day than
	// UTC+14 - the guard must allow that day (and nothing later).
	req := httptest.NewRequest("GET", "/", nil)
	if got, want := RequestLatestDate(req), TodayIn(earliestZone); !got.Equal(want) {
		t.Fatalf("no header: %v, want %v", got, want)
	}

	req.Header.Set(TimezoneHeader, "UTC")
	if got, want := RequestLatestDate(req), TodayIn(time.UTC); !got.Equal(want) {
		t.Fatalf("UTC header: %v, want %v", got, want)
	}
}

func TestValidateEmailAndName(t *testing.T) {
	for _, ok := range []string{"a@b.co", "first.last+tag@example.com"} {
		if err := ValidateEmail(ok); err != nil {
			t.Errorf("%q rejected: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "plain", "a@b", "Name <a@b.co>", "a@b.co ", "@b.co"} {
		if ValidateEmail(bad) == nil {
			t.Errorf("%q accepted", bad)
		}
	}
	if ValidateFullName("") == nil {
		t.Error("empty name accepted")
	}
	// 100 multi-byte characters is fine (the column counts characters, not bytes).
	if err := ValidateFullName(string(make([]rune, 0)) + repeatRune('ফ', 100)); err != nil {
		t.Errorf("100 Bangla characters rejected: %v", err)
	}
	if ValidateFullName(repeatRune('a', 101)) == nil {
		t.Error("101 characters accepted")
	}
}

func repeatRune(r rune, n int) string {
	out := make([]rune, n)
	for i := range out {
		out[i] = r
	}
	return string(out)
}
