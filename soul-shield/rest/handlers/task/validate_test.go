package task

import (
	"errors"
	"strings"
	"testing"

	"soulsheld/util"
)

func TestValidateTitle(t *testing.T) {
	if got, err := validateTitle("  Fajr  "); err != nil || got != "Fajr" {
		t.Fatalf("trim: %q, %v", got, err)
	}
	if _, err := validateTitle("   "); !errors.Is(err, util.ErrTitleRequired) {
		t.Fatalf("blank: %v", err)
	}
	// 255 runes of a multi-byte letter is fine; 256 is not.
	if _, err := validateTitle(strings.Repeat("আ", 255)); err != nil {
		t.Fatalf("255 runes: %v", err)
	}
	if _, err := validateTitle(strings.Repeat("আ", 256)); !errors.Is(err, util.ErrTitleTooLong) {
		t.Fatalf("256 runes: %v", err)
	}
}

func TestValidateRecurrenceType(t *testing.T) {
	if err := validateRecurrenceType("daily"); err != nil {
		t.Fatalf("daily: %v", err)
	}
	if err := validateRecurrenceType("hourly"); !errors.Is(err, util.ErrInvalidRecurrenceType) {
		t.Fatalf("hourly: %v", err)
	}
}
