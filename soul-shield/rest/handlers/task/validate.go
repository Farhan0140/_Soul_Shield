package task

import (
	"soulsheld/util"
	"strings"
	"unicode/utf8"
)

// validateTitle mirrors the tasks.title column: non-empty, at most 255
// characters. Returns the trimmed title.
func validateTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", util.ErrTitleRequired
	}
	if utf8.RuneCountInString(title) > 255 {
		return "", util.ErrTitleTooLong
	}
	return title, nil
}

// validateRecurrenceType mirrors the tasks.recurrence_type CHECK.
func validateRecurrenceType(rt string) error {
	switch rt {
	case util.RecurrenceDaily, util.RecurrenceWeekly, util.RecurrenceCustom:
		return nil
	}
	return util.ErrInvalidRecurrenceType
}
