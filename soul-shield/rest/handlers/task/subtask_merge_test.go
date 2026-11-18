package task

import (
	"encoding/json"
	"os"
	"path/filepath"
	"soulsheld/repo"
	"testing"
)

// The same fixture file is run against the mobile app's TypeScript port
// (soul-shield-mobile-app/tests/parent-status.test.mjs) so the two
// implementations of this rule can't silently drift apart.
type parentStatusFixture struct {
	Cases []struct {
		Name     string   `json:"name"`
		Statuses []string `json:"statuses"`
		Date     string   `json:"date"`
		Today    string   `json:"today"`
		Expected string   `json:"expected"`
	} `json:"cases"`
}

func TestComputeParentStatusSharedFixture(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "shared-test-fixtures", "parent-status.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var fixture parentStatusFixture
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if len(fixture.Cases) == 0 {
		t.Fatal("fixture has no cases")
	}

	for _, c := range fixture.Cases {
		subs := make([]repo.SubTaskWithStatus, len(c.Statuses))
		for i, s := range c.Statuses {
			subs[i] = repo.SubTaskWithStatus{Status: s}
		}
		if got := computeParentStatus(subs, c.Date, c.Today); got != c.Expected {
			t.Errorf("%s: got %q, want %q", c.Name, got, c.Expected)
		}
	}
}
