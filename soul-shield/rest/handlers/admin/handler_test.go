package admin

import (
	"soulsheld/repo"
	"testing"
	"time"
)

func TestScheduledDays(t *testing.T) {
	from := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC) // Sunday
	to := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)  // Saturday, 2 full weeks
	if n := scheduledDays([]int64{0, 1, 2, 3, 4, 5, 6}, from, to); n != 14 {
		t.Fatalf("daily: %d, want 14", n)
	}
	if n := scheduledDays([]int64{5}, from, to); n != 2 { // Fridays
		t.Fatalf("fridays: %d, want 2", n)
	}
	if n := scheduledDays(nil, from, to); n != 0 {
		t.Fatalf("none: %d", n)
	}
}

func TestBuildStatsResponse(t *testing.T) {
	from := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC) // 7 days
	o := &repo.AdminOverview{
		TotalUsers: 10, ActiveUsers: 4,
		Tasks: []repo.AdminTaskUsage{
			{UUID: "a", Title: "Fajr", RecurrenceDays: []int64{0, 1, 2, 3, 4, 5, 6}, Completions: 14, Users: 3},
			{UUID: "b", Title: "Jumuah", RecurrenceDays: []int64{5}, Completions: 9, Users: 4}, // > opportunities: capped
		},
	}
	resp := buildStatsResponse(o, 7, from, to)
	if resp.Tasks[0].Opportunities != 28 || resp.Tasks[0].CompletionRate != 50 {
		t.Fatalf("daily task: %+v", resp.Tasks[0])
	}
	if resp.Tasks[1].Opportunities != 4 || resp.Tasks[1].CompletionRate != 100 {
		t.Fatalf("weekly task: %+v", resp.Tasks[1])
	}
	if resp.From != "2026-11-01" || resp.To != "2026-11-07" {
		t.Fatalf("range %s..%s", resp.From, resp.To)
	}
}
