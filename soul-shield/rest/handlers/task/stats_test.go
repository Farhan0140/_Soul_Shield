package task

import (
	"soulsheld/repo"
	"testing"
	"time"
)

func row(date, status string, category string) repo.TaskWithStatus {
	t := repo.TaskWithStatus{Date: date, Status: status}
	if category != "" {
		c := category
		t.CategoryName = &c
	}
	return t
}

func TestComputePersonalStats(t *testing.T) {
	today := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC) // a Wednesday

	t.Run("empty history", func(t *testing.T) {
		s := computePersonalStats(nil, today)
		if s.TotalTasks != 0 || s.CompletionRate != 0 || s.Streak != 0 || s.BestWeekday != nil || s.FavoriteCategory != nil {
			t.Fatalf("unexpected %+v", s)
		}
	})

	t.Run("rate, streak through yesterday, favourite category, best weekday", func(t *testing.T) {
		items := []repo.TaskWithStatus{
			row("2026-11-18", "pending", "Prayer"), // today not done yet: streak counts from yesterday
			row("2026-11-17", "completed", "Prayer"),
			row("2026-11-16", "completed", "Quran"),
			row("2026-11-16", "completed", "Prayer"),
			row("2026-11-15", "missed", ""),
			row("2026-11-14", "completed", "Quran"), // after the gap: not part of the streak
		}
		s := computePersonalStats(items, today)
		if s.TotalTasks != 6 || s.TotalCompleted != 4 {
			t.Fatalf("totals %d/%d", s.TotalCompleted, s.TotalTasks)
		}
		if s.CompletionRate != 67 {
			t.Fatalf("rate %d, want 67", s.CompletionRate)
		}
		if s.Streak != 2 {
			t.Fatalf("streak %d, want 2", s.Streak)
		}
		if s.FavoriteCategory == nil || *s.FavoriteCategory != "Prayer" || s.FavoriteCategoryCount != 2 {
			t.Fatalf("favourite %v/%d", s.FavoriteCategory, s.FavoriteCategoryCount)
		}
		if s.BestWeekday == nil || *s.BestWeekday != int(time.Monday) { // 2026-11-16 had 2 completions
			t.Fatalf("best weekday %v, want Monday", s.BestWeekday)
		}
	})

	t.Run("streak includes today when today is done", func(t *testing.T) {
		items := []repo.TaskWithStatus{row("2026-11-18", "completed", ""), row("2026-11-17", "completed", "")}
		if s := computePersonalStats(items, today); s.Streak != 2 {
			t.Fatalf("streak %d, want 2", s.Streak)
		}
	})
}
